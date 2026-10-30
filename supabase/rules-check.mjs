// Checks every rule in supabase/schema.sql (who can see, follow, react, block,
// delete) against a LOCAL Supabase. Needs Docker Desktop running. To run:
//   npx supabase init            (once, in a temp folder; copy schema.sql into
//                                 supabase/migrations/; set the magic_link + confirmation email templates to email-code-template.html in config.toml)
//   npx supabase start            (or `npx supabase db reset` before re-running)
//   node supabase/rules-check.mjs (the keys below are Supabase's public local defaults)
//   npx supabase stop --no-backup
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { createClient } = require("@supabase/supabase-js");

const URL = "http://127.0.0.1:54321";
const PUB = "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH";
const SECRET = "sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz";
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(URL, SECRET, opts);

let pass = 0, fail = 0;
const ok = (name, cond) => { cond ? pass++ : fail++; console.log(`${cond ? "PASS" : "FAIL"}  ${name}`); };

async function grower(email) {
  await admin.auth.admin.createUser({ email, password: "test-pass-123", email_confirm: true });
  const c = createClient(URL, PUB, opts);
  const { data, error } = await c.auth.signInWithPassword({ email, password: "test-pass-123" });
  if (error) throw error;
  return { c, id: data.user.id };
}
const A = await grower("a@test.local"), B = await grower("b@test.local"), C = await grower("c@test.local");

// Profiles
ok("A creates private profile", !(await A.c.from("profiles").insert({ id: A.id, username: "alice", is_public: false })).error);
ok("B creates public profile", !(await B.c.from("profiles").insert({ id: B.id, username: "bob", is_public: true })).error);
ok("C creates profile", !(await C.c.from("profiles").insert({ id: C.id, username: "carol" })).error);
ok("reserved username rejected", !!(await C.c.from("profiles").update({ username: "beakerboys" }).eq("id", C.id)).error);
ok("duplicate username rejected (23505)", (await C.c.from("profiles").update({ username: "alice" }).eq("id", C.id)).error?.code === "23505");
ok("C can't edit A's profile", ((await C.c.from("profiles").update({ is_public: true }).eq("id", A.id).select()).data || []).length === 0);

// A shares one post with followers (with photo) and one training-only
const jpeg = Buffer.from("/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==", "base64");
ok("A uploads photo to own folder", !(await A.c.storage.from("shared-photos").upload(`${A.id}/log1-0.jpg`, jpeg, { contentType: "image/jpeg" })).error);
ok("C can't upload into A's folder", !!(await C.c.storage.from("shared-photos").upload(`${A.id}/evil.jpg`, jpeg, { contentType: "image/jpeg" })).error);
const p1 = await A.c.from("shared_items").insert({ user_id: A.id, kind: "grow_log", local_id: "log1", grow_local_id: "g1", data: { type: "photo" }, photo_paths: [`${A.id}/log1-0.jpg`], visible_to_followers: true }).select("id").single();
ok("A shares follower post", !p1.error);
ok("A shares training-only post", !(await A.c.from("shared_items").insert({ user_id: A.id, kind: "reading", local_id: "r1", data: {}, for_training: true })).error);
ok("item shared with nobody is rejected", !!(await A.c.from("shared_items").insert({ user_id: A.id, kind: "reading", local_id: "r2", data: {} })).error);
ok("C can't post as A", !!(await C.c.from("shared_items").insert({ user_id: A.id, kind: "reading", local_id: "x", data: {}, for_training: true })).error);

const visible = async (who, owner) => ((await who.c.from("shared_items").select("id, local_id").eq("user_id", owner.id)).data || []).map((r) => r.local_id);
ok("C (not following) sees none of A's posts", (await visible(C, A)).length === 0);
ok("C can't get A's photo", !!(await C.c.storage.from("shared-photos").createSignedUrl(`${A.id}/log1-0.jpg`, 60)).error);

// Following a private profile
await C.c.from("follows").insert({ followee_id: A.id });
const st = (await C.c.from("follows").select("status").eq("followee_id", A.id).single()).data?.status;
ok("follow on private profile starts pending", st === "pending");
ok("pending follower still sees nothing", (await visible(C, A)).length === 0);
ok("C can't approve itself", ((await C.c.from("follows").update({ status: "approved" }).eq("followee_id", A.id).select()).data || []).length === 0);
ok("A sees C's request", ((await A.c.from("follows").select("follower_id").eq("followee_id", A.id).eq("status", "pending")).data || []).length === 1);
ok("A approves C", !(await A.c.from("follows").update({ status: "approved" }).eq("follower_id", C.id).eq("followee_id", A.id)).error);
const seen = await visible(C, A);
ok("approved follower sees follower post", seen.includes("log1"));
ok("follower does NOT see training-only post", !seen.includes("r1"));
ok("follower can view the photo", !(await C.c.storage.from("shared-photos").createSignedUrl(`${A.id}/log1-0.jpg`, 60)).error);
ok("B (not a follower) still sees nothing", (await visible(B, A)).length === 0);

