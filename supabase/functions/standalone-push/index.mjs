import webpush from "npm:web-push@3.6.7";
import { handlePush } from "./core.mjs";
const origin = Deno.env.get("SUPABASE_URL");
const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
async function rpc(name, body) {
  const res = await fetch(`${origin}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error("RPC failed");
  return res.json();
}
Deno.serve((req) =>
  handlePush(req, {
    rpc,
    generateVapid: () => webpush.generateVAPIDKeys(),
    setVapid: (subject, pub, priv) =>
      webpush.setVapidDetails(subject, pub, priv),
    send: (subscription) =>
      webpush.sendNotification(subscription, undefined, {
        TTL: 3600,
        urgency: "normal",
        timeout: 10000,
      }),
    subject: origin,
  }),
);
