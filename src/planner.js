// ─────────────────────────────────────────────────────────────────────────────
// Amberly grow planner — pure logic, no React. Every number here comes from the
// grow-planner research (RII best-practice guides, GrowWeedEasy, GH/FoxFarm
// charts, Fast Buds, Royal Queen Seeds). Keep data here; keep UI in GrowPlanner.
// ─────────────────────────────────────────────────────────────────────────────

// The ONLY place the app touches device storage. Swap these two functions for
// API calls later (accounts / social feed) and nothing else has to change.
export const store = {
  get(key, fallback) {
    try { const raw = localStorage.getItem(key); return raw == null ? fallback : JSON.parse(raw); }
    catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch { return false; } // usually "storage full" — caller warns the user
  },
  remove(key) {
    try { localStorage.removeItem(key); } catch { /* storage unavailable: nothing to delete */ }
  },
  // Ask the browser not to clear our data when the phone runs low on space.
  // Chrome/Android grants this quietly for apps people use; Safari keeps data for
  // Home Screen apps. Best effort: a "no" just means default browser behavior.
  persist() {
    navigator.storage?.persist?.().catch(() => {});
  },
};

export const GROWS_KEY = "amberly.grows.v1";
export const uid = (p) => `${p}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

// ── Dates (local-time safe: "2026-10-07" must not shift a day in Ohio) ──────
const DAY = 864e5;
export const parseDay = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
export const dayStart = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x.getTime(); };
export const toDayStr = (d) => { const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`; };
export const daysBetween = (a, b) => Math.round((dayStart(b) - dayStart(a)) / DAY);
// Calendar-day math via setDate so DST changes (Mar/Nov) never shift a date.
export const addDays = (d, n) => { const x = new Date(dayStart(d)); x.setDate(x.getDate() + n); return x; };
export const fmtDate = (d) => new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" });
export const relDay = (d) => {
  const n = daysBetween(Date.now(), d);
  return n === 0 ? "Today" : n === 1 ? "Tomorrow" : n === -1 ? "Yesterday" : n > 0 ? `In ${n} days` : `${-n} days ago`;
};

// ── Stage targets (research §7 consolidated table) ──────────────────────────
// ranges are [min, max]; temps °F; ec = mS/cm (×500 for ppm-500 meters)
export const STAGES = {
  germination: { label: "Germination", emoji: "🫘", ppfd: [75, 200], dli: [6, 12], day: [75, 80], night: [70, 75], rh: [70, 90], vpd: [0.4, 0.6],
    ec: { soil: [0, 0], coco: [0.2, 0.4] }, feed: "None — the seed feeds itself.",
    tasks: ["Keep the medium moist, not soaked", "Note the day it breaks the surface"] },
  seedling: { label: "Seedling", emoji: "🌱", ppfd: [100, 300], dli: [15, 20], day: [70, 80], night: [65, 75], rh: [65, 75], vpd: [0.4, 0.8],
    ec: { soil: [0, 0.4], coco: [0.4, 0.6] }, feed: "Plain water in soil. ¼-strength in coco/hydro.",
    tasks: ["Small ring waterings around the stem", "Start gentle LST (tie-down) at 3–4 nodes"] },
  earlyVeg: { label: "Early veg", emoji: "🌿", ppfd: [300, 450], dli: [20, 30], day: [72, 82], night: [65, 75], rh: [55, 70], vpd: [0.8, 1.0],
    ec: { soil: [0.6, 1.0], coco: [0.8, 1.2] }, feed: "Nitrogen-heavy veg/grow formula, start at half strength.",
    tasks: ["Top or FIM at 4–6 nodes (autos: once at most, before pistils)", "Keep LST going to open the canopy"] },
  lateVeg: { label: "Late veg", emoji: "🌳", ppfd: [450, 650], dli: [30, 40], day: [72, 85], night: [65, 75], rh: [50, 60], vpd: [1.0, 1.2],
    ec: { soil: [1.0, 1.4], coco: [1.2, 1.8] }, feed: "Nitrogen plus rising phosphorus/potassium.",
    tasks: ["Water to 10–20% runoff", "Light clean-up of lower leaves before flower"] },
  stretch: { label: "Early flower (stretch)", emoji: "🌼", ppfd: [600, 800], dli: [25, 35], day: [70, 80], night: [64, 72], rh: [45, 55], vpd: [1.0, 1.3],
    ec: { soil: [1.2, 1.6], coco: [1.4, 2.0] }, feed: "Shift to bloom formula — P/K up, keep some N.",
    tasks: ["Plants can double in height — keep an eye on light distance", "Optional: defoliate around flower day 21", "No more topping from here"] },
  midFlower: { label: "Mid flower", emoji: "🌸", ppfd: [800, 1000], dli: [35, 45], day: [68, 80], night: [62, 72], rh: [40, 50], vpd: [1.2, 1.5],
    ec: { soil: [1.4, 1.8], coco: [1.6, 2.2] }, feed: "Peak bloom feeding — high P/K, low N.",
    tasks: ["Peak thirst — check pots daily", "No high-stress training", "Keep humidity down: buds are getting dense"] },
  lateFlower: { label: "Late flower", emoji: "🍯", ppfd: [650, 900], dli: [25, 40], day: [65, 78], night: [60, 68], rh: [35, 45], vpd: [1.2, 1.6],
    ec: { soil: [1.0, 1.4], coco: [0.9, 1.4] }, feed: "Taper — potassium-heavy, low nitrogen.",
    tasks: ["Scan trichomes every 2–3 days", "Yellowing fan leaves now is normal", "Start your flush if you chose one"] },
  drying: { label: "Drying", emoji: "🌬️", day: [60, 70], night: [60, 70], rh: [55, 62],
    tasks: ["Dark room, gentle airflow — aim for 60°F / 60% RH", "Done when small stems snap (7–14 days)"] },
  curing: { label: "Curing", emoji: "🫙", day: [60, 70], night: [60, 70], rh: [58, 62],
    tasks: ["Jars about ¾ full, target 58–62% RH", "Burp daily week 1, every 2–3 days week 2, then weekly"] },
  done: { label: "Cured & ready", emoji: "🏆", tasks: ["Enjoy it — and log how it turned out"] },
};
const FLOWER_KEYS = ["stretch", "midFlower", "lateFlower"];
export const PH = { soil: "6.3–6.8", coco: "5.8–6.2", hydro: "5.5–6.0" };
export const AMBER_TARGET = { energetic: 5, balanced: 15, relaxed: 35 }; // matches the Effect Dial

