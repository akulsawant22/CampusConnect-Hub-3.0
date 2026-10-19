// Live concurrency + storage tests. DISPOSABLE TEST BACKEND ONLY — never production.
// Required env (all from the dedicated test environment, never production secrets):
//   CC_TEST_ENV=disposable
//   CC_TEST_BACKEND_URL      must exactly equal VITE_SUPABASE_URL
//   VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY   of the test backend
//   CC_TEST_SERVICE_ROLE_KEY service-role key of the TEST backend, used only for cleanup
//   CC_TEST_PW               password of the pre-created cc-*@campusconnect.test fixture accounts
// Optional: CC_PRODUCTION_SUPABASE_URL — the script refuses to run if it matches.
// Run: bun supabase/tests/concurrency.ts
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../src/integrations/supabase/types";

// ---- fail-closed guard: runs before any client is created or any network call ----
const PROD_REF = "soteduauaolzlrhdqcno"; // this project's live backend
const norm = (u?: string) => (u ?? "").trim().replace(/\/+$/, "").toLowerCase();
const URL = norm(process.env.VITE_SUPABASE_URL);
const reasons: string[] = [];
if (process.env.CC_TEST_ENV !== "disposable") reasons.push("CC_TEST_ENV must be 'disposable'");
if (!URL || norm(process.env.CC_TEST_BACKEND_URL) !== URL)
  reasons.push("CC_TEST_BACKEND_URL must exactly match VITE_SUPABASE_URL");
if (process.env.CC_PRODUCTION_SUPABASE_URL && norm(process.env.CC_PRODUCTION_SUPABASE_URL) === URL)
  reasons.push("VITE_SUPABASE_URL is the production URL");
if (URL.includes(PROD_REF))
  reasons.push("VITE_SUPABASE_URL points at the live CampusConnect backend");
if (!process.env.VITE_SUPABASE_PUBLISHABLE_KEY)
  reasons.push("VITE_SUPABASE_PUBLISHABLE_KEY missing");
if (!process.env.CC_TEST_SERVICE_ROLE_KEY)
  reasons.push("CC_TEST_SERVICE_ROLE_KEY (test backend, cleanup only) missing");
if (!process.env.CC_TEST_PW) reasons.push("CC_TEST_PW missing");
if (reasons.length) {
  console.error("Refusing to run:\n - " + reasons.join("\n - "));
  process.exit(2);
}

const KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY!;
const PW = process.env.CC_TEST_PW!;
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const svc = createClient<Database>(URL, process.env.CC_TEST_SERVICE_ROLE_KEY!, opts);
const runStart = new Date().toISOString();
const createdEvents: string[] = [];
const testUserIds: string[] = [];
let failures = 0;
const check = (name: string, cond: boolean, info = "") => {
  console.log(`${cond ? "PASS" : "FAIL"} ${name} ${info}`);
  if (!cond) failures++;
};

async function login(email: string): Promise<SupabaseClient<Database>> {
  const c = createClient<Database>(URL, KEY, opts);
  const { data, error } = await c.auth.signInWithPassword({ email, password: PW });
  if (error) throw new Error(`${email}: ${error.message}`);
  testUserIds.push(data.user.id);
  return c;
}

