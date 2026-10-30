// ─────────────────────────────────────────────────────────────────────────────
// Accounts, sharing, and following (Supabase). The ONLY code that talks to a
// server. Off entirely until VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY
// are set (docs/SETUP.md); the app works fully on-device without it.
// Tables, photo bucket, and who-can-see-what rules: supabase/schema.sql.
// ─────────────────────────────────────────────────────────────────────────────
import { store } from "./planner.js";

export const AUTH_KEY = "amberly.auth.v1";
export const REACTIONS = ["🔥", "🌿", "👏", "😍"];
export const USERNAME_RULE = /^[a-z0-9_]{3,20}$/;
const BUCKET = "shared-photos";
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const cloudEnabled = Boolean(url && key);

// The Supabase library (~half the app's code) is only downloaded the first time
// someone signs in or opens a cloud feature. Growers who never sign in never load it.
// Sign-in session is kept through `store`, like all other on-device data.
const listeners = new Set();
let clientPromise = null;
const client = () => (clientPromise ??= import("@supabase/supabase-js").then(({ createClient }) => {
  const sb = createClient(url, key, {
    auth: {
      storageKey: AUTH_KEY,
      storage: { getItem: (k) => store.get(k, null), setItem: (k, v) => { store.set(k, v); }, removeItem: (k) => store.remove(k) },
      detectSessionInUrl: false,
    },
  });
  sb.auth.onAuthStateChange((_event, session) => listeners.forEach((cb) => cb(session?.user ?? null)));
  return sb;
}));

// Turn library errors into one plain sentence for the grower.
const check = ({ error }) => {
  if (!error) return;
  if (error.code === "23505") throw new Error("That username is taken. Try another.");
  if (/row-level security/i.test(error.message || "")) throw new Error("Amberly couldn't do that. If you've shared or reported a lot today, try again tomorrow.");
  const offline = /fetch|network|failed to/i.test(error.message || "");
  throw new Error(offline ? "Couldn't reach Amberly's server. Check your connection and try again." : error.message);
};
// The signed-in user plus the client, for every call that needs an account.
const session = async () => {
  const sb = await client();
  const { data } = await sb.auth.getSession();
  if (!data.session) throw new Error("Please sign in first.");
  return { sb, user: data.session.user };
};

// ── Account (email + 6-digit code, no password) ──────────────────────────────
export async function currentUser() {
  if (!cloudEnabled || !store.get(AUTH_KEY, null)) return null; // never signed in: don't load cloud code
  const { data } = await (await client()).auth.getSession();
  return data.session?.user ?? null;
}
export const onUserChange = (cb) => { listeners.add(cb); return () => listeners.delete(cb); };
export const sendCode = async (email, termsVersion) =>
  check(await (await client()).auth.signInWithOtp({ email, options: { shouldCreateUser: true, data: { terms_version: termsVersion, confirmed_21_plus: true } } }));
export const verifyCode = async (email, token) => check(await (await client()).auth.verifyOtp({ email, token, type: "email" }));
export const signOut = async () => { await (await client()).auth.signOut(); };

// ── Profile (username + privacy) ─────────────────────────────────────────────
export async function myProfile() {
  const { sb, user } = await session();
  const { data, error } = await sb.from("profiles").select("id, username, is_public").eq("id", user.id).maybeSingle();
  check({ error });
  return data;
}
export async function saveProfile({ username, is_public }) {
  const { sb, user } = await session();
  check(await sb.from("profiles").upsert({ id: user.id, username: username.toLowerCase(), is_public }));
}
export async function findUsers(query) {
  const q = query.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
  if (q.length < 2) return [];
  const { sb } = await session();
  // `_` is a wildcard in LIKE searches; escape it so "tent_a" doesn't match "tentXa".
  const { data, error } = await sb.from("profiles").select("id, username, is_public").ilike("username", `${q.replace(/_/g, "\\_")}%`).order("username").limit(20);
  check({ error });
  return data;
}
export async function profileByUsername(username) {
  const { sb } = await session();
  const { data, error } = await sb.from("profiles").select("id, username, is_public").eq("username", username.toLowerCase()).maybeSingle();
  check({ error });
  return data;
}
export const inviteLink = (username) => `${window.location.origin}/?u=${encodeURIComponent(username)}`;