const FLOWER_DAYS = { indica: 56, hybrid: 63, sativa: 77 };   // photo, after the flip
const AUTO_DAYS = { fast: 63, standard: 77, long: 91 };        // auto, seed to harvest
const STRETCH = { indica: 1.5, hybrid: 2, sativa: 2.5 };       // height multiplier after flip

// ── Trichome-scan forecast ──────────────────────────────────────────────────
// Turns the harvest date from a guess into a converging forecast: if amber is
// rising between scans, project when it hits the grower's chosen target.
export function scanForecast(scans, effect) {
  const pts = scans.filter((s) => s.reading).map((s) => ({ t: dayStart(s.createdAt), a: s.reading.amber }))
    .sort((x, y) => x.t - y.t);
  if (!pts.length) return null;
  const target = AMBER_TARGET[effect] ?? 15, last = pts.at(-1);
  if (last.a >= target) return { date: new Date(last.t), ready: true, last };
  if (pts.length < 2) return { last };
  const first = pts[0], slope = (last.a - first.a) / Math.max(1, (last.t - first.t) / DAY);
  if (slope <= 0) return { last };
  return { date: addDays(last.t, Math.ceil((target - last.a) / slope)), last };
}

// ── The plan: stage boundaries + milestones, recalculated from real events ──
export function plan(g, scans = []) {
  const s = parseDay(g.startDate);
  const at = (n) => addDays(s, n);
  const auto = g.plantType === "auto";
  const flipDay = g.flipDate ? daysBetween(s, parseDay(g.flipDate)) : null;

  let flower, harvest;
  if (auto) {
    const bd = +g.breederDays;                               // typed "days from seed": only trust sane values
    const total = bd >= 40 && bd <= 200 ? bd : AUTO_DAYS[g.autoSpeed] || 77;
    const pre = Math.round(total * 0.32);                  // autos self-flower ~week 3–5
    flower = flipDay ?? pre;
    harvest = flower + (total - pre);
  } else {
    flower = flipDay ?? 14 + (+g.vegWeeks || 4) * 7;
    harvest = flower + (FLOWER_DAYS[g.genetics] || 63);
  }
  const fc = scanForecast(scans, g.effect);
  if (fc?.date && !g.harvestDate) harvest = Math.max(flower + 21, daysBetween(s, fc.date));
  if (g.harvestDate) harvest = daysBetween(s, parseDay(g.harvestDate));

  const vegMid = 14 + Math.max(0, flower - 14) / 2, fl = harvest - flower;
  const bounds = [
    ["germination", 0], ["seedling", 5], ["earlyVeg", 14], ["lateVeg", Math.round(vegMid)],
    ["stretch", flower], ["midFlower", flower + Math.round(fl * 0.3)], ["lateFlower", flower + Math.round(fl * 0.65)],
    ["drying", harvest], ["curing", harvest + 10], ["done", harvest + 38],
  ];
  const day = daysBetween(s, Date.now());
  const stageKey = [...bounds].reverse().find(([, d]) => day >= d)?.[0] ?? "germination";
  const flush = +g.flush || 0;

  const milestones = [
    { label: "Sprout", date: at(3), emoji: "🫘" },
    { label: auto ? "First pistils (auto-flowers)" : "Flip to 12/12", date: at(flower), emoji: auto ? "🌼" : "💡", actual: !!g.flipDate },
    { label: "Start trichome scans", date: at(Math.max(flower, harvest - 14)), emoji: "🔬" },
    flush && { label: `Start ${flush}-day flush`, date: at(harvest - flush), emoji: "🚿" },
    { label: fc?.date && !g.harvestDate ? "Harvest (from your scans)" : "Estimated harvest", date: at(harvest), emoji: "✂️", actual: !!g.harvestDate },
    { label: "Dry done → into jars", date: at(harvest + 10), emoji: "🫙" },
    { label: "Cured & ready", date: at(harvest + 38), emoji: "🏆" },
  ].filter(Boolean);

  return {
    day, stageKey, stage: STAGES[stageKey], flowering: FLOWER_KEYS.includes(stageKey),
    flowerDate: at(flower), harvestDate: at(harvest), progress: Math.min(1, Math.max(0, day / harvest)),
    lightHours: auto ? g.lightSchedule || "18/6" : day >= flower ? "12/12" : "18/6",
    milestones, forecast: fc, scanTime: day >= harvest - 14 && day < harvest + 1,
  };
}

