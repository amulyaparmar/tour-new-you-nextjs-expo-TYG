import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import { runInNewContext } from "node:vm";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const source = readFileSync(new URL("../src/recording/RecordingExperienceHost.tsx", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const gestureSource = readFileSync(new URL("../src/recording/useRecordingSheetGesture.ts", import.meta.url), "utf8");
const gestureAst = ts.createSourceFile("gesture.ts", gestureSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
let finalizeSource = "";
function findFinalize(node: any) {
  if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)
    && node.expression.name.text === "onFinalize") finalizeSource = node.arguments[0].getText(gestureAst);
  ts.forEachChild(node, findFinalize);
}
findFinalize(gestureAst);
assert.ok(finalizeSource, "Expected the actual recording gesture's finalizer");
const compiledFinalize = ts.transpileModule(`const callback = ${finalizeSource}; callback;`, {
  compilerOptions: { target: ts.ScriptTarget.ES2020 },
}).outputText;

type NativeNode = { type: string; props: Record<string, any> };
type Animation = {
  animation: "spring" | "timing";
  target: number;
  config: Record<string, any>;
  callback?: (finished: boolean) => void;
  canceled?: boolean;
  owner?: any;
};
type Hook = { value?: any; deps?: any[]; cleanup?: () => void; setup?: () => any };

// Exercise the real component, React-style hook lifetimes, animation callbacks,
// and delayed UI-thread-to-JS delivery. This is not a native animation test.
function createHost(initial: Record<string, any> = {}) {
  const hooks: Hook[] = [];
  const animations: Animation[] = [];
  const queuedJs: (() => void)[] = [];
  const effects: (() => void)[] = [];
  const layoutEffects: (() => void)[] = [];
  const backHandlers = new Set<() => boolean>();
  let cursor = 0;
  let minimized = 0;
  let keyboardDismissals = 0;
  let root: NativeNode | null = null;
  let viewportHeight = 840;
  const context: Record<string, any> = {
    experienceVisible: true,
    isRecording: true,
    isPaused: false,
    localId: "local-one",
    liveMeta: { title: "Current tour", source: "create-session", sessionId: null },
    draft: { notes: "Keep my notes", assets: [], selectedAssetIds: [], attachments: [], participants: [] },
    minimizeExperience: () => { minimized++; context.experienceVisible = false; },
    ...initial,
  };
  function slot() { return hooks[cursor++] ?? (hooks[cursor - 1] = {}); }
  function equalDeps(left?: any[], right?: any[]) {
    return Boolean(left && right && left.length === right.length && left.every((value, index) => Object.is(value, right[index])));
  }
  function memo(factory: () => any, deps?: any[]) {
    const hook = slot();
    if (!equalDeps(hook.deps, deps)) { hook.value = factory(); hook.deps = deps; }
    return hook.value;
  }
  function effect(queue: (() => void)[], callback: () => any, deps?: any[]) {
    const hook = slot();
    if (equalDeps(hook.deps, deps)) return;
    hook.deps = deps;
    hook.setup = callback;
    queue.push(() => { hook.cleanup?.(); hook.cleanup = callback(); });
  }
  function cancel(value: any) {
    if (!value.active) return;
    const current = value.active;
    value.active = null;
    current.canceled = true;
    current.callback?.(false);
  }
  const jsx = (type: string, props: Record<string, any>): NativeNode => ({ type, props });
  const mocks: Record<string, any> = {
    "react/jsx-runtime": { jsx, jsxs: jsx },
    react: {
      useRef: (initialValue: any) => {
        const hook = slot();
        if (!hook.value) hook.value = { current: initialValue };
        return hook.value;
      },
      useCallback: (callback: () => any, deps: any[]) => memo(() => callback, deps),
      useLayoutEffect: (callback: () => any, deps: any[]) => effect(layoutEffects, callback, deps),
      useEffect: (callback: () => any, deps: any[]) => effect(effects, callback, deps),
    },
    "react-native": {
      BackHandler: { addEventListener: (_name: string, callback: () => boolean) => {
        backHandlers.add(callback);
        return { remove: () => backHandlers.delete(callback) };
      } },
      Keyboard: { dismiss: () => keyboardDismissals++ },
      StyleSheet: { absoluteFill: { position: "absolute" }, create: (styles: any) => styles },
      useWindowDimensions: () => ({ height: viewportHeight, width: 390 }),
    },
    "react-native-reanimated": {
      __esModule: true,
      default: { View: "Animated.View" },
      cancelAnimation: cancel,
      Easing: { cubic: "cubic", out: (value: any) => `out(${value})` },
      ReduceMotion: { System: "system" },
      runOnJS: (callback: (...args: any[]) => void) => (...args: any[]) => queuedJs.push(() => callback(...args)),
      useSharedValue: (initialValue: any) => {
        const hook = slot();
        if (!hook.value) {
          let current = initialValue;
          const value: any = { active: null };
          Object.defineProperty(value, "value", {
            get: () => current,
            set: (next) => {
              cancel(value);
              if (next?.animation) { next.owner = value; value.active = next; }
              else current = next;
            },
          });
          hook.value = value;
        }
        return hook.value;
      },
      useAnimatedStyle: (callback: () => any) => callback,
      withSpring: (target: number, config: any, callback: any) => {
        const animation: Animation = { animation: "spring", target, config, callback };
        animations.push(animation);
        return animation;
      },
      withTiming: (target: number, config: any, callback: any) => {
        const animation: Animation = { animation: "timing", target, config, callback };
        animations.push(animation);
        return animation;
      },
    },
    "./RecordingProvider": { useRecording: () => context },
    "./RecordingExperience": { RecordingExperience: "RecordingExperience" },
  };
  const module = { exports: {} as any };
  runInNewContext(compiled, {
    exports: module.exports,
    require: (name: string) => {
      assert.ok(name in mocks, `Unexpected dependency: ${name}`);
      return mocks[name];
    },
  });
  function render(patch: Record<string, any> = {}) {
    Object.assign(context, patch);
    cursor = 0;
    root = module.exports.RecordingExperienceHost();
    while (layoutEffects.length) layoutEffects.shift()!();
    while (effects.length) effects.shift()!();
    return root;
  }
  function finish(animation = animations.at(-1)!, deliverJs = true) {
    assert.ok(animation, "Expected an animation");
    if (animation.owner?.active === animation) {
      animation.owner.active = null;
      animation.owner.value = animation.target;
    }
    animation.callback?.(true);
    if (deliverJs) while (queuedJs.length) queuedJs.shift()!();
  }
  render();
  return {
    context, animations, backHandlers, render, finish,
    get root() { return root; },
    get props() { return root!.props.children.props; },
    get minimized() { return minimized; },
    get keyboardDismissals() { return keyboardDismissals; },
    close: () => root!.props.children.props.onSwipeDown(),
    style: () => root!.props.style[1](),
    layout: (height: number) => root!.props.onLayout({ nativeEvent: { layout: { height } } }),
    viewport: (height: number) => { viewportHeight = height; },
    flushJs: () => { while (queuedJs.length) queuedJs.shift()!(); },
    dispose: () => { for (const hook of hooks) hook.cleanup?.(); },
    replayEffects: () => {
      for (const hook of hooks) hook.cleanup?.();
      for (const hook of hooks) if (hook.setup) hook.cleanup = hook.setup();
    },
  };
}

test("opens from the viewport bottom using a reduced-motion-aware spring, without fading or scaling", () => {
  const host = createHost();
  assert.equal(host.props.sheetOffset.value, 840);
  assert.equal(host.props.sheetHeight.value, 840);
  const opening = host.animations.at(-1)!;
  assert.equal(opening.animation, "spring");
  assert.equal(opening.target, 0);
  assert.equal(opening.config.overshootClamping, true);
  assert.equal(opening.config.reduceMotion, "system");
  assert.equal(host.style().opacity, undefined);
  assert.equal(host.style().transform.length, 1);
  assert.equal(host.style().transform[0].translateY, 840);
  host.finish();
  assert.equal(host.style().transform[0].translateY, 0);
  assert.equal(host.style().borderTopLeftRadius, 0);
});

test("interactive offset moves the complete surface one-to-one, with modest rounded top corners", () => {
  const host = createHost();
  host.finish();
  host.props.sheetOffset.value = 64;
  assert.equal(host.style().transform[0].translateY, 64);
  assert.equal(host.style().borderTopLeftRadius, 64 * 0.18);
  host.props.sheetOffset.value = 400;
  assert.equal(host.style().borderTopRightRadius, 22);
});

test("Strict Mode effect replay does not leave an opening session hidden", () => {
  const host = createHost();
  const opening = host.animations.at(-1)!;
  host.replayEffects();
  assert.equal(opening.canceled, true);
  assert.notEqual(host.animations.at(-1), opening);
  host.finish();
  assert.equal(host.props.sheetOffset.value, 0);
  host.close();
  host.finish();
  assert.equal(host.minimized, 1);
});

test("minimizing finishes its animation before invoking the provider, exactly once", () => {
  const host = createHost();
  host.finish();
  host.props.sheetOffset.value = 120;
  host.close();
  const closing = host.animations.at(-1)!;
  assert.equal(closing.target, 840);
  assert.equal(closing.animation, "timing");
  assert.equal(closing.config.reduceMotion, "system");
  assert.equal(host.props.sheetClosing.value, true);
  assert.equal(host.keyboardDismissals, 1);
  assert.equal(host.minimized, 0);
  host.close();
  assert.equal(host.animations.at(-1), closing);
  host.finish(closing);
  assert.equal(host.minimized, 1);
  host.finish(closing);
  assert.equal(host.minimized, 1);
  host.render();
  assert.equal(host.props.isPresented, false);
  assert.equal(host.root!.props.pointerEvents, "none");
  assert.equal(host.root!.props.accessibilityElementsHidden, true);
});

test("a gesture may pre-mark sheetClosing before requesting the shared minimize action", () => {
  const host = createHost();
  host.finish();
  host.props.sheetClosing.value = true;
  host.close();
  host.finish();
  assert.equal(host.minimized, 1);
});

test("hardware Back uses the same non-destructive animated minimize action", () => {
  const host = createHost();
  host.finish();
  assert.equal(host.backHandlers.size, 1);
  assert.equal([...host.backHandlers][0](), true);
  assert.equal(host.minimized, 0);
  host.finish();
  assert.equal(host.minimized, 1);
  host.render();
  assert.equal(host.backHandlers.size, 0);
});

test("a delayed canceled pan cannot spring the hidden recorder back on screen after hardware Back", () => {
  const host = createHost();
  host.finish();
  const props = host.props;
  props.sheetOffset.value = 64;
  let springs = 0;
  const finalize = runInNewContext(compiledFinalize, {
    sheetClosing: props.sheetClosing,
    sheetOffset: props.sheetOffset,
    pullingSheet: { value: true },
    didPull: { value: true },
    pullProgress: { value: 0.64 },
    RETURN_SPRING: {},
    withSpring: (value: number) => { springs++; return value; },
  });
  [...host.backHandlers][0]();
  host.finish();
  host.render();
  assert.equal(props.sheetClosing.value, true);
  assert.equal(host.root!.props.pointerEvents, "none");
  finalize({}, false);
  assert.equal(springs, 0);
  assert.equal(props.sheetOffset.value, props.sheetHeight.value);
  host.render({ experienceVisible: true });
  assert.equal(props.sheetClosing.value, false);
});

test("hidden startup, cleared sessions and teardown keep stale gesture callbacks sealed", () => {
  const hidden = createHost({ experienceVisible: false, isRecording: false });
  assert.equal(hidden.props.sheetClosing.value, true);
  const cleared = createHost();
  const props = cleared.props;
  cleared.render({ liveMeta: null, draft: null, experienceVisible: false, localId: null });
  assert.equal(props.sheetClosing.value, true);
  const disposed = createHost();
  const disposedProps = disposed.props;
  disposed.dispose();
  assert.equal(disposedProps.sheetClosing.value, true);
});

test("hidden startup and paused sessions retain the same recording component and shared state", () => {
  const host = createHost({ experienceVisible: false, isRecording: false });
  assert.ok(host.root, "A minimized startup must not unmount recording/transcription");
  const offset = host.props.sheetOffset;
  const experienceType = host.root!.props.children.type;
  host.render({ isRecording: true, isPaused: true });
  assert.equal(host.root!.props.children.type, experienceType);
  assert.equal(host.props.sheetOffset, offset);
  assert.equal(host.props.notes, "Keep my notes");
  assert.equal(host.props.autoStart, true);
  assert.equal(host.props.preparing, undefined);
  assert.equal(host.props.isPresented, false);
  host.render({ experienceVisible: true });
  assert.equal(host.props.sheetOffset, offset);
  assert.equal(host.animations.at(-1)!.target, 0);
});

test("receiving the server ID or initial local ID does not restart the opening animation", () => {
  const host = createHost({ localId: null });
  const opening = host.animations.at(-1);
  host.render({ localId: "local-one" });
  assert.equal(host.animations.at(-1), opening);
  host.render({ liveMeta: { ...host.context.liveMeta, sessionId: "remote-tour" } });
  assert.equal(host.animations.at(-1), opening);
  assert.equal(host.props.sessionId, "remote-tour");
});

test("the first local ID arriving during closing does not strand the same startup session", () => {
  const host = createHost({ localId: null, isRecording: false });
  host.finish();
  host.close();
  const closing = host.animations.at(-1)!;
  host.render({ localId: "local-one" });
  assert.equal(host.animations.at(-1), closing);
  host.finish(closing);
  assert.equal(host.minimized, 1);
});

test("reopening reverses closing and rejects a previously queued minimize callback", () => {
  const host = createHost();
  host.finish();
  host.close();
  const closing = host.animations.at(-1)!;
  host.finish(closing, false);
  host.render({ experienceVisible: false });
  host.render({ experienceVisible: true });
  host.flushJs();
  assert.equal(host.minimized, 0);
  assert.equal(host.props.isPresented, true);
  assert.equal(host.props.sheetClosing.value, false);
  assert.equal(host.animations.at(-1)!.animation, "spring");
});

test("an old session's completed animation cannot minimize its replacement", () => {
  const host = createHost();
  host.finish();
  host.close();
  const closing = host.animations.at(-1)!;
  host.finish(closing, false);
  host.render({ localId: "local-two", liveMeta: { ...host.context.liveMeta, title: "Another tour" } });
  host.flushJs();
  assert.equal(host.minimized, 0);
  assert.equal(host.props.title, "Another tour");
  assert.equal(host.props.sheetClosing.value, false);
});

test("clearing a session or unmounting rejects delayed close callbacks", () => {
  for (const end of ["clear", "unmount"]) {
    const host = createHost();
    host.finish();
    host.close();
    host.finish(host.animations.at(-1)!, false);
    if (end === "clear") {
      host.render({ liveMeta: null, draft: null, localId: null, experienceVisible: false });
      assert.equal(host.root, null);
    } else {
      host.dispose();
    }
    host.flushJs();
    assert.equal(host.minimized, 0, end);
    assert.equal(host.backHandlers.size, 0, end);
  }
});

test("canceled native animations never invoke minimize", () => {
  const host = createHost();
  host.finish();
  host.close();
  const closing = host.animations.at(-1)!;
  host.render({ experienceVisible: false });
  assert.equal(closing.canceled, true);
  host.flushJs();
  assert.equal(host.minimized, 0);
});

test("layout measurement determines close distance and keeps a hidden sheet fully off screen", () => {
  const host = createHost();
  host.finish();
  host.layout(710);
  assert.equal(host.props.sheetHeight.value, 710);
  assert.equal(host.props.sheetOffset.value, 0);
  host.close();
  assert.equal(host.animations.at(-1)!.target, 710);
  host.finish();
  host.render();
  host.layout(920);
  assert.equal(host.props.sheetHeight.value, 920);
  assert.equal(host.props.sheetOffset.value, 920);
  host.layout(0);
  host.layout(Number.NaN);
  assert.equal(host.props.sheetHeight.value, 920);
});

test("a layout change during closing retargets it and invalidates the obsolete callback", () => {
  const host = createHost();
  host.finish();
  host.close();
  const oldClose = host.animations.at(-1)!;
  host.layout(720);
  const newClose = host.animations.at(-1)!;
  assert.equal(oldClose.canceled, true);
  assert.notEqual(newClose, oldClose);
  assert.equal(newClose.target, 720);
  host.finish(oldClose);
  assert.equal(host.minimized, 0);
  host.finish(newClose);
  assert.equal(host.minimized, 1);
});

test("the host forwards recorder preparing onto the experience", () => {
  const host = createHost({ experiencePreparing: true });
  assert.equal(host.props.preparing, true);
  host.render({ experiencePreparing: false });
  assert.equal(host.props.preparing, false);
});
