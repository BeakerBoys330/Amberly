# Harvest timing, competitors, strains, branding (2026)

## Trichome harvest consensus
- Clear = immature. Cloudy/milky = peak THC. Amber = THC → CBN, more sedative, start of over-ripeness.
- Ed Rosenthal: "80–90% milky with 5–15% amber." Vendor cluster (RQS, GrowerIQ, Spider Farmer): 70–80% cloudy + 20–30% amber. Present a range → Effect Dial.
- Indicas amber faster; many sativas/hazes barely amber (harvest when no clear remains or after ~10–14 days at 80%+ cloudy).
- Common mistakes the app guards against: reading sugar-leaf trichomes (amber early → false "ready"), using pistil color, harvesting by calendar, sampling one bud, too little magnification (30–60× loupe minimum).
- CBN-sedation link is widely repeated but only partly proven; genetics matter more than a few days.

## Competitors
| App | What it is | Notes |
|---|---|---|
| Grow with Jane | Category-leading grow journal | ~650K downloads, ~3.4★. Loved: reminders carrying exact feed recipe, photo privacy. Hated: subscription, free tier capped at 4 plants, too many taps, assumes flip date. |
| GrowBotiq | AI trichome analyzer | iOS app on-device (beta); web version uploads photos, credit packs €0.99/10. No accuracy claim. |
| BudProof AI | Trichome analyzer + logs | Claims "99.9% accuracy" (unsubstantiated); $4.99–19.99 IAP; criticized for full photo-library access. |
| PLNTRK | Free tracker | VPD, QR/NFC tags, timeline replay, social feed. |
| Grow Guide / Grow Buddy | Journals | AI plant doctor, toolbox calculators, green-light mode, strain DB. |
| AC Infinity / VIVOSUN / Pulse | Hardware apps | Sensor/VPD automation, not planning. |
| Hempie | AI companion | $7.99/wk–$199.99/yr. |

**Market gap Amberly fills:** snapshot trichome tools don't plan; journals don't read trichomes well. Amberly combines pistil-aware trichome reading + strain-aware timeline + climate + scans that converge the harvest date.

**Lessons applied:** no plant caps, one-tap logging, reminders with payload, editable/real-event dates, on-device privacy, cheap middle tier (~$2–5/mo) between free and Pro, keep core reads free. Future: green-light mode, copy-forward.

## Strains & breeders
- Trending photos: Runtz, Wedding Cake, Blue Dream, Gelato, London Pound Cake, Tahoe OG, Super Lemon Haze, Bruce Banner.
- Leafly Strain of the Year: Gelato '18, Wedding Cake '19, Runtz '20, Do-Si-Dos '21, Jealousy '22, Permanent Marker '23, Super Boof '24, Hash Burger '25.
- Classics: GG4, Northern Lights, Zkittlez, GSC, OG Kush, Sour Diesel, Amnesia Haze, White Widow, Jack Herer.
- Auto breeders: Fast Buds (most Autoflower World Cup titles; Frostbanger Auto 29.5% THC), Mephisto Genetics, Night Owl, Ethos, Humboldt, Atlas (Mendo Breath Auto 30.33%), Dutch Passion.
- Photo breeders: Royal Queen Seeds, Barney's Farm, Seed Junky, Compound Genetics, In House, Exotic Genetix, Cannarado, Sensi Seeds, North Atlantic Seed Co (also a reseller).
- Legal data: Kaggle (kingburrito666 "Cannabis Strains", gthrosa Leafly metadata, corykjar Leafly dataset), GitHub (gugarosa/leaflyer, Piyush-Bhor/The_Cannabis_API MIT), DoltHub, Washington State lab-test data. Seedfinder API discontinued July 2024; Leafly blocks scraping.

## Branding
- "TrichomeVision" read as clinical. Chosen working name: **Amberly** (warm, "-ly" like Leafly, ties to the amber harvest moment). Alternatives: Ripe, Frosty, ChopReady, Harvestly, Peak, Goldilocks, Loupe.
- Trends: clean sans-serif, warm palette, friendly tone, privacy-forward, avoid leaf clichés.

## App store policy
- Apple 1.4.3: no encouraging illegal drug use; facilitating sale of marijuana not allowed (licensed geo-fenced dispensaries only).
- Google Play: no facilitating marijuana sale regardless of legality.
- Grow journals are allowed on both (Grow with Jane is live). Keep listing about plant care. Expect adults-only rating.
- New personal Google Play accounts: closed test with ≥ 12 testers opted in 14 consecutive days before production. Business accounts exempt (need verification; Apple orgs need D-U-N-S).

## Earlier product decisions (history)
- Data strategy: crowdsourced opt-in photos (iNaturalist model) + optional paid grower partners for ground truth; validation = auto-filter blur/darkness, manual spot checks, time-series consistency (clear → cloudy → amber, never backwards).
- Accounts: anonymous use for everyone; optional minimal account later (no name), 21+ attestation + location. A checkbox alone is weak age verification; card/ID verification only if needed at scale.
- Earlier names/versions: V1–V9 single-file prototypes (TrichomeVision*.jsx); V10 = this Vite project.
