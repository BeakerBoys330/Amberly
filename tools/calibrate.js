// Scores the app's trichome color rules against a labeled COCO dataset
// (Roboflow "trichome colour detection", CC BY 4.0) placed in tools/dataset/.
// Dev-only: open http://localhost:5173/tools/calibrate.html. Never shipped.
import { rgbToHsl, classifyPixel, analyzeImage } from "../src/trichomes.js";

const CLASSES = ["clear", "milky", "amber"];
const norm = (name) => ({ cloudy: "milky", milk: "milky" }[name.toLowerCase()] || name.toLowerCase());
const sets = import.meta.glob("./dataset/**/_annotations.coco.json", { eager: true, import: "default" });

const loadImage = (src) => new Promise((ok, fail) => {
  const img = new Image();
  img.onload = () => ok(img);
  img.onerror = () => fail(new Error(`Can't load ${src}`));
  img.src = src;
});
const median = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const pct = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(s.length * p))]; };

// One labeled box → what the rules call each pixel, plus the median HSL of its
// central half (where the trichome head sits, away from background).
function scoreBox(ctx, [x, y, w, h]) {
  const { data } = ctx.getImageData(Math.round(x), Math.round(y), Math.max(1, Math.round(w)), Math.max(1, Math.round(h)));
  const W = Math.max(1, Math.round(w)), H = Math.max(1, Math.round(h));
  const counts = { clear: 0, milky: 0, amber: 0 }, hs = [], ss = [], ls = [];
  for (let py = 0; py < H; py++) for (let px = 0; px < W; px++) {
    const i = (py * W + px) * 4, r = data[i], g = data[i + 1], b = data[i + 2];
    const stage = classifyPixel(r, g, b);
    if (stage) counts[stage]++;
    if (px > W / 4 && px < (3 * W) / 4 && py > H / 4 && py < (3 * H) / 4) {
      const [hh, s, l] = rgbToHsl(r, g, b); hs.push(hh); ss.push(s); ls.push(l);
    }
  }
  // Majority among stage pixels; "none" only when the rules found no stage pixels at all.
  const pred = CLASSES.reduce((best, c) => (counts[c] > (counts[best] ?? 0) ? c : best), "none");
  return { counts, pred, hsl: hs.length ? [median(hs), median(ss), median(ls)] : null };
}

async function run() {
  const boxes = [], images = [];
  for (const [path, coco] of Object.entries(sets)) {
    const dir = path.slice(0, path.lastIndexOf("/") + 1);
    const cat = Object.fromEntries(coco.categories.map((c) => [c.id, norm(c.name)]));
    for (const im of coco.images) {
      const anns = coco.annotations.filter((a) => a.image_id === im.id && CLASSES.includes(cat[a.category_id]));
      if (!anns.length) continue;
      const img = await loadImage(dir + im.file_name);
      const canvas = Object.assign(document.createElement("canvas"), { width: img.width, height: img.height });
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(img, 0, 0);
      const labelCounts = { clear: 0, milky: 0, amber: 0 };
      for (const a of anns) {
        const label = cat[a.category_id];
        labelCounts[label]++;
        boxes.push({ set: dir.split("/")[2], label, area: a.bbox[2] * a.bbox[3], ...scoreBox(ctx, a.bbox) });
      }
      // Whole photo, exactly as the app reads it, vs. the share of labeled heads.
      const app = await analyzeImage(img), n = anns.length;
      images.push({
        set: dir.split("/")[2], file: im.file_name, n, coverage: app.coverage,
        truth: Object.fromEntries(CLASSES.map((c) => [c, (labelCounts[c] / n) * 100])),
        app: Object.fromEntries(CLASSES.map((c) => [c, app.total ? (app[c] / app.total) * 100 : 0])),
      });
    }
  }

  const confusion = Object.fromEntries(CLASSES.map((t) => [t, Object.fromEntries([...CLASSES, "none"].map((p) => [p, boxes.filter((b) => b.label === t && b.pred === p).length]))]));
  const hslStats = Object.fromEntries(CLASSES.map((c) => {
    const hs = boxes.filter((b) => b.label === c && b.hsl).map((b) => b.hsl);
    return [c, ["H", "S", "L"].map((k, i) => ({ k, p10: pct(hs.map((v) => v[i]), 0.1), p50: pct(hs.map((v) => v[i]), 0.5), p90: pct(hs.map((v) => v[i]), 0.9) }))];
  }));
  const mae = Object.fromEntries(CLASSES.map((c) => [c, images.reduce((s, im) => s + Math.abs(im.app[c] - im.truth[c]), 0) / (images.length || 1)]));
  window.results = { boxes, images, confusion, hslStats, mae };
  render(window.results);
}

function render({ boxes, images, confusion, hslStats, mae }) {
  const f = (v) => (v == null ? "—" : v.toFixed(1));
  const correct = boxes.filter((b) => b.pred === b.label).length;
  // Balanced = average of per-class hit rates, so the big milky class can't hide misses. Chance = 33%.
  const balanced = CLASSES.reduce((s, c) => s + confusion[c][c] / (Object.values(confusion[c]).reduce((a, n) => a + n, 0) || 1), 0) / 3;
  document.getElementById("out").innerHTML = `
    <p>${Object.keys(sets).length} split(s), ${images.length} photos, ${boxes.length} labeled trichome heads.
       Per-head accuracy: <b>${((correct / (boxes.length || 1)) * 100).toFixed(1)}%</b> ·
       balanced: <b>${(balanced * 100).toFixed(1)}%</b> (chance 33%)</p>
    <h2>Per head: label (rows) vs. what the rules said (columns)</h2>
    <table><tr><th></th>${[...CLASSES, "none"].map((p) => `<th>${p}</th>`).join("")}</tr>
      ${CLASSES.map((t) => `<tr><td>${t}</td>${[...CLASSES, "none"].map((p) => `<td>${confusion[t][p]}</td>`).join("")}</tr>`).join("")}</table>
    <h2>Whole photo: average error in % points (app reading vs. labeled share)</h2>
    <table><tr>${CLASSES.map((c) => `<th>${c}</th>`).join("")}</tr><tr>${CLASSES.map((c) => `<td>${f(mae[c])}</td>`).join("")}</tr></table>
    <h2>Real color of labeled heads (median of each head's center; 10th / 50th / 90th percentile)</h2>
    <table><tr><th>class</th><th>H</th><th>S</th><th>L</th></tr>
      ${CLASSES.map((c) => `<tr><td>${c}</td>${hslStats[c].map((s) => `<td>${f(s.p10)} / ${f(s.p50)} / ${f(s.p90)}</td>`).join("")}</tr>`).join("")}</table>`;
}

if (!Object.keys(sets).length) document.getElementById("out").textContent = "No dataset found — unzip the COCO export into tools/dataset/.";
else run().catch((e) => { document.getElementById("out").textContent = e.message; });
