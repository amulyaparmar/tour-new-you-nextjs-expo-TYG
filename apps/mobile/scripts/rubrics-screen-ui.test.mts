import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const screen = readFileSync(
  new URL("../src/components/settings/rubrics-screen.tsx", import.meta.url),
  "utf8",
);

test("rubrics screens use the Settings glass header", () => {
  assert.match(screen, /<GlassNavHeader title="Rubrics" onBack=\{onBack\} \/>/);
  assert.match(screen, /<GlassNavHeader[\s\S]*title=\{rubric\.name\}[\s\S]*onBack=\{onBack\}/);
  assert.match(screen, /glassNavContentInset/);
  assert.doesNotMatch(screen, /TourBackButton/);
  assert.doesNotMatch(screen, /BackBtn/);
  assert.doesNotMatch(screen, /animationType="slide"/);
  assert.doesNotMatch(screen, /StyleSheet\.absoluteFill/);
});

test("opening a rubric uses a native stack slide", () => {
  assert.match(screen, /createNativeStackNavigator/);
  assert.match(screen, /animation: "slide_from_right"/);
  assert.match(screen, /name="Detail"/);
});

test("the rubrics list does not show a property name", () => {
  assert.doesNotMatch(screen, /workspace\.community\.name/);
});

test("a rubric detail page shows criteria and points in a stats card", () => {
  assert.match(screen, /styles\.stats/);
  assert.match(screen, /criterion/);
  assert.match(screen, /points/);
  assert.doesNotMatch(screen, /criteria · .* points/);
});

test("rubrics screens use CustomText and shared UI tokens", () => {
  assert.match(screen, /<CustomText /);
  assert.match(screen, /BACKGROUND/);
  assert.match(screen, /CARD/);
  assert.match(screen, /ACCENT/);
  assert.match(screen, /SMALL_CORNER/);
  assert.doesNotMatch(screen, /from "react-native"[^;]*\bText\b/);
});

test("all rubrics share one list with the default first", () => {
  assert.match(screen, /All rubrics/);
  assert.doesNotMatch(screen, /style=\{styles\.sectionHeader\}>\s*Default/);
  assert.match(screen, /showDefault=\{rubric\.id === defaultRubric\?\.id\}/);
  assert.match(
    screen,
    /\[defaultRubric, \.\.\.rubrics\.filter\(\(rubric\) => rubric\.id !== defaultRubric\.id\)\]/,
  );
});

test("rubrics screens do not use outlined chrome", () => {
  assert.doesNotMatch(screen, /borderWidth:\s*1/);
  assert.doesNotMatch(screen, /borderTopWidth:\s*1/);
  assert.doesNotMatch(screen, /borderBottomWidth:\s*1/);
  assert.doesNotMatch(screen, /C\.border/);
  assert.doesNotMatch(screen, /#e9d5ff/);
});
