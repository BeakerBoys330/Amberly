import { useState, useEffect, useCallback } from "react";
import { ArrowLeft } from "lucide-react";
import Icon from "./Icon.jsx";
import {
  myProfile, saveProfile, findUsers, profileByUsername, inviteLink, myConnections, follow, unfollow,
  approveFollower, removeFollower, block, unblock, report, posts, react, unreact, REACTIONS, USERNAME_RULE,
} from "./cloud.js";
import ShareSheet, { useCloudUser, ProfileFields } from "./ShareSheet.jsx";
import { fmtDate } from "./planner.js";

// Community: follow other growers' journeys. Deliberately simple —
//  • the feed is ONLY people you follow, newest first (no ranking, no suggestions)
//  • find people by invite link or exact-ish username search
//  • followers can react with a fixed emoji set; no comments
//  • every post and profile has Report and Block (Apple guideline 1.2)
const SC_STYLES = `
  .sc-post { background: #fffdfa; border: 1px solid #efe7dc; border-radius: 18px; padding: 14px 16px; margin-bottom: 12px; }
  .sc-head { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #766b60; margin-bottom: 6px; }
  .sc-user { background: none; border: none; padding: 0; min-height: 44px; font-weight: 700; color: #2b2622; font-size: 14px; cursor: pointer; }
  .sc-body { font-size: 14.5px; color: #3d352e; line-height: 1.5; }
  .sc-photos { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 6px; margin-top: 10px; }
  .sc-photos img { width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: 12px; background: #f1e9dd; }
  .sc-reacts { display: flex; gap: 6px; margin-top: 10px; flex-wrap: wrap; align-items: center; }
  .sc-react { border: 1px solid #efe7dc; background: #fff; border-radius: 99px; min-width: 48px; min-height: 44px; padding: 0 12px; font-size: 16px; color: #2b2622; cursor: pointer; }
  .sc-react.on { background: #fbefdc; border-color: #d99a3c; }
  .sc-more { margin-left: auto; background: none; border: none; color: #766b60; font-size: 20px; cursor: pointer; min-width: 44px; min-height: 44px; }
  .sc-person { display: flex; align-items: center; gap: 10px; padding: 4px 0; border-bottom: 1px solid #f3ece2; font-size: 15px; }
  .sc-person:last-child { border-bottom: none; }
  .sc-person .tv-link { padding: 12px 8px; font-size: 14px; }
  .sc-badge { background: #d99a3c; color: #2b2622; font-weight: 700; border-radius: 99px; font-size: 11px; padding: 1px 7px; margin-left: 4px; }
`;

const LOG_LABEL = { water: "Watered", feed: "Fed", photo: "New photo", env: "Climate check", note: "Note" };
function describe(p) {
  const d = p.data || {};
  if (p.kind === "grow") return `Sharing a ${d.strainName || "new"} grow (${d.plantType === "auto" ? "autoflower" : "photoperiod"}, ${d.medium || "soil"})`;
  if (p.kind === "reading") {
    const r = d.reading || {};
    return `Trichome check on ${d.strainName || "a plant"}: ${r.cloudy ?? "?"}% cloudy · ${r.amber ?? "?"}% amber${d.note ? `. ${d.note}` : ""}`;
  }
  const extra = d.type === "env" ? ` · ${d.temp}°F, ${d.rh}% RH` : d.type === "feed" && (d.ec || d.ph) ? ` · ${d.ec ? `EC ${d.ec}` : ""} ${d.ph ? `pH ${d.ph}` : ""}` : "";
  return `${LOG_LABEL[d.type] || "Update"}${extra}${d.note ? `: ${d.note}` : ""}`;
}

const REPORT_REASONS = ["Selling or buying", "Looks underage", "Harassment or hate", "Nudity or violence", "Spam", "Something else"];