// ── Following ────────────────────────────────────────────────────────────────
// Everything about me: who I follow, who follows me, who's waiting, who I blocked.
export async function myConnections() {
  const { sb, user } = await session();
  const [f, b] = await Promise.all([
    sb.from("follows").select("follower_id, followee_id, status, follower:profiles!follows_follower_id_fkey(username), followee:profiles!follows_followee_id_fkey(username)")
      .or(`follower_id.eq.${user.id},followee_id.eq.${user.id}`),
    sb.from("blocks").select("blocked_id"),
  ]);
  check(f); check(b);
  const rows = f.data;
  return {
    following: rows.filter((r) => r.follower_id === user.id).map((r) => ({ id: r.followee_id, username: r.followee.username, status: r.status })),
    followers: rows.filter((r) => r.followee_id === user.id && r.status === "approved").map((r) => ({ id: r.follower_id, username: r.follower.username })),
    requests:  rows.filter((r) => r.followee_id === user.id && r.status === "pending").map((r) => ({ id: r.follower_id, username: r.follower.username })),
    blocked: b.data.map((r) => r.blocked_id),
  };
}
export async function follow(id) { const { sb } = await session(); check(await sb.from("follows").insert({ followee_id: id })); }
export async function unfollow(id) { const { sb, user } = await session(); check(await sb.from("follows").delete().eq("follower_id", user.id).eq("followee_id", id)); }
export async function approveFollower(id) { const { sb, user } = await session(); check(await sb.from("follows").update({ status: "approved" }).eq("follower_id", id).eq("followee_id", user.id)); }
export async function removeFollower(id) { const { sb, user } = await session(); check(await sb.from("follows").delete().eq("follower_id", id).eq("followee_id", user.id)); }
export async function block(id) { const { sb } = await session(); check(await sb.from("blocks").insert({ blocked_id: id })); }
export async function unblock(id) { const { sb } = await session(); check(await sb.from("blocks").delete().eq("blocked_id", id)); }
export async function report({ userId, itemId = null, reason }) {
  const { sb } = await session();
  check(await sb.from("reports").insert({ reported_user_id: userId, item_id: itemId, reason: reason.slice(0, 500) }));
}

// ── Feed: posts from people I follow, newest first ───────────────────────────
// No ranking, no suggestions. Public profiles are viewable when you open them,
// but never pushed into anyone's feed.
// Photo links last an hour; reuse them so the phone doesn't re-download images.
const signedCache = new Map(); // path → { url, until }
async function photoUrls(sb, paths) {
  const now = Date.now();
  const missing = paths.filter((p) => !(signedCache.get(p)?.until > now));
  if (missing.length) {
    const { data } = await sb.storage.from(BUCKET).createSignedUrls(missing, 3600);
    for (const s of data || []) if (s.signedUrl) signedCache.set(s.path, { url: s.signedUrl, until: now + 50 * 60e3 });
  }
  return (p) => signedCache.get(p)?.url;
}
export async function posts({ userId = null, before = null, limit = 20 } = {}) {
  const { sb, user } = await session();
  let authors = [userId];
  if (!userId) {
    const { data, error } = await sb.from("follows").select("followee_id").eq("follower_id", user.id).eq("status", "approved");
    check({ error });
    authors = data.map((f) => f.followee_id);
    if (!authors.length) return [];
  }
  let q = sb.from("shared_items")
    .select("id, user_id, kind, grow_local_id, data, photo_paths, created_at, reactions(user_id, emoji)")
    .eq("visible_to_followers", true).in("user_id", authors).order("created_at", { ascending: false }).limit(limit);
  if (before) q = q.lt("created_at", before);
  const { data, error } = await q;
  check({ error });
  const ids = [...new Set(data.map((p) => p.user_id))];
  const [urlFor, names] = await Promise.all([
    photoUrls(sb, data.flatMap((p) => p.photo_paths)),
    ids.length ? sb.from("profiles").select("id, username").in("id", ids) : { data: [] },
  ]);
  const nameFor = Object.fromEntries((names.data || []).map((n) => [n.id, n.username]));
  return data.map((p) => ({ ...p, username: nameFor[p.user_id] || "grower", photos: p.photo_paths.map(urlFor).filter(Boolean), mine: p.user_id === user.id }));
}
// One reaction per grower per post: replace any earlier one. (Not an upsert: the
// database only lets the app change `emoji`, so a reaction can't be moved to another post.)
export async function react(itemId, emoji) {
  const { sb, user } = await session();
  check(await sb.from("reactions").delete().eq("item_id", itemId).eq("user_id", user.id));
  check(await sb.from("reactions").insert({ item_id: itemId, user_id: user.id, emoji }));
}
export async function unreact(itemId) {
  const { sb, user } = await session();
  check(await sb.from("reactions").delete().eq("item_id", itemId).eq("user_id", user.id));
}

