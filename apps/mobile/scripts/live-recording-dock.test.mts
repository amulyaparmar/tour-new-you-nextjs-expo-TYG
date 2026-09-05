import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import { runInNewContext } from "node:vm";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const source = readFileSync(new URL("../src/recording/LiveRecordingDock.tsx", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;

type NativeNode = { type: string; props: Record<string, any> };
type Hook = { value?: any; deps?: any[]; cleanup?: () => void };

function loadHelper(relativePath: string) {
  const helper = readFileSync(new URL(relativePath, import.meta.url), "utf8");
  const output = ts.transpileModule(helper, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const exports: Record<string, any> = {};
  runInNewContext(output, { exports });
  return exports;
}

// Render the actual TSX with React-style state/effect lifetimes. This tests dock
// visibility and recording ownership, not native glass rendering or touch layout.
function createDock(initialProps: Record<string, any> = {}, initialRecording: Record<string, any> = {}) {
  const hooks: Hook[] = [];
  const pendingEffects: (() => void)[] = [];
  const controls: Record<string, number> = {
    expand: 0, pause: 0, stop: 0, cancel: 0, finish: 0, minimize: 0,
  };
  const transparencyListeners = new Set<(enabled: boolean) => void>();
  const alerts: string[] = [];
  let cursor = 0;
  let dirty = false;
  let root: NativeNode | null = null;
  let props = { resetKey: "main:home", bottomInset: 80, ...initialProps };
  const context: Record<string, any> = {
    isRecording: true,
    isPaused: false,
    elapsed: 64,
    experienceVisible: false,
    liveMeta: { title: "Current tour", prospectName: "Sam", propertyName: "Community" },
    localId: "local-tour",
    draft: { participants: [{ name: "Sam" }], prospect: "Sam", notes: "Keep my notes" },
    expandExperience: () => controls.expand++,
    togglePause: async () => { controls.pause++; },
    stop: () => controls.stop++,
    stopRecording: () => controls.stop++,
    cancelRecording: () => controls.cancel++,
    finishRecording: () => controls.finish++,
    minimizeExperience: () => controls.minimize++,
    ...initialRecording,
  };
  function slot() { return hooks[cursor++] ?? (hooks[cursor - 1] = {}); }
  function equalDeps(left?: any[], right?: any[]) {
    return Boolean(left && right && left.length === right.length
      && left.every((value, index) => Object.is(value, right[index])));
  }
  const jsx = (type: string, props: Record<string, any>): NativeNode => ({ type, props });
  const mocks: Record<string, any> = {
    "react/jsx-runtime": { jsx, jsxs: jsx },
    react: {
      useState: (initialValue: any) => {
        const hook = slot();
        if (!("value" in hook)) hook.value = typeof initialValue === "function" ? initialValue() : initialValue;
        return [hook.value, (next: any) => {
          const value = typeof next === "function" ? next(hook.value) : next;
          if (!Object.is(value, hook.value)) { hook.value = value; dirty = true; }
        }];
      },
      useRef: (initialValue: any) => {
        const hook = slot();
        if (!("value" in hook)) hook.value = { current: initialValue };
        return hook.value;
      },
      useMemo: (factory: () => any, deps: any[]) => {
        const hook = slot();
        if (!equalDeps(hook.deps, deps)) { hook.value = factory(); hook.deps = deps; }
        return hook.value;
      },
      useEffect: (callback: () => any, deps: any[]) => {
        const hook = slot();
        if (equalDeps(hook.deps, deps)) return;
        hook.deps = deps;
        pendingEffects.push(() => { hook.cleanup?.(); hook.cleanup = callback(); });
      },
    },
    "@expo/vector-icons": { Ionicons: "Ionicons" },
    "expo-blur": { BlurView: "BlurView" },
    "react-native": {
      View: "View", Pressable: "Pressable", Text: "Text", ActivityIndicator: "ActivityIndicator",
      Platform: { OS: "ios" },
      StyleSheet: { create: (styles: any) => styles, absoluteFill: { position: "absolute" }, hairlineWidth: 0.5 },
      Alert: { alert: (title: string) => alerts.push(title) },
      AccessibilityInfo: {
        isReduceTransparencyEnabled: () => ({ then: (callback: (enabled: boolean) => void) => {
          callback(true);
          return { catch: () => {} };
        } }),
        addEventListener: (_name: string, callback: (enabled: boolean) => void) => {
          transparencyListeners.add(callback);
          return { remove: () => transparencyListeners.delete(callback) };
        },
      },
    },
    "react-native-safe-area-context": { useSafeAreaInsets: () => ({ bottom: 34 }) },
    "../components/liquid-glass": { getLiquidGlassView: () => "GlassView" },
    "./formatElapsed": loadHelper("../src/recording/formatElapsed.ts"),
    "./liveSessionLabel": loadHelper("../src/recording/liveSessionLabel.ts"),
    "./RecordingProvider": { useRecording: () => context },
  };
  const module = { exports: {} as any };
  runInNewContext(compiled, {
    exports: module.exports,
    require: (name: string) => {
      assert.ok(name in mocks, `Unexpected dependency: ${name}`);
      return mocks[name];
    },
  });
  function render(propsPatch: Record<string, any> = {}, recordingPatch: Record<string, any> = {}) {
    props = { ...props, ...propsPatch };
    Object.assign(context, recordingPatch);
    let passes = 0;
    do {
      assert.ok(++passes < 10, "Unexpected render loop");
      dirty = false;
      cursor = 0;
      root = module.exports.LiveRecordingDock(props);
      while (pendingEffects.length) pendingEffects.shift()!();
    } while (dirty);
    return root;
  }
  function flatten(node: any): NativeNode[] {
    if (!node || typeof node !== "object") return [];
    if (Array.isArray(node)) return node.flatMap(flatten);
    return [node, ...flatten(node.props?.children)];
  }
  render();
  return {
    context, controls, alerts, transparencyListeners, render,
    get root() { return root; },
    get nodes() { return flatten(root); },
    get text() { return flatten(root).filter((node) => node.type === "Text").map((node) => node.props.children); },
    find(label: string) {
      const control = flatten(root).find((node) => node.props.accessibilityLabel === label);
      assert.ok(control, `Missing control: ${label}`);
      return control.props;
    },
    dispose: () => { for (const hook of hooks) hook.cleanup?.(); },
  };
}

function assertNoRecordingControls(dock: ReturnType<typeof createDock>) {
  assert.deepEqual(dock.controls, { expand: 0, pause: 0, stop: 0, cancel: 0, finish: 0, minimize: 0 });
  assert.deepEqual(dock.alerts, []);
}

test("hidden dock renders no surface, overlay or controls", () => {
  const dock = createDock({ hidden: true });
  assert.equal(dock.root, null);
  assert.deepEqual(dock.nodes, []);
  assertNoRecordingControls(dock);
  assert.equal(dock.context.isRecording, true);
  assert.equal(dock.context.experienceVisible, false);
  dock.dispose();
});

test("hidden defaults false and the normal dock keeps all three controls", () => {
  const dock = createDock();
  assert.ok(dock.root);
  assert.deepEqual(dock.nodes.filter((node) => node.props.accessibilityRole === "button")
    .map((node) => node.props.accessibilityLabel), [
    "Open live tour with Sam", "Pause recording", "Hide live session bar",
  ]);
  assert.ok(dock.text.includes("01:04"));
  assertNoRecordingControls(dock);
  dock.dispose();
});

test("show then hidden then show restores the mounted dock without touching recording", () => {
  const dock = createDock();
  const recording = dock.context;
  const draft = recording.draft;
  assert.equal(dock.transparencyListeners.size, 1);
  dock.render({ hidden: true });
  assert.equal(dock.root, null);
  assert.equal(dock.transparencyListeners.size, 1, "Hiding should not unmount the dock");
  dock.render({ hidden: false });
  assert.ok(dock.root);
  assert.ok(dock.find("Pause recording"));
  assert.equal(dock.context, recording);
  assert.equal(dock.context.draft, draft);
  assert.equal(dock.context.localId, "local-tour");
  assertNoRecordingControls(dock);
  dock.dispose();
});

test("hidden dock uses the provider's current elapsed time and paused state when shown again", () => {
  const dock = createDock();
  dock.render({ hidden: true }, { elapsed: 90 });
  dock.render({}, { elapsed: 145, isPaused: true });
  assert.equal(dock.root, null);
  assertNoRecordingControls(dock);
  dock.render({ hidden: false });
  assert.ok(dock.find("Resume recording"));
  assert.ok(dock.text.includes("Recording paused"));
  assert.ok(dock.text.includes("02:25"));
  dock.render({ hidden: true }, { isPaused: false, elapsed: 146 });
  dock.render({}, { elapsed: 160 });
  dock.render({ hidden: false });
  assert.ok(dock.find("Pause recording"));
  assert.ok(dock.text.includes("Recording live"));
  assert.ok(dock.text.includes("02:40"));
  assertNoRecordingControls(dock);
  dock.dispose();
});

test("no recording and absent metadata still suppress the dock", () => {
  for (const provider of [{ isRecording: false }, { liveMeta: null }]) {
    const dock = createDock({ hidden: false }, provider);
    assert.equal(dock.root, null);
    dock.render({ hidden: true });
    dock.render({ hidden: false });
    assert.equal(dock.root, null);
    assertNoRecordingControls(dock);
    dock.dispose();
  }
});

test("explicit X remains local dismissal and a reset key brings the dock back", () => {
  const dock = createDock();
  dock.find("Hide live session bar").onPress();
  dock.render();
  assert.equal(dock.root, null);
  assertNoRecordingControls(dock);
  dock.render({ hidden: true });
  dock.render({ hidden: false });
  assert.equal(dock.root, null, "Route suppression alone must not clear explicit dismissal");
  dock.render({ resetKey: "main:sessions" });
  assert.ok(dock.root);
  assert.ok(dock.find("Open live tour with Sam"));
  assertNoRecordingControls(dock);
  dock.dispose();
});

test("explicit dismissal persists while opening and closing; a new recording restores the dock", () => {
  const dock = createDock();
  dock.find("Hide live session bar").onPress();
  dock.render();
  assert.equal(dock.root, null);
  dock.render({}, { experienceVisible: true });
  assert.equal(dock.root, null);
  dock.render({}, { experienceVisible: false });
  assert.equal(dock.root, null);
  dock.render({}, { localId: "local-next-tour" });
  assert.ok(dock.root);
  assertNoRecordingControls(dock);
  dock.dispose();
});

test("expanded and minimized round trips retain the same dock layout without recording controls", () => {
  const dock = createDock();
  const type = dock.root!.type;
  const styles = dock.root!.props.style;
  const nodes = dock.nodes.map((node) => node.type);
  const text = dock.text;
  dock.render({}, { experienceVisible: true });
  assert.ok(dock.root);
  assert.equal(dock.root.type, type);
  assert.deepEqual(dock.root.props.style, styles);
  assert.deepEqual(dock.nodes.map((node) => node.type), nodes);
  assert.deepEqual(dock.text, text);
  assert.equal(dock.root.props.pointerEvents, "none");
  assert.equal(dock.root.props.accessibilityElementsHidden, true);
  assert.equal(dock.root.props.importantForAccessibility, "no-hide-descendants");
  dock.render({}, { experienceVisible: false });
  assert.ok(dock.root);
  assert.equal(dock.root.type, type);
  assert.deepEqual(dock.root.props.style, styles);
  assert.deepEqual(dock.nodes.map((node) => node.type), nodes);
  assert.notEqual(dock.root.props.pointerEvents, "none");
  assert.notEqual(dock.root.props.accessibilityElementsHidden, true);
  assert.notEqual(dock.root.props.importantForAccessibility, "no-hide-descendants");
  assertNoRecordingControls(dock);
  dock.dispose();
});

test("active and paused docks keep updating behind the expanded recording surface", () => {
  const dock = createDock({}, { experienceVisible: true });
  assert.ok(dock.root);
  assert.ok(dock.text.includes("Recording live"));
  dock.render({}, { elapsed: 92, isPaused: true });
  assert.ok(dock.root);
  assert.ok(dock.text.includes("Recording paused"));
  assert.ok(dock.text.includes("01:32"));
  assert.ok(dock.find("Resume recording"));
  assert.equal(dock.root.props.pointerEvents, "none");
  assertNoRecordingControls(dock);
  dock.dispose();
});

test("session-route hiding takes precedence over the expanded recorder", () => {
  const dock = createDock({ hidden: true }, { experienceVisible: true });
  assert.equal(dock.root, null);
  dock.render({}, { experienceVisible: false });
  assert.equal(dock.root, null);
  dock.render({ hidden: false }, { experienceVisible: true });
  assert.ok(dock.root);
  assert.equal(dock.root.props.pointerEvents, "none");
  assertNoRecordingControls(dock);
  dock.dispose();
});

test("App hides the dock for every session route, but not main tabs or recording creation", () => {
  const appSource = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
  const ast = ts.createSourceFile("App.tsx", appSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const routeTypes: string[] = [];
  const hiddenExpressions: string[] = [];
  function visit(node: any) {
    if (ts.isTypeAliasDeclaration(node) && node.name.text === "Screen") {
      for (const member of node.type.types) {
        const type = member.members.find((property: any) => property.name?.getText(ast) === "type");
        assert.ok(type && ts.isLiteralTypeNode(type.type) && ts.isStringLiteral(type.type.literal));
        routeTypes.push(type.type.literal.text);
      }
    }
    if ((ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node))
      && node.tagName.getText(ast) === "LiveRecordingDock") {
      const hidden = node.attributes.properties.find((attribute: any) =>
        ts.isJsxAttribute(attribute) && attribute.name.text === "hidden");
      assert.ok(hidden?.initializer && ts.isJsxExpression(hidden.initializer), "Dock needs an explicit route visibility prop");
      hiddenExpressions.push(hidden.initializer.expression.getText(ast));
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.equal(hiddenExpressions.length, 1);
  assert.ok(routeTypes.filter((route) => route.startsWith("session-")).length >= 7);
  const hiddenFor = (screen: Record<string, any>) => runInNewContext(hiddenExpressions[0], { screen });
  for (const type of routeTypes) {
    assert.equal(hiddenFor({ type }), type.startsWith("session-"), type);
  }
  for (const tab of ["home", "sessions", "tour", "materials", "practice"]) {
    assert.equal(hiddenFor({ type: "main", tab }), false, `main:${tab}`);
  }
  assert.equal(hiddenFor({ type: "create-session" }), false);
  assert.equal(hiddenFor({ type: "session-transcript" }), true, "New session review routes should inherit suppression");
});