function Post({ post, userId, onOpenUser, onBlocked }) {
  const [menu, setMenu] = useState(false);
  const [msg, setMsg] = useState("");
  const [reactions, setReactions] = useState(post.reactions); // updated in place, no feed reload
  const mine = reactions.find((r) => r.user_id === userId)?.emoji;
  const counts = REACTIONS.map((e) => [e, reactions.filter((r) => r.emoji === e).length]);
  const act = (fn, done) => async () => { try { if ((await fn()) !== false) { setMsg(done || ""); setMenu(false); } } catch (e) { setMsg(e.message); } };
  const toggle = (e) => act(async () => {
    await (mine === e ? unreact(post.id) : react(post.id, e));
    setReactions((rs) => [...rs.filter((r) => r.user_id !== userId), ...(mine === e ? [] : [{ user_id: userId, emoji: e }])]);
  });

  return (
    <div className="sc-post">
      <div className="sc-head">
        <button className="sc-user" onClick={() => onOpenUser(post.username)}>@{post.username}</button>
        <span>· {fmtDate(post.created_at)}</span>
      </div>
      <div className="sc-body">{describe(post)}</div>
      {post.photos.length > 0 && <div className="sc-photos">{post.photos.map((src) => <img key={src} src={src} alt="" loading="lazy" />)}</div>}
      <div className="sc-reacts">
        {counts.map(([e, n]) => (
          <button key={e} className={`sc-react ${mine === e ? "on" : ""}`} disabled={post.mine} onClick={toggle(e)}>{e}{n ? ` ${n}` : ""}</button>
        ))}
        {!post.mine && <button className="sc-more" aria-label="More" onClick={() => setMenu(!menu)}>⋯</button>}
      </div>
      {menu && (
        <div className="tv-tip" style={{ marginTop: 10 }}>
          <b>Report this post</b>
          <div>{REPORT_REASONS.map((r) => <button key={r} className="tv-link" style={{ paddingLeft: 0, marginRight: 8 }}
            onClick={act(() => report({ userId: post.user_id, itemId: post.id, reason: r }), "Thanks. BeakerBoys will review this within 24 hours.")}>{r}</button>)}</div>
          <button className="tv-link" style={{ paddingLeft: 0, color: "#b0442c" }}
            onClick={act(async () => {
              if (!window.confirm(`Block @${post.username}? You won't see each other's posts.`)) return false;
              await block(post.user_id); onBlocked(post.user_id);
            }, "Blocked.")}>
            Block @{post.username}
          </button>
        </div>
      )}
      {msg && <div className="tv-field-hint" style={{ marginTop: 8 }}>{msg}</div>}
    </div>
  );
}

function PostList({ userId, onlyUser, onOpenUser, empty }) {
  const [list, setList] = useState(null);
  const [error, setError] = useState("");
  const load = useCallback(async (before = null) => {
    try {
      const next = await posts({ userId: onlyUser, before });
      setList((cur) => (before ? [...cur, ...next] : next)); setError("");
    } catch (e) { setError(e.message); }
  }, [onlyUser]);
  useEffect(() => { load(); }, [load]);

  if (error) return <div className="tv-error-msg">{error}</div>;
  if (!list) return <div className="tv-field-hint">Loading…</div>;
  if (!list.length) return <div className="tv-diary-empty"><div className="tv-big-icon"><Icon name="sprout" size={36} /></div>{empty}</div>;
  return (<>
    {list.map((p) => <Post key={p.id} post={p} userId={userId} onOpenUser={onOpenUser}
      onBlocked={(id) => setList((cur) => cur.filter((x) => x.user_id !== id))} />)}
    {list.length % 20 === 0 && <button className="tv-btn tv-btn-soft" onClick={() => load(list.at(-1).created_at)}>Show older</button>}
  </>);
}

function Profile({ username, userId, onOpenUser }) {
  const [person, setPerson] = useState(null);
  const [rel, setRel] = useState(null);
  const [msg, setMsg] = useState("");
  const refresh = useCallback(async () => {
    const [p, c] = await Promise.all([profileByUsername(username), myConnections()]);
    setPerson(p || {}); // {} = no such grower
    setRel(c);
  }, [username]);
  useEffect(() => { refresh().catch((e) => setMsg(e.message)); }, [refresh]);

  if (msg && !person) return <div className="tv-error-msg">{msg}</div>;
  if (!person || !rel) return <div className="tv-field-hint">Loading…</div>;
  if (!person.id) return <div className="tv-field-hint">No grower called @{username}.</div>;
  const isMe = person.id === userId;
  const f = rel.following.find((x) => x.id === person.id);
  const blocked = rel.blocked.includes(person.id);
  const act = (fn, done = "") => async () => { try { if ((await fn()) !== false) { setMsg(done); await refresh(); } } catch (e) { setMsg(e.message); } };

  return (<>
    <div className="tv-hero" style={{ marginBottom: 12 }}>
      <div className="tv-hero-title">@{person.username}</div>
      <div className="tv-hero-sub">{person.is_public ? "Public grower" : "Approves followers"}</div>
    </div>
    {!isMe && (blocked ? (
      <button className="tv-btn tv-btn-soft" onClick={act(() => unblock(person.id), "Unblocked.")}>Unblock</button>
    ) : !f ? (
      <button className="tv-btn tv-btn-primary" onClick={act(() => follow(person.id), person.is_public ? "" : "Request sent.")}>
        {person.is_public ? "Follow" : "Request to follow"}
      </button>
    ) : (
      <button className="tv-btn tv-btn-soft" onClick={act(() => unfollow(person.id))}>{f.status === "pending" ? "Requested · Cancel" : "Following · Unfollow"}</button>
    ))}
    {msg && <div className="tv-field-hint" style={{ margin: "8px 0" }}>{msg}</div>}
    <div style={{ marginTop: 16 }}>
      {/* Reload posts whenever follow/block status changes (e.g. hide them right after blocking). */}
      <PostList key={`${f?.status}|${blocked}`} userId={userId} onlyUser={person.id} onOpenUser={onOpenUser}
        empty={isMe ? "Nothing shared with followers yet." : f?.status === "approved" || person.is_public ? "Nothing shared yet." : "Follow to see their grows."} />
    </div>
    {!isMe && !blocked && (
      <div style={{ textAlign: "center", marginTop: 8 }}>
        <button className="tv-link" onClick={act(() => report({ userId: person.id, reason: "Profile reported" }), "Thanks. BeakerBoys will review this within 24 hours.")}>Report</button>
        <button className="tv-link" style={{ color: "#b0442c" }}
          onClick={act(async () => (window.confirm(`Block @${person.username}?`) ? block(person.id) : false), "Blocked.")}>Block</button>
      </div>
    )}
  </>);
}

