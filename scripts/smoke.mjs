import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const APP = process.env.APP_URL ?? "http://127.0.0.1:3000";
const REF = new URL(SUPABASE_URL).hostname.split(".")[0];
const COOKIE = `sb-${REF}-auth-token`;

const admin = createClient(SUPABASE_URL, SERVICE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function log(step, ok, extra = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${step} ${extra}`);
  if (!ok) process.exitCode = 1;
}

async function sessionFor(email, password) {
  const { error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createError && !/already/i.test(createError.message)) {
    throw createError;
  }

  const client = createClient(SUPABASE_URL, ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;
  return data.session;
}

function cookieHeader(session) {
  return `${COOKIE}=${encodeURIComponent(JSON.stringify(session))}`;
}

async function call(session, path, init = {}) {
  return fetch(`${APP}${path}`, {
    ...init,
    headers: {
      cookie: cookieHeader(session),
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...(init.headers ?? {}),
    },
    redirect: "manual",
  });
}

const stamp = Date.now();
const emailA = `smoke-a-${stamp}@khoonemoon.test`;
const emailB = `smoke-b-${stamp}@khoonemoon.test`;
const password = "SmokeTest1234!";

const sessionA = await sessionFor(emailA, password);
const sessionB = await sessionFor(emailB, password);

// Anonymous access is rejected.
const anon = await fetch(`${APP}/api/chores`, { redirect: "manual" });
log("anonymous /api/chores is 401", anon.status === 401, `(${anon.status})`);

// Signup hook must have created a profile row.
const { data: profile } = await admin
  .from("profiles")
  .select("id")
  .eq("id", sessionA.user.id)
  .maybeSingle();
log("profile auto-created for new user", Boolean(profile));

// Create household through the RPC used by the UI.
const supabaseA = createClient(SUPABASE_URL, ANON, {
  global: { headers: { Authorization: `Bearer ${sessionA.access_token}` } },
  auth: { persistSession: false, autoRefreshToken: false },
});
const { data: householdId, error: householdError } = await supabaseA.rpc(
  "create_household",
  { p_name: `خانه تست ${stamp}` },
);
log("create_household RPC", !householdError, householdError?.message ?? "");

// Pages render for an authenticated user.
const today = await call(sessionA, "/today");
const todayHtml = await today.text();
log("GET /today renders", today.status === 200, `(${today.status})`);
log(
  "GET /today shows dashboard heading",
  todayHtml.includes("امروز چه کارهایی داریم"),
);

const lists = await call(sessionA, "/lists");
log("GET /lists renders", lists.status === 200, `(${lists.status})`);

// Shopping list + item + realtime-ready toggle.
const listRes = await call(sessionA, "/api/shopping/lists", {
  method: "POST",
  body: JSON.stringify({ name: "خرید تست" }),
});
log("create shopping list", listRes.status === 201, `(${listRes.status})`);
const { list } = await listRes.json();

const itemRes = await call(sessionA, "/api/shopping/items", {
  method: "POST",
  body: JSON.stringify({ listId: list.id, name: "شیر" }),
});
log("add shopping item", itemRes.status === 201, `(${itemRes.status})`);
const { item } = await itemRes.json();

const toggleRes = await call(sessionA, `/api/shopping/items/${item.id}`, {
  method: "PATCH",
  body: JSON.stringify({ purchased: true }),
});
const toggled = await toggleRes.json();
log(
  "toggle item purchased",
  toggleRes.ok && toggled.item?.purchased === true,
);

// Chores: create + complete (rotation + reschedule).
const choreRes = await call(sessionA, "/api/chores", {
  method: "POST",
  body: JSON.stringify({
    title: "شستن ظرف‌ها",
    rotationMode: "FIXED",
    frequency: "WEEKLY",
    assigneeIds: [sessionA.user.id],
  }),
});
log("create chore", choreRes.status === 201, `(${choreRes.status})`);
const { id: choreId } = await choreRes.json();

const completeRes = await call(sessionA, `/api/chores/${choreId}/complete`, {
  method: "POST",
});
const completed = await completeRes.json();
log(
  "complete chore reschedules next due",
  completeRes.ok && Boolean(completed.nextDueAt),
  completed.nextDueAt ?? "",
);

// Finance: bill becomes overdue → shows up in the finance board.
const billRes = await call(sessionA, "/api/finance", {
  method: "POST",
  body: JSON.stringify({
    title: "قبض برق",
    recordType: "BILL",
    amount: 450000,
    visibility: "HOUSEHOLD_SHARED",
    dueAt: new Date(Date.now() - 86400000).toISOString(),
  }),
});
const bill = await billRes.json();
log("create bill", billRes.status === 201, `(${billRes.status})`);
log("bill auto-marked overdue", bill.record?.bill_status === "OVERDUE");

// Search finds the household data for a member...
const searchRes = await call(sessionA, "/api/search?q=%D8%B4%DB%8C%D8%B1");
const { results } = await searchRes.json();
log("search finds own shopping item", results.length > 0, `(${results.length})`);

// ...and returns nothing for an outsider.
const outsiderSearch = await call(sessionB, "/api/search?q=%D8%B4%DB%8C%D8%B1");
const outsider = await outsiderSearch.json();
log("outsider search is empty (RLS)", outsider.results.length === 0);

const outsiderChores = await call(sessionB, "/api/chores");
const outsiderChoresBody = await outsiderChores.json();
log(
  "outsider list API is empty (RLS)",
  outsiderChoresBody.chores.length === 0,
);

// Cleanup test accounts so the project stays tidy.
await admin.auth.admin.deleteUser(sessionA.user.id);
await admin.auth.admin.deleteUser(sessionB.user.id);
console.log("\nsmoke run finished");
