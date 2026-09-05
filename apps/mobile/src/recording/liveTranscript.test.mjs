import assert from "node:assert/strict";
import test from "node:test";
import {
  mergeTranscriptLines,
  speakerInitial,
  transcriptsOverlap,
} from "./liveTranscript.ts";

function line(id, text, time, speaker = "Speaker") {
  return { id, text, time, speaker };
}

test("speakerInitial renders generic and diarized speaker labels", () => {
  assert.equal(speakerInitial("Speaker"), "S");
  assert.equal(speakerInitial("Speaker A"), "A");
  assert.equal(speakerInitial("Agent"), "A");
  assert.equal(speakerInitial("Prospect"), "P");
});

test("transcriptsOverlap matches exact short utterances", () => {
  assert.equal(transcriptsOverlap(line("local", "Thank you!", 10), line("muse", "thank you", 11)), true);
  assert.equal(transcriptsOverlap(line("local", "Yeah", 10), line("muse", "yeah", 11)), true);
});

test("transcriptsOverlap only allows strict near-matches for short phrases", () => {
  assert.equal(transcriptsOverlap(line("local", "thank you", 10), line("muse", "thank you so much", 11)), true);
  assert.equal(transcriptsOverlap(line("local", "on left", 10), line("muse", "on the left", 11)), true);
  assert.equal(transcriptsOverlap(line("local", "yeah", 10), line("muse", "yeah okay", 11)), false);
  assert.equal(transcriptsOverlap(line("local", "thank you", 10), line("muse", "thank them", 11)), false);
  assert.equal(transcriptsOverlap(line("local", "thank you", 10), line("muse", "thank you", 16)), false);
});

test("mergeTranscriptLines prefers Muse for duplicates and retains unique local lines", () => {
  const local = [line("local-1", "thank you", 10), line("local-2", "turn right", 20)];
  const muse = [line("muse-1", "Thank you so much", 11, "Speaker A")];

  assert.deepEqual(mergeTranscriptLines(local, muse), [
    muse[0],
    local[1],
  ]);
});

test("mergeTranscriptLines replaces native fallback rows in a recovered range", () => {
  const local = [
    line("before", "welcome", 4),
    line("fallback", "native guess", 12),
    line("after", "follow me", 22),
  ];
  const recovered = [line("recovered", "accurate result", 13, "Speaker B")];

  assert.deepEqual(mergeTranscriptLines(local, recovered, [{ start: 10, end: 20 }]), [
    local[0],
    recovered[0],
    local[2],
  ]);
});
