import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import { runInNewContext } from "node:vm";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const source = readFileSync(new URL("../src/recording/LiveRecordingCard.tsx", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;

type NativeNode = { type: string; props: Record<string, any> };
type Hook = { value?: any; deps?: any[]; cleanup?: () => void };

function loadHelper(path: string) {
  const helper = readFileSync(new URL(path, import.meta.url), "utf8");
  const output = ts.transpileModule(helper, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const exports: Record<string, any> = {};
  runInNewContext(output, { exports });
  return exports;
}

// Actual card TSX, persistent React hooks, and observable native-animation mocks.
// No UI screenshot or native animation timing is simulated by these tests.
function createCard(initialProps: Record<string, any> = {}, initialRecording: Record<string, any> = {}) {
  const hooks: Hook[] = [];
  const effects: (() => void)[] = [];
  const loops: { starts: number; stops: number; animation: any }[] = [];
  const controls = { expand: 0, pause: 0, stop: 0, cancel: 0, finish: 0, minimize: 0, externalPress: 0 };
  const values: MockAnimatedValue[] = [];
  class MockAnimatedValue {
    value: number;
    stops = 0;
    writes: number[] = [];
    constructor(value: number) { this.value = value; values.push(this); }
    stopAnimation() { this.stops++; }
    setValue(value: number) { this.value = value; this.writes.push(value); }
  }
  let cursor = 0;
  let root: NativeNode | null = null;
  const context: Record<string, any> = {
    isRecording: true,
    isPaused: false,
    elapsed: 64,
    experienceVisible: false,
    liveMeta: { title: "Current tour", prospectName: "Sam Prospect" },
    draft: { participants: [{ name: "Sam Prospect" }], prospect: "Sam Prospect", notes: "Keep notes" },
    expandExperience: () => controls.expand++,
    togglePause: () => controls.pause++,
    stop: () => controls.stop++,
    stopRecording: () => controls.stop++,
    cancelRecording: () => controls.cancel++,
    finishRecording: () => controls.finish++,
    minimizeExperience: () => controls.minimize++,
    ...initialRecording,
  };
  let props = { onPress: () => controls.externalPress++, ...initialProps };
  function slot() { return hooks[cursor++] ?? (hooks[cursor - 1] = {}); }
  function equalDeps(left?: any[], right?: any[]) {
    return Boolean(left && right && left.length === right.length
      && left.every((value, index) => Object.is(value, right[index])));
  }
  const jsx = (type: string, props: Record<string, any>): NativeNode => ({ type, props });
  const mocks: Record<string, any> = {
    "react/jsx-runtime": { jsx, jsxs: jsx },
    react: {
      useRef: (initialValue: any) => {
        const hook = slot();
        if (!("value" in hook)) hook.value = { current: initialValue };
        return hook.value;
      },
      useEffect: (callback: () => any, deps: any[]) => {
        const hook = slot();
        if (equalDeps(hook.deps, deps)) return;
        hook.deps = deps;
        effects.push(() => { hook.cleanup?.(); hook.cleanup = callback(); });
      },
    },
    "@expo/vector-icons": { Ionicons: "Ionicons" },
    "react-native": {
      View: "View", Pressable: "Pressable",
      StyleSheet: { create: (styles: any) => styles },
      Animated: {
        View: "Animated.View",
        Value: MockAnimatedValue,
        timing: (value: MockAnimatedValue, config: any) => ({ value, config }),
        sequence: (animations: any[]) => ({ animations }),
        loop: (animation: any) => {
          const loop = { starts: 0, stops: 0, animation };
          loops.push(loop);
          return { start: () => loop.starts++, stop: () => loop.stops++ };
        },
      },
    },
    "../components/custom-text": { CustomText: "Text" },
    "../theme/tokens": { ACCENT: "blue", CARD: "white", SMALL_CORNER: 16 },
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
  function flatten(node: any): NativeNode[] {
    if (!node || typeof node !== "object") return [];
    if (Array.isArray(node)) return node.flatMap(flatten);
    return [node, ...flatten(node.props?.children)];
  }
  function render(recordingPatch: Record<string, any> = {}, propsPatch: Record<string, any> = {}) {
    Object.assign(context, recordingPatch);
    props = { ...props, ...propsPatch };
    cursor = 0;
    root = module.exports.LiveRecordingCard(props);
    while (effects.length) effects.shift()!();
    return root;
  }
  render();
  return {
    context, controls, loops, values, render,
    get root() { return root; },
    get nodes() { return flatten(root); },
    get text() { return flatten(root).filter((node) => node.type === "Text").map((node) => node.props.children); },
    style: () => Object.assign({}, ...root!.props.style({ pressed: false }).filter(Boolean)),
    dispose: () => { for (const hook of hooks) hook.cleanup?.(); },
  };
}

function assertNoRecordingControls(card: ReturnType<typeof createCard>) {
  assert.deepEqual(card.controls, { expand: 0, pause: 0, stop: 0, cancel: 0, finish: 0, minimize: 0, externalPress: 0 });
}

test("active card renders its current guest, recording status and timer", () => {
  const card = createCard();
  assert.ok(card.root);
  assert.equal(card.root.type, "Pressable");
  assert.ok(card.text.includes("Sam Prospect"));
  assert.ok(card.text.includes("Recording"));
  assert.ok(card.text.includes("01:04"));
  assert.equal(card.root.props.accessibilityRole, "button");
  assert.equal(card.loops.length, 1);
  assert.equal(card.loops[0].starts, 1);
  assertNoRecordingControls(card);
  card.dispose();
});

test("opening and closing the full recorder retain the same card layout and pulse loop", () => {
  const card = createCard({ style: { marginBottom: 8 } });
  const style = card.style();
  const nodes = card.nodes.map((node) => node.type);
  const loop = card.loops[0];
  const pulse = card.values[0];
  const stopCount = pulse.stops;
  const writes = pulse.writes.length;
  for (const experienceVisible of [true, false, true, false]) {
    card.render({ experienceVisible });
    assert.ok(card.root);
    assert.equal(card.root.type, "Pressable");
    assert.deepEqual(card.style(), style);
    assert.deepEqual(card.nodes.map((node) => node.type), nodes);
    assert.equal(card.loops.length, 1);
    assert.equal(card.loops[0], loop);
    assert.equal(loop.starts, 1);
    assert.equal(loop.stops, 0);
    assert.equal(pulse.stops, stopCount);
    assert.equal(pulse.writes.length, writes);
  }
  assert.equal(style.marginBottom, 8);
  assert.ok(style.minHeight > 0);
  assertNoRecordingControls(card);
  card.dispose();
  assert.equal(loop.stops, 1);
});

test("expanded cards remain rendered but leave touch and accessibility focus to the recorder", () => {
  const card = createCard({}, { experienceVisible: true });
  assert.ok(card.root);
  assert.equal(card.root.props.pointerEvents, "none");
  assert.equal(card.root.props.accessibilityElementsHidden, true);
  assert.equal(card.root.props.importantForAccessibility, "no-hide-descendants");
  card.render({ experienceVisible: false });
  assert.ok(card.root);
  assert.notEqual(card.root.props.pointerEvents, "none");
  assert.notEqual(card.root.props.accessibilityElementsHidden, true);
  assert.notEqual(card.root.props.importantForAccessibility, "no-hide-descendants");
  assertNoRecordingControls(card);
  card.dispose();
});

test("paused cards remain present behind the recorder without starting a pulse loop", () => {
  const card = createCard({}, { isPaused: true });
  assert.ok(card.root);
  assert.ok(card.text.includes("Paused"));
  assert.equal(card.loops.length, 0);
  card.render({ experienceVisible: true, elapsed: 90 });
  assert.ok(card.root);
  assert.ok(card.text.includes("Paused"));
  assert.ok(card.text.includes("01:30"));
  card.render({ experienceVisible: false });
  assert.ok(card.root);
  assert.equal(card.loops.length, 0);
  assertNoRecordingControls(card);
  card.dispose();
});

test("elapsed updates do not recreate the active recording pulse", () => {
  const card = createCard();
  card.render({ elapsed: 70 });
  card.render({ elapsed: 75, experienceVisible: true });
  assert.ok(card.text.includes("01:15"));
  assert.equal(card.loops.length, 1);
  assert.equal(card.loops[0].starts, 1);
  assert.equal(card.loops[0].stops, 0);
  assertNoRecordingControls(card);
  card.dispose();
});

test("pause and resume still control the pulse independently of recorder expansion", () => {
  const card = createCard();
  card.render({ isPaused: true, experienceVisible: true });
  assert.ok(card.root);
  assert.equal(card.loops[0].stops, 1);
  assert.ok(card.text.includes("Paused"));
  card.render({ isPaused: false });
  assert.ok(card.root);
  assert.equal(card.loops.length, 2);
  assert.equal(card.loops[1].starts, 1);
  card.render({ experienceVisible: false });
  assert.equal(card.loops.length, 2);
  assertNoRecordingControls(card);
  card.dispose();
});

test("ended recordings and missing metadata still remove the card", () => {
  for (const invalid of [{ isRecording: false }, { liveMeta: null }]) {
    const card = createCard({}, invalid);
    assert.equal(card.root, null);
    assert.equal(card.loops.length, 0);
    card.render({ experienceVisible: true });
    assert.equal(card.root, null);
    card.render({ experienceVisible: false });
    assert.equal(card.root, null);
    assertNoRecordingControls(card);
    card.dispose();
  }
  const card = createCard();
  card.render({ isRecording: false });
  assert.equal(card.root, null);
  assert.equal(card.loops[0].stops, 1);
  assertNoRecordingControls(card);
  card.dispose();
});

test("tapping the uncovered card still calls the optional route callback and expands once", () => {
  const card = createCard();
  card.root!.props.onPress();
  assert.deepEqual(card.controls, { expand: 1, pause: 0, stop: 0, cancel: 0, finish: 0, minimize: 0, externalPress: 1 });
  card.dispose();
});