// ── Photos: redraw before upload ─────────────────────────────────────────────
// Drawing onto a canvas and re-encoding keeps only pixels: GPS location, camera
// model, and timestamps (EXIF) are gone. Also caps size at 1600px.
const toImage = (src) => (typeof src !== "string" ? Promise.resolve(src) : new Promise((ok, fail) => {
  const img = new Image();
  img.onload = () => ok(img);
  img.onerror = () => fail(new Error("Couldn't prepare a photo for sharing."));
  img.src = src;
}));
export async function cleanJpeg(src, max = 1600) {
  const img = await toImage(src);
  const ratio = Math.min(1, max / Math.max(img.width, img.height));
  const canvas = Object.assign(document.createElement("canvas"), { width: Math.round(img.width * ratio), height: Math.round(img.height * ratio) });
  canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
  return new Promise((ok, fail) => canvas.toBlob((b) => (b ? ok(b) : fail(new Error("Couldn't prepare a photo for sharing."))), "image/jpeg", 0.85));
}

// ── Share / unshare ──────────────────────────────────────────────────────────
// audience: { followers, training } — two separate choices. Re-sharing the same
// localId replaces it. photos: <img> elements or data URLs.
export async function shareItem({ kind, localId, growLocalId = null, data, photos = [], audience }) {
  const { sb, user } = await session();
  const photo_paths = [];
  for (const [i, src] of photos.slice(0, 6).entries()) {
    const path = `${user.id}/${localId}-${i}.jpg`;
    check(await sb.storage.from(BUCKET).upload(path, await cleanJpeg(src), { contentType: "image/jpeg", upsert: true }));
    photo_paths.push(path);
  }
  check(await sb.from("shared_items").upsert(
    { user_id: user.id, kind, local_id: localId, grow_local_id: growLocalId, data, photo_paths,
      visible_to_followers: !!audience.followers, for_training: !!audience.training },
    { onConflict: "user_id,local_id" },
  ));
}

// Change who sees already-shared items without re-uploading anything,
// e.g. setAudience("grow_local_id", growId, { followers: false, training: true }).
export async function setAudience(column, value, audience) {
  const { sb, user } = await session();
  check(await sb.from("shared_items").update({ visible_to_followers: !!audience.followers, for_training: !!audience.training })
    .eq("user_id", user.id).eq(column, value));
}

// Delete shared rows (and their photos) matching one column, e.g.
// unshare("local_id", [id]) or unshare("grow_local_id", [growId]).
export async function unshare(column, values) {
  const { sb, user } = await session();
  const { data: rows, error } = await sb.from("shared_items").select("photo_paths").eq("user_id", user.id).in(column, values);
  check({ error });
  const paths = rows.flatMap((r) => r.photo_paths);
  if (paths.length) check(await sb.storage.from(BUCKET).remove(paths));
  check(await sb.from("shared_items").delete().eq("user_id", user.id).in(column, values));
}

// Share a grow's setup plus any journal entries not uploaded yet, with the grow's
// audience. Returns uploaded log ids so the caller can mark them synced.
export async function syncGrow(grow) {
  const { logs, id, author, shared, sharing, name, ...setup } = grow; // nickname stays on the phone
  const audience = sharing || { training: true }; // grows shared before the two switches existed
  await shareItem({ kind: "grow", localId: id, growLocalId: id, data: setup, audience });
  const uploaded = [];
  for (const { photo, synced, author: _a, shared: _s, ...log } of logs) {
    if (synced) continue;
    await shareItem({ kind: "grow_log", localId: log.id, growLocalId: id, data: log, photos: photo ? [photo] : [], audience });
    uploaded.push(log.id);
  }
  return uploaded;
}

// Remove every photo, then the account itself (everything else cascades).
export async function deleteAccount() {
  const { sb, user } = await session();
  for (;;) { // listing is paged; keep removing until the folder is empty
    const { data: files, error } = await sb.storage.from(BUCKET).list(user.id, { limit: 100 });
    check({ error });
    if (!files.length) break;
    check(await sb.storage.from(BUCKET).remove(files.map((f) => `${user.id}/${f.name}`)));
  }
  check(await sb.rpc("delete_my_account"));
  await sb.auth.signOut({ scope: "local" });
}
