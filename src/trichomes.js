// Trichome color rules: pure logic shared by the app (Amberly.jsx) and the
// calibration page (tools/calibrate.html). No React.

export const rgbToHsl = (r, g, b) => {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;
  if (max === min) { h = s = 0; }
  else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
      default: h = 0;
    }
  }
  return [h * 360, s * 100, l * 100];
};

// Classify a single pixel into a trichome stage, or null if it is background,
// plant matter, or a PISTIL (the orange/brown "hairs", which are NOT trichomes).
//
// This pistil-vs-trichome distinction is the single most important correctness
// requirement in the whole app: pistils turn orange/brown weeks before trichome
// heads reach peak, and counting their color as "amber" would tell a grower to
// harvest early and lose potency. The separator is SATURATION + HUE:
//   Pistils         = vivid orange-brown (H 6-40, S > 40%)
//   Amber trichomes = golden resin       (H 20-62, S 32-55%)
//
// Thresholds tuned against ~3,500 labeled heads (tools/calibrate.html, Roboflow
// CC BY 4.0 sets). Labeled clear heads are see-through, so they read DARKER than
// opaque milky heads, not brighter. Color alone separates clear from milky only
// weakly; a trained model is the real fix. Stopgap rules: a guide, not a lab test.
export const classifyPixel = (r, g, b) => {
  const [h, s, l] = rgbToHsl(r, g, b);

  // Reject pure background: near-white blowout, near-black shadow, grey haze.
  if (l > 96 || l < 6 || (s < 5 && l > 90)) return null;

  // Reject green plant matter (leaf/calyx surface) so it doesn't dilute counts.
  if (h >= 70 && h <= 160 && s > 18) return null;

  // PISTIL EXCLUSION — warm hue AND high saturation = a hair, not a trichome.
  const isPistil = h >= 6 && h <= 40 && s > 40 && l >= 30 && l <= 82;
  if (isPistil) return null;

  // AMBER — golden hue, clearly saturated (vivid orange was rejected above).
  // S ≥ 32 keeps slightly warm milky heads (S up to ~35) out of amber.
  if (h >= 20 && h <= 62 && s >= 32 && s <= 55 && l >= 30 && l < 80) return "amber";
  if (s >= 42) return null;

  // CLEAR — mid lightness (glassy: background shows through).
  // Below L 50 is mostly shadow/background, so it's ignored rather than counted.
  if (l >= 50 && l < 61) return "clear";

  // MILKY / CLOUDY — bright (opaque white = THC peak).
  if (l >= 61) return "milky";

  return null;
};

// Analyze one image into trichome-stage counts. Also tracks how many pixels were
// scanned vs. how many were classifiable trichomes, which gives us a rough
// "coverage" score used to warn about low-magnification or poor-quality photos.
export const analyzeImage = (img) => new Promise((resolve, reject) => {
  try {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) { reject(new Error("Canvas 2D context unavailable")); return; }
    // Downscale to a bounded working width so cost is fixed regardless of upload size.
    const ratio = img.width > 480 ? 480 / img.width : 1;
    canvas.width = Math.max(1, Math.round(img.width * ratio));
    canvas.height = Math.max(1, Math.round(img.height * ratio));
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const counts = { clear: 0, milky: 0, amber: 0, total: 0 };
    let scanned = 0;
    // Step by 16 bytes = every 4th pixel (RGBA = 4 bytes). Enough signal, ~4x faster.
    for (let i = 0; i < data.length; i += 16) {
      scanned++;
      const type = classifyPixel(data[i], data[i + 1], data[i + 2]);
      if (type) { counts[type]++; counts.total++; }
    }
    counts.coverage = scanned ? counts.total / scanned : 0; // 0..1
    resolve(counts);
  } catch (err) {
    reject(err);
  }
});
