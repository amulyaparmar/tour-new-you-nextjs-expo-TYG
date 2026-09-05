import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import { runInNewContext } from "node:vm";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const source = readFileSync(new URL("../src/components/check-in/check-in-sheet-scroll-view.tsx", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;

type NativeNode = { type: string; props: Record<string, any> };
type SharedValue<T> = { value: T };

class MockGesture {
  kind: string;
  config: Record<string, any> = {};
  callbacks: Record<string, (...args: any[]) => void> = {};
  constructor(kind: string) { this.kind = kind; }
  enabled(value: boolean) { this.config.enabled = value; return this; }
  maxPointers(value: number) { this.config.maxPointers = value; return this; }
  activeOffsetY(value: number[]) { this.config.activeOffsetY = Array.from(value); return this; }
  failOffsetX(value: number[]) { this.config.failOffsetX = Array.from(value); return this; }
  onBegin(callback: (...args: any[]) => void) { this.callbacks.begin = callback; return this; }
  onUpdate(callback: (...args: any[]) => void) { this.callbacks.update = callback; return this; }
  onEnd(callback: (...args: any[]) => void) { this.callbacks.end = callback; return this; }
  onFinalize(callback: (...args: any[]) => void) { this.callbacks.finalize = callback; return this; }
}

// Run the actual TSX gesture callbacks. This validates the arithmetic and native
// wiring contract, not UIKit/Android arbitration or native scrolling physics.
function render({ visible = true, initialDrag = 0, initialClosing = false, keyboardShouldPersistTaps = undefined as string | undefined } = {}) {
  const dragY: SharedValue<number> = { value: initialDrag };
  const closing: SharedValue<boolean> = { value: initialClosing };
  const scrolls: { x: number; y: number; animated: boolean }[] = [];
  const springs: { value: number; damping: number; stiffness: number }[] = [];
  const canceled: any[] = [];
  let dismissals = 0;
  const scrollRef = { current: "native-scroll" };
  const jsx = (type: string, props: Record<string, any>): NativeNode => ({ type, props });
  const native = new MockGesture("native");
  const pan = new MockGesture("pan");
  const mocks: Record<string, any> = {
    "react/jsx-runtime": { jsx, jsxs: jsx },
    react: { useMemo: (factory: () => any) => factory() },
    "react-native-gesture-handler": {
      GestureDetector: "GestureDetector",
      Gesture: {
        Native: () => native,
        Pan: () => pan,
        Simultaneous: (...gestures: MockGesture[]) => ({ kind: "simultaneous", gestures }),
      },
    },
    "react-native-reanimated": {
      __esModule: true,
      default: { ScrollView: "Animated.ScrollView" },
      useAnimatedRef: () => scrollRef,
      useSharedValue: (value: any) => ({ value }),
      useAnimatedScrollHandler: (callback: any) => callback,
      cancelAnimation: (value: any) => canceled.push(value),
      runOnJS: (callback: any) => callback,
      scrollTo: (ref: any, x: number, y: number, animated: boolean) => {
        assert.equal(ref, scrollRef);
        scrolls.push({ x, y, animated });
      },
      withSpring: (value: number, config: any) => {
        springs.push({ value, damping: config.damping, stiffness: config.stiffness });
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
  const root: NativeNode = module.exports.CheckInSheetScrollView({
    children: "QR content",
    visible,
    dragY,
    closing,
    onDismiss: () => dismissals++,
    style: { flex: 1 },
    contentContainerStyle: { paddingBottom: 12 },
    keyboardShouldPersistTaps,
  });
  const scroll: NativeNode = root.props.children;
  const event = (absoluteY: number, velocityY = 0) => ({ absoluteY, velocityY });
  return {
    root, scroll, native, pan, dragY, closing, scrolls, springs, canceled,
    get dismissals() { return dismissals; },
    begin: (absoluteY: number) => pan.callbacks.begin(event(absoluteY)),
    move: (absoluteY: number) => pan.callbacks.update(event(absoluteY)),
    offset: (y: number) => scroll.props.onScroll({ contentOffset: { y } }),
    end: (velocityY = 0, success = true) => pan.callbacks.end(event(0, velocityY), success),
    finalize: (success = true) => pan.callbacks.finalize(event(0), success),
  };
}

test("QR scroll and dismiss pan observe the same gesture, with native overscroll disabled", () => {
  const ui = render();
  assert.equal(ui.root.type, "GestureDetector");
  assert.equal(ui.root.props.gesture.kind, "simultaneous");
  assert.deepEqual(ui.root.props.gesture.gestures, [ui.native, ui.pan]);
  assert.equal(ui.scroll.type, "Animated.ScrollView");
  assert.equal(ui.scroll.props.bounces, false);
  assert.equal(ui.scroll.props.alwaysBounceVertical, false);
  assert.equal(ui.scroll.props.overScrollMode, "never");
  assert.equal(ui.scroll.props.scrollEventThrottle, 16);
  assert.equal(ui.scroll.props.children, "QR content");
  assert.deepEqual(ui.scroll.props.style, { flex: 1 });
  assert.deepEqual(ui.scroll.props.contentContainerStyle, { paddingBottom: 12 });
});

test("gesture obeys visibility and rejects horizontal or multi-finger capture", () => {
  const ui = render();
  assert.equal(ui.pan.config.enabled, true);
  assert.equal(render({ visible: false }).pan.config.enabled, false);
  assert.equal(ui.pan.config.maxPointers, 1);
  assert.deepEqual(ui.pan.config.activeOffsetY, [-6, 6]);
  assert.deepEqual(ui.pan.config.failOffsetX, [-28, 28]);
});

test("form tap handling is forwarded without changing QR defaults", () => {
  assert.equal(render().scroll.props.keyboardShouldPersistTaps, undefined);
  assert.equal(render({ keyboardShouldPersistTaps: "handled" }).scroll.props.keyboardShouldPersistTaps, "handled");
});

test("check-in presents as a native page with a page-sheet form modal", () => {
  const sheetSource = readFileSync(new URL("../src/components/check-in/check-in-sheet.tsx", import.meta.url), "utf8");
  assert.match(sheetSource, /GlassNavHeader/);
  assert.match(sheetSource, /PageSheetModal/);
  assert.equal(sheetSource.includes("CheckInSheetScrollView"), false);
  assert.equal(sheetSource.includes("SessionModeTabs"), false);
  const ast = ts.createSourceFile("check-in-sheet.tsx", sheetSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const wrappers: Record<string, string>[] = [];
  let horizontalOptions = 0;
  function visit(node: any) {
    if (ts.isJsxOpeningElement(node)) {
      const attributes: Record<string, string> = {};
      for (const attribute of node.attributes.properties) {
        if (!ts.isJsxAttribute(attribute)) continue;
        attributes[attribute.name.getText(ast)] = attribute.initializer
          ? ts.isStringLiteral(attribute.initializer)
            ? attribute.initializer.text
            : attribute.initializer.expression?.getText(ast) ?? ""
          : "true";
      }
      if (node.tagName.getText(ast) === "ScrollView" && attributes.key) wrappers.push(attributes);
      if (node.tagName.getText(ast) === "ScrollView" && attributes.horizontal === "true") {
        horizontalOptions++;
        assert.equal(attributes.keyboardShouldPersistTaps, "handled");
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.deepEqual(wrappers.map((props) => props.key).sort(), ["contact", "qr", "questions"]);
  for (const props of wrappers) {
    if (props.key !== "qr") assert.equal(props.keyboardShouldPersistTaps, "handled");
  }
  assert.equal(horizontalOptions, 1);
});

test("pulling anywhere in QR content at its top moves the sheet and dismisses once", () => {
  const ui = render();
  ui.begin(300);
  ui.move(350);
  assert.equal(ui.dragY.value, 50);
  ui.move(395);
  assert.equal(ui.dragY.value, 95);
  ui.end();
  ui.finalize();
  assert.equal(ui.dismissals, 1);
  assert.equal(ui.closing.value, true);
  ui.end(1200);
  ui.begin(500);
  ui.move(800);
  assert.equal(ui.dismissals, 1);
  assert.equal(ui.dragY.value, 95);
});

test("deep content scrolling does not count toward dismissal distance", () => {
  const ui = render();
  ui.offset(240);
  ui.begin(200);
  ui.offset(140);
  ui.move(300);
  ui.offset(40);
  ui.move(400);
  assert.equal(ui.dragY.value, 0);
  ui.end(1500);
  ui.finalize();
  assert.equal(ui.dismissals, 0);
  assert.equal(ui.closing.value, false);
});

test("continued pull hands scrolling to the sheet at the top without lifting", () => {
  const ui = render();
  ui.offset(120);
  ui.begin(300);
  ui.offset(60);
  ui.move(360);
  ui.offset(0);
  ui.move(420);
  assert.equal(ui.dragY.value, 0);
  ui.move(460);
  assert.equal(ui.dragY.value, 40);
  ui.move(515);
  assert.equal(ui.dragY.value, 95);
  ui.end();
  assert.equal(ui.dismissals, 1);
});

test("reaching the top after a long scroll does not instantly dismiss", () => {
  const ui = render();
  ui.offset(300);
  ui.begin(200);
  ui.offset(150);
  ui.move(350);
  ui.offset(0);
  ui.move(510);
  assert.equal(ui.dragY.value, 10);
  ui.end(2000);
  assert.equal(ui.dismissals, 0);
  assert.equal(ui.dragY.value, 0);
});

test("a first fast update past the top counts only the remaining sheet pull", () => {
  const ui = render();
  ui.offset(200);
  ui.begin(200);
  ui.offset(0);
  ui.move(430);
  assert.equal(ui.dragY.value, 30);
  ui.end(1000);
  assert.equal(ui.dismissals, 1);
});

test("pan updates arriving before scroll updates cannot prematurely dismiss", () => {
  const ui = render();
  ui.offset(100);
  ui.begin(200);
  ui.move(250);
  ui.offset(50);
  ui.move(300);
  ui.offset(0);
  ui.move(350);
  assert.equal(ui.dragY.value, 0);
  // A stale positive offset conservatively delays handoff, but the ongoing
  // gesture can still move the sheet without lifting after the final scroll.
  ui.move(380);
  assert.equal(ui.dragY.value, 30);
  ui.end();
  assert.equal(ui.dismissals, 0);
});

test("reversing a pull restores the sheet before content can scroll again", () => {
  const ui = render();
  ui.begin(300);
  ui.move(360);
  ui.offset(25);
  assert.deepEqual(ui.scrolls.at(-1), { x: 0, y: 0, animated: false });
  assert.equal(ui.dragY.value, 60);
  ui.move(325);
  assert.equal(ui.dragY.value, 25);
  ui.move(300);
  assert.equal(ui.dragY.value, 0);
  const callsAtRest = ui.scrolls.length;
  ui.offset(40);
  ui.move(260);
  assert.equal(ui.dragY.value, 0);
  assert.equal(ui.scrolls.length, callsAtRest);
  ui.offset(0);
  ui.move(300);
  ui.move(325);
  assert.equal(ui.dragY.value, 25);
  ui.end();
  assert.equal(ui.dismissals, 0);
});

test("upward scroll followed by a downward reversal can hand off in one gesture", () => {
  const ui = render();
  ui.begin(400);
  ui.offset(100);
  ui.move(300);
  ui.offset(20);
  ui.move(380);
  ui.offset(0);
  ui.move(400);
  assert.equal(ui.dragY.value, 0);
  ui.move(450);
  assert.equal(ui.dragY.value, 50);
  ui.end(1000);
  assert.equal(ui.dismissals, 1);
});

test("short pulls spring back; fast downward pulls require real sheet travel", () => {
  const short = render();
  short.begin(300);
  short.move(340);
  short.end(100);
  assert.equal(short.dismissals, 0);
  assert.equal(short.dragY.value, 0);
  assert.deepEqual(short.springs.at(-1), { value: 0, damping: 24, stiffness: 260 });

  const tinyFast = render();
  tinyFast.begin(300);
  tinyFast.move(312);
  tinyFast.end(1500);
  assert.equal(tinyFast.dismissals, 0);

  const fast = render();
  fast.begin(300);
  fast.move(313);
  fast.end(901);
  assert.equal(fast.dismissals, 1);

  const upwardVelocity = render();
  upwardVelocity.begin(300);
  upwardVelocity.move(325);
  upwardVelocity.end(-1500);
  assert.equal(upwardVelocity.dismissals, 0);
});

test("canceled drags and failed activation restore the sheet without dismissing", () => {
  const canceled = render();
  canceled.begin(300);
  canceled.move(450);
  canceled.end(2000, false);
  canceled.finalize(false);
  assert.equal(canceled.dismissals, 0);
  assert.equal(canceled.dragY.value, 0);

  const interruptedSpring = render({ initialDrag: 22 });
  interruptedSpring.begin(300);
  interruptedSpring.finalize(false);
  assert.equal(interruptedSpring.dismissals, 0);
  assert.equal(interruptedSpring.dragY.value, 0);
  assert.equal(interruptedSpring.canceled[0], interruptedSpring.dragY);
});

test("a new pull picks up a partially returned sheet without jumping", () => {
  const ui = render({ initialDrag: 30 });
  ui.begin(300);
  ui.move(310);
  assert.equal(ui.dragY.value, 40);
  ui.end();
  assert.equal(ui.dragY.value, 0);
  assert.equal(ui.dismissals, 0);
});

test("cancellation after dismissal does not reset the closing position", () => {
  const ui = render();
  ui.begin(300);
  ui.move(420);
  ui.end();
  ui.finalize(false);
  assert.equal(ui.dragY.value, 120);
  assert.equal(ui.springs.length, 0);
  assert.equal(ui.dismissals, 1);
});

test("accessibility escape only invokes sheet dismissal", () => {
  const ui = render();
  ui.scroll.props.onAccessibilityEscape();
  assert.equal(ui.dismissals, 1);
  assert.equal(ui.scrolls.length, 0);
});
