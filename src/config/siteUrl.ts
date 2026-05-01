/** Canonical public URL (prod). Override with VITE_PUBLIC_SITE_URL for staging. */
const raw = import.meta.env.VITE_PUBLIC_SITE_URL;
export const PUBLIC_SITE_URL =
  typeof raw === "string" && raw.trim() ? raw.replace(/\/$/, "") : "https://mymusics.murad.gg";
