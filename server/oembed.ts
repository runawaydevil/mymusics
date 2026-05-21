const DEFAULT_SITE = "https://mymusics.murad.gg";

export function buildOEmbedResponse(
  requestUrl: string,
  siteOrigin: string = process.env.PUBLIC_SITE_URL?.trim() || DEFAULT_SITE,
): Record<string, unknown> | null {
  let parsed: URL;
  try {
    parsed = new URL(requestUrl);
  } catch {
    return null;
  }
  const allowedHosts = new Set([
    new URL(siteOrigin).host,
    "mymusics.murad.gg",
    "localhost",
    "127.0.0.1",
  ]);
  if (!allowedHosts.has(parsed.host)) return null;
  if (!parsed.pathname.startsWith("/embed")) return null;

  const iframeSrc = `${siteOrigin.replace(/\/$/, "")}/embed${parsed.search}`;
  const html = `<iframe src="${iframeSrc}" title="MyMusics" width="380" height="540" style="max-width:100%;border:0;border-radius:12px" loading="lazy" allow="autoplay"></iframe>`;

  return {
    version: "1.0",
    type: "rich",
    provider_name: "MyMusics",
    provider_url: siteOrigin,
    title: "MyMusics Player",
    width: 380,
    height: 540,
    html,
  };
}
