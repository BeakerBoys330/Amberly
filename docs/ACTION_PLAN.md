# Amberly: From Your PC to Beta to the App Stores

**The big picture, as an analogy:** you've built the engine. Now you (1) drive it around
your own block, (2) let a few friends drive it, (3) put it in a car body the dealerships
accept, (4) get it inspected, and (5) open the showroom. Each phase below has a clear
"done when" so you always know when to move on.

**Realistic timeline:** 6–10 weeks of part-time work. **Cost:** $25 (Google, one-time) +
$99/year (Apple). Everything else can stay free.

---

## Phase 1 — Run it on your PC (Day 1, ~1 hour)

1. Install Node.js LTS (nodejs.org).
2. Open the folder `C:\Users\smith\Amberly` in a terminal: `npm install`, then `npm run dev`.
3. Open the printed address on your PC, then the `Network:` address on your iPhone (same Wi-Fi).
4. Set up one real grow in the planner and log a few waterings.

**Done when:** you can start a grow, log a watering, add a photo, and run a trichome scan from the grow.

## Phase 2 — Private web beta (Weeks 1–3, free)

The fastest way to real feedback. A web app installs on any phone with no store approval.

1. Make a free GitHub account; create a **private** repo; upload the folder (or use GitHub Desktop).
2. Make a free Vercel account → "Add New Project" → pick the repo → Deploy. You get a link.
   The live alpha is at https://amberly-coral.vercel.app (Vercel, from GitHub `main`).
   Steps: `docs/SETUP.md`.
3. Testers open the link on iPhone → Share → **Add to Home Screen**. It launches like an app.
4. Recruit **15–20 growers** you trust (r/autoflowers and r/microgrowery DMs, local grow shop,
   friends). Aim high: some will drift away, and Google's later step needs 12 who stay.
5. Give them a 5-question Google Form: What confused you? What did you skip? Was the watering
   timing right for your pots? Did the trichome read match your eye? Would you pay $3/month?
6. Ship fixes weekly — every push to GitHub auto-updates their app.

**Done when:** 10+ people have used it for 2+ weeks and you've fixed the top 5 complaints.

## Phase 3 — Store-proofing (Weeks 3–5)

These are the things reviewers check, plus one storage limit that will bite real users.

| Task | Why |
|---|---|
| **Move photos off `localStorage`** to on-device file storage (Capacitor Filesystem/Preferences) | Browser storage caps around 5 MB — roughly 50–100 grow photos. The app already warns when full. |
| **Add watering/feeding reminder notifications** (Capacitor Local Notifications) | Users' #1 loved feature in competitor apps, and it proves to Apple this is a real app, not a wrapped website (Apple's "minimum functionality" rule, 4.2). |
| **21+ confirmation on first launch** + local-law notice (done: `LegalGate.jsx`) | Matches the age rating you will declare. |
| **Privacy policy + terms** pages (done: `public/privacy.html`, `public/terms.html`, hosted on Vercel) | Both stores require a privacy policy URL. Keep the pages true to the app: without an account, data stays on the device. Sharing is opt-in and needs an account. Followers see the username. Training use is a separate switch. |
| **Real app icon** (designer on Fiverr ~$30–80, or refine the placeholder) | First impression in the store. |
| **No buying, selling, or shop links** of any cannabis product | Both stores' red line (details in Phase 6). |

**Done when:** a fresh install works fully offline, reminders fire, and the privacy page is live.

## Phase 4 — Put it in a native "box" with Capacitor (Week 5)

Capacitor wraps your existing web app in a real iOS/Android shell — same code, store-ready.

1. In the project: `npm install @capacitor/core @capacitor/cli @capacitor/android @capacitor/ios`
2. `npx cap init Amberly com.yourname.amberly --web-dir dist`
3. `npm run build` then `npx cap add android` and `npx cap add ios`
4. **Android (works on your PC):** install Android Studio → `npx cap open android` → Run on a phone or emulator.
5. **iOS needs macOS + Xcode.** Options without buying a Mac: a cloud Mac build service
   (Codemagic and Ionic Appflow both have free/low tiers), or borrow a Mac for the build day.

**Done when:** the app runs from an installed build on one Android phone and one iPhone.

## Phase 5 — Developer accounts + store betas (Weeks 5–8)

