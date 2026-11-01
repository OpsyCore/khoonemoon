/** A stateless, cron-invoked worker for the independent Web Push queue.
 * Service credentials and the VAPID private key are runtime-only; never bundle
 * this module into the client or print credentials/endpoints/response bodies.
 */
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";
import { pathToFileURL } from "node:url";

export function safeMozillaEndpoint(value) {
  try {
    if (typeof value !== "string" || value.length > 2000) return false;
    const u = new URL(value);
    return (
      u.protocol === "https:" &&
      !u.username &&
      !u.password &&
      !u.port &&
      !u.hash &&
      (u.hostname === "updates.push.services.mozilla.com" ||
        u.hostname === "push.services.mozilla.com")
    );
  } catch {
    return false;
  }
}
export async function dispatchBatch({ client, send, size = 10 }) {
  if (!Number.isInteger(size) || size < 1 || size > 10)
    throw new Error("invalid batch size");
  const { data: jobs, error } = await client.rpc("standalone_push_claim", {
    p_limit: size,
  });
  if (error || !Array.isArray(jobs)) throw new Error("claim failed");
  const counts = {
    claimed: jobs.length,
    sent: 0,
    expired: 0,
    retry: 0,
    stale: 0,
    errors: 0,
  };
  await Promise.all(
    jobs.map(async (job) => {
      let outcome;
      try {
        if (!safeMozillaEndpoint(job.endpoint)) outcome = "stale";
        else {
          const valid = await client.rpc("standalone_push_validate", {
            p_job: job.job_id,
            p_token: job.token,
          });
          if (valid.error) {
            counts.errors++;
            return;
          } // let the lease expire
          if (valid.data !== true)
            outcome = "retry"; // may only be temporarily quiet
          else {
            try {
              await send({
                endpoint: job.endpoint,
                keys: { p256dh: job.p256dh, auth: job.auth },
              });
              outcome = "sent";
            } catch (error) {
              outcome = [404, 410].includes(error?.statusCode)
                ? "expired"
                : "retry";
            }
          }
        }
        const finished = await client.rpc("standalone_push_finish", {
          p_job: job.job_id,
          p_token: job.token,
          p_result: outcome,
        });
        if (finished.error || finished.data !== true) counts.errors++;
        else counts[outcome]++;
      } catch {
        counts.errors++;
      } // don't reveal secrets or mark uncertain delivery successful
    }),
  );
  return counts;
}
export function configFromEnv(env) {
  const {
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY,
    VAPID_SUBJECT,
  } = env;
  if (
    !SUPABASE_URL ||
    !SUPABASE_SERVICE_ROLE_KEY ||
    !VAPID_PUBLIC_KEY ||
    !VAPID_PRIVATE_KEY ||
    !VAPID_SUBJECT
  )
    throw new Error("Missing server configuration");
  const origin = new URL(SUPABASE_URL);
  if (
    origin.protocol !== "https:" ||
    origin.username ||
    origin.password ||
    origin.pathname !== "/" ||
    origin.search ||
    origin.hash
  )
    throw new Error("Invalid Supabase origin");
  if (
    !VAPID_SUBJECT.startsWith("mailto:") &&
    !VAPID_SUBJECT.startsWith("https://")
  )
    throw new Error("Invalid VAPID subject");
  return {
    url: origin.origin,
    serviceKey: SUPABASE_SERVICE_ROLE_KEY,
    publicKey: VAPID_PUBLIC_KEY,
    privateKey: VAPID_PRIVATE_KEY,
    subject: VAPID_SUBJECT,
  };
}
async function main() {
  const config = configFromEnv(process.env);
  webpush.setVapidDetails(config.subject, config.publicKey, config.privateKey);
  const client = createClient(config.url, config.serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) =>
        fetch(input, { ...init, signal: AbortSignal.timeout(15000) }),
    },
  });
  let errors = 0;
  for (let i = 0; i < 10; i++) {
    const counts = await dispatchBatch({
      client,
      send: (subscription) =>
        webpush.sendNotification(subscription, undefined, {
          TTL: 3600,
          urgency: "normal",
          timeout: 10000,
        }),
    });
    console.log(
      `batch ${i + 1}: claimed=${counts.claimed}, sent=${counts.sent}, expired=${counts.expired}, retry=${counts.retry}, stale=${counts.stale}, errors=${counts.errors}`,
    );
    errors += counts.errors;
    if (counts.claimed < 10) break;
  }
  if (errors) process.exitCode = 1;
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch(() => {
    console.error(
      "Standalone push dispatch failed; check server configuration and connectivity.",
    );
    process.exitCode = 1;
  });
}
