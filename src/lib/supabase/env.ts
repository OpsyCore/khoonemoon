const URL_VAR = "NEXT_PUBLIC_SUPABASE_URL";
const KEY_VAR = "NEXT_PUBLIC_SUPABASE_ANON_KEY";

function sanitize(raw: string) {
  // Remove accidental surrounding quotes and whitespace picked up from
  // copy/paste (a recurring source of "Invalid API key" 401s).
  return raw
    .trim()
    .replace(/^["']+/, "")
    .replace(/["']+$/, "");
}

function describeFormatProblem(value: string): string | null {
  if (/[\[\]]/.test(value)) {
    return "contains square brackets — looks like pasted Markdown, use the raw value";
  }
  if (value.includes("\\_")) {
    return "contains backslash-escaped underscores (\\_) — Markdown artifact, use the raw value";
  }
  if (/\(https?:\/\//.test(value)) {
    return "contains a '(https://...)' fragment — looks like a pasted Markdown link";
  }
  if (/\s/.test(value)) {
    return "contains whitespace in the middle of the value";
  }
  return null;
}

function looksLikeSupabaseKey(value: string) {
  // Legacy anon key: a JWT (three dot-separated base64url segments starting
  // with "eyJ"). Modern key: "sb_publishable_..." (or "sb_secret_..." on the
  // server — never in the browser).
  const isLegacyJwt = value.startsWith("eyJ") && value.split(".").length === 3;
  const isPublishable = value.startsWith("sb_publishable_");
  return isLegacyJwt || isPublishable;
}

export function getSupabaseEnv() {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const rawAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!rawUrl || !rawAnonKey) {
    throw new Error(
      `Supabase environment variables are not configured. Set ${URL_VAR} and ${KEY_VAR} in .env.local and restart the dev server.`,
    );
  }

  const url = sanitize(rawUrl);
  const anonKey = sanitize(rawAnonKey);

  const urlProblem = describeFormatProblem(url);
  if (urlProblem) {
    throw new Error(`${URL_VAR} is malformed: ${urlProblem}.`);
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(
      `${URL_VAR} is not a valid URL. Expected the form https://<project-ref>.supabase.co with no trailing path.`,
    );
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error(`${URL_VAR} must start with https://`);
  }

  const keyProblem = describeFormatProblem(anonKey);
  if (keyProblem) {
    // Never include the key value itself in the error.
    throw new Error(`${KEY_VAR} is malformed: ${keyProblem}.`);
  }

  if (anonKey.startsWith("sb_secret_")) {
    throw new Error(
      `${KEY_VAR} is set to a secret key (sb_secret_...). Use the publishable key (sb_publishable_...) or the legacy anon JWT — never the secret key in the browser.`,
    );
  }

  if (!looksLikeSupabaseKey(anonKey)) {
    throw new Error(
      `${KEY_VAR} does not look like a valid Supabase API key. Expected a legacy anon JWT (starts with "eyJ", two dots) or a publishable key (starts with "sb_publishable_"). Copy it from Supabase Dashboard → Project Settings → API Keys, then restart the dev server.`,
    );
  }

  return { url: parsed.origin, anonKey };
}
