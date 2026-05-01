/**
 * Predefined port pools for API and Vite dev server.
 * Override with PORT / VITE_DEV_PORT, or pick a slot with PORT_INDEX (and optional VITE_PORT_INDEX).
 */

export const PREDEFINED_API_PORTS = [38471, 41892, 45203, 47741] as const;
export const PREDEFINED_DEV_WEB_PORTS = [38472, 41893, 45204, 47742] as const;

function clampIndex(i: number, len: number): number {
  if (!Number.isFinite(i) || i < 0) return 0;
  if (i >= len) return len - 1;
  return Math.floor(i);
}

export function resolveApiPort(env: NodeJS.ProcessEnv): number {
  const explicit = env.PORT?.trim();
  if (explicit) {
    const n = Number(explicit);
    if (Number.isFinite(n) && n > 0 && n < 65536) return n;
  }
  const idx = clampIndex(Number(env.PORT_INDEX), PREDEFINED_API_PORTS.length);
  return PREDEFINED_API_PORTS[idx]!;
}

export function resolveDevWebPort(env: NodeJS.ProcessEnv): number {
  const explicit = env.VITE_DEV_PORT?.trim();
  if (explicit) {
    const n = Number(explicit);
    if (Number.isFinite(n) && n > 0 && n < 65536) return n;
  }
  const raw = env.VITE_PORT_INDEX ?? env.PORT_INDEX;
  const idx = clampIndex(Number(raw), PREDEFINED_DEV_WEB_PORTS.length);
  return PREDEFINED_DEV_WEB_PORTS[idx]!;
}
