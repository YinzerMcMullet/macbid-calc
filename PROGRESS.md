# Fantasy Football Command Center — Progress

_Last updated: 2026-08-27_

## Status: Research complete — awaiting stack sign-off. No code written yet.

## Done
- [x] Step 1 research deep-dive (platforms, APIs, player values, news sources, free LLMs, free hosting) → see `RESEARCH.md`
- [x] Verified live: Sleeper API, Fleaflicker API (2026 data), FantasyCalc API, DynastyProcess CSVs + ID crosswalk, FFC ADP API, Sleeper projections, Rotowire/PFT/CBS/Yahoo RSS, Boris Chen tiers
- [x] Ruled out: KeepTradeCut scraping (ToS), Twitter/X + Nitter (dead), GitHub Models (retired 7/2026), sportsdata.io free trial (scrambled data), Vercel Hobby for cron (once/day cap)
- [x] Stack proposal drafted (RESEARCH.md §7)

## Blocked on user
- [ ] **Sign-off on proposed stack** (Cloudflare Pages/Workers/D1 + TypeScript + React/Vite PWA + Hono; adapter pattern for platforms/values/news/LLMs)
- [ ] **Yahoo Fantasy API access application** — user must apply (needs their Yahoo account): https://sports.yahoo.com/developer/access/ — manual approval, unknown lead time, so apply ASAP
- [ ] User's league IDs / Sleeper username to test import against

## Next (after sign-off) — Phase 1
- [ ] Scaffold project (Workers + Pages + D1 schema, adapter interfaces)
- [ ] Sleeper league import (no auth) + normalized internal league model
- [ ] Multi-league dashboard (leagues, teams, lineups, matchups, waivers, byes)
- [ ] Yahoo OAuth + import (once API access approved)
- [ ] Keeper-aware available-players board (Yahoo keeper league)
- [ ] Draft cheat sheets (league-scoring-tuned tiers via Sleeper projections raw stats + Boris Chen tier breaks + FFC ADP)
- [ ] Trade calculator (FantasyCalc daily refresh; redraft + dynasty; roster-hole weighting; suggestions only on request)
- [ ] News engine (cron: Rotowire RSS + PFT/CBS/Yahoo RSS + Bluesky + Sleeper trending; keyword-match vs all rosters)

## Phase 2 (later)
- [ ] Fleaflicker + ESPN import
- [ ] LLM triage/reasoning layer (Gemini free primary, Groq/Mistral fallback — config-driven models)
- [ ] Lineup optimizer, start/sit, waiver targets, injury/bye alerts

## Key decisions log
- 2026-08-27: KTC rejected (ToS forbids scraping) → FantasyCalc is the value backbone; DynastyProcess `db_playerids.csv` is the canonical player-ID crosswalk.
- 2026-08-27: Bluesky replaces Twitter/X as the fast news layer (Jetstream firehose is free + officially supported).
- 2026-08-27: Cloudflare free tier chosen over Vercel/Netlify because it's the only one with minute-level cron at $0.
