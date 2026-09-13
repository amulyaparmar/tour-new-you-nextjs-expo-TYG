import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import test from "node:test";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const compiled = ts.transpileModule(readFileSync(new URL("./TourCoach.tsx", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true },
}).outputText;

// Exercise the real component's hooks and press handlers without a native runtime.
function harness(initial = {}) {
  const slots = [], effects = [], timers = new Map();
  let cursor = 0, dirty = false, tree, haptics = 0;
  const props = { enabled: true, ready: true, active: false, recordingId: "one", tip: null, history: [],
    preview: false, hidden: false, top: 0, bottom: 0, onEnable() {}, onOpenGuidance() {},
    onDismiss() { props.tip = null; }, ...initial };
  function slot() { const index = cursor++; return slots[index] ??= {}; }
  const same = (a, b) => a && b && a.length === b.length && a.every((value, i) => Object.is(value, b[i]));
  const react = {
    createElement(type, props, ...children) { return { type, props: props ?? {}, children: children.flat(Infinity).filter(c => c !== false && c != null) }; },
    useState(initial) {
      const s = slot(); if (!("value" in s)) s.value = initial;
      return [s.value, value => { const next = typeof value === "function" ? value(s.value) : value;
        if (!Object.is(next, s.value)) { s.value = next; dirty = true; } }];
    },
    useRef(initial) { const s = slot(); return s.ref ??= { current: initial }; },
    useMemo(fn, deps) { const s = slot(); if (!same(s.deps, deps)) { s.value = fn(); s.deps = deps; } return s.value; },
    useEffect(fn, deps) { const s = slot(); if (!same(s.deps, deps)) {
      s.deps = deps; effects.push(() => { s.cleanup?.(); s.cleanup = fn(); });
    } },
  };
  class Value { setValue() {} stopAnimation() {} interpolate() { return 0; } getTranslateTransform() { return []; } }
  let swipeEnd;
  function gesture() {
    const proxy = new Proxy({}, { get: (_, name) => (...args) => {
      if (name === "onEnd") swipeEnd = args[0];
      return proxy;
    } });
    return proxy;
  }
  const mocks = {
    react,
    "@expo/vector-icons": { Ionicons: "Icon" },
    "@/components/custom-text": { CustomText: "Text" },
    "@/components/coach-icon": { CoachIcon: "CoachIcon" },
    "@/lib/haptics": { impactHaptic() { haptics++; } },
    "@/theme/tokens": { ACCENT: "blue", CARD: "white", TEXT: "black" },
    "react-native-gesture-handler": { Gesture: { Pan: gesture }, GestureDetector: "Gesture" },
    "react-native": {
      Pressable: "Button", View: "View", ScrollView: "ScrollView",
      StyleSheet: { create: value => value, absoluteFill: {} },
      AccessibilityInfo: { isReduceMotionEnabled: async () => false, addEventListener: () => ({ remove() {} }) },
      Easing: { out: () => 0, cubic: 0 },
      Animated: { Value, ValueXY: Value, View: "AnimatedView", timing: () => ({ start() {} }), spring: () => ({ start() {} }) },
    },
  };
  const exports = {};
  runInNewContext(compiled, { exports, require: name => { assert.ok(mocks[name], name); return mocks[name]; },
    setTimeout(fn, delay) { timers.set(fn, delay); return fn; }, clearTimeout(fn) { timers.delete(fn); } });
  function render(next = {}) {
    Object.assign(props, next);
    for (let count = 0; count < 20; count++) {
      dirty = false; cursor = 0; tree = exports.TourCoach(props);
      while (effects.length) effects.shift()();
      if (!dirty) return tree;
    }
    assert.fail("Render did not settle");
  }
  function nodes(node = tree) { return typeof node !== "object" ? [] : [node, ...node.children.flatMap(nodes)]; }
  return {
    render, timers, haptics: () => haptics,
    swipe(distance) { swipeEnd({ translationX: distance }); render(); },
    text: () => nodes().filter(n => n.type === "Text").flatMap(n => n.children).join(" "),
    open: () => nodes().find(n => n.type === "AnimatedView" && "pointerEvents" in n.props).props.pointerEvents === "auto",
    button: label => nodes().find(n => n.type === "Button" && n.props.accessibilityLabel === label),
    press(label) { const button = this.button(label); assert.ok(button, label); assert.ok(!button.props.disabled); button.props.onPress(); render(); },
    link(label) { return nodes().find(n => n.type === "Text" && n.props.accessibilityRole === "link" && n.props.accessibilityLabel === label); },
    pressLink(label) { const link = this.link(label); assert.ok(link, label); let stopped = false;
      link.props.onPress({ stopPropagation() { stopped = true; } }); assert.equal(stopped, true); render(); },
    dispose() { for (const s of slots) s.cleanup?.(); },
  };
}
const tip = text => ({ text, items: [{ kind: "ask", text }], sourceTurnIds: [text] });

test("internal categories stay hidden but the selected item is passed into chat", () => {
  const text = "You connected the room to their routine; build on that connection.";
  const feedback = { text, items: [{ kind: "adjust", type: "feedback", text }], sourceTurnIds: ["a"] };
  let asked;
  const h = harness({ tip: feedback, history: [feedback], onOpenGuidance: item => { asked = item; } });
  h.render();
  assert.ok(!h.text().includes("Feedback"));
  h.press(text);
  assert.equal(asked, feedback.items[0]);
  h.dispose();
});

