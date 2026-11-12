# Amberly — project context for Claude Code

Amberly (working name; formerly "TrichomeVision") is a mobile-first web app for home cannabis growers:
1. **Harvest timing** — analyzes phone/loupe photos of trichomes (clear → cloudy → amber) and recommends when to harvest.
2. **Grow planner** — calendar, watering schedule, feeding guidance, stage-by-stage climate/light targets, one-tap logging, photo journal.

Owner: Patrick (solo founder, IT background, not a full-time developer). Explain changes plainly, with analogies when concepts are new.

## Priorities (in order — apply to every change)
1. **Ease of use.** Fewest taps. One-tap logging. Big friendly choices over forms. Apple-style simplicity, especially on first screens.
2. **Concise code.** No dead code, no unused state/imports, no speculative abstractions.
3. **Strain + photo data collection** (opt-in) to train a future trichome ML model.

## Run
```
npm install
npm run dev      # vite --host; open the Network URL on a phone (same Wi-Fi)
npm run build    # outputs dist/
```
Stack: React 18 + Vite 7, lucide-react icons, vite-plugin-pwa (offline service worker), optional Supabase backend for opt-in sharing (`src/cloud.js`). No TypeScript, no CSS framework (styles are template-literal CSS inside components).

## Files
| File | Role |
|---|---|
| `src/Amberly.jsx` | Main app: welcome → strain select → Effect Dial + capture → analysis → diary. Also diary screen, share sheet hookup, About modal (account, delete data). Holds the design-system CSS (`STYLES`, `tv-*` classes). |
| `src/GrowPlanner.jsx` | Planner UI: grow list, setup form, Today card, quick-log, 21-day strip, targets, timeline, photos, history. Reuses `tv-*` classes; extra `gp-*` CSS in `GP_STYLES`. |
| `src/Icon.jsx` | The app's icon set (lucide line icons picked by name). `planner.js` names the icon for each stage and milestone. |
| `src/InstallTip.jsx` | "Keep Amberly on your Home Screen" card on the welcome screen. iPhone: Share → Add to Home Screen steps. Android Chrome: one Install button. Hidden on desktop, once installed, or once closed. |
| `src/planner.js` | Pure logic + research data, no React: `STAGES` table, `plan()`, `waterPlan()`, `feedPlan()`, `envCheck()` (VPD), `lightCheck()`, `flipHeight()`, `scanForecast()`, date helpers, `store`. |
| `src/strain-database.json` | Starter strain list (27, curated), bundled into the app (works offline). Facts only — no third-party image links. |
| `src/trichomes.js` | Pixel color rules (`classifyPixel`, `analyzeImage`). Tuned with `tools/calibrate.html`. |
| `src/LegalGate.jsx` | First-launch 21+ / local-law / Terms+Privacy agreement. Bump `LEGAL_VERSION` when the legal pages change. |
| `public/terms.html`, `public/privacy.html` | Legal pages (operator BeakerBoys, Ohio law, beakerboys330@gmail.com). Keep in sync with what the app actually does. |
| `src/cloud.js` | Opt-in sharing + accounts (Supabase): sign-in, `shareItem`, `syncGrow`, `unshare`, `deleteAccount`, EXIF-stripping `cleanJpeg`. |
| `src/ShareSheet.jsx` | Sign-in (email code) + share-consent sheet; `useCloudUser()` hook. |
| `supabase/schema.sql` | Table, photo bucket, Row Level Security, account-deletion function. Run once in Supabase. |
| `src/Social.jsx` | Following: feed (followed people only, newest first), profiles, username search, invite links (`?u=`), followers/requests/blocks, emoji reactions, report/block. |
| `supabase/rules-check.mjs` | 45 end-to-end checks of the database rules (including blocked attacks) against a local Supabase (Docker). Re-run after any schema change. |
| `docs/SETUP.md` | GitHub → Supabase → Vercel steps, training-data rule, daily report review. |
| `vercel.json` | Security headers (CSP etc.) for hosting; `npm run preview` applies the same headers locally. |
| `tests/` | `npm test` (Node's built-in runner, no extra packages). |
| `docs/ACTION_PLAN.md` | Beta → App Store launch plan. |
| `docs/` | Research summaries this code is based on. Read before changing numbers. |

## Architecture rules (don't break these)
- **`store` in `planner.js` is the ONLY code that touches localStorage** (Supabase's sign-in session goes through it too). **`cloud.js` is the ONLY code that talks to a server**, and it loads the Supabase library on demand (`client()`), so signed-out growers never download it. `Social.jsx` is lazy-loaded too.
- **Local-first, account optional.** Everything works with no account and no network. Sign-in (email + 6-digit code, no password) is only for sharing now, and later for backup/multi-device sync. Without `VITE_SUPABASE_*` env vars, all cloud UI is hidden.
- **Sharing & following:** every shared reading/grow has two separate switches — `visible_to_followers` and `for_training` (training data = `for_training` rows ONLY). Profiles default to approve-each-follower; users can go public. The feed shows ONLY people you follow (approved), newest first: no ranking, no suggestions, public profiles never pushed into feeds. Followers react with 4 fixed emoji; no comments/DMs. Report + block everywhere (Apple 1.2). RLS in `supabase/schema.sql` enforces all of it (helper functions live in the unexposed `private` schema; post photo paths must be in the poster's own folder; daily flood limits on posts, photos, follows, reports); `rules-check.mjs` proves it, including the attacks found in the Oct 2026 review. Photos re-encoded via canvas before upload (strips EXIF/GPS); grow nicknames never upload; stop sharing / deleting an item / deleting the account removes the server copy. Setup: `docs/SETUP.md`.
- **Records are "social-ready":** every grow, log, and diary entry has `id`, ISO timestamp, `author: null`, `shared: false`. Keep this shape — it's what a future community feed syncs.
- Keys: `amberly.diary.v1` (scans, max 200, newest first), `amberly.grows.v1` (grows with embedded `logs[]`), `amberly.consent.v1` (legal acceptance + version), `amberly.auth.v1` (Supabase session, only if signed in), `amberly.install.v1` (true once the Home Screen card is closed). `amberly.prefs.v1` is a retired "always share" setting, only deleted now. Bump the `v` suffix and migrate if a shape changes.
- Diary entries carry `growId` when a scan is launched from a grow → `scanForecast()` projects harvest date from amber trend.
- **Dates:** grows store `YYYY-MM-DD` strings; always use `parseDay`/`addDays`/`daysBetween` (local-time, DST-safe via `setDate`). Never add `n * 86400000` — that shifted dates a day across the Nov DST change (real bug, fixed).
- **Photos:** `decodeFile()` in Amberly: 10 MB cap, non-image rejection, friendly HEIC message where the browser can't decode it (Safari decodes HEIC natively; iOS hands `accept="image/*"` inputs a JPEG). No converter library. Reuse it for any new photo input. Diary thumbs 160px, grow photos 480px JPEG data URLs.
- Blob URLs are tracked in `objectUrlsRef` and revoked on reset/unmount.
- Derived data uses `useMemo` (e.g. `filtered`), never state + effect.
- No `alert()`; use inline UI/toasts. `window.confirm` only for destructive deletes.
- **Navigation:** change screens in Amberly.jsx with `go(step)` / `leave(n)`, never `setStep` directly. Each screen is a browser-history entry, so Android Back and the iPhone edge swipe step back instead of closing the app.
- **Logs:** adding or deleting a grow log shows a toast with Undo. `save()` in GrowPlanner returns false when storage is full; don't show a success message in that case.

## Trichome analysis (rule-based, on-device)
- Pixels → HSL. **Pistil exclusion is the headline correctness rule:** orange/brown hairs are NOT amber trichomes. Pistils `H 6–40, S > 40, L 30–82` → ignored. Amber: `H 20–62, S 32–55, L 30–80`. Pixels with `S ≥ 42` that aren't amber are ignored.
- Also ignores green plant matter (`H 70–160, S > 18`) and blown-out/black pixels.
- Clear (see-through, so it reads darker than milky): `50 ≤ L < 61`. Cloudy/milky: `L ≥ 61`. Thresholds were tuned against ~3,500 labeled heads with `tools/calibrate.html` (Roboflow CC BY 4.0 sets; download them into `tools/dataset/`); re-run it after changing them. Color alone separates clear from milky only weakly — a trained model is the real fix.
- Images downscaled to 480px wide; every 4th pixel sampled. Multiple photos are averaged (`combineSamples`); low coverage (< 4% classifiable) shows a "reading may be off" warning.
- **Effect Dial** (`EFFECT_PROFILES` in Amberly.jsx, `AMBER_TARGET` in planner.js — keep in sync):
  - Energetic: 1–10% amber (ideal 5)
  - Balanced: 10–22% (ideal 15) — default
  - Relaxed: 25–55% (ideal 35)
  - Not ready if cloudy < 50% or clear > 40%.
- Honest framing required: "a guide, not a lab test." Amber = CBN (not CBD). **Never claim an accuracy %** (competitor claims "99.9%", unsubstantiated).
- Phase 2 plan: MobileNet v3 transfer learning → TFLite, on-device; keep rules as fallback. Needs ~1,000+ labeled opt-in photos.

## Grow planner logic (see `docs/research-grow-planner.md`)
- Stages: germination → seedling (d5) → early veg (d14) → late veg → stretch (flower start) → mid flower (+30%) → late flower (+65%) → drying (harvest) → curing (+10d) → done (+38d).
- Autos: total days from breeder or fast 63 / standard 77 / long 91; flower starts at 32% of total. Photos: flip = 14 + vegWeeks×7; flower length indica 56 / hybrid 63 / sativa 77.
- **Real events override estimates:** "I flipped / first pistils", "I harvested" buttons re-time everything (competitor complaint: apps that assume the flip).
- Watering: base interval by medium/pot, ×0.75 in stretch/mid flower, then blended 50/50 with the median of the user's last 5 logged gaps. Volume ≈ 30% of pot (12% for seedlings, ring-watered). Soil feeds every other watering; coco every watering.
- Feeding: brand-neutral phases with EC/ppm (×500) and pH; default ½ chart strength, autos ¼–½; Cal-Mag reminder for coco or RO water.
- VPD: Tetens, LED leaf offset −1.5 °C. Warn: > 85 °F, < 60 °F, flower RH > stage max + 5 (bad if > 60%), VPD outside stage band ± 0.1, danger < 0.4 or > 1.6 kPa.
- Flip height = (tent − 12" hanger − 18" light gap − pot height) ÷ stretch (indica 1.5, hybrid 2, sativa 2.5).
- Light check: watts ÷ sq ft (< 20 under-lit, 20–30 adequate, 30–50 strong, > 50 dim it).
- Contested practices are user **choices**, not rules: auto 18/6 vs 20/4, flush none/7/14, day-21 defoliation.

## Design system
Warm, welcoming, familiar-but-distinct, Apple-like. Owner rejected an earlier dark/monochrome "lab" look.
- Background `#faf6f0`, cards `#fffdfa`, borders `#efe7dc`, text `#2b2622`, muted `#766b60`, single accent amber `#d99a3c` (hover `#cf8f30`, text `#8f6128`). Amber buttons use dark ink text (`#2b2622`), not white: white on amber fails contrast.
- Inter font, self-hosted via `@fontsource/inter` (no Google Fonts); 14–22px radii; soft shadows; generous whitespace.
- Icons are drawn line icons from `src/Icon.jsx` (`<Icon name>`; `<Tile name>` puts one on a soft amber tile). No emoji in the interface, they look different on every phone. The only emoji are the four follower reactions.
- Screens open with a big plain-language question ("What are you growing?").
- Progress dots for multi-step flows. Mobile-first, must fit 320px wide with no horizontal scroll.
- Tap targets ≥ 44px. Choices are one tap (no separate Continue button). Plain sentences in user-facing copy: no em dashes.
- **Wording follows ASD-STE100 (Simplified Technical English):** short sentences (instructions ≤ 20 words, descriptions ≤ 25), one instruction per sentence, active voice, simple tenses, no contractions, no idioms or slang, and one word for one thing (photo, device, tap, delete, reading, grow). Applies to the app, the legal pages, and `docs/SETUP.md`. Legal clauses that carry risk (disclaimers, liability, licence, indemnity) keep their original wording.
- Contrast: keep secondary text ≥ 4.5:1.

## Privacy & policy decisions
- Everything on-device. Analysis always works without sharing.
- Sharing is opt-in per reading or per grow, never automatic, and needs an account (email code, no password). A shared grow keeps sending new entries until both switches are off. Consent text: `ShareSheet.jsx`, Terms §7 (follower display + separate training license) and §8 (community rules, 24-hour report review).
- Accounts are optional and minimal (email + 6-digit code, no password, no name); 21+ is attested at first launch and stored with sign-up. In-app account deletion exists (About → Account; Apple 5.1.1(v)).
- **No client-side admin passwords** (removed — fake security). Admin actions belong behind real backend auth.
- **Never** add buying, selling, ordering, delivery, or shop links for cannabis — banned by Apple 1.4.3 and Google Play regardless of legality. Store copy stays about plant care.
- Local-law notice shown on setup. Expect adults-only store rating.
- Data sourcing: do **not** scrape Leafly, Seedfinder, or GrowDiaries (ToS). Strain facts may be re-entered from breeder sites (facts aren't copyrightable; descriptions and photos are). Do not use the `linhacanabica/images-strains-weed` images (partly Leafly's, conflicting license) or the Cannabis Intelligence Database (paid license for apps).

## Known limitations / next tasks
1. localStorage caps ~5 MB (~50–100 grow photos). App toasts when full. Next: Capacitor Filesystem.
2. Reminder notifications (Capacitor Local Notifications) — top competitor-loved feature.
3. Wrap with Capacitor for iOS/Android (see `docs/ACTION_PLAN.md`).
4. Backend: sharing + following are built (Supabase). Next: optional cloud backup + multi-device sync for signed-in users (keep it separate from training data: backups must NOT be used for training unless shared). `connect-src`/`img-src` in `vercel.json` are pinned to the one Supabase project (change them if the project ever moves). Sign-in has a Cloudflare Turnstile bot check (`botCheck` in cloud.js, on when `VITE_TURNSTILE_SITE_KEY` is set; Supabase verifies the token); its script loads only when the sign-in sheet opens.
5. Strain DB: grow beyond 27 by re-entering facts (name, auto/photo, breeder, flower weeks) from breeder sites; no copied descriptions or images. Or let user-added strains build the list. The "Popular" badge (`trending: true`) is hand-picked on 5 strains for now; later, set it from what growers actually pick and share.
6. Ideas from research not yet built: green-light mode, copy-forward of yesterday's log, outdoor flowering date from latitude, brand feeding presets (GH Flora, FoxFarm at ½ strength), runoff EC/pH alerts, deficiency diagnosis library.

## Verification
- `npm test` must pass. It covers these planner sanity checks: auto standard harvest = day 77; photo hybrid 4-wk veg harvest = day 105; 75 °F / 55% RH → VPD ≈ 1.0 kPa; 480 W in 4×4 = 30 W/sq ft; 72" tent, 5 gal, hybrid → flip at 15".
- Run `npm test` and `npm run build` before declaring done; test on an iPhone in Safari.
- **Security:** no third-party scripts, fonts, or images — everything loads from our own host so the CSP in `vercel.json` can stay strict (`script-src 'self'`). The one exception is Cloudflare Turnstile (`challenges.cloudflare.com` in `script-src`/`frame-src`), loaded only on the sign-in sheet. A backend later means adding its origin to `connect-src`.
