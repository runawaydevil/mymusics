const VOLUME_KEY = "mymusics:volume";

export function loadStoredVolume(): number | null {
  try {
    const raw = localStorage.getItem(VOLUME_KEY);
    if (raw === null) return null;
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0 || n > 1) return null;
    return n;
  } catch {
    return null;
  }
}

export function saveVolume(value: number): void {
  try {
    localStorage.setItem(VOLUME_KEY, String(Math.min(1, Math.max(0, value))));
  } catch {
    /* ignore */
  }
}
