import { describe, expect, it } from "vitest";
import { generateKeyPairSync, sign } from "node:crypto";
import { verifyGithubWorkloadIdentity } from "../../supabase/functions/project-backup/oidc.mjs";
const pair = generateKeyPairSync("rsa", { modulusLength: 2048 });
const jwk = {
  ...pair.publicKey.export({ format: "jwk" }),
  kid: "test-key",
  alg: "RS256",
  use: "sig",
};
const sha = "a".repeat(40),
  now = 1700000000;
const claims = {
  iss: "https://token.actions.githubusercontent.com",
  aud: "khoonemoon-backup-isfzuxrkzeeeggvfcoah",
  repository_id: "1338213501",
  repository_owner_id: "241570151",
  actor_id: "241570151",
  ref: "refs/heads/arena/00d965b0-khoonemoon",
  workflow_ref:
    "OpsyCore/khoonemoon/.github/workflows/backup-network-check.yml@refs/heads/arena/00d965b0-khoonemoon",
  event_name: "push",
  sha,
  iat: now - 10,
  nbf: now - 10,
  exp: now + 200,
  jti: "unique-token",
  run_id: "42",
  run_attempt: "1",
};
const enc = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
function token(
  payload = claims,
  header = { alg: "RS256", typ: "JWT", kid: "test-key" },
) {
  const message = `${enc(header)}.${enc(payload)}`;
  return `${message}.${sign("RSA-SHA256", Buffer.from(message), pair.privateKey).toString("base64url")}`;
}
describe("GitHub backup workload identity", () => {
  it("verifies a signed pinned identity and returns only replay metadata", async () => {
    expect(
      await verifyGithubWorkloadIdentity(token(), [jwk], sha, now),
    ).toEqual({ jti: "unique-token", runId: "42", expiresAt: now + 200 });
  });
  it("rejects modified identity, unapproved revision and expired or replayed attempt", async () => {
    for (const patch of [
      { actor_id: "2" },
      { repository_id: "2" },
      { repository_owner_id: "2" },
      { ref: "refs/heads/main" },
      { workflow_ref: "other" },
      { event_name: "pull_request" },
      { sha: "b".repeat(40) },
      { aud: "other" },
      { iss: "other" },
      { exp: now },
      { exp: now + 900 },
      { iat: now - 301 },
      { nbf: now + 31 },
      { jti: "" },
      { run_id: "x" },
      { run_attempt: "2" },
    ]) {
      await expect(
        verifyGithubWorkloadIdentity(
          token({ ...claims, ...patch }),
          [jwk],
          sha,
          now,
        ),
      ).rejects.toThrow("Invalid workload identity");
    }
  });
  it("rejects invalid signature, ambiguous key sets and dangerous JWT headers", async () => {
    const t = token();
    await expect(
      verifyGithubWorkloadIdentity(t.slice(0, -4) + "AAAA", [jwk], sha, now),
    ).rejects.toThrow();
    await expect(
      verifyGithubWorkloadIdentity(t, [jwk, jwk], sha, now),
    ).rejects.toThrow();
    await expect(
      verifyGithubWorkloadIdentity(
        token(claims, {
          alg: "RS256",
          typ: "JWT",
          kid: "test-key",
          jku: "https://evil.test",
        }),
        [jwk],
        sha,
        now,
      ),
    ).rejects.toThrow();
    await expect(
      verifyGithubWorkloadIdentity(t, [jwk], "b".repeat(40), now),
    ).rejects.toThrow();
  });
});
