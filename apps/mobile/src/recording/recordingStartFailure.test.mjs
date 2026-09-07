import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyRecordingStartError,
  permissionStartFailure,
} from "./recordingStartFailure.ts";

test("permissionStartFailure opens settings when permission cannot be requested again", () => {
  assert.deepEqual(permissionStartFailure({ granted: false, canAskAgain: false }), {
    code: "permission-blocked",
    message: "Microphone access is unavailable. Check Settings or device restrictions, then try again.",
    action: "open-settings",
  });
});

test("permissionStartFailure keeps retry available when permission can be requested", () => {
  assert.equal(permissionStartFailure({ granted: true, canAskAgain: true }), null);
  assert.equal(permissionStartFailure({ granted: false, canAskAgain: true })?.action, "retry");
});

test("classifyRecordingStartError recognizes iOS audio-session contention", () => {
  const failures = [
    new Error("The operation couldn’t be completed. (OSStatus error 561145187.)"),
    new Error("AVAudioSession failed to activate: insufficient priority"),
    { code: "microphone_in_use", message: "Microphone is busy" },
  ];

  for (const error of failures) {
    assert.deepEqual(classifyRecordingStartError(error), {
      code: "microphone-unavailable",
      message: "The microphone is unavailable. End any call or other recording, then try again.",
      action: "retry",
    });
  }
});

test("classifyRecordingStartError recognizes native permission errors", () => {
  const failure = classifyRecordingStartError(new Error("Recording permission is not authorized"));
  assert.equal(failure.code, "permission-blocked");
  assert.equal(failure.action, "open-settings");
});

test("classifyRecordingStartError gives an actionable fallback", () => {
  assert.deepEqual(classifyRecordingStartError(new Error("Recorder failed unexpectedly")), {
    code: "initialization-failed",
    message: "Recording couldn’t start. Check your microphone and try again.",
    action: "retry",
  });
});
