import { useState, useEffect, useRef } from "react";
import { currentUser, onUserChange, sendCode, verifyCode, myProfile, saveProfile, USERNAME_RULE, botCheckEnabled, botCheck } from "./cloud.js";
import { LEGAL_VERSION } from "./LegalGate.jsx";

// Signed-in grower, null when signed out, undefined while still checking.
// Kept in sync with sign-in / sign-out anywhere.
export function useCloudUser() {
  const [user, setUser] = useState(undefined);
  useEffect(() => { currentUser().then(setUser); return onUserChange(setUser); }, []);
  return user;
}

const Switch = ({ on, label, desc, onToggle }) => (
  <button type="button" role="switch" aria-checked={on} className="tv-toggle-row" onClick={onToggle}>
    <div className="tv-toggle-text"><div className="tv-toggle-label">{label}</div><div className="tv-toggle-desc">{desc}</div></div>
    <div className={`tv-switch ${on ? "on" : ""}`}><div className="tv-switch-knob" /></div>
  </button>
);

// Pick a username and who can follow. Used when someone first shares with
// followers, and in Account settings.
export function ProfileFields({ value, onChange }) {
  const ok = USERNAME_RULE.test(value.username);
  return (<>
    <label className="tv-field-label">Username</label>
    <input className="tv-input" autoCapitalize="none" autoCorrect="off" placeholder="e.g. tent_wizard" maxLength={20}
      value={value.username} onChange={(e) => onChange({ ...value, username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "") })} />
    <div className="tv-field-hint" style={{ margin: "6px 0 12px" }}>{value.username && !ok ? "3–20 letters, numbers, or _" : "Followers see this. Don't use your real name."}</div>
    <Switch on={value.is_public} label="Public profile"
      desc={value.is_public ? "Anyone who finds you can follow without asking." : "Off: you approve each follower (recommended)."}
      onToggle={() => onChange({ ...value, is_public: !value.is_public })} />
  </>);
}