function Find({ onOpenUser }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [error, setError] = useState("");
  useEffect(() => {
    let live = true; // ignore answers to an older, shorter search that arrive late
    const t = setTimeout(() => findUsers(q).then(
      (r) => { if (live) { setResults(r); setError(""); } },
      (e) => { if (live) { setResults([]); setError(e.message); } }), 300);
    return () => { live = false; clearTimeout(t); };
  }, [q]);
  return (<>
    <input className="tv-input" autoCapitalize="none" autoCorrect="off" placeholder="Search usernames" aria-label="Search usernames" value={q} onChange={(e) => setQ(e.target.value)} style={{ marginBottom: 10 }} />
    {results.map((p) => (
      <div key={p.id} className="sc-person"><button className="sc-user" onClick={() => onOpenUser(p.username)}>@{p.username}</button>
        <span className="tv-field-hint">{p.is_public ? "public" : "approves followers"}</span></div>
    ))}
    {error ? <div className="tv-error-msg" role="alert">{error}</div>
      : q.length >= 2 && !results.length && <div className="tv-field-hint">No growers found.</div>}
  </>);
}

function People({ profile, onProfileSaved, onOpenUser }) {
  const [c, setC] = useState(null);
  const [draft, setDraft] = useState(profile);
  const [msg, setMsg] = useState("");
  const load = useCallback(() => myConnections().then(setC, (e) => setMsg(e.message)), []);
  useEffect(() => { load(); }, [load]);
  const act = (fn, done = "") => async () => { try { await fn(); setMsg(done); load(); } catch (e) { setMsg(e.message); } };
  const link = inviteLink(profile.username);
  const shareLink = async () => {
    try { if (navigator.share) await navigator.share({ title: "Follow my grow on Amberly", url: link }); else { await navigator.clipboard.writeText(link); setMsg("Invite link copied."); } }
    catch { /* share sheet dismissed */ }
  };
  const Row = ({ p, children }) => <div className="sc-person"><button className="sc-user" onClick={() => onOpenUser(p.username)}>@{p.username}</button><span style={{ marginLeft: "auto" }}>{children}</span></div>;

  return (<>
    <div className="tv-card"><div className="tv-card-pad">
      <div className="tv-section-title" style={{ marginBottom: 10 }}>Invite people to follow you</div>
      <div className="tv-field-hint" style={{ marginBottom: 10, wordBreak: "break-all" }}>{link}</div>
      <button className="tv-btn tv-btn-soft" onClick={shareLink}>Send invite link</button>
    </div></div>

    {c?.requests.length > 0 && (
      <div className="tv-card"><div className="tv-card-pad">
        <div className="tv-section-title" style={{ marginBottom: 6 }}>Follow requests</div>
        {c.requests.map((p) => <Row key={p.id} p={p}>
          <button className="tv-link" onClick={act(() => approveFollower(p.id))}>Approve</button>
          <button className="tv-link" onClick={act(() => removeFollower(p.id))}>Decline</button>
        </Row>)}
      </div></div>
    )}

    <div className="tv-card"><div className="tv-card-pad">
      <div className="tv-section-title" style={{ marginBottom: 6 }}>Followers ({c?.followers.length ?? "…"})</div>
      {c?.followers.map((p) => <Row key={p.id} p={p}><button className="tv-link" onClick={act(() => removeFollower(p.id))}>Remove</button></Row>)}
      <div className="tv-section-title" style={{ margin: "14px 0 6px" }}>Following ({c?.following.length ?? "…"})</div>
      {c?.following.map((p) => <Row key={p.id} p={p}><button className="tv-link" onClick={act(() => unfollow(p.id))}>{p.status === "pending" ? "Cancel request" : "Unfollow"}</button></Row>)}
      {c?.blocked.length > 0 && <>
        <div className="tv-section-title" style={{ margin: "14px 0 6px" }}>Blocked ({c.blocked.length})</div>
        {c.blocked.map((id) => <div key={id} className="sc-person"><span className="tv-field-hint">Blocked grower</span>
          <span style={{ marginLeft: "auto" }}><button className="tv-link" onClick={act(() => unblock(id))}>Unblock</button></span></div>)}
      </>}
    </div></div>

    <div className="tv-card"><div className="tv-card-pad">
      <div className="tv-section-title" style={{ marginBottom: 10 }}>Your profile</div>
      <ProfileFields value={draft} onChange={setDraft} />
      <button className="tv-btn tv-btn-primary" disabled={!USERNAME_RULE.test(draft.username)}
        onClick={act(async () => { await saveProfile(draft); onProfileSaved(draft); }, "Saved.")}>Save profile</button>
    </div></div>
    {msg && <div className="tv-field-hint" style={{ textAlign: "center" }}>{msg}</div>}
  </>);
}

