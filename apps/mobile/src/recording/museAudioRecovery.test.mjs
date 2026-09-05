import assert from "node:assert/strict";
import test from "node:test";
import {
  createPcm16WavHeader,
  recoveredLinesFromResponse,
} from "./museAudioRecovery.ts";

test("createPcm16WavHeader describes 16 kHz mono PCM", () => {
  const header = createPcm16WavHeader(32_000);
  const view = new DataView(header.buffer);
  const ascii = (start, length) => String.fromCharCode(...header.slice(start, start + length));

  assert.equal(header.byteLength, 44);
  assert.equal(ascii(0, 4), "RIFF");
  assert.equal(ascii(8, 4), "WAVE");
  assert.equal(view.getUint32(24, true), 16_000);
  assert.equal(view.getUint16(34, true), 16);
  assert.equal(view.getUint32(40, true), 32_000);
});

test("recoveredLinesFromResponse offsets timestamps into the live session", () => {
  const lines = recoveredLinesFromResponse({
    turns: [{ turnId: 7, startMs: 1_250, transcript: "Welcome in.", speaker: "b" }],
  }, "gap-1", 29_000);

  assert.deepEqual(lines, [{
    id: "muse-recovery-gap-1-7",
    speaker: "Speaker B",
    text: "Welcome in.",
    time: 30.25,
  }]);
});