// One sheet for signing in and for choosing who sees a reading or grow:
//  • not signed in → email → 6-digit code (no password)
//  • with onShare → two separate switches (followers / help train Amberly), then onShare(audience)
//  • without onShare → plain optional sign-in; closes once signed in
export default function ShareSheet({ what, audience: current, onShare, onClose }) {
  const initial = current || { followers: true, training: false }; // `current` = already shared
  const user = useCloudUser();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [audience, setAudience] = useState(initial);
  const [profile, setProfile] = useState(undefined);         // undefined = loading, null = none yet
  const [draft, setDraft] = useState({ username: "", is_public: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // Bot check pass for the next sign-in email: "" = not ready yet, null = couldn't load.
  const [pass, setPass] = useState("");
  const checkBox = useRef(null);
  const check = useRef(null);

  useEffect(() => {
    if (user !== null || !botCheckEnabled) return;
    check.current = botCheck(checkBox.current, setPass);
    return check.current.remove;
  }, [user]);
  useEffect(() => { if (user && !onShare) onClose(); }, [user, onShare, onClose]);
  useEffect(() => { if (user && onShare) myProfile().then(setProfile, () => setProfile(null)); }, [user, onShare]);

  const run = (fn) => async () => {
    setBusy(true); setError("");
    try { await fn(); } catch (e) { setError(e.message || "Something went wrong. Try again."); }
    setBusy(false);
  };
  // Wrapping the fields in a form lets the keyboard's Go/Done key submit. preventDefault keeps the page from reloading.
  const submit = (fn) => (e) => { e.preventDefault(); run(fn)(); };
  // Each pass works once, so get a fresh one after every send, even a failed one.
  const sendTo = async () => {
    try { await sendCode(email.trim(), LEGAL_VERSION, pass || undefined); } finally { check.current?.reset(); }
    setCodeSent(true); setCode("");
  };
  const waiting = botCheckEnabled && !pass;
  const needsName = audience.followers && profile === null;
  const nothing = !audience.followers && !audience.training;
  const alreadyShared = Boolean(current);

  return (
    <div className="tv-overlay" onClick={busy || codeSent ? undefined : onClose}>
      <div className="tv-modal" onClick={(e) => e.stopPropagation()}>
        <div className="tv-modal-pad">
          <div className="tv-modal-title">{onShare ? `Share ${what}` : "Sign in to Amberly"}</div>

          {!user ? (<>
            <p className="tv-field-hint" style={{ marginBottom: 12 }}>
              {onShare ? "Sharing needs a simple account. " : "This is optional. Amberly works fully without an account. "}
              {codeSent ? `We sent a 6-digit code to ${email.trim()}. It can take a minute, so check spam too.` : "Just your email, no password. We'll email you a 6-digit code."}
            </p>
            {!codeSent ? (
              <form onSubmit={submit(sendTo)}>
                <input className="tv-input" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" placeholder="you@example.com" aria-label="Email"
                  value={email} onChange={(e) => setEmail(e.target.value)} style={{ marginBottom: 12 }} />
                <button className="tv-btn tv-btn-primary" disabled={busy || waiting || !/^\S+@\S+\.\S+$/.test(email.trim())}>
                  {busy ? "Sending…" : waiting && pass !== null ? "Checking you're human…" : "Email me a code"}
                </button>
              </form>
            ) : (
              <form onSubmit={submit(() => verifyCode(email.trim(), code))}>
                <input className="tv-input" inputMode="numeric" autoComplete="one-time-code" placeholder="6-digit code" aria-label="6-digit code" maxLength={6} autoFocus
                  value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} style={{ marginBottom: 12 }} />
                <button className="tv-btn tv-btn-primary" disabled={busy || code.length !== 6}>
                  {busy ? "Checking…" : "Sign in"}
                </button>
                <button type="button" className="tv-link" disabled={busy || waiting} onClick={run(sendTo)}>Send a new code</button>
                <button type="button" className="tv-link" disabled={busy} onClick={() => { setCodeSent(false); setCode(""); setError(""); }}>Use a different email</button>
              </form>
            )}
            {botCheckEnabled && <div ref={checkBox} style={{ marginTop: 10 }} />}
            {pass === null && <div className="tv-error-msg" role="alert" style={{ marginTop: 10 }}>Couldn't load the sign-in check. Check your connection and try again.</div>}
          </>) : profile === undefined ? (
            <div className="tv-field-hint">Loading…</div>
          ) : (<>
            <Switch on={audience.followers} label="Followers can see this"
              desc="People you approve (or anyone, if your profile is public) can follow along and react."
              onToggle={() => setAudience((a) => ({ ...a, followers: !a.followers }))} />
            <Switch on={audience.training} label="Help train Amberly"
              desc="BeakerBoys may use the photos and notes to improve trichome reading. Never shown to others."
              onToggle={() => setAudience((a) => ({ ...a, training: !a.training }))} />
            {needsName && <div style={{ marginTop: 6 }}><ProfileFields value={draft} onChange={setDraft} /></div>}
            <p className="tv-field-hint" style={{ margin: "4px 0 14px" }}>
              Location, camera, and time details are removed from photos. You can change this or stop sharing anytime.
              See the <a href="/terms.html" target="_blank" rel="noreferrer">Terms</a>.
            </p>
            <button className="tv-btn tv-btn-primary" disabled={busy || (nothing && !alreadyShared) || (needsName && !USERNAME_RULE.test(draft.username))}
              onClick={run(async () => {
                if (needsName) { await saveProfile(draft); setProfile(draft); }
                await onShare(audience);
                onClose();
              })}>
              {busy ? "Saving…" : nothing ? "Stop sharing" : alreadyShared ? "Save" : "Share"}
            </button>
          </>)}

          {error && <div className="tv-error-msg" role="alert" style={{ marginTop: 10 }}>{error}</div>}
          <button className="tv-btn tv-btn-ghost" style={{ marginTop: 8 }} disabled={busy} onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
