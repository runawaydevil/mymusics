export type ClientEventType = "stream_error" | "time_to_play";

export function reportEvent(payload: {
  type: ClientEventType;
  trackId?: string;
  detail?: string;
  ms?: number;
}): void {
  void fetch("/api/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).catch(() => {});
}