async function cleanup() {
  const errs: string[] = [];
  const run = async (label: string, p: PromiseLike<{ error: { message: string } | null }>) => {
    const { error } = await p;
    if (error) errs.push(`${label}: ${error.message}`);
  };
  if (createdEvents.length) {
    const { data: regs } = await svc
      .from("registrations")
      .select("id")
      .in("event_id", createdEvents);
    const regIds = (regs ?? []).map((r) => r.id);
    await run("certificates", svc.from("certificates").delete().in("event_id", createdEvents));
    await run("feedback", svc.from("feedback").delete().in("event_id", createdEvents));
    await run("attendance", svc.from("attendance").delete().in("event_id", createdEvents));
    if (regIds.length)
      await run("tickets", svc.from("tickets").delete().in("registration_id", regIds));
    await run("registrations", svc.from("registrations").delete().in("event_id", createdEvents));
    await run("event_staff", svc.from("event_staff").delete().in("event_id", createdEvents));
    for (const id of createdEvents) {
      const { data: files } = await svc.storage.from("event-covers").list(id);
      if (files?.length) {
        const { error } = await svc.storage
          .from("event-covers")
          .remove(files.map((f) => `${id}/${f.name}`));
        if (error) errs.push(`covers: ${error.message}`);
      }
    }
    await run("events", svc.from("events").delete().in("id", createdEvents));
  }
  if (testUserIds.length) {
    await run(
      "notifications",
      svc.from("notifications").delete().in("user_id", testUserIds).gte("created_at", runStart),
    );
    await run(
      "audit_logs",
      svc.from("audit_logs").delete().in("actor_id", testUserIds).gte("created_at", runStart),
    );
  }
  if (errs.length) {
    console.error("CLEANUP INCOMPLETE:\n - " + errs.join("\n - "));
    failures++;
  } else console.log("cleanup: removed all rows/files created by this run");
}

// Verify the cleanup credential works before creating anything.
{
  const { error } = await svc.from("events").select("id", { head: true, count: "exact" });
  if (error) {
    console.error("Refusing to run: cleanup credential invalid:", error.message);
    process.exit(2);
  }
}

