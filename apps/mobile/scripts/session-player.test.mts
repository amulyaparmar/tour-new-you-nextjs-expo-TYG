import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import { runInNewContext } from "node:vm";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const source = readFileSync(new URL("../src/components/session/session-player.tsx", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;

type Node = { type: string; props: Record<string, any> };

// Execute the actual component with lightweight native-view/hook mocks. These
// tests check its controls and responder contract, not UIKit gesture arbitration.
function render(overrides: Record<string, any> = {}) {
  const seeks: number[] = [];
  const scrubbing: boolean[] = [];
  const cleanups: (() => void)[] = [];
  const effects: (() => void | (() => void))[] = [];
  const callbacks = { toggles: 0, speeds: 0 };
  const jsx = (type: string, props: Record<string, any>): Node => ({ type, props });
  const mocks: Record<string, any> = {
    "react/jsx-runtime": { jsx, jsxs: jsx },
    react: { useRef: (current: any) => ({ current }), useEffect: (effect: () => void) => effects.push(effect) },
    "react-native": { View: "View", Pressable: "Pressable", StyleSheet: { create: (styles: any) => styles, hairlineWidth: 0.5 } },
    "react-native-safe-area-context": { useSafeAreaInsets: () => ({ bottom: 34 }) },
    "lucide-react-native": { Pause: "Pause", Play: "Play", RotateCcw: "RotateCcw", RotateCw: "RotateCw" },
    "@/components/custom-text": { CustomText: "Text" },
    "@/components/loading-dots": { LoadingDots: "LoadingDots" },
    "@/components/ui/icon": { Icon: "Icon" },
    "@/components/ui/motion": { MotionPressable: "MotionPressable" },
    "@/theme/tokens": { ACCENT: "blue", CARD: "white", TEXT: "black" },
    "@/theme/tour-brand": { tourColors: { textSec: "gray" } },
    "./session-layout": { SESSION_PAGE_PADDING: 16 },
  };
  const module = { exports: {} as any };
  runInNewContext(compiled, {
    exports: module.exports,
    require: (name: string) => {
      assert.ok(name in mocks, `Unexpected dependency: ${name}`);
      return mocks[name];
    },
  });
  const root: Node = module.exports.SessionPlayer({
    position: 20, duration: 100, playing: false, speed: 1, ready: true, progressPercent: 20,
    onToggle: () => callbacks.toggles++, onSpeed: () => callbacks.speeds++,
    onSeek: (ratio: number) => seeks.push(ratio), onScrubbingChange: (value: boolean) => scrubbing.push(value),
    ...overrides,
  });
  for (const effect of effects) {
    const cleanup = effect();
    if (cleanup) cleanups.push(cleanup);
  }
  function flatten(node: any): Node[] {
    if (!node || typeof node !== "object") return [];
    if (Array.isArray(node)) return node.flatMap(flatten);
    return [node, ...flatten(node.props?.children)];
  }
  const nodes = flatten(root);
  const find = (label: string) => {
    const node = nodes.find((item) => item.props.accessibilityLabel === label);
    assert.ok(node, `Missing control: ${label}`);
    return node.props;
  };
  return { root, nodes, find, seeks, scrubbing, callbacks, unmount: () => cleanups.forEach((cleanup) => cleanup()) };
}

const touch = (x: number) => ({ nativeEvent: { locationX: x } });

test("wider left play button precedes rewind, forward and speed", () => {
  const ui = render();
  const buttons = ui.nodes.filter((node) => node.props.accessibilityRole === "button");
  assert.deepEqual(buttons.map((node) => node.props.accessibilityLabel), [
    "Play recording", "Rewind 5 seconds", "Forward 5 seconds", "Playback speed 1 times",
  ]);
  assert.ok(ui.find("Play recording").style.minWidth >= 96);
  ui.find("Play recording").onPress();
  ui.find("Playback speed 1 times").onPress();
  assert.equal(ui.callbacks.toggles, 1);
  assert.equal(ui.callbacks.speeds, 1);
});

test("player occupies layout space, clears the home indicator, and avoids the edge-back strip", () => {
  const ui = render();
  const dock = Object.assign({}, ...ui.root.props.style);
  assert.equal(dock.position, undefined);
  assert.equal(dock.flexShrink, 0);
  assert.equal(dock.paddingBottom, 34);
  const track = ui.find("Recording playhead");
  assert.ok(dock.paddingHorizontal + track.style.marginHorizontal >= 32);
  assert.equal(track.hitSlop, undefined);
});

test("skip controls clamp to the recording's start and end", () => {
  const start = render({ position: 2 });
  start.find("Rewind 5 seconds").onPress();
  start.find("Forward 5 seconds").onPress();
  assert.deepEqual(start.seeks, [0, 0.07]);
  const end = render({ position: 98 });
  end.find("Forward 5 seconds").onPress();
  assert.deepEqual(end.seeks, [1]);
});

test("scrubbing locks navigation at touch-down and unlocks after release", () => {
  const ui = render();
  const track = ui.find("Recording playhead");
  track.onLayout({ nativeEvent: { layout: { width: 200 } } });
  track.onTouchStart();
  track.onResponderGrant(touch(20));
  track.onResponderMove(touch(150));
  assert.equal(track.onResponderTerminationRequest(), false);
  assert.deepEqual(ui.scrubbing, [true]);
  track.onResponderRelease(touch(220));
  track.onTouchEnd();
  assert.deepEqual(ui.scrubbing, [true, false]);
  assert.deepEqual(ui.seeks, [0.1, 0.75, 1]);
});

test("cancel, responder termination and unmount all release the scrubbing lock", () => {
  for (const finish of ["onTouchCancel", "onResponderTerminate", "unmount"]) {
    const ui = render();
    const track = ui.find("Recording playhead");
    track.onTouchStart();
    if (finish === "unmount") ui.unmount();
    else track[finish]();
    assert.deepEqual(ui.scrubbing, [true, false], finish);
  }
});

test("disabled and unknown-duration audio cannot seek or capture drags", () => {
  for (const props of [{ ready: false }, { duration: 0 }]) {
    const ui = render(props);
    const track = ui.find("Recording playhead");
    assert.equal(track.onStartShouldSetResponder(), false);
    track.onTouchStart();
    ui.find("Rewind 5 seconds").onPress();
    ui.find("Forward 5 seconds").onPress();
    assert.deepEqual(ui.seeks, []);
    assert.deepEqual(ui.scrubbing, []);
  }
});

test("VoiceOver can adjust playback in five-second steps", () => {
  const ui = render();
  const track = ui.find("Recording playhead");
  track.onAccessibilityAction({ nativeEvent: { actionName: "increment" } });
  track.onAccessibilityAction({ nativeEvent: { actionName: "decrement" } });
  track.onAccessibilityAction({ nativeEvent: { actionName: "unknown" } });
  assert.deepEqual(ui.seeks, [0.25, 0.15]);
  assert.equal(track.accessibilityValue.text, "0:20 of 1:40");
});

test("pause, loading and failed states have accurate accessible controls", () => {
  assert.equal(render({ playing: true }).find("Pause recording").disabled, false);
  assert.equal(render({ ready: false }).find("Loading recording").accessibilityState.busy, true);
  const failed = render({ ready: false, error: "Could not load audio", onRetry: () => {} });
  assert.equal(failed.find("Recording unavailable").accessibilityState.busy, false);
  assert.equal(failed.find("Could not load audio Retry loading recording").disabled, false);
});
