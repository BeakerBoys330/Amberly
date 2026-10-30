import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { ArrowLeft, Plus } from "lucide-react";
import {
  store, GROWS_KEY, plan, waterPlan, feedPlan, envCheck, lightCheck, flipHeight,
  makeLog, newGrow, toDayStr, dayStart, fmtDate, relDay, parseDay, daysBetween, addDays,
} from "./planner.js";
import { cloudEnabled, syncGrow, setAudience, unshare } from "./cloud.js";
import ShareSheet from "./ShareSheet.jsx";

// Grow planner: setup → today card (what to do now) → one-tap logging → timeline.
// Reuses the main app's tv-* design system; only planner-specific bits live below.
const GP_STYLES = `
  .gp-progress { height: 8px; background: #f1e9dd; border-radius: 99px; overflow: hidden; margin: 12px 0 6px; }
  .gp-progress > div { height: 100%; background: #d99a3c; border-radius: 99px; }
  .gp-quick { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; margin-bottom: 14px; }
  .gp-quick button { background: #fffdfa; border: 1px solid #efe7dc; border-radius: 14px; padding: 12px 4px;
    cursor: pointer; font-size: 11.5px; color: #6b5d4c; font-weight: 500; display: flex; flex-direction: column; align-items: center; gap: 4px; }
  .gp-quick button span { font-size: 22px; }
  .gp-quick button:active { transform: scale(0.96); }
  .gp-row { display: flex; justify-content: space-between; gap: 12px; padding: 9px 0; border-bottom: 1px solid #f3ece2; font-size: 14px; }
  .gp-row:last-child { border-bottom: none; }
  .gp-row b { color: #2b2622; font-weight: 600; text-align: right; }
  .gp-row span { color: #8a7f74; }
  .gp-strip { display: grid; grid-template-columns: repeat(7, 1fr); gap: 6px; }
  .gp-day { aspect-ratio: 1; border-radius: 10px; background: #f7f0e6; display: flex; flex-direction: column;
    align-items: center; justify-content: center; font-size: 11px; color: #a4988a; line-height: 1.1; }
  .gp-day.today { outline: 2px solid #d99a3c; color: #2b2622; font-weight: 600; }
  .gp-day i { font-style: normal; font-size: 13px; min-height: 15px; }
  .gp-day.plan i { opacity: 0.35; }
  .gp-ms { display: flex; gap: 12px; align-items: center; padding: 10px 0; border-bottom: 1px solid #f3ece2; font-size: 14px; }
  .gp-ms:last-child { border-bottom: none; }
  .gp-ms.past { opacity: 0.5; }
  .gp-ms .when { margin-left: auto; color: #8a7f74; font-size: 13px; white-space: nowrap; }
  .gp-photos { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
  .gp-photo { position: relative; border-radius: 12px; overflow: hidden; aspect-ratio: 1; background: #f1e9dd; }
  .gp-photo img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .gp-issue { font-size: 13.5px; padding: 10px 13px; border-radius: 12px; margin-top: 8px; line-height: 1.45; }
  .gp-issue.warn { background: #fdf3e3; color: #9a6f30; }
  .gp-issue.bad { background: #fceeec; color: #b0442c; }
  .gp-issue.ok { background: #f0f5ee; color: #5e7d52; }
  .gp-label { font-size: 13px; font-weight: 600; color: #5c5249; margin: 16px 0 7px; }
  .gp-two { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .gp-toast { position: fixed; left: 50%; bottom: 28px; transform: translateX(-50%); background: #2b2622; color: #fff;
    padding: 12px 20px; border-radius: 99px; font-size: 14px; z-index: 60; box-shadow: 0 8px 24px rgba(0,0,0,0.2); }
`;

