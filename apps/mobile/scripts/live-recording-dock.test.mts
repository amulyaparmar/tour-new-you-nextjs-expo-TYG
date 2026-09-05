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
      Animated: {
        View: "Animated.View",
        Value: class MockAnimatedValue {
          constructor(value) { this.value = value; }
          stopAnimation() {}
          setValue(value) { this.value = value; }
        },
        timing: (value, config) => ({ value, config }),
        sequence: (animations) => ({ animations }),
        loop: (animation) => ({ animation, start() {}, stop() {} }),
      },
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
    "../components/custom-text": { CustomText: "Text" },
    "../components/liquid-glass": { getLiquidGlassView: () => "GlassView" },
    "../theme/tokens": { ACCENT: "blue", CARD: "white", HINT: "#E8F1FC", SMALL_CORNER: 16, LARGE_CORNER: 32 },
    "../theme/tour-brand": { tourColors: { text: "#101828", textSec: "#667085", textMuted: "#8a94a6", border: "rgba(16, 24, 40, 0.08)" } },
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
  function render(recordingPatch: Record<string, any> = {}) {
    Object.assign(context, recordingPatch);
    let passes = 0;
    do {
      assert.ok(++passes < 10, "Unexpected render loop");
      dirty = false;
      cursor = 0;
      root = module.exports.LiveRecordingDock();
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

test("the dock keeps open and pause controls while recording", () => {
  const dock = createDock();
  assert.ok(dock.root);
  assert.deepEqual(dock.nodes.filter((node) => node.props.accessibilityRole === "button")
    .map((node) => node.props.accessibilityLabel), [
    "Open live tour with Sam", "Pause recording",
  ]);
  assert.ok(dock.text.includes("01:04"));
  assertNoRecordingControls(dock);
  dock.dispose();
});

test("no recording and absent metadata still suppress the dock", () => {
  for (const provider of [{ isRecording: false }, { liveMeta: null }]) {
    const dock = createDock({}, provider);
    assert.equal(dock.root, null);
    assertNoRecordingControls(dock);
    dock.dispose();
  }
});

test("expanded and minimized round trips retain the same dock layout without recording controls", () => {
  const dock = createDock();
  const type = dock.root!.type;
  const styles = dock.root!.props.style;
  const nodes = dock.nodes.map((node) => node.type);
  const text = dock.text;
  dock.render({ experienceVisible: true });
  assert.ok(dock.root);
  assert.equal(dock.root.type, type);
  assert.deepEqual(dock.root.props.style, styles);
  assert.deepEqual(dock.nodes.map((node) => node.type), nodes);
  assert.deepEqual(dock.text, text);
  assert.equal(dock.root.props.pointerEvents, "none");
  assert.equal(dock.root.props.accessibilityElementsHidden, true);
  assert.equal(dock.root.props.importantForAccessibility, "no-hide-descendants");
  dock.render({ experienceVisible: false });
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
  dock.render({ elapsed: 92, isPaused: true });
  assert.ok(dock.root);
  assert.ok(dock.text.includes("Recording paused"));
  assert.ok(dock.text.includes("01:32"));
  assert.ok(dock.find("Resume recording"));
  assert.equal(dock.root.props.pointerEvents, "none");
  assertNoRecordingControls(dock);
  dock.dispose();
});

test("App stacks the live dock with the tab bar inside MainTabs", () => {
  const appSource = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
  const mainTabs = appSource.match(/function MainTabs\([\s\S]*?\nfunction ErrorBanner/);
  assert.ok(mainTabs, "MainTabs should own the tab bar");
  const dockIndex = mainTabs[0].indexOf("<LiveRecordingDock");
  const tabIndex = mainTabs[0].indexOf("st.tabBar");
  assert.ok(dockIndex >= 0, "LiveRecordingDock should render inside MainTabs");
  assert.ok(tabIndex >= 0, "MainTabs should still render the tab bar");
  assert.ok(dockIndex < tabIndex, "The dock should sit directly above the tab bar");
  assert.match(mainTabs[0], /!practiceLive/);
  assert.doesNotMatch(
    appSource,
    /<RecordingExperienceHost \/>\s*<BulkUploadDock[\s\S]{0,400}<LiveRecordingDock/,
  );
});