test("popover stays open without a timeout or title, and closing preserves suggestions", () => {
  const one = tip("Ask about their move date.");
  const h = harness({ tip: one, history: [one] }); h.render();
  assert.equal(h.open(), true); assert.equal(h.timers.size, 0);
  assert.ok(!h.text().includes("Tour Coach"));
  h.render({ elapsed: 100, turns: ["new turn"] }); assert.equal(h.open(), true);
  assert.equal(h.button("Close coaching suggestions"), undefined);
  h.press("Dismiss coaching"); assert.equal(h.open(), false);
  h.press("Tour Coach"); assert.equal(h.open(), true);
  assert.ok(h.text().includes(one.text)); h.dispose();
});

test("previous/next controls browse history without new tips moving an older page", () => {
  const one = tip("Ask about their move date."), two = tip("Confirm the recurring fees."), three = tip("Ask about their commute.");
  const h = harness({ tip: one, history: [one] }); h.render();
  h.render({ tip: two, history: [one, two] }); assert.ok(h.text().includes(two.text));
  assert.equal(h.button("Next coaching suggestions").props.disabled, true);
  h.press("Previous coaching suggestions"); assert.ok(h.text().includes(one.text));
  assert.equal(h.button("Previous coaching suggestions").props.disabled, true);
  h.render({ tip: three, history: [one, two, three] }); assert.ok(h.text().includes(one.text));
  h.press("Next coaching suggestions"); assert.ok(h.text().includes(two.text));
  h.press("Next coaching suggestions"); assert.ok(h.text().includes(three.text));
  h.render({ recordingId: "two", tip: null, history: [] });
  assert.equal(h.open(), false); assert.ok(!h.text().includes(three.text)); h.dispose();
});

test("asking about an older suggestion uses the selected text", () => {
  const one = tip("Ask about their move date."), two = tip("Confirm the recurring fees.");
  let asked;
  const h = harness({ tip: two, history: [one, two], onOpenGuidance: item => { asked = item.text; } }); h.render();
  h.press("Previous coaching suggestions");
  h.render({ busy: true }); assert.equal(h.button(one.text).props.disabled, true);
  h.render({ busy: false }); h.press(one.text);
  assert.equal(asked, one.text); assert.equal(h.open(), false); h.dispose();
});

test("one item at a time, with one haptic per new tip and no haptic on reopening", () => {
  const one = tip("Reflect their priority.");
  one.items.push({ kind: "know", text: "Verify the total." });
  const h = harness({ active: true, tip: one, history: [one] }); h.render();
  assert.ok(h.text().includes(one.items[0].text));
  assert.ok(!h.text().includes(one.items[1].text));
  assert.equal(h.haptics(), 1);
  h.swipe(-80); assert.ok(h.text().includes(one.items[1].text));
  h.swipe(-80); assert.ok(h.text().includes(one.items[1].text));
  h.swipe(80); assert.ok(h.text().includes(one.items[0].text));
  h.press("Tour Coach"); assert.equal(h.open(), false);
  h.press("Tour Coach"); assert.equal(h.open(), true);
  assert.equal(h.haptics(), 1);
  const two = tip("Connect the next room to their routine.");
  h.render({ tip: two, history: [one, two] }); assert.equal(h.haptics(), 2);
  h.dispose();
});

test("preview and hidden coaching do not trigger attention haptics", () => {
  const one = tip("Reflect their priority.");
  const preview = harness({ active: true, preview: true, tip: one, history: [one] });
  preview.render(); assert.equal(preview.haptics(), 0); preview.dispose();
  const hidden = harness({ active: true, hidden: true, tip: one, history: [one] });
  hidden.render(); assert.equal(hidden.haptics(), 0); hidden.dispose();
});

test("preview renders the production two-option coaching layout", () => {
  const h = harness({ active: true, preview: true });
  h.render();
  assert.match(h.text(), /Make the benefit personal/);
  assert.match(h.text(), /Learn their routine/);
  assert.match(h.text(), /How would you see yourself using this day to day/);
  assert.match(h.text(), /Build the connection/);
  h.dispose();
});

test("a legacy headline opens guidance on the first tap", () => {
  const item = { kind: "ask", type: "discovery", text: "What monthly total feels comfortable?", sayIt: "What monthly total feels comfortable?", headline: "Clarify their budget" };
  const value = { text: item.text, items: [item], sourceTurnIds: ["a"] };
  const events = []; let asked;
  const h = harness({ tip: value, history: [value], onOpenGuidance: selected => { asked = selected; }, onInteraction: event => events.push(event) });
  h.render(); assert.ok(h.text().includes(item.headline)); assert.ok(!h.text().includes(item.sayIt));
  h.press(item.headline); assert.equal(asked, item); assert.equal(h.open(), false); assert.ok(events.includes("tap"));
  h.press("Tour Coach"); h.press("Dismiss coaching"); assert.ok(events.includes("dismiss")); h.dispose();
});

test("the whole coaching message opens its already-prepared guidance without highlighted words", () => {
  const item = { kind: "know", type: "information", text: "Confirm rent and fees.", preparedGuidance: {
    sayThis: "Let me separate the rent from the other monthly costs.",
    whyNow: "They asked what the price includes.",
  }, inlineCoaching: { caption: [{ type: "text", text: "Confirm rent and fees." }], links: [], factIds: [] } };
  const value = { text: item.text, items: [item], sourceTurnIds: ["t1"] };
  const actions = [], events = [];
  const h = harness({ tip: value, history: [value], onOpenGuidance: selected => actions.push(selected), onInteraction: event => events.push(event) });
  h.render(); assert.equal(h.open(), true);
  h.render({ busy: true }); assert.equal(h.button(item.text).props.disabled, true); assert.equal(actions.length, 0);
  h.render({ busy: false }); h.press(item.text);
  assert.deepEqual(actions, [item]); assert.equal(h.open(), false); assert.deepEqual(events, ["tap"]);
  h.dispose();
});