// Segmented pill picker — the whole setup form is built from these, so most
// answers are one tap instead of typing.
const Seg = ({ value, options, onChange }) => (
  <div className="tv-seg">
    {options.map(([v, label]) => (
      <button key={String(v)} type="button" className={`tv-seg-btn ${value === v ? "active" : ""}`} onClick={() => onChange(v)}>{label}</button>
    ))}
  </div>
);

const Card = ({ title, children }) => (
  <div className="tv-card"><div className="tv-card-pad">
    {title && <div className="tv-section-title" style={{ marginBottom: 10 }}>{title}</div>}
    {children}
  </div></div>
);

const Row = ({ k, v }) => <div className="gp-row"><span>{k}</span><b>{v}</b></div>;
const range = (r, unit = "") => (r ? `${r[0]}–${r[1]}${unit}` : "—");

export default function GrowPlanner({ diary, strainNames, openId, onScan, onBack, fileToThumb }) {
  const [grows, setGrows] = useState(() => { const g = store.get(GROWS_KEY, []); return Array.isArray(g) ? g : []; });
  const [view, setView] = useState(openId ? { mode: "detail", id: openId } : { mode: "list" });
  const [draft, setDraft] = useState(null);
  const [sheet, setSheet] = useState(null);     // { type, ...fields } for feed/climate/note
  const [toast, setToast] = useState("");
  const [sharing, setSharing] = useState(false); // "Share this grow" sheet open
  const photoRef = useRef(null);
  const growsRef = useRef(grows);               // latest grows, for code that finishes after an upload
  growsRef.current = grows;

  // Persist on every change; storage is the one place that can fail (quota).
  const save = useCallback((next) => {
    setGrows(next);
    if (!store.set(GROWS_KEY, next)) setToast("Storage full — delete old photos to keep saving");
  }, []);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(""), 2400); return () => clearTimeout(t); }, [toast]);

  const grow = grows.find((g) => g.id === view.id);
  const patchGrow = (id, fn) => save(growsRef.current.map((g) => (g.id === id ? { ...g, ...fn(g) } : g)));
  const updateGrow = (patch) => patchGrow(grow.id, () => patch);
  const addLog = (type, fields, msg) => { updateGrow({ logs: [...grow.logs, makeLog(type, fields)] }); setToast(msg); setSheet(null); };

  // ── Sharing a grow journey (opt-in): followers and/or training, chosen separately ──
  // Upload the grow and any entries not sent yet, then mark those entries synced.
  // One upload at a time: changes made meanwhile are picked up when it finishes.
  const syncing = useRef(false);
  const pushGrow = async (g) => {
    if (syncing.current) return;
    syncing.current = true;
    try {
      const ids = await syncGrow(g);
      // Keep any audience change made while uploading (cur.sharing wins over g.sharing).
      patchGrow(g.id, (cur) => ({ shared: true, sharing: cur.sharing || g.sharing, logs: cur.logs.map((l) => (ids.includes(l.id) ? { ...l, synced: true } : l)) }));
    } finally { syncing.current = false; }
  };
  // From the share sheet. Both switches off = stop sharing and delete the server copy.
  // Changing who sees an already-shared grow just flips the setting — no re-upload.
  const setGrowSharing = async (audience) => {
    // Let any running upload finish first, so nothing lands afterwards with the old setting.
    while (syncing.current) await new Promise((r) => setTimeout(r, 200));
    if (audience.followers || audience.training) {
      if (!grow.shared) return pushGrow({ ...grow, sharing: audience });
      await setAudience("grow_local_id", grow.id, audience);
      return patchGrow(grow.id, () => ({ sharing: audience }));
    }
    await unshare("grow_local_id", [grow.id]);
    updateGrow({ shared: false, sharing: null, logs: grow.logs.map(({ synced, ...l }) => l) });
    setToast("Stopped sharing — the shared copy was deleted");
  };
  const deleteLog = (id) => {
    if (cloudEnabled && grow.shared) unshare("local_id", [id]).catch(() => {});
    updateGrow({ logs: grow.logs.filter((x) => x.id !== id) });
  };
  // While a grow is shared, quietly send new entries and key dates — now, and again
  // whenever the phone gets its connection back.
  const pending = grow?.shared ? `${grow.logs.filter((l) => !l.synced).length}|${grow.flipDate}|${grow.harvestDate}` : null;
  useEffect(() => {
    if (!cloudEnabled || !pending) return;
    const send = () => pushGrow(growsRef.current.find((g) => g.id === grow.id)).catch(() => {});
    if (navigator.onLine) send();
    window.addEventListener("online", send);
    return () => window.removeEventListener("online", send);
  }, [pending]); // eslint-disable-line react-hooks/exhaustive-deps

  const scans = useMemo(() => (grow ? diary.filter((e) => e.growId === grow.id) : []), [diary, grow]);
  const p = useMemo(() => (grow ? plan(grow, scans) : null), [grow, scans]);

  const pickPhoto = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try { addLog("photo", { photo: await fileToThumb(file) }, "📷 Photo added"); }
    catch (err) { setToast(err?.message || "Couldn't read that photo"); }
  };

  const set = (k) => (v) => setDraft((d) => ({ ...d, [k]: v }));
  const field = (k) => ({ value: draft[k] ?? "", onChange: (e) => set(k)(e.target.value) });

  // ═══════════════ SETUP / EDIT ═══════════════
  if (view.mode === "edit" && draft) {
    const auto = draft.plantType === "auto", indoor = draft.location === "indoor";
    const commit = () => {
      const g = { ...draft, name: draft.name.trim() || draft.strainName.trim() || "My grow" };
      save(grows.some((x) => x.id === g.id) ? grows.map((x) => (x.id === g.id ? g : x)) : [g, ...grows]);
      setView({ mode: "detail", id: g.id });
    };
    return (
      <>
        <style>{GP_STYLES}</style>
        <button className="tv-back" onClick={() => setView(grow ? { mode: "detail", id: grow.id } : { mode: "list" })}><ArrowLeft size={17} /> Back</button>
        <div className="tv-hero"><div className="tv-hero-title">{grows.some((x) => x.id === draft.id) ? "Edit grow" : "Start a grow"}</div>
          <div className="tv-hero-sub">A few taps and we'll build your calendar.</div></div>

        <Card>
          <label className="tv-field-label">Strain</label>
          <input className="tv-input" list="gp-strains" placeholder="e.g. Gorilla Cookies Auto" {...field("strainName")} />
          <datalist id="gp-strains">{strainNames.map((n) => <option key={n} value={n} />)}</datalist>
          <div className="gp-label">Plant type</div>
          <Seg value={draft.plantType} onChange={set("plantType")} options={[["auto", "🌱 Autoflower"], ["photo", "☀️ Photoperiod"]]} />
          <div className="gp-label">Genetics</div>
          <Seg value={draft.genetics} onChange={set("genetics")} options={[["indica", "Indica"], ["hybrid", "Hybrid"], ["sativa", "Sativa"]]} />
          {auto ? (<>
            <div className="gp-label">How fast does the breeder say it finishes?</div>
            <Seg value={draft.autoSpeed} onChange={set("autoSpeed")} options={[["fast", "Fast ~9 wk"], ["standard", "~11 wk"], ["long", "Long ~13 wk"]]} />
            <input className="tv-input" type="number" inputMode="numeric" placeholder="Or exact days from seed (optional)" style={{ marginTop: 8 }} {...field("breederDays")} />
            <div className="gp-label">Light schedule</div>
            <Seg value={draft.lightSchedule} onChange={set("lightSchedule")} options={[["18/6", "18/6 (default)"], ["20/4", "20/4 (push)"]]} />
          </>) : (<>
            <div className="gp-label">Weeks of veg before flipping</div>
            <Seg value={+draft.vegWeeks} onChange={set("vegWeeks")} options={[[3, "3"], [4, "4"], [6, "6"], [8, "8"]]} />
          </>)}
          <div className="gp-label">Germination date</div>
          <input className="tv-input" type="date" {...field("startDate")} />
        </Card>

        <Card title="Your setup">
          <Seg value={draft.location} onChange={set("location")} options={[["indoor", "🏠 Indoor"], ["outdoor", "🌤️ Outdoor"]]} />
          <div className="gp-label">Growing medium</div>
          <Seg value={draft.medium} onChange={set("medium")} options={[["soil", "Soil"], ["coco", "Coco"], ["hydro", "Hydro"]]} />
          {draft.medium !== "hydro" && (<>
            <div className="gp-label">Pot size (gallons)</div>
            <Seg value={+draft.potGal} onChange={set("potGal")} options={[[1, "1"], [3, "3"], [5, "5"], [7, "7"], [10, "10"]]} />
          </>)}
          {indoor && (<>
            <div className="gp-label">Tent size (feet)</div>
            <Seg value={`${draft.tentW}x${draft.tentL}`} onChange={(v) => { const [w, l] = v.split("x").map(Number); setDraft((d) => ({ ...d, tentW: w, tentL: l })); }}
              options={["2x2", "2x4", "3x3", "4x4", "5x5"].map((t) => [t, t])} />
            <div className="gp-two" style={{ marginTop: 10 }}>
              <div><label className="tv-field-label">Light watts (actual draw)</label><input className="tv-input" type="number" inputMode="numeric" placeholder="e.g. 480" {...field("lightWatts")} /></div>
              <div><label className="tv-field-label">Tent height (in)</label><input className="tv-input" type="number" inputMode="numeric" {...field("tentHeight")} /></div>
            </div>
          </>)}
          <label className="tv-toggle-row" style={{ marginTop: 14, marginBottom: 0 }} onClick={() => set("roWater")(!draft.roWater)}>
            <div className="tv-toggle-text"><div className="tv-toggle-label">Using RO or very soft water</div><div className="tv-toggle-desc">We'll remind you about Cal-Mag.</div></div>
            <div className={`tv-switch ${draft.roWater ? "on" : ""}`}><div className="tv-switch-knob" /></div>
          </label>
        </Card>

        <Card title="Your goal">
          <Seg value={draft.effect} onChange={set("effect")} options={[["energetic", "⚡ Energetic"], ["balanced", "⚖️ Balanced"], ["relaxed", "🌙 Relaxed"]]} />
          <div className="gp-label">Flush before harvest? <span className="tv-field-hint">(experts disagree — optional)</span></div>
          <Seg value={+draft.flush} onChange={set("flush")} options={[[0, "No flush"], [7, "7 days"], [14, "14 days"]]} />
          <div className="gp-label">Nickname <span className="tv-field-hint">(optional)</span></div>
          <input className="tv-input" placeholder="e.g. Tent A – left" {...field("name")} />
        </Card>

        <button className="tv-btn tv-btn-primary" onClick={commit}>Build my plan</button>
        <div className="tv-disclaimer" style={{ marginTop: 12 }}>Home growing is legal only in some places. Check your local laws.</div>
      </>
    );
  }

  // ═══════════════ GROW DETAIL ═══════════════
  if (view.mode === "detail" && grow && p) {
    const st = p.stage, w = waterPlan(grow, p.stageKey, grow.logs), f = feedPlan(grow, p.stageKey);
    const lc = lightCheck(grow), fh = grow.location === "indoor" && !p.flowering && p.stageKey !== "drying" ? flipHeight(grow) : null;
    const env = grow.logs.filter((l) => l.type === "env").at(-1);
    const envRes = env && st.rh ? envCheck(p.stageKey, env.temp, env.rh) : null;
    const photos = grow.logs.filter((l) => l.type === "photo").reverse();
    const auto = grow.plantType === "auto", growing = p.day < daysBetween(parseDay(grow.startDate), p.harvestDate);
    const overdue = !w.hydro && dayStart(Date.now()) >= w.next;

    // 21-day strip: last 7 days, today, next 13 — logged dots solid, planned waterings faded
    const today = dayStart(Date.now()), nextWater = Math.max(w.next || 0, today);
    const strip = Array.from({ length: 21 }, (_, i) => {
      const d = addDays(today, i - 7).getTime(), logs = grow.logs.filter((l) => dayStart(l.date) === d);
      const fed = logs.some((l) => l.type === "feed"), watered = logs.some((l) => l.type === "water");
      const planned = !w.hydro && growing && d >= nextWater && daysBetween(nextWater, d) % w.interval === 0;
      return { d, icon: fed ? "🧪" : watered ? "💧" : logs.some((l) => l.type === "photo") ? "📷" : planned ? "💧" : "", plan: planned && !fed && !watered };
    });

    return (
      <>
        <style>{GP_STYLES}</style>
        <button className="tv-back" onClick={() => setView({ mode: "list" })}><ArrowLeft size={17} /> My grows</button>

        <div className="tv-banner">
          <div style={{ fontSize: 32 }}>{st.emoji}</div>
          <div style={{ flex: 1 }}>
            <div className="tv-banner-name">{grow.name}</div>
            <div className="tv-banner-meta">Day {Math.max(0, p.day)} · {st.label} · {auto ? "Auto" : "Photo"}</div>
            <div className="gp-progress"><div style={{ width: `${p.progress * 100}%` }} /></div>
            <div className="tv-banner-meta">Harvest ≈ {fmtDate(p.harvestDate)} ({relDay(p.harvestDate)})</div>
          </div>
        </div>

        {/* TODAY — reminders carry the exact payload (amount, EC, pH) */}
        <Card title="Today">
          {w.hydro ? <Row k="Reservoir" v="Top off; full change every 7–14 days" /> : growing && (<>
            <Row k={overdue ? "💧 Water" : "💧 Next water"} v={overdue ? (w.last ? "Due now" : "When top inch is dry") : relDay(w.next)} />
            <Row k="Amount" v={`~${w.liters.toFixed(1)} L (${w.gal.toFixed(1)} gal)${p.stageKey === "seedling" ? ", ring around stem" : ""}`} />
            <Row k="This watering" v={w.feedNext && f?.ec[1] ? "Feed 🧪" : "Plain water"} />
          </>)}
          {f && f.ec[1] > 0 && (<>
            <Row k="Target EC" v={`${range(f.ec)} (${range(f.ppm)} ppm)`} />
            <Row k="pH" v={f.ph} />
          </>)}
          {f && <div className="tv-tip">{f.focus} {f.strength}{f.calmag && <><br />{f.calmag}</>}</div>}
          {!w.hydro && growing && <div className="tv-field-hint" style={{ marginTop: 10 }}>Always double-check: water when the pot feels light or the top inch is dry. We learn your rhythm from your logs.</div>}
        </Card>

        <div className="gp-quick">
          <button onClick={() => addLog("water", {}, "💧 Watering logged")}><span>💧</span>Watered</button>
          <button onClick={() => setSheet({ type: "feed", ec: "", ph: "", note: "" })}><span>🧪</span>Fed</button>
          <button onClick={() => photoRef.current?.click()}><span>📷</span>Photo</button>
          <button onClick={() => setSheet({ type: "env", temp: "", rh: "" })}><span>🌡️</span>Climate</button>
          <button onClick={() => setSheet({ type: "note", note: "" })}><span>✏️</span>Note</button>
        </div>
        <input ref={photoRef} type="file" accept="image/*" onChange={pickPhoto} style={{ display: "none" }} />

        {sheet && (
          <Card title={{ feed: "🧪 Log a feeding", env: "🌡️ Climate check", note: "✏️ Add a note" }[sheet.type]}>
            {sheet.type === "feed" && <div className="gp-two" style={{ marginBottom: 10 }}>
              <input className="tv-input" type="number" step="0.1" inputMode="decimal" placeholder="EC (optional)" value={sheet.ec} onChange={(e) => setSheet({ ...sheet, ec: e.target.value })} />
              <input className="tv-input" type="number" step="0.1" inputMode="decimal" placeholder="pH (optional)" value={sheet.ph} onChange={(e) => setSheet({ ...sheet, ph: e.target.value })} />
            </div>}
            {sheet.type === "env" && <div className="gp-two" style={{ marginBottom: 10 }}>
              <input className="tv-input" type="number" inputMode="decimal" placeholder="Temp °F" value={sheet.temp} onChange={(e) => setSheet({ ...sheet, temp: e.target.value })} />
              <input className="tv-input" type="number" inputMode="decimal" placeholder="Humidity %" value={sheet.rh} onChange={(e) => setSheet({ ...sheet, rh: e.target.value })} />
            </div>}
            {sheet.type !== "env" && <textarea className="tv-textarea" placeholder={sheet.type === "feed" ? "What did you feed? (e.g. Big Bloom 3 tsp/gal)" : "What's happening?"} value={sheet.note} onChange={(e) => setSheet({ ...sheet, note: e.target.value })} style={{ marginBottom: 10 }} />}
            <div className="tv-btn-row" style={{ marginTop: 0 }}>
              <button className="tv-btn tv-btn-soft" onClick={() => setSheet(null)}>Cancel</button>
              <button className="tv-btn tv-btn-primary"
                disabled={(sheet.type === "env" && (!sheet.temp || !sheet.rh)) || (sheet.type === "note" && !sheet.note.trim())}
                onClick={() => {
                  if (sheet.type === "feed") addLog("feed", { ec: sheet.ec ? +sheet.ec : null, ph: sheet.ph ? +sheet.ph : null, note: sheet.note.trim() }, "🧪 Feeding logged");
                  if (sheet.type === "env") addLog("env", { temp: +sheet.temp, rh: +sheet.rh }, "🌡️ Climate saved");
                  if (sheet.type === "note") addLog("note", { note: sheet.note.trim().slice(0, 2000) }, "✏️ Note saved");
                }}>Save</button>
            </div>
          </Card>
        )}

        {/* Real events re-time everything downstream (never "assume" the flip) */}
        {!grow.flipDate && !p.flowering && p.day >= 14 && (
          <button className="tv-btn tv-btn-soft" style={{ marginBottom: 14 }} onClick={() => { updateGrow({ flipDate: toDayStr(Date.now()) }); setToast("Plan updated from today"); }}>
            {auto ? "🌼 I see first pistils today" : "💡 I flipped to 12/12 today"}
          </button>
        )}
        {(p.scanTime || p.flowering) && !grow.harvestDate && (
          <div className="tv-btn-row" style={{ marginTop: 0, marginBottom: 14 }}>
            <button className="tv-btn tv-btn-primary" onClick={() => onScan(grow)}>🔬 Scan trichomes</button>
            {p.scanTime && <button className="tv-btn tv-btn-soft" onClick={() => { updateGrow({ harvestDate: toDayStr(Date.now()) }); setToast("✂️ Harvest logged — drying plan started"); }}>✂️ I harvested</button>}
          </div>
        )}
        {p.forecast?.last && (
          <div className={`gp-issue ${p.forecast.ready ? "ok" : "warn"}`} style={{ marginTop: 0, marginBottom: 14 }}>
            Last scan: {p.forecast.last.a}% amber. {p.forecast.ready ? "You've reached your target — harvest window is open." : p.forecast.date ? `At this pace you'll hit your target around ${fmtDate(p.forecast.date)}.` : "Scan again in 2–3 days to project your harvest date."}
          </div>
        )}

        <Card title="Last 7 days · next 2 weeks">
          <div className="gp-strip">
            {strip.map((s) => (
              <div key={s.d} className={`gp-day ${s.d === today ? "today" : ""} ${s.plan ? "plan" : ""}`}>
                <i>{s.icon}</i>{new Date(s.d).getDate()}
              </div>
            ))}
          </div>
          <div className="tv-field-hint" style={{ marginTop: 8 }}>Solid = done · faded 💧 = planned</div>
        </Card>

        <Card title={`${st.label} targets`}>
          {st.ppfd && <Row k="Light" v={`${p.lightHours} · ${range(st.ppfd)} PPFD`} />}
          {st.dli && <Row k="Daily light (DLI)" v={range(st.dli, " mol")} />}
          {st.day && <Row k="Temp day / night" v={`${range(st.day, "°F")} / ${range(st.night, "°F")}`} />}
          {st.rh && <Row k="Humidity" v={range(st.rh, "%")} />}
          {st.vpd && <Row k="VPD" v={range(st.vpd, " kPa")} />}
          <div className="tv-tip">{st.tasks.map((t) => <div key={t}>• {t}</div>)}</div>
          {envRes && (<>
            <div className="gp-label">Last climate check ({relDay(env.date)}): {env.temp}°F · {env.rh}% · VPD {envRes.vpd.toFixed(2)}</div>
            {envRes.issues.length ? envRes.issues.map(([lvl, m]) => <div key={m} className={`gp-issue ${lvl}`}>{m}</div>)
              : <div className="gp-issue ok">Right in the zone. 👌</div>}
          </>)}
        </Card>

        {(fh || lc || grow.location === "outdoor") && (
          <Card title="Setup check">
            {fh && <Row k="Flip when plant is about" v={`${fh} in tall`} />}
            {fh && <div className="tv-field-hint" style={{ marginBottom: 8 }}>Plants stretch {grow.genetics === "indica" ? "~1.5×" : grow.genetics === "sativa" ? "2–3×" : "~2×"} after the flip — this keeps tops clear of your light.</div>}
            {lc && <div className={`gp-issue ${lc.ok ? "ok" : "warn"}`}>{lc.wpsf} watts/sq ft — {lc.msg}</div>}
            {grow.location === "outdoor" && !auto && <div className="gp-issue warn">Outdoors, photoperiods start flowering when days shorten (≈ late July–August at mid-latitudes). Tap "I flipped" when you see pistils. Watch frost dates near harvest.</div>}
          </Card>
        )}

        <Card title="Timeline">
          {p.milestones.map((m) => (
            <div key={m.label} className={`gp-ms ${dayStart(m.date) < today ? "past" : ""}`}>
              <span>{m.emoji}</span><span>{m.label}{m.actual ? " ✓" : ""}</span>
              <span className="when">{fmtDate(m.date)}</span>
            </div>
          ))}
        </Card>

        {photos.length > 0 && (
          <Card title={`Photos (${photos.length})`}>
            <div className="gp-photos">
              {photos.map((l) => (
                <div key={l.id} className="gp-photo">
                  <img src={l.photo} alt={`Day ${Math.max(0, daysBetween(parseDay(grow.startDate), l.date))}`} />
                </div>
              ))}
            </div>
          </Card>
        )}

        {cloudEnabled && (
          <Card title="Share your grow journey">
            {grow.shared ? (<>
              <div className="gp-issue ok" style={{ marginTop: 0 }}>
                {[grow.sharing?.followers && "👥 Your followers can follow along", grow.sharing?.training && "💚 helping train Amberly"].filter(Boolean).join(" · ")}.
                New entries and photos are sent automatically when you're online.
              </div>
              <button className="tv-link" style={{ paddingLeft: 0 }} onClick={() => setSharing(true)}>Change who sees this grow</button>
            </>) : (<>
              <div className="tv-field-hint" style={{ marginBottom: 10 }}>Let followers watch this grow, and/or help train Amberly. Your nickname for the grow stays on this phone.</div>
              <button className="tv-btn tv-btn-soft" onClick={() => setSharing(true)}>👥 Share this grow</button>
            </>)}
          </Card>
        )}
        {sharing && <ShareSheet what="this grow" audience={grow.shared ? grow.sharing : undefined} onShare={setGrowSharing} onClose={() => setSharing(false)} />}

        <Card title="History">
          {grow.logs.length === 0 ? <div className="tv-field-hint">Nothing logged yet — tap 💧 when you water.</div> :
            [...grow.logs].reverse().slice(0, 20).map((l) => (
              <div key={l.id} className="gp-row">
                <span>{{ water: "💧 Watered", feed: "🧪 Fed", photo: "📷 Photo", env: "🌡️ Climate", note: "✏️ Note" }[l.type]}
                  {l.type === "feed" && (l.ec || l.ph) ? ` · ${l.ec ? `EC ${l.ec}` : ""}${l.ph ? ` pH ${l.ph}` : ""}` : ""}
                  {l.type === "env" ? ` · ${l.temp}°F ${l.rh}%` : ""}
                  {l.note ? ` — ${l.note}` : ""}</span>
                <b style={{ fontWeight: 400, color: "#a4988a", whiteSpace: "nowrap" }}>
                  {fmtDate(l.date)} <button className="tv-diary-del" onClick={() => deleteLog(l.id)} aria-label="Delete log">✕</button>
                </b>
              </div>
            ))}
        </Card>

        <div className="tv-btn-row">
          <button className="tv-btn tv-btn-soft" onClick={() => { setDraft(grow); setView({ mode: "edit", id: grow.id }); }}>Edit setup</button>
          <button className="tv-btn tv-btn-ghost" onClick={() => {
            if (!window.confirm("Delete this grow and all its logs?" + (grow.shared ? " The shared copy will be deleted too." : ""))) return;
            if (cloudEnabled && grow.shared) unshare("grow_local_id", [grow.id]).catch(() => {});
            save(grows.filter((g) => g.id !== grow.id)); setView({ mode: "list" });
          }}>Delete grow</button>
        </div>
        {toast && <div className="gp-toast">{toast}</div>}
      </>
    );
  }

  // ═══════════════ GROW LIST ═══════════════
  return (
    <>
      <style>{GP_STYLES}</style>
      <button className="tv-back" onClick={onBack}><ArrowLeft size={17} /> Home</button>
      <div className="tv-hero"><div className="tv-hero-title">My grows</div>
        <div className="tv-hero-sub">Your calendar, watering plan, and targets for every stage.</div></div>

      {grows.length === 0 && <div className="tv-diary-empty"><div className="tv-diary-empty-emoji">🗓️</div>Start a grow and we'll build your whole timeline.</div>}
      {grows.map((g) => {
        const gp = plan(g, diary.filter((e) => e.growId === g.id));
        return (
          <button key={g.id} className="tv-choice-btn" style={{ marginBottom: 12 }} onClick={() => setView({ mode: "detail", id: g.id })}>
            <span className="tv-choice-emoji">{gp.stage.emoji}</span>
            <span className="tv-choice-text">
              <span className="tv-choice-name">{g.name}</span>
              <span className="tv-choice-desc">Day {Math.max(0, gp.day)} · {gp.stage.label} · harvest ≈ {fmtDate(gp.harvestDate)}</span>
            </span>
          </button>
        );
      })}
      <button className="tv-btn tv-btn-primary" onClick={() => { setDraft(newGrow()); setView({ mode: "edit" }); }}><Plus size={17} /> Start a new grow</button>
      <div className="tv-disclaimer" style={{ marginTop: 12 }}>Unlimited grows, free. Everything stays on this device.</div>
      {toast && <div className="gp-toast">{toast}</div>}
    </>
  );
}