try {
  const admin = await login("cc-admin@campusconnect.test");
  const org = await login("cc-org@campusconnect.test");
  const vol = await login("cc-vol@campusconnect.test");
  const students = await Promise.all(
    Array.from({ length: 20 }, (_, i) =>
      login(`cc-s${String(i + 3).padStart(2, "0")}@campusconnect.test`),
    ),
  );
  const orgId = (await org.auth.getUser()).data.user!.id;
  const volId = (await vol.auth.getUser()).data.user!.id;

  // organizer creates + publishes an event with capacity 5
  const day = 86400000;
  const { data: ev, error: evErr } = await org
    .from("events")
    .insert({
      organizer_id: orgId,
      title: "Concurrency Test Event",
      starts_at: new Date(Date.now() + 2 * day).toISOString(),
      ends_at: new Date(Date.now() + 3 * day).toISOString(),
      registration_deadline: new Date(Date.now() + day).toISOString(),
      capacity: 5,
      status: "published",
    })
    .select("id")
    .single();
  check("organizer can create+publish event", !evErr && !!ev, evErr?.message);
  const eventId = ev!.id;
  createdEvents.push(eventId);

  // student cannot publish/edit someone else's event
  const { data: hijack } = await students[0]!
    .from("events")
    .update({ title: "hacked" })
    .eq("id", eventId)
    .select();
  check("student cannot edit event", (hijack ?? []).length === 0);

  // 20 students register simultaneously for 5 seats
  const results = await Promise.all(
    students.map((s) => s.rpc("register_for_event", { _event_id: eventId })),
  );
  const ok = results.filter((r) => !r.error).length;
  const full = results.filter((r) => r.error?.message.includes("full")).length;
  check(
    "concurrent registration: exactly 5 seats filled",
    ok === 5,
    `ok=${ok} full=${full} other=${20 - ok - full}`,
  );
  const { count } = await org
    .from("registrations")
    .select("id", { count: "exact", head: true })
    .eq("event_id", eventId)
    .eq("status", "registered");
  check("database holds exactly 5 registrations", count === 5, `count=${count}`);

  // same student double-submits at once
  const winner = students[results.findIndex((r) => !r.error)]!;
  const otherEventIns = await org
    .from("events")
    .insert({
      organizer_id: orgId,
      title: "Dup Test Event",
      starts_at: new Date(Date.now() + 2 * day).toISOString(),
      ends_at: new Date(Date.now() + 3 * day).toISOString(),
      registration_deadline: new Date(Date.now() + day).toISOString(),
      capacity: 50,
      status: "published",
    })
    .select("id")
    .single();
  if (otherEventIns.data) createdEvents.push(otherEventIns.data.id);
  const dupRes = await Promise.all(
    Array.from({ length: 8 }, () =>
      students[19]!.rpc("register_for_event", { _event_id: otherEventIns.data!.id }),
    ),
  );
  check(
    "concurrent duplicate registration: exactly 1 succeeds",
    dupRes.filter((r) => !r.error).length === 1,
    `ok=${dupRes.filter((r) => !r.error).length}`,
  );

  // volunteer flow
  const preScan = await vol.rpc("check_in_ticket", { _event_id: eventId, _token: "x" });
  check("unassigned volunteer cannot scan", !!preScan.error);
  const selfAssign = await vol.rpc("assign_volunteer", {
    _event_id: eventId,
    _user_id: volId,
    _can_scan: true,
    _can_view_registrations: true,
    _can_view_attendance: true,
  });
  check("student cannot self-assign as volunteer", !!selfAssign.error);
  const assign = await admin.rpc("assign_volunteer", {
    _event_id: eventId,
    _user_id: volId,
    _can_scan: true,
    _can_view_registrations: false,
    _can_view_attendance: true,
  });
  check("admin assigns volunteer", !assign.error, assign.error?.message);
  const { data: tickets } = await vol.from("tickets").select("token");
  check("volunteer cannot read tickets", (tickets ?? []).length === 0);

  // 12 simultaneous scans of the same ticket by volunteer + organizer
  const { data: myTicket } = await winner.from("tickets").select("token").limit(1).single();
  const scans = await Promise.all(
    Array.from({ length: 12 }, (_, i) =>
      (i % 2 ? org : vol).rpc("check_in_ticket", { _event_id: eventId, _token: myTicket!.token }),
    ),
  );
  const outcomes = scans.map(
    (s) => (s.data as { result?: string } | null)?.result ?? s.error?.message,
  );
  check(
    "concurrent check-in: exactly 1 ok",
    outcomes.filter((o) => o === "ok").length === 1,
    JSON.stringify(outcomes),
  );
  check(
    "concurrent check-in: rest are duplicates",
    outcomes.filter((o) => o === "duplicate").length === 11,
  );
  const { count: attCount } = await org
    .from("attendance")
    .select("id", { count: "exact", head: true })
    .eq("event_id", eventId);
  check("database holds exactly 1 attendance row", attCount === 1, `count=${attCount}`);
  const { count: volRegs } = await vol
    .from("registrations")
    .select("id", { count: "exact", head: true })
    .eq("event_id", eventId);
  check("volunteer without registrations permission sees none", volRegs === 0, `count=${volRegs}`);

  // certificates
  const certs = await org.rpc("issue_certificates", { _event_id: eventId });
  check(
    "organizer issues certificates to attendees only",
    certs.data === 1,
    `issued=${certs.data}`,
  );
  const { data: wCert } = await winner.from("certificates").select("serial");
  check("attendee sees own certificate", (wCert ?? []).length === 1);

  // cover upload
  const png = Uint8Array.from(
    atob(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    ),
    (c) => c.charCodeAt(0),
  );
  const path = `${eventId}/cover-test.png`;
  const up = await org.storage.from("event-covers").upload(path, png, { contentType: "image/png" });
  check("organizer uploads cover", !up.error, up.error?.message);
  const bad = await students[0]!.storage
    .from("event-covers")
    .upload(`${eventId}/evil.png`, png, { contentType: "image/png" });
  check("student cannot upload cover", !!bad.error);
  const signed = await students[0]!.storage.from("event-covers").createSignedUrl(path, 60);
  check("student can view cover of published event", !!signed.data?.signedUrl);
  await org.storage.from("event-covers").remove([path]);

  // self-promotion over the API
  const promo = await students[0]!.rpc("set_user_role", {
    _user_id: (await students[0]!.auth.getUser()).data.user!.id,
    _role: "admin",
    _grant: true,
  });
  check("student cannot self-promote via API", !!promo.error);
  const direct = await students[0]!
    .from("user_roles")
    .insert({ user_id: (await students[0]!.auth.getUser()).data.user!.id, role: "admin" });
  check("student cannot insert role row via API", !!direct.error);
} catch (e) {
  console.error("ERROR", e);
  failures++;
} finally {
  await cleanup();
}

console.log(failures ? `\n${failures} FAILURE(S)` : "\nALL LIVE TESTS PASSED");
process.exit(failures ? 1 : 0);
