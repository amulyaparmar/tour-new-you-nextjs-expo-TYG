import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import { runInNewContext } from "node:vm";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const source = readFileSync(new URL("../src/recording/useRecordingSheetGesture.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;

type SharedValue<T> = { value: T };

class MockGesture {
  kind: string;
  config: Record<string, any> = {};
  callbacks: Record<string, (...args: any[]) => void> = {};
  constructor(kind: string) { this.kind = kind; }
  enabled(value: boolean) { this.config.enabled = value; return this; }
  maxPointers(value: number) { this.config.maxPointers = value; return this; }
  activeOffsetY(value: number | number[]) {
    this.config.activeOffsetY = Array.isArray(value) ? Array.from(value) : value;
    return this;
  }
  failOffsetX(value: number[]) { this.config.failOffsetX = Array.from(value); return this; }
  onBegin(callback: (...args: any[]) => void) { this.callbacks.begin = callback; return this; }
  onStart(callback: (...args: any[]) => void) { this.callbacks.start = callback; return this; }
  onUpdate(callback: (...args: any[]) => void) { this.callbacks.update = callback; return this; }
  onEnd(callback: (...args: any[]) => void) { this.callbacks.end = callback; return this; }
  onFinalize(callback: (...args: any[]) => void) { this.callbacks.finalize = callback; return this; }
}

// Exercise the real hook callbacks with lightweight native/hook mocks. Native
// recognizer arbitration, animation timing and scroll physics need device tests.
function render({
  enabled = true,
  scrollable = false,
  initialOffset = 0,
  height = 800,
  initialClosing = false,
  initialProgress = 0,
  scrollResetKey = undefined as string | undefined,
} = {}) {
  const sheetOffset: SharedValue<number> = { value: initialOffset };
  const sheetHeight: SharedValue<number> = { value: height };
  const sheetClosing: SharedValue<boolean> = { value: initialClosing };
  const pullProgress: SharedValue<number> = { value: initialProgress };
  const scrollRef = { current: "native-recording-scroll" };
  const scrolls: { x: number; y: number; animated: boolean }[] = [];
  const canceled: any[] = [];
  const springs: number[] = [];
  const springConfigs: Record<string, any>[] = [];
  const minimizeClosingStates: boolean[] = [];
  const pan = new MockGesture("pan");
  const native = new MockGesture("native");
  const sharedValues: SharedValue<any>[] = [];
  let sharedValueIndex = 0;
  const effectDependencies: any[][] = [];
  let effectIndex = 0;
  let pendingEffects: (() => void)[] = [];
  const mocks: Record<string, any> = {
    react: {
      useMemo: (factory: () => any) => factory(),
      useCallback: (callback: any) => callback,
      useEffect: (effect: () => void, dependencies: any[]) => {
        const index = effectIndex++;
        const previous = effectDependencies[index];
        if (!previous || previous.length !== dependencies.length
          || dependencies.some((dependency: any, i: number) => !Object.is(dependency, previous[i]))) {
          effectDependencies[index] = Array.from(dependencies);
          pendingEffects.push(effect);
        }
      },
    },
    "react-native-gesture-handler": {
      Gesture: {
        Pan: () => pan,
        Native: () => native,
        Simultaneous: (...gestures: MockGesture[]) => ({ kind: "simultaneous", gestures }),
      },
    },
    "react-native-reanimated": {
      __esModule: true,
      ReduceMotion: { System: "system" },
      useSharedValue: (value: any) => {
        const index = sharedValueIndex++;
        sharedValues[index] ??= { value };
        return sharedValues[index];
      },
      useAnimatedScrollHandler: (callback: any) => callback,
      cancelAnimation: (value: any) => canceled.push(value),
      runOnJS: (callback: any) => callback,
      scrollTo: (ref: any, x: number, y: number, animated: boolean) => {
        assert.equal(ref, scrollRef);
        scrolls.push({ x, y, animated });
      },
      withSpring: (value: number, config: Record<string, any>) => {
        springs.push(value);
        springConfigs.push({ ...config });
        return value;
      },
    },
  };
  const module = { exports: {} as any };
  runInNewContext(compiled, {
    exports: module.exports,
    require: (name: string) => {
      assert.ok(name in mocks, `Unexpected dependency: ${name}`);
      return mocks[name];
    },
  });
  let props: Record<string, any> = {
    enabled,
    sheetOffset,
    sheetHeight,
    sheetClosing,
    pullProgress,
    onMinimize: () => minimizeClosingStates.push(sheetClosing.value),
    scrollResetKey,
    ...(scrollable ? { scrollRef } : {}),
  };
  let hook: any;
  function rerender(overrides: Record<string, any> = {}) {
    props = { ...props, ...overrides };
    sharedValueIndex = 0;
    effectIndex = 0;
    pendingEffects = [];
    hook = module.exports.useRecordingSheetGesture(props);
    for (const effect of pendingEffects) effect();
  }
  rerender();
  let beginY = 0;
  const event = (absoluteY: number, velocityY = 0) => ({ absoluteY, translationY: absoluteY - beginY, velocityY });
  return {
    get hook() { return hook; },
    pan, native, sheetOffset, sheetHeight, sheetClosing, pullProgress,
    scrolls, canceled, springs, springConfigs, minimizeClosingStates,
    rerender,
    get minimizations() { return minimizeClosingStates.length; },
    begin: (absoluteY: number) => { beginY = absoluteY; pan.callbacks.begin(event(absoluteY)); },
    move: (absoluteY: number) => pan.callbacks.update(event(absoluteY)),
    offset: (y: number) => {
      const onScroll = typeof hook.onScroll === "function" ? hook.onScroll : hook.onScroll.onScroll;
      onScroll({ contentOffset: { y } });
    },
    end: (velocityY = 0, success = true) => pan.callbacks.end(event(beginY, velocityY), success),
    finalize: (success = true) => pan.callbacks.finalize(event(beginY), success),
  };
}

test("header gets a pan while recording content coordinates native scrolling simultaneously", () => {
  const header = render();
  assert.equal(header.hook.gesture, header.pan);
  const content = render({ scrollable: true });
  assert.equal(content.hook.gesture.kind, "simultaneous");
  assert.deepEqual(content.hook.gesture.gestures, [content.native, content.pan]);
});

test("pan respects enabled state and only captures single-finger vertical movement", () => {
  assert.equal(render().pan.config.enabled, true);
  assert.equal(render({ enabled: false }).pan.config.enabled, false);
  assert.equal(render().pan.config.maxPointers, 1);
  assert.deepEqual(render().pan.config.failOffsetX, [-28, 28]);
});

test("tap and failed activation leave the Host opening animation alone", () => {
  const ui = render({ initialOffset: 180 });
  ui.begin(300);
  assert.equal(ui.canceled.length, 0);
  ui.finalize(false);
  assert.equal(ui.canceled.length, 0);
  assert.equal(ui.springs.length, 0);
  assert.equal(ui.sheetOffset.value, 180);
  assert.equal(ui.minimizations, 0);
});

test("native scrolling does not interrupt the Host or animate the sheet", () => {
  const ui = render({ scrollable: true, initialOffset: 180 });
  ui.offset(200);
  ui.begin(300);
  ui.offset(280);
  ui.move(220);
  ui.end();
  ui.finalize();
  assert.equal(ui.sheetOffset.value, 180);
  assert.equal(ui.pullProgress.value, 0);
  assert.equal(ui.canceled.length, 0);
  assert.equal(ui.springs.length, 0);
  assert.equal(ui.minimizations, 0);
});

test("remounting scroll content with a new key discards the old tab's scroll offset", () => {
  const ui = render({ scrollable: true, scrollResetKey: "summary" });
  ui.offset(120);
  ui.rerender({ scrollResetKey: "transcript" });
  // The remounted native view is already at zero before its first scroll event.
  ui.begin(300);
  ui.move(320);
  assert.equal(ui.sheetOffset.value, 20);
  assert.equal(ui.pullProgress.value, 0.2);
  ui.end();
  assert.equal(ui.minimizations, 0);
});

test("disabling and reenabling around a popup preserves the current tab's scroll offset", () => {
  const ui = render({ scrollable: true, scrollResetKey: "summary" });
  ui.offset(120);
  ui.rerender({ enabled: false });
  assert.equal(ui.pan.config.enabled, false);
  ui.rerender({ enabled: true });
  ui.begin(300);
  ui.move(320);
  assert.equal(ui.sheetOffset.value, 0);
  assert.equal(ui.pullProgress.value, 0);
  assert.equal(ui.canceled.length, 0);
  ui.end(2000);
  assert.equal(ui.minimizations, 0);
});

test("unrelated rerenders retain scroll state until the reset key actually changes", () => {
  const ui = render({ scrollable: true, scrollResetKey: "transcript" });
  ui.offset(120);
  ui.rerender({ scrollResetKey: "transcript" });
  ui.begin(300);
  ui.move(320);
  assert.equal(ui.sheetOffset.value, 0);
  assert.equal(ui.canceled.length, 0);
  ui.finalize(false);
});

test("grabbing a moving opening sheet preserves its current offset on the first pull", () => {
  const ui = render({ initialOffset: 180, initialProgress: 0 });
  ui.begin(300);
  assert.equal(ui.canceled.length, 0);
  ui.move(320);
  assert.ok(ui.canceled.includes(ui.sheetOffset));
  assert.equal(ui.sheetOffset.value, 200);
  assert.equal(ui.pullProgress.value, 1);
  ui.move(330);
  assert.equal(ui.sheetOffset.value, 210);
});

test("a top pull follows the finger in pixels and cancels opening only after pulling begins", () => {
  const ui = render();
  ui.begin(300);
  assert.equal(ui.canceled.length, 0);
  ui.move(340);
  assert.equal(ui.sheetOffset.value, 40);
  assert.equal(ui.pullProgress.value, 0.4);
  assert.ok(ui.canceled.includes(ui.sheetOffset));
  const cancellationCount = ui.canceled.length;
  ui.move(370);
  assert.equal(ui.sheetOffset.value, 70);
  assert.equal(ui.pullProgress.value, 0.7);
  assert.equal(ui.canceled.length, cancellationCount);
});

test("pull offset clamps to viewport height and progress clamps to one", () => {
  const ui = render({ height: 600 });
  ui.begin(200);
  ui.move(1200);
  assert.equal(ui.sheetOffset.value, 600);
  assert.equal(ui.pullProgress.value, 1);
});

test("deep downward scrolling does not count as sheet travel or a fast dismissal", () => {
  const ui = render({ scrollable: true });
  ui.offset(300);
  ui.begin(200);
  ui.offset(180);
  ui.move(320);
  ui.offset(40);
  ui.move(460);
  ui.end(2000);
  assert.equal(ui.sheetOffset.value, 0);
  assert.equal(ui.pullProgress.value, 0);
  assert.equal(ui.canceled.length, 0);
  assert.equal(ui.minimizations, 0);
});

test("continuous scrolling hands off at the top without requiring a finger lift", () => {
  const ui = render({ scrollable: true });
  ui.offset(120);
  ui.begin(300);
  ui.offset(60);
  ui.move(360);
  ui.offset(0);
  ui.move(420);
  assert.equal(ui.sheetOffset.value, 0);
  ui.move(465);
  assert.equal(ui.sheetOffset.value, 45);
  assert.equal(ui.pullProgress.value, 0.45);
  ui.move(515);
  assert.equal(ui.sheetOffset.value, 95);
  ui.end();
  assert.equal(ui.minimizations, 1);
});

test("a large first update consumes content offset before calculating sheet pull", () => {
  const ui = render({ scrollable: true });
  ui.offset(300);
  ui.begin(200);
  ui.offset(0);
  ui.move(510);
  assert.equal(ui.sheetOffset.value, 10);
  ui.end(2000);
  assert.equal(ui.minimizations, 0);
  assert.equal(ui.sheetOffset.value, 0);
});

test("reversing a pull holds content at zero until the sheet returns", () => {
  const ui = render({ scrollable: true });
  ui.begin(300);
  ui.move(360);
  ui.offset(25);
  assert.deepEqual(ui.scrolls.at(-1), { x: 0, y: 0, animated: false });
  ui.move(325);
  assert.equal(ui.sheetOffset.value, 25);
  assert.equal(ui.pullProgress.value, 0.25);
  ui.move(300);
  assert.equal(ui.sheetOffset.value, 0);
  assert.equal(ui.pullProgress.value, 0);
  const scrollCallsAtRest = ui.scrolls.length;
  ui.offset(40);
  ui.move(260);
  assert.equal(ui.scrolls.length, scrollCallsAtRest);
  assert.equal(ui.sheetOffset.value, 0);
  ui.offset(0);
  ui.move(300);
  ui.move(330);
  assert.equal(ui.sheetOffset.value, 30);
  ui.end();
  assert.equal(ui.minimizations, 0);
});

test("short and canceled pulls restore offset and progress without minimizing", () => {
  for (const canceled of [false, true]) {
    const ui = render();
    ui.begin(300);
    ui.move(canceled ? 450 : 350);
    ui.end(canceled ? 2000 : 0, !canceled);
    ui.finalize(!canceled);
    assert.equal(ui.sheetOffset.value, 0);
    assert.equal(ui.pullProgress.value, 0);
    assert.equal(ui.sheetClosing.value, false);
    assert.equal(ui.minimizations, 0);
    assert.ok(ui.springs.includes(0));
    assert.ok(ui.springConfigs.every((config) => config.reduceMotion === "system"));
    assert.ok(ui.springConfigs.every((config) => config.overshootClamping === true));
  }
});

test("picking up a returning interactive pull inherits its current sheet offset", () => {
  const ui = render({ initialOffset: 30, initialProgress: 0.3 });
  ui.begin(300);
  assert.equal(ui.canceled.length, 0);
  ui.move(310);
  assert.equal(ui.sheetOffset.value, 40);
  assert.equal(ui.pullProgress.value, 0.4);
  ui.end();
  assert.equal(ui.sheetOffset.value, 0);
  assert.equal(ui.pullProgress.value, 0);
  assert.equal(ui.minimizations, 0);
});

test("finalize-only cancellation restores an actively pulled sheet", () => {
  const ui = render();
  ui.begin(300);
  ui.move(440);
  ui.finalize(false);
  assert.equal(ui.sheetOffset.value, 0);
  assert.equal(ui.pullProgress.value, 0);
  assert.equal(ui.minimizations, 0);
});

test("fast dismissal requires downward velocity and more than twelve pixels of sheet travel", () => {
  for (const [distance, velocity, expected] of [[12, 2000, 0], [13, 900, 0], [13, 901, 1], [40, -2000, 0]]) {
    const ui = render();
    ui.begin(300);
    ui.move(300 + distance);
    ui.end(velocity);
    assert.equal(ui.minimizations, expected, `distance=${distance}, velocity=${velocity}`);
  }
});

test("long pull threshold is strictly over ninety-two pixels", () => {
  for (const [distance, expected] of [[92, 0], [93, 1]]) {
    const ui = render();
    ui.begin(300);
    ui.move(300 + distance);
    ui.end();
    assert.equal(ui.minimizations, expected);
  }
});

test("accepted pull closes once and marks closing before invoking minimize", () => {
  const ui = render();
  ui.begin(300);
  ui.move(420);
  ui.end();
  assert.deepEqual(ui.minimizeClosingStates, [true]);
  assert.equal(ui.sheetOffset.value, 120);
  ui.end(2000);
  ui.finalize(false);
  ui.begin(400);
  ui.move(700);
  assert.equal(ui.minimizations, 1);
  assert.equal(ui.sheetOffset.value, 120);
  assert.equal(ui.springs.length, 0);
});

test("already-closing Host ignores new gesture callbacks", () => {
  const ui = render({ initialClosing: true, initialOffset: 240, initialProgress: 1 });
  ui.begin(300);
  ui.move(600);
  ui.end(2000);
  ui.finalize(false);
  assert.equal(ui.sheetOffset.value, 240);
  assert.equal(ui.pullProgress.value, 1);
  assert.equal(ui.canceled.length, 0);
  assert.equal(ui.springs.length, 0);
  assert.equal(ui.minimizations, 0);
});
