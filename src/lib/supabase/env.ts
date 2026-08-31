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

export type SupabaseKeyDiagnostics = {
  keyType: "publishable" | "legacy-jwt" | "unknown";
  keyLength: number;
  /** First 8 characters only — never the full key. */
  keyPrefix: string;
  hasMarkdownArtifacts: boolean;
  /** Decoded from the JWT payload (public metadata, not a secret). */
  jwtProjectRef: string | null;
  jwtRole: string | null;
  jwtExpiresAt: string | null;
};

function decodeBase64Url(segment: string): string | null {
  try {
    const base64 = segment.replace(/-/g, "+").replace(/_/g, "/");
    if (typeof atob === "function") {
      return atob(base64);
    }
    return Buffer.from(base64, "base64").toString("utf8");
  } catch {
    return null;
  }
}

/**
 * Development-only key fingerprint. Exposes key type, length, first 8
 * characters and (for legacy JWTs) the public payload claims — NEVER the
 * key itself.
 */
export function getSupabaseKeyDiagnostics(
  rawKey: string,
): SupabaseKeyDiagnostics {
  const key = sanitize(rawKey);
  const hasMarkdownArtifacts = describeFormatProblem(key) !== null;

  let keyType: SupabaseKeyDiagnostics["keyType"] = "unknown";
  if (key.startsWith("sb_publishable_")) {
    keyType = "publishable";
  } else if (key.startsWith("eyJ") && key.split(".").length === 3) {
    keyType = "legacy-jwt";
  }

  let jwtProjectRef: string | null = null;
  let jwtRole: string | null = null;
  let jwtExpiresAt: string | null = null;

  if (keyType === "legacy-jwt") {
    const payloadJson = decodeBase64Url(key.split(".")[1]);
    if (payloadJson) {
      try {
        const payload = JSON.parse(payloadJson) as {
          ref?: string;
          role?: string;
          exp?: number;
        };
        jwtProjectRef = payload.ref ?? null;
        jwtRole = payload.role ?? null;
        jwtExpiresAt =
          typeof payload.exp === "number"
            ? new Date(payload.exp * 1000).toISOString()
            : null;
      } catch {
        // Malformed payload — leave nulls.
      }
    }
  }

  return {
    keyType,
    keyLength: key.length,
    keyPrefix: key.slice(0, 8),
    hasMarkdownArtifacts,
    jwtProjectRef,
    jwtRole,
    jwtExpiresAt,
  };
}

/**
 * Development-only one-line summary of the Supabase connection config the
 * browser is actually using: URL, key type/length/prefix, Markdown-artifact
 * flag, and legacy-JWT payload cross-checks (project ref match, role,
 * expiry). Returns null in production. Never includes the key value.
 */
export function getSupabaseConfigDebugText(): string | null {
  if (process.env.NODE_ENV === "production") {
    return null;
  }

  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const rawKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

  if (!rawUrl || !rawKey) {
    return "supabase config: missing NEXT_PUBLIC_SUPABASE_URL and/or NEXT_PUBLIC_SUPABASE_ANON_KEY";
  }

  const url = sanitize(rawUrl);
  const d = getSupabaseKeyDiagnostics(rawKey);

  const urlRef = /^https?:\/\/([a-z0-9]+)\.supabase\.co/.exec(url)?.[1] ?? null;

  const parts = [
    `url=${url}`,
    `keyType=${d.keyType}`,
    `keyLength=${d.keyLength}`,
    `keyPrefix=${d.keyPrefix}…`,
    `markdownArtifacts=${d.hasMarkdownArtifacts ? "YES" : "no"}`,
  ];

  if (d.keyType === "legacy-jwt") {
    parts.push(
      `jwtRef=${d.jwtProjectRef ?? "?"}`,
      `jwtRole=${d.jwtRole ?? "?"}`,
      `jwtExp=${d.jwtExpiresAt ?? "?"}`,
    );
    if (urlRef && d.jwtProjectRef && urlRef !== d.jwtProjectRef) {
      parts.push(
        `MISMATCH: key belongs to project ${d.jwtProjectRef}, URL points to ${urlRef}`,
      );
    }
    if (d.jwtExpiresAt && new Date(d.jwtExpiresAt).getTime() < Date.now()) {
      parts.push("EXPIRED: key exp is in the past");
    }
  }

  return parts.join(" | ");
}