// ── Watering: research defaults, then learns from the grower's own logs ─────
export function waterPlan(g, stageKey, logs) {
  if (g.medium === "hydro") return { hydro: true };
  const pot = +g.potGal || 5, coco = g.medium === "coco";
  let base = coco ? (pot <= 5 ? 1 : 1.5) : pot <= 1 ? 1.5 : pot <= 5 ? 2.5 : pot <= 7 ? 3.5 : 4;
  const young = stageKey === "germination" || stageKey === "seedling";
  if (young) base = coco ? 1 : 2.5;
  if (stageKey === "stretch" || stageKey === "midFlower") base *= 0.75; // peak thirst

  const days = [...new Set(logs.filter((l) => l.type === "water" || l.type === "feed").map((l) => dayStart(l.date)))].sort((a, b) => a - b);
  if (days.length >= 3) {                                   // blend in the grower's real rhythm
    const gaps = days.slice(1).map((d, i) => (d - days[i]) / DAY).slice(-5).sort((a, b) => a - b);
    base = (base + gaps[Math.floor(gaps.length / 2)]) / 2;
  }
  const interval = Math.max(1, Math.round(base));
  const last = days.at(-1);
  const frac = young ? 0.12 : 0.3;                          // ~25–33% of pot volume once established

  // Soil: feed every other watering (avoids salt build-up). Coco/hydro: every watering.
  const lastWaterLog = logs.filter((l) => l.type === "water" || l.type === "feed").at(-1);
  const feedNext = !young && (coco || lastWaterLog?.type !== "feed");
  return { interval, last, next: last ? addDays(last, interval).getTime() : dayStart(Date.now()), gal: pot * frac, liters: pot * frac * 3.785, feedNext };
}

export function feedPlan(g, stageKey) {
  const st = STAGES[stageKey];
  if (!st.ec) return null;
  const ec = st.ec[g.medium === "soil" ? "soil" : "coco"];
  const auto = g.plantType === "auto";
  return {
    focus: st.feed,
    ec, ppm: ec.map((v) => Math.round(v * 500)),
    ph: PH[g.medium] || PH.soil,
    strength: auto ? "Autos: use ¼–½ of the bottle's chart strength." : "Start at ½ the bottle's chart strength; raise only if leaves go pale.",
    calmag: g.medium === "coco" || g.roWater ? "Add Cal-Mag every feed (coco/RO water binds calcium & magnesium)." : null,
  };
}

