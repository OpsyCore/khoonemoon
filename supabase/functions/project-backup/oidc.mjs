/**
 * Fail-closed GitHub Actions identity validation. Verifies identity only; it
 * does not authorize access, consume jti, issue credentials, or serve backups.
 * The caller must obtain keys from GitHub's fixed HTTPS JWKS endpoint, pin a
 * previously reviewed commit, and atomically consume the jti before granting
 * any privileged access. Never log the bearer token or raw request.
 */
const ISSUER = "https://token.actions.githubusercontent.com";
const AUDIENCE = "khoonemoon-backup-isfzuxrkzeeeggvfcoah";
const REPOSITORY_ID = "1338213501";
const OWNER_ID = "241570151";
const ACTOR_ID = "241570151";
const REF = "refs/heads/arena/00d965b0-khoonemoon";
const WORKFLOW = `OpsyCore/khoonemoon/.github/workflows/backup-network-check.yml@${REF}`;

function fail() {
  throw new Error("Invalid workload identity.");
}
function decode(part) {
  if (!part || !/^[A-Za-z0-9_-]+$/.test(part)) return fail();
  const binary = atob(
    part
      .replace(/-/g, "+")
      .replace(/_/g, "/")
      .padEnd(Math.ceil(part.length / 4) * 4, "="),
  );
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}
function parse(part) {
  const value = JSON.parse(
    new TextDecoder("utf-8", { fatal: true }).decode(decode(part)),
  );
  if (!value || typeof value !== "object" || Array.isArray(value))
    return fail();
  return value;
}

export async function verifyGithubWorkloadIdentity(
  token,
  keys,
  approvedSha,
  now = Math.floor(Date.now() / 1000),
) {
  try {
    if (
      typeof token !== "string" ||
      token.length > 16000 ||
      !Array.isArray(keys) ||
      keys.length > 100 ||
      !/^[a-f0-9]{40}$/.test(approvedSha) ||
      !Number.isSafeInteger(now)
    )
      return fail();
    const parts = token.split(".");
    if (parts.length !== 3) return fail();
    const header = parse(parts[0]);
    const claims = parse(parts[1]);
    if (
      header.alg !== "RS256" ||
      header.typ !== "JWT" ||
      typeof header.kid !== "string" ||
      header.kid.length > 256 ||
      "crit" in header ||
      "jku" in header ||
      "x5u" in header
    )
      return fail();
    const matches = keys.filter(
      (k) =>
        k &&
        k.kid === header.kid &&
        k.kty === "RSA" &&
        (!k.alg || k.alg === "RS256") &&
        (!k.use || k.use === "sig"),
    );
    if (matches.length !== 1) return fail();
    const jwk = matches[0];
    const key = await crypto.subtle.importKey(
      "jwk",
      jwk,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"],
    );
    if ((key.algorithm.modulusLength ?? 0) < 2048) return fail();
    const valid = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      key,
      decode(parts[2]),
      new TextEncoder().encode(`${parts[0]}.${parts[1]}`),
    );
    if (!valid) return fail();
    if (
      claims.iss !== ISSUER ||
      claims.aud !== AUDIENCE ||
      claims.repository_id !== REPOSITORY_ID ||
      claims.repository_owner_id !== OWNER_ID ||
      claims.actor_id !== ACTOR_ID ||
      claims.ref !== REF ||
      claims.workflow_ref !== WORKFLOW ||
      claims.event_name !== "push" ||
      claims.sha !== approvedSha ||
      !Number.isSafeInteger(claims.iat) ||
      !Number.isSafeInteger(claims.nbf) ||
      !Number.isSafeInteger(claims.exp) ||
      claims.iat > now + 30 ||
      claims.iat < now - 300 ||
      claims.nbf > now + 30 ||
      claims.exp <= now ||
      claims.exp > claims.iat + 600 ||
      typeof claims.jti !== "string" ||
      claims.jti.length < 1 ||
      claims.jti.length > 256 ||
      typeof claims.run_id !== "string" ||
      !/^[0-9]+$/.test(claims.run_id) ||
      claims.run_attempt !== "1"
    )
      return fail();
    return { jti: claims.jti, runId: claims.run_id, expiresAt: claims.exp };
  } catch {
    return fail();
  }
}