**Accounts**
- Google Play Console: $25 one-time, ID verification.
- Apple Developer Program: $99/year.
- **Decision to make now — personal or business account?** A *new personal* Google account
  must run a **closed test with at least 12 testers opted in for 14 days in a row** before it can
  publish. A business (organization) account skips that, but needs business verification (and
  Apple requires a D-U-N-S number for organizations). If you'd rather the app not appear under
  your own name, a business account also solves that.

**Betas**
- **iOS — TestFlight:** upload from Xcode/cloud build; invite testers by email or public link.
  Your Phase 2 testers move straight over.
- **Android — Closed testing track:** add testers by Gmail, share the opt-in link. Keep 15+ enrolled;
  if you dip below 12, the 14-day clock restarts. Remind them to *stay* opted in.

**Done when:** TestFlight and Play closed-test builds are in testers' hands, and (Android) 14 days have passed with 12+ testers.

## Phase 6 — Submit for review (Weeks 8–10)

**Know the rules you're being judged on**
- **Apple (guideline 1.4.3):** no encouraging illegal drug use or minors' use; facilitating the
  *sale* of marijuana isn't allowed (only licensed, geo-fenced dispensaries may sell).
- **Google Play:** bans apps that facilitate the sale of marijuana, regardless of legality.
- **You're fine on both** because Amberly is a horticulture tool: timing, watering, climate, journaling.
  Grow-journal apps like Grow with Jane are live on both stores. Keep the store text about
  *plant care*, never about getting high or buying.

**Submission checklist**
1. Store listing: name, subtitle ("Harvest timing & grow planner"), description, 5–8 screenshots
   (Today card, trichome reading, timeline, calendar strip, climate check).
2. Age rating questionnaire: answer drug-reference questions honestly → expect the **highest**
   (adults-only) rating on both stores.
3. Privacy: Apple "App Privacy" labels and Google "Data safety" form. Without an account, all
   data stays on the device. When a user signs in and shares, the app stores this data
   (Supabase): email, username, shared photos and grow data, follows, reactions, reports and
   blocks. Cloudflare Turnstile runs at sign-in. Declare all of this.
4. **Reviewer notes** (this matters most): *"Amberly is a horticultural planning and journaling tool
   for adults growing where home cultivation is legal. It contains no sales, ordering, delivery, or
   links to purchase cannabis. Without an account, all data stays on the device. Sharing is
   optional and needs an email sign-in. Account deletion is in About, then Account."*
5. If rejected: read the exact guideline cited, fix that one thing, reply in Resolution Center — first
   rejections are common and usually quick to resolve.

**Done when:** "Ready for Sale" (Apple) and "Published" (Google).

## Phase 7 — After launch (ongoing)

1. **Backend** (done): Supabase gives accounts, sharing and following. Next: optional cloud
   backup and multi-device sync. Keep backups out of training data.
2. **In-app account deletion** (Apple guideline 5.1.1(v)) is done: About, then Account.
3. Use photos that users share with the training switch on to train the Phase 2 trichome model.
4. Pricing per the research: generous free tier, **no plant caps** (competitors' #1 complaint), a cheap
   middle tier (~$3/month) for cloud backup, extra analytics, and brand feeding presets.

---

## What's already in v0.10 (and where it came from)

| Feature | Source |
|---|---|
| Stage-by-stage targets: light hours, PPFD, DLI, day/night temp, humidity, VPD | Research §2–3, §7 |
| Calendar: sprout → flip/pistils → scans → flush → harvest → dry → cure | Research §1, §6 |
| Watering amount + interval by pot size/medium, **learns from your logs** | Research §4; competitor gap |
| Feed guidance: focus, EC/ppm, pH, half-strength default, auto-specific, Cal-Mag | Research §5 |
| Climate check with leaf VPD + bud-rot / heat / cold warnings | Research §3 |
| Flip-height calculator, watts-per-sq-ft check | Research §1c, §2d |
| "I flipped" / "first pistils" / "I harvested" buttons re-time the plan | Competitor complaint: apps that *assume* the flip |
| Trichome scans linked to a grow **project your harvest date** | Gap no competitor fills |
| One-tap logging, photos with per-photo Share toggle | Competitor UX lessons |
| Contested practices offered as choices (20/4 vs 18/6, flush) | Research caveats |