// ── Climate check: leaf VPD (Tetens, LED leaf ≈ 1.5 °C cooler) + warnings ───
const svp = (c) => 0.61078 * Math.exp((17.27 * c) / (c + 237.3));
export function envCheck(stageKey, tempF, rh) {
  const st = STAGES[stageKey], c = ((tempF - 32) * 5) / 9;
  const vpd = Math.max(0, svp(c - 1.5) - svp(c) * (rh / 100));
  const out = [];
  if (tempF > 90) out.push(["bad", "Too hot (over 90°F). Raise or dim the light, add airflow."]);
  else if (tempF > 85) out.push(["warn", "Running hot (over 85°F)."]);
  else if (tempF < 60) out.push(["bad", "Too cold (under 60°F) — growth will stall."]);
  else if (st.day && tempF < st.day[0] - 3) out.push(["warn", `A bit cool for ${st.label.toLowerCase()} (aim ${st.day[0]}–${st.day[1]}°F).`]);
  if (st.rh && rh > st.rh[1] + 5) out.push([FLOWER_KEYS.includes(stageKey) && rh > 60 ? "bad" : "warn",
    FLOWER_KEYS.includes(stageKey) ? `Humidity ${rh}% — bud-rot risk. Aim ${st.rh[0]}–${st.rh[1]}%.` : `Humidity high — aim ${st.rh[0]}–${st.rh[1]}%.`]);
  else if (st.rh && rh < st.rh[0] - 5) out.push(["warn", `Air is dry — aim ${st.rh[0]}–${st.rh[1]}%.`]);
  if (st.vpd) {
    if (vpd < 0.4 || vpd > 1.6) out.push(["bad", `VPD ${vpd.toFixed(2)} kPa is in the danger zone (aim ${st.vpd[0]}–${st.vpd[1]}).`]);
    else if (vpd < st.vpd[0] - 0.1 || vpd > st.vpd[1] + 0.1) out.push(["warn", `VPD ${vpd.toFixed(2)} kPa — target ${st.vpd[0]}–${st.vpd[1]} for this stage.`]);
  }
  return { vpd, issues: out };
}

// ── Equipment helpers ───────────────────────────────────────────────────────
export function lightCheck(g) {
  const area = (+g.tentW || 0) * (+g.tentL || 0), w = +g.lightWatts || 0;
  if (area <= 0 || w <= 0) return null;
  const wpsf = w / area;
  const msg = wpsf < 20 ? "Under-lit for flowering — expect a smaller harvest."
    : wpsf < 30 ? "Adequate for flowering." : wpsf <= 50 ? "Strong — great for flowering." : "Very strong — dim it if tops bleach or temps climb.";
  return { wpsf: Math.round(wpsf), msg, ok: wpsf >= 20 };
}

// Flip when the plant is about final-height ÷ stretch (GrowWeedEasy rule),
// where final height = tent − light hanger (12") − light gap (18") − pot.
const POT_IN = { 1: 7, 3: 10, 5: 12, 7: 13, 10: 15 };
export function flipHeight(g) {
  if (g.plantType === "auto" || g.location === "outdoor" || !+g.tentHeight) return null;
  const room = +g.tentHeight - 12 - 18 - (POT_IN[g.potGal] || 12);
  return room > 0 ? Math.round(room / (STRETCH[g.genetics] || 2)) : null;
}

// Diary/log records keep the "social-ready" shape used everywhere else.
export const makeLog = (type, fields = {}) => ({ id: uid("l"), type, date: new Date().toISOString(), author: null, shared: false, ...fields });

export const newGrow = () => ({
  id: uid("g"), createdAt: new Date().toISOString(), author: null, shared: false,
  name: "", strainName: "", breeder: "", plantType: "auto", genetics: "hybrid", autoSpeed: "standard", breederDays: "",
  vegWeeks: 4, location: "indoor", medium: "soil", potGal: 5, lightWatts: "", tentW: 4, tentL: 4, tentHeight: 72,
  lightSchedule: "18/6", effect: "balanced", flush: 0, roWater: false,
  startDate: toDayStr(Date.now()), flipDate: "", harvestDate: "", logs: [],
});
