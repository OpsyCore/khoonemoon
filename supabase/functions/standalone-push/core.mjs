/** Edge worker core: dependencies injected for tests. Never log keys or endpoints. */
export async function handlePush(
  req,
  { rpc, generateVapid, setVapid, send, subject },
) {
  const reply = (status) =>
    new Response(null, { status, headers: { "Cache-Control": "no-store" } });
  if (req.method !== "POST") return reply(405);
  const nonce = req.headers.get("x-dispatch-nonce");
  if (!nonce || !/^[0-9a-f]{64}$/.test(nonce)) return reply(401);
  try {
    if (
      (await rpc("standalone_push_consume_nonce", { p_nonce: nonce })) !== true
    )
      return reply(401);
    let keys = await rpc("standalone_push_vapid", {
      p_public: null,
      p_private: null,
    });
    if (keys === null) {
      const fresh = generateVapid();
      keys = await rpc("standalone_push_vapid", {
        p_public: fresh.publicKey,
        p_private: fresh.privateKey,
      });
    }
    if (
      !keys ||
      typeof keys.public_key !== "string" ||
      typeof keys.private_key !== "string"
    )
      return reply(503);
    setVapid(subject, keys.public_key, keys.private_key);
    const jobs = await rpc("standalone_push_claim", { p_limit: 10 });
    if (!Array.isArray(jobs) || jobs.length > 10) return reply(503);
    let failed = false;
    await Promise.all(
      jobs.map(async (job) => {
        try {
          let endpoint;
          try {
            endpoint = new URL(job.endpoint);
          } catch {
            endpoint = null;
          }
          let outcome;
          if (
            !endpoint ||
            job.endpoint.length > 2000 ||
            endpoint.protocol !== "https:" ||
            endpoint.username ||
            endpoint.password ||
            endpoint.port ||
            endpoint.hash ||
            ![
              "updates.push.services.mozilla.com",
              "push.services.mozilla.com",
            ].includes(endpoint.hostname)
          )
            outcome = "stale";
          else if (
            (await rpc("standalone_push_validate", {
              p_job: job.job_id,
              p_token: job.token,
            })) !== true
          )
            outcome = "retry";
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
          if (
            (await rpc("standalone_push_finish", {
              p_job: job.job_id,
              p_token: job.token,
              p_result: outcome,
            })) !== true
          )
            failed = true;
        } catch {
          failed = true;
        } // lease expires; delivery is never claimed on uncertainty
      }),
    );
    return reply(failed ? 503 : 204);
  } catch {
    return reply(503);
  }
}
