export function microphoneHint(): string | null {
  if (typeof window === "undefined") return "אין גישה למיקרופון";
  if (!window.isSecureContext) {
    return "הדפדפן חוסם את המיקרופון בלי https. פתחו את האתר בכתובת המאובטחת.";
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    return "הדפדפן הזה לא נותן גישה למיקרופון.";
  }
  return null;
}

export function microphoneErrorMessage(error: unknown) {
  const preset = microphoneHint();
  if (preset) return preset;
  const name = error instanceof DOMException ? error.name : "";
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return "לא נמצא מיקרופון מחובר למחשב.";
  }
  if (name === "NotAllowedError" || name === "PermissionDeniedError") {
    return "המיקרופון חסום. לחצו על המנעול ליד הכתובת למעלה ואפשרו מיקרופון, ואז נסו שוב.";
  }
  if (name === "NotReadableError" || name === "TrackStartError") {
    return "המיקרופון תפוס על ידי תוכנה אחרת. סגרו אותה ונסו שוב.";
  }
  if (error instanceof Error && error.message) return error.message;
  return "אין גישה למיקרופון";
}

export function pickRecorderMime() {
  if (typeof MediaRecorder === "undefined") return "";
  const options = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"];
  return options.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
}

export async function requestMicrophone(): Promise<MediaStream> {
  const blocked = microphoneHint();
  if (blocked) throw new Error(blocked);
  return navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true },
  });
}
