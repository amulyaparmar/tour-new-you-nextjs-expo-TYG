export type RecordingStartFailure = {
  code: "permission-denied" | "permission-blocked" | "microphone-unavailable" | "initialization-failed";
  message: string;
  action: "retry" | "open-settings";
};

export type RecordingStartResult =
  | { ok: true }
  | { ok: false; failure: RecordingStartFailure };

type RecordingPermission = {
  granted: boolean;
  canAskAgain?: boolean;
};

export function permissionStartFailure(permission: RecordingPermission): RecordingStartFailure | null {
  if (permission.granted) return null;

  if (permission.canAskAgain === false) {
    return {
      code: "permission-blocked",
      message: "Microphone access is unavailable. Check Settings or device restrictions, then try again.",
      action: "open-settings",
    };
  }

  return {
    code: "permission-denied",
    message: "Allow microphone access to start recording, then try again.",
    action: "retry",
  };
}

function errorDetails(error: unknown): string {
  if (error instanceof Error) {
    const cause = "cause" in error ? String(error.cause ?? "") : "";
    return `${error.name} ${error.message} ${cause}`;
  }

  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    return [record.name, record.message, record.code, record.domain, record.cause]
      .filter(Boolean)
      .map(String)
      .join(" ");
  }

  return String(error ?? "");
}

export function classifyRecordingStartError(error: unknown): RecordingStartFailure {
  const details = errorDetails(error);

  if (/permission|not authori[sz]ed|recording.*not allowed|microphone.*denied|record_audio/i.test(details)) {
    return {
      code: "permission-blocked",
      message: "Microphone access is unavailable. Check Settings or device restrictions, then try again.",
      action: "open-settings",
    };
  }

  // These iOS AVAudioSession failures commonly occur while a phone or VoIP
  // call, or another app, owns the recording route.
  if (
    /audio.?session|avaudiosession|cannot.?start.?recording|cannot.?interrupt|insufficient.?priority|microphone.*(?:busy|in use|unavailable)|(?:busy|in use).*microphone|osstatus.*(?:561145187|561017449|560557684)|!rec|!pri|!int/i.test(details)
  ) {
    return {
      code: "microphone-unavailable",
      message: "The microphone is unavailable. End any call or other recording, then try again.",
      action: "retry",
    };
  }

  return {
    code: "initialization-failed",
    message: "Recording couldn’t start. Check your microphone and try again.",
    action: "retry",
  };
}
