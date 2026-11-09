/** Values in a Vite bundle are public. Never bundle a secret or service key. */
export function validateMobileConfig(
  url: string | undefined,
  key: string | undefined,
) {
  if (!url || !key)
    throw new Error(
      "VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are required for a mobile build.",
    );
  let origin: URL;
  try {
    origin = new URL(url);
  } catch {
    throw new Error("Invalid Supabase URL.");
  }
  if (
    origin.protocol !== "https:" ||
    origin.username ||
    origin.password ||
    origin.search ||
    origin.hash ||
    origin.pathname !== "/"
  ) {
    throw new Error(
      "Supabase URL must be an HTTPS origin without credentials, path, query or fragment.",
    );
  }
  if (key.startsWith("sb_publishable_")) return;
  // Legacy Supabase anon JWTs have role=anon; reject all other JWT roles.
  try {
    const parts = key.split(".");
    if (parts.length !== 3) throw new Error();
    const payload = JSON.parse(
      Buffer.from(parts[1], "base64url").toString("utf8"),
    );
    if (payload.role === "anon") return;
  } catch {
    /* rejected below */
  }
  throw new Error(
    "Only a Supabase publishable or legacy anon key may be bundled; never use a secret/service-role key.",
  );
}

/** Safely place validated public client config in root HTML attributes. */
export function mobileRuntimeAttributes(
  url: string | undefined,
  key: string | undefined,
): string {
  if (!url || !key) return "";
  const escape = (value: string) =>
    value.replace(
      /[&"<>]/g,
      (char) =>
        ({ "&": "&amp;", '"': "&quot;", "<": "&lt;", ">": "&gt;" })[char]!,
    );
  return `data-supabase-url="${escape(url)}" data-supabase-anon-key="${escape(key)}"`;
}

/** Restrict connections to the configured HTTPS Supabase origin and its realtime socket. */
export function mobileConnectSources(url: string | undefined): string {
  if (!url) return "";
  const origin = new URL(url);
  if (
    origin.protocol !== "https:" ||
    origin.username ||
    origin.password ||
    origin.search ||
    origin.hash ||
    origin.pathname !== "/"
  )
    throw new Error("Invalid Supabase origin for CSP.");
  return `${origin.origin} wss://${origin.host}`;
}
