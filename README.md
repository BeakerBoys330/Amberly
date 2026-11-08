# Amberly

Harvest timing and grow planner for home growers, by BeakerBoys.

- **Harvest timing:** reads trichome color (clear → cloudy → amber) from close-up photos, on the phone. A guide, not a lab test.
- **Grow planner:** calendar, watering and feeding guidance, stage-by-stage climate targets, one-tap logging, photo journal.
- **Optional sharing:** with an account (email code, no password), share a reading or grow with approved followers and/or to help train Amberly. Everything works without an account.

Built with React + Vite as an installable web app (works offline). Accounts and sharing use Supabase.

## Run it on your PC

Needs Node.js 20.19 or newer.

```
npm install
npm run dev      # open the "Network" address on a phone on the same Wi-Fi
npm test         # quick checks of the grow math and color rules
npm run build    # production build in dist/
```

Sharing and Following stay hidden until Supabase is set up: copy `.env.example` to `.env.local` and fill it in.

## Docs

| | |
|---|---|
| `docs/SETUP.md` | GitHub → Supabase → Vercel, step by step; daily report review; training-data rule |
| `docs/ACTION_PLAN.md` | Beta → App Store / Google Play plan |
| `docs/research-*.md` | The research the grow numbers and harvest rules are based on |
| `CLAUDE.md` | How the code is organized and the rules it must keep |
| `supabase/schema.sql` | Database tables and who-can-see-what rules (run once in Supabase) |