// Reactions
ok("C reacts 🔥", !(await C.c.from("reactions").insert({ item_id: p1.data.id, emoji: "🔥" })).error);
ok("non-emoji reaction rejected", !!(await C.c.from("reactions").upsert({ item_id: p1.data.id, user_id: C.id, emoji: "lol" })).error);
ok("A sees C's reaction", ((await A.c.from("reactions").select("emoji").eq("item_id", p1.data.id)).data || []).length === 1);
ok("B can't react to A's post", !!(await B.c.from("reactions").insert({ item_id: p1.data.id, emoji: "👏" })).error);

// Public profile
await C.c.from("follows").insert({ followee_id: B.id });
ok("follow on public profile is approved instantly", (await C.c.from("follows").select("status").eq("followee_id", B.id).single()).data?.status === "approved");
await B.c.from("shared_items").insert({ user_id: B.id, kind: "grow", local_id: "gb", data: {}, visible_to_followers: true });
ok("A (not following) can view public B's posts", (await visible(A, B)).includes("gb"));

// Reports
ok("C files a report", !(await C.c.from("reports").insert({ reported_user_id: B.id, reason: "Spam" })).error);
ok("reports aren't readable from the app", ((await C.c.from("reports").select("id")).data || []).length === 0);

// Blocking
ok("A blocks C", !(await A.c.from("blocks").insert({ blocked_id: C.id })).error);
ok("block removed the follow", ((await A.c.from("follows").select("follower_id").eq("followee_id", A.id)).data || []).length === 0);
ok("blocked C sees nothing", (await visible(C, A)).length === 0);
ok("blocked C can't follow again", !!(await C.c.from("follows").insert({ followee_id: A.id })).error);

// Unsharing + account deletion
ok("A deletes own post", !(await A.c.from("shared_items").delete().eq("local_id", "log1")).error && (await visible(A, A)).length === 1);
await A.c.storage.from("shared-photos").remove([`${A.id}/log1-0.jpg`]);
ok("B deletes own account", !(await B.c.rpc("delete_my_account")).error);
ok("B's profile and posts are gone", ((await A.c.from("profiles").select("id").eq("id", B.id)).data || []).length === 0 && (await visible(A, B)).length === 0);
ok("anon can't call delete_my_account", !!(await createClient(URL, PUB, opts).rpc("delete_my_account")).error);

// ── Attacks that must stay blocked (found in the Oct 2026 security review) ──
const tag = Date.now();
async function attacker(name) {
  const email = `${name}${tag}@test.local`;
  await admin.auth.admin.createUser({ email, password: "pw-123456", email_confirm: true });
  const c = createClient(URL, PUB, opts);
  const { data } = await c.auth.signInWithPassword({ email, password: "pw-123456" });
  await c.from("profiles").insert({ id: data.user.id, username: `${name}${String(tag).slice(-6)}` });
  return { c, id: data.user.id };
}
const V = await attacker("vic"), M = await attacker("mal"), F = await attacker("fri");
const secret = `${V.id}/private-0.jpg`;
await V.c.storage.from("shared-photos").upload(secret, jpeg, { contentType: "image/jpeg" });
await V.c.from("shared_items").insert({ user_id: V.id, kind: "reading", local_id: "p", data: {}, photo_paths: [secret], for_training: true });
const borrow = await M.c.from("shared_items").insert({ user_id: M.id, kind: "reading", local_id: "x", data: {}, photo_paths: [secret], visible_to_followers: true });
ok("can't list someone else's photo in your own post", !!borrow.error && !!(await M.c.storage.from("shared-photos").createSignedUrl(secret, 60)).error);
await V.c.from("blocks").insert({ blocked_id: F.id });
ok("helper functions can't be called to snoop on blocks", !!(await M.c.rpc("blocked_between", { a: V.id, b: F.id })).error && !!(await M.c.rpc("can_view", { owner: V.id })).error);
let filed = 0;
for (let i = 0; i < 25; i++) if (!(await M.c.from("reports").insert({ reported_user_id: V.id, reason: "spam" })).error) filed++;
ok(`report flooding stops at 20 a day (filed ${filed})`, filed === 20);
// Email code sign-in (the app's real flow)
const D = createClient(URL, PUB, opts);
ok("send sign-in code", !(await D.auth.signInWithOtp({ email: "d@test.local", options: { shouldCreateUser: true } })).error);
await new Promise((r) => setTimeout(r, 1500));
const msgs = await (await fetch("http://127.0.0.1:54324/api/v1/search?query=to:d@test.local")).json();
const msg = await (await fetch(`http://127.0.0.1:54324/api/v1/message/${msgs.messages[0].ID}`)).json();
const code = (msg.Text.match(/\b\d{6}\b/) || [])[0];
ok("email contains a 6-digit code", !!code);
ok("code signs the user in", !(await D.auth.verifyOtp({ email: "d@test.local", token: code, type: "email" })).error);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