export default function Community({ openUsername, onBack }) {
  const user = useCloudUser();
  const [profile, setProfile] = useState(undefined); // undefined = loading, null = none yet
  const [draft, setDraft] = useState({ username: "", is_public: false });
  const [view, setView] = useState(openUsername ? { mode: "profile", username: openUsername } : { mode: "feed" });
  const [requests, setRequests] = useState(0);
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (user) myProfile().then(setProfile, (e) => setError(e.message));
  }, [user]);
  // Follow-request badge: refreshed each time you come back to the feed (e.g. after approving).
  useEffect(() => {
    if (user && view.mode === "feed") myConnections().then((c) => setRequests(c.requests.length), () => {});
  }, [user, view.mode]);

  const openUser = (username) => setView({ mode: "profile", username });
  const back = view.mode === "feed" ? onBack : () => setView({ mode: "feed" });
  const title = { feed: "Following", find: "Find growers", people: "Followers & settings", profile: "" }[view.mode];

  let body;
  if (!user) body = (<>
    <div className="tv-tip" style={{ marginTop: 0 }}>Follow friends' grows and let them follow yours. You only ever see people you follow. Nothing is ranked or suggested.</div>
    <button className="tv-btn tv-btn-primary" style={{ marginTop: 14 }} onClick={() => setSigningIn(true)}>Sign in to follow growers</button>
  </>);
  else if (profile === undefined) body = <div className="tv-field-hint">{error || "Loading…"}</div>;
  else if (profile === null) body = (<>
    <div className="tv-field-hint" style={{ marginBottom: 12 }}>Pick a username so friends can find and follow you.</div>
    <ProfileFields value={draft} onChange={setDraft} />
    <button className="tv-btn tv-btn-primary" disabled={!USERNAME_RULE.test(draft.username)}
      onClick={async () => { try { await saveProfile(draft); setProfile(draft); } catch (e) { setError(e.message); } }}>Continue</button>
    {error && <div className="tv-error-msg" style={{ marginTop: 10 }}>{error}</div>}
  </>);
  else if (view.mode === "feed") body = (<>
    <div className="tv-btn-row" style={{ marginTop: 0, marginBottom: 14 }}>
      <button className="tv-btn tv-btn-soft" onClick={() => setView({ mode: "find" })}><Icon name="search" /> Find</button>
      <button className="tv-btn tv-btn-soft" onClick={() => setView({ mode: "people" })}><Icon name="users" /> Followers{requests > 0 && <span className="sc-badge">{requests}</span>}</button>
    </div>
    <PostList userId={user.id} onOpenUser={openUser} empty="When people you follow share their grows, updates show up here, newest first." />
  </>);
  else if (view.mode === "find") body = <Find onOpenUser={openUser} />;
  else if (view.mode === "people") body = <People profile={profile} onProfileSaved={setProfile} onOpenUser={openUser} />;
  else body = <Profile key={view.username} username={view.username} userId={user.id} onOpenUser={openUser} />;

  return (<>
    <style>{SC_STYLES}</style>
    <button className="tv-back" onClick={back}><ArrowLeft size={17} /> {view.mode === "feed" ? "Home" : "Following"}</button>
    {title && <div className="tv-hero" style={{ marginBottom: 16 }}><div className="tv-hero-title">{title}</div></div>}
    {body}
    {signingIn && <ShareSheet onClose={() => setSigningIn(false)} />}
  </>);
}
