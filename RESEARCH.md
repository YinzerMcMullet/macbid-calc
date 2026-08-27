# Fantasy Football Command Center — Research Findings

**Research date: August 27, 2026.** Every claim below was verified by live fetch or against 2024–2026 sources where possible. Items that could not be verified are explicitly flagged with ⚠️. Sources are linked inline.

---

## TL;DR

- **Sleeper** is the easiest, safest integration: official public API, no auth, JSON, ~1000 calls/min documented limit. Build first.
- **Yahoo** works but has a new gate: since ~2025, creating an OAuth app is not enough — you must **apply for Fantasy API access and get manually approved** by Yahoo. **Action item: apply now** at https://sports.yahoo.com/developer/access/ so approval lands before we need it.
- **Fleaflicker's public API is alive** (verified with live 2026 season data). No auth documented, ~13 read endpoints, JSON. Easy Phase 2 add.
- **ESPN** remains unofficial/reverse-engineered (cookie auth for private leagues) and demonstrably brittle — isolate behind an adapter, expect breakage.
- **Trade values**: FantasyCalc's free API is verified live, covers redraft + dynasty + superflex, and embeds Sleeper/ESPN/MFL/Fleaflicker IDs natively. KeepTradeCut has no API and its ToS explicitly forbids scraping — skip it.
- **News**: Rotowire's player-news RSS (verified live, player-name-first titles) + Bluesky (free official API/firehose, where NFL beat writers now live) + ESPN's unofficial news JSON form a genuinely fast $0 pipeline. X/Twitter and Nitter are dead ends.
- **Free LLMs**: Google Gemini free tier is the anchor (best requests/day × context window combo, no credit card); Groq and Mistral Experiment as fallbacks. GitHub Models was **retired July 30, 2026** — ignore any guide recommending it.
- **Hosting**: Cloudflare's free tier is the only one that supports minute-level cron (news polling) at $0. Vercel Hobby caps cron at once per day — disqualifying for the news engine.

---

## 1. Platform comparison

### Product strengths / weaknesses

| | **Sleeper** | **Yahoo** | **ESPN** | **Fleaflicker** |
|---|---|---|---|---|
| UI / mobile | Best-in-class, social-first (chat, DMs, polls, reactions) | Solid but aging | Clean; redesigned 2025 | Dated but very fast |
| Scoring customization | Fully custom incl. full IDP | Moderate | Limited (full-PPR default) | Very deep (dynasty/IDP niche) |
| Keeper / dynasty | Excellent — taxi squads, offseason waivers, traded picks | Solid keeper, weak dynasty | Minimal, "tacked on" | Excellent (dynasty heritage) |
| Draft experience | Best — slow drafts, 10s–24h timers | Live only | Live only, no slow drafts | Slow/email drafts supported |
| Analytics / news speed | Fast in-app news; weak projections (common complaint) | Deep news integration; best tools behind ~$49/yr Plus | Best free analytics (IBM watsonx trade/waiver grades) | Basic |
| User base | Large, growing, competitive | Largest, casual/office | Very large, casual | Small, niche |

Sources: [FantasyButler 2026 comparison](https://fantasybutler.com/blog/sleeper-vs-espn-vs-yahoo-fantasy-football), [Throne Fantasy platform guide](https://thronefantasyfootball.com/2025/07/26/ultimate-guide-to-fantasy-football-platforms/), [LordSkunk Sleeper vs Yahoo](https://lordskunk.com/guides/sleeper-vs-yahoo-fantasy-football/).

Design takeaway: Sleeper's UI is the target (per spec). Features worth stealing from others: ESPN's AI trade/waiver grades (we rebuild these free with FantasyCalc + LLM), Yahoo's news integration (our news engine), Fleaflicker's league-history depth.

### API status

| | **Sleeper** | **Yahoo** | **ESPN** | **Fleaflicker** |
|---|---|---|---|---|
| API type | **Official, public, read-only** ✅ | Official, OAuth 2.0, **approval-gated since ~2025** ⚠️ | **Unofficial** (reverse-engineered) | Official-ish public docs ✅ verified live 2026 |
| Auth | None | OAuth 2.0 + manual application approval | `espn_s2` + `SWID` cookies for private leagues | None documented |
| Format | JSON | XML native; `?format=json` (awkward machine-translated JSON) | JSON | JSON or protobuf |
| Rate limits | "Stay under 1000 calls/min" (documented) | Undocumented ("throttling for excessive use") | Undocumented | Undocumented |
| Stability risk | Low | Medium (approval, ToS) | **High** — host moved to `lm-api-reads.fantasy.espn.com`; Aug 2025 lockdown of `leagueHistory` behind cookies | Medium (API stable; platform is a tiny shop) |
| Best JS/TS client | Thin wrappers exist; DIY is fine | [whatadewitt/yahoo-fantasy](https://github.com/whatadewitt/yahoo-fantasy-sports-api) | [mkreiser/ESPN-Fantasy-Football-API](https://github.com/mkreiser/ESPN-Fantasy-Football-API) (semi-maintained) | **None — DIY** |
| Best Python client | sleeper-api-wrapper | [uberfastman/yfpy](https://github.com/uberfastman/yfpy) | [cwendt94/espn-api](https://github.com/cwendt94/espn-api) (active, the de facto standard) | [joeyagreco/fleaflicker](https://github.com/joeyagreco/fleaflicker) |

**Sleeper** ([docs.sleeper.com](https://docs.sleeper.com/), verified live): `GET https://api.sleeper.app/v1/...` — `/user/<name>`, `/user/<id>/leagues/nfl/<season>`, `/league/<id>` (+ `/rosters`, `/users`, `/matchups/<week>`, `/transactions/<round>`, `/traded_picks`, brackets, drafts), `/players/nfl` (full dump, ~5MB — docs say cache and call **at most once/day**), `/players/nfl/trending/add|drop`, `/state/nfl`. Free for non-commercial use.

**Yahoo** ([sports.yahoo.com/developer](https://sports.yahoo.com/developer) — the old developer.yahoo.com/fantasysports now redirects here): REST at `https://fantasysports.yahooapis.com/fantasy/v2/` with resources for games/leagues/teams/rosters/players/transactions/settings keyed like `nfl.l.{league_id}`. Read-only access only (write not granted). Access tokens ~1h (⚠️ inferred from OAuth guide + library behavior, not stated on portal); refresh tokens long-lived and auto-renewable. ⚠️ No numeric rate limit is published — the oft-cited 20k/day is folklore. Attribution required per [ToU](https://legal.yahoo.com/us/en/yahoo/terms/product-atos/fantasysportsapi/index.html).

**ESPN** (community docs: [nntrn's endpoint gist](https://gist.github.com/nntrn/ee26cb2a0716de0947a0a4e9a157bc1c), [ffscrapr guide](https://ffscrapr.ffverse.com/articles/espn_getendpoint.html), [Steven Morse's v3 writeup](https://stmorse.github.io/journal/espn-fantasy-v3.html)): `https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/{year}/segments/0/leagues/{id}?view=mTeam|mRoster|mMatchup|mSettings|kona_player_info`. Private leagues need `espn_s2`+`SWID` cookies copied from a logged-in browser (anecdotally last ~1 year, ⚠️ unverified). Watch [cwendt94/espn-api](https://github.com/cwendt94/espn-api) issues as the early-warning system for breakage.

**Fleaflicker** ([api-docs](https://www.fleaflicker.com/api-docs/index.html), fetched live; sample call `FetchLeagueStandings?sport=NFL&league_id=12345` returned real 2026 standings): ~13 RPC-style GETs at `https://www.fleaflicker.com/api/` — FetchUserLeagues, FetchLeagueRosters, FetchLeagueRules, FetchLeagueScoreboard, FetchLeagueStandings, FetchLeagueTransactions, FetchLeagueBoxscore, FetchLeagueDraftBoard, FetchPlayerListing, FetchRoster, FetchTeamPicks, FetchTrades, FetchLeagueActivity. Note: raw curl from a datacenter IP got a 403 (bot filtering) — set a normal User-Agent. ⚠️ Private-league auth story undocumented.

---

## 2. Player values & projections (trade calculator + cheat sheets)

| Source | Free API? | Auth | Redraft | Dynasty | Superflex | Cross-platform IDs | Risk |
|---|---|---|---|---|---|---|---|
| **FantasyCalc** ✅ verified | Yes (undocumented but open) | None | Yes | Yes | Yes (`numQbs=2`) | **sleeperId, espnId, mflId, fleaflickerId in every record** | Low-ish; no SLA |
| **KeepTradeCut** | **No — ToS forbids scraping** | — | Yes | Yes | Yes | via crosswalk only | **High — skip** |
| **DynastyProcess (GitHub CSVs)** ✅ verified | Yes | None | Partial | Yes (players + picks, 1QB/2QB) | Yes | **`db_playerids.csv` = the crosswalk (~20 ID systems incl. yahoo_id)** | Low (GPL-3.0) |
| **FFC ADP API** ✅ verified | Yes (officially documented) | None | Yes (ppr/half/std/2QB) | ADP variant | 2QB variant | Own IDs — name-match | Low; attribution requested |
| **Sleeper projections** ✅ verified | Yes (undocumented) | None | Season + weekly, **raw stat categories → re-scoreable to any league settings** | ADP fields | 2QB ADP | Native Sleeper IDs | Medium (undocumented) |
| **Boris Chen tiers** ✅ verified | Free S3 text files | None | Yes (std/half/PPR, weekly) | No | No | Names only | Medium (hobby infra) |
| **FantasyPros API** | Free tier = non-production only | API key | Yes | Yes | Yes | fantasypros_id | Gated — not viable as backbone |
| **Sleeper trending** ✅ verified | Yes (documented) | None | Momentum signal only | — | — | Native | Low |

**FantasyCalc** — the backbone. `https://api.fantasycalc.com/values/current?isDynasty=false&numQbs=1&numTeams=12&ppr=1` (verified live; superflex verified via `numQbs=2`). Each record: `player {id, name, sleeperId, espnId, mflId, fleaflickerId, position, maybeTeam, maybeAge, ...}`, `value`, `overallRank`, `positionRank`, `trend30Day`, `redraftValue`, `combinedValue`, trade-frequency fields. Values derived from ~1M real trades, refreshed continuously. ⚠️ No published API terms or rate limits (terms page is a JS SPA that returned nothing) — cache daily, 1–2 calls/day per format; consider emailing the author for a courtesy blessing.

**KeepTradeCut** — no API. robots.txt is wide open but the [Terms](https://keeptradecut.com/terms-and-conditions) expressly prohibit "any form of automated data collection" and republishing rankings. Community scrapers exist ([Dynasty Daddy](https://github.com/G-Sher/dynasty-daddy) scrapes it daily) but building on a ToS violation is fragile and legally dicey. **Decision: use FantasyCalc; skip KTC.**

**DynastyProcess** ([repo](https://github.com/dynastyprocess/data)) — free raw CSVs, updated weekly by GitHub Actions (verified fresh, scrape_date 2026-08-21): [values-players.csv](https://raw.githubusercontent.com/dynastyprocess/data/master/files/values-players.csv) (dynasty values + ECR, 1QB/2QB), values-picks.csv (dynasty pick values), and critically [db_playerids.csv](https://raw.githubusercontent.com/dynastyprocess/data/master/files/db_playerids.csv) — the ID crosswalk with `sleeper_id, espn_id, yahoo_id, fleaflicker_id, mfl_id, ktc_id, fantasypros_id, ...`. **This bridges FantasyCalc → Yahoo IDs.**

**Fantasy Football Calculator ADP** ([official docs](https://help.fantasyfootballcalculator.com/article/42-adp-rest-api), verified live): `https://fantasyfootballcalculator.com/api/v1/adp/ppr?teams=12&year=2026` — real mock-draft ADP with high/low/stdev/times_drafted, updated daily. Explicitly free for personal and commercial use, attribution link requested. Great market cross-check + draft-day "value vs ADP" signal.

**Sleeper projections** (⚠️ undocumented but verified live, community-standard for years): `https://api.sleeper.com/projections/nfl/2026?season_type=regular&position[]=QB...&order_by=ppr` — note host `api.sleeper.com`, not `.app`. Returns `pts_ppr/pts_half_ppr/pts_std` **plus raw stat categories** (pass_yd, rush_td, rec, ...), meaning we can re-score projections to each league's exact scoring settings — this is what makes league-tuned cheat sheets and the keeper-aware player board possible. Weekly variant: `.../2026/{week}` (⚠️ weekly path unverified this session; widely used). Provided by Rotowire (`company: "rotowire"`).

**Boris Chen tiers** ([borischen.co](https://www.borischen.co/), verified): Gaussian-mixture tier breaks from FantasyPros ECR, raw text at e.g. `https://s3-us-west-1.amazonaws.com/fftiers/out/text_QB.txt`. Names only; hobby-run; use for tier boundaries on cheat sheets.

Also noted: [ffopportunity](https://github.com/ffverse/ffopportunity) publishes automated Expected Fantasy Points CSVs (CC-BY-SA) — a nice in-season buy-low/sell-high signal for the trade calculator later.

---

## 3. News pipeline ($0, ranked by speed-to-news)

⚠️ Environment caveat: some endpoints 403'd from the research sandbox's datacenter IP (Akamai/CDN bot blocks), flagged below — they are very likely fine from other egress; must re-verify from the actual deployment IP.

1. **Bluesky** — the X replacement, and the fastest free path. NFL beat writers migrated en masse ([beat-writers starter pack](https://blueskystarterpack.com/starter-packs/@bernzone.bsky.social/nfl-beat-writers-and-reporters-3lasn45dohl2n), [@32beatwriters.com](https://bsky.app/profile/32beatwriters.com) follows all 32 teams' beats — its follow list is a ready-made source list).
   - **Jetstream firehose**: free, no auth, officially maintained ([docs](https://docs.bsky.app/blog/jetstream)) — `wss://jetstream.us-east.bsky.network/...&wantedDids=...` filtered to a curated DID list → seconds-level push.
   - **HTTP polling fallback**: `app.bsky.feed.getAuthorFeed` / `searchPosts` on `api.bsky.app` (⚠️ not `public.api.bsky.app`, which 403s search since mid-2026). IP limit ~3,000 req/5min; free app-password auth lifts limits. ⚠️ Couldn't verify live from sandbox egress.
   - ⚠️ Unverified whether tier-1 insiders (Schefter/Rapoport) post natively; assume scoops land via beat writers/aggregators with small lag.
2. **Rotowire player-news RSS** ✅ verified live: `https://www.rotowire.com/rss/news.php?sport=NFL` — player-name-first titles ("Chris Olave: Back at practice Wednesday"), timestamped to the minute, minutes behind source. **Ideal for roster keyword matching.** Poll 60–120s with ETag/If-Modified-Since.
3. **ESPN unofficial JSON news** (⚠️ blocked from sandbox datacenter IP; third-party-verified live July 2026): `site.api.espn.com/apis/site/v2/sports/football/nfl/news?limit=50`, fantasy player news `site.api.espn.com/apis/fantasy/v2/games/ffl/news/players?limit=50`, firehose `now.core.api.espn.com/v1/sports/news?limit=1000&sport=football`. Also structured team injuries: `sports.core.api.espn.com/v2/.../teams/{id}/injuries` ($ref-style, needs dereferencing). ToS-gray; personal use, low volume.
4. **ProFootballTalk RSS** ✅ verified live at redirect target `https://www.nbcsports.com/profootballtalk.rss` — fast aggregation of insider reports. **CBS** `https://www.cbssports.com/rss/headlines/nfl/` ✅ and **Yahoo** `https://sports.yahoo.com/nfl/rss.xml` ✅ (currently heavy SB Nation team-blog syndication = free team-beat aggregator) at 2–5 min.
5. **Reddit** (`/r/fantasyfootball` + `/r/nfl` new): mods post breaking news within minutes. Unauthenticated JSON is blocked from cloud IPs; free OAuth tier is 100 QPM but new-app registration now needs **manual approval** (late-2025 "Responsible Builder Policy"). Nice-to-have if approved; not the backbone.
6. **Sleeper trending add/drop** ✅ — not news text (API exposes `[{player_id, count}]` only; Sleeper's in-app blurbs are NOT in the public API), but a "something happened" tripwire, every 15–60 min.
7. **Google News RSS** ✅ verified: `https://news.google.com/rss/search?q=...` per-query feeds — 10min+ latency catch-all safety net for star players.

**Dead ends (verified):** Nitter is dead (X cease-and-desist Aug 24 2026, repo archived); RSSHub X routes need your own X cookies and violate ToS; Rotoworld/NBC Edge removed its RSS; sportsdata.io free trial serves **scrambled data**; FantasyPros news API requires a paid-tier key in practice. Twitter/X: don't build on it at all.

**Injury reports:** nflverse injuries data is **dead for 2025+** ("data source died after the 2024 season" — [nflreadr schedule](https://nflreadr.nflverse.com/articles/nflverse_data_schedule.html)); use ESPN's team injuries endpoint + beat-writer/Rotowire flow instead. nflverse rosters/depth charts still update daily and remain useful.

---

## 4. Free LLM options (Phase 2 reasoning layer)

| Provider | Free limits (verified where possible) | Card? | OpenAI-compatible? | Data/privacy on free tier |
|---|---|---|---|---|
| **Google Gemini** | Flash-Lite ~15 RPM / ~1,000 RPD; Flash ~10 RPM / 250–1,500 RPD; ~250K TPM; 1M context (⚠️ Google no longer publishes a fixed table — numbers third-party-corroborated; confirm in AI Studio dashboard) | **No** | Yes (`/v1beta/openai/`) | **Trains on free-tier data; human review possible** ([terms](https://ai.google.dev/gemini-api/terms)) |
| **Groq** | ~30 RPM / ~1K RPD; tight TPM (~6–15K) is the real constraint ([docs](https://console.groq.com/docs/rate-limits)) | No | Yes | States no training on API data (⚠️ not verified against Groq's own terms) |
| **Mistral Experiment** | ~1 RPS, ~1B tokens/month class | No card; phone verification | Yes | **Trains by default — must opt out in console** |
| **OpenRouter `:free`** | 20 RPM; **50 RPD** (1,000 RPD after one-time $10 credit purchase) ([docs](https://openrouter.ai/docs/api-reference/limits)) | No | Yes | Provider-dependent; assume logged/trainable |
| **Cerebras** | 5 RPM / 30K TPM / **1M tokens/day** | No | Yes | — |
| **Cloudflare Workers AI** | 10K neurons/day ≈ 15–25 calls/day on 8B-class | No | Partial | — |
| ~~GitHub Models~~ | **RETIRED July 30, 2026** — do not plan around it | — | — | — |
| Cohere trial | 1,000 calls/month — too small, skip | — | — | — |

Notes: OpenRouter's free catalog **churned hard** — the 2025-era DeepSeek/Llama/Qwen free variants are gone, replaced by promo models (GLM 5.2, MiniMax M3, Inkling, Nemotron). **Never hardcode model IDs; fetch the model list / keep models in config** (which the spec already demands).

**Architecture pattern (community-standard):** cheap-triage-then-escalate. A small fast model (Gemini Flash-Lite / Groq `llama-3.1-8b-instant`) classifies every news item ("does this affect a rostered player? JSON verdict"), and only hits escalate to a big-context model (Gemini Flash, 1M context = full rosters + article in one call). Triage burns RPD (plentiful on Flash-Lite/Groq); reasoning burns tokens (plentiful on Gemini TPM / Cerebras TPD). Since every provider speaks the OpenAI chat-completions dialect, one client + a per-provider `{baseUrl, key, model}` config table is the whole abstraction — with 429-triggered fallback down a provider chain (LiteLLM/Vercel AI SDK do this off-the-shelf if we want a library).

Privacy note: free tiers may train on prompts — fine for public football news, but don't route personal data through them.

---

## 5. Free hosting / infra

| | Cron | Compute | Storage | Verdict |
|---|---|---|---|---|
| **Cloudflare (Pages + Workers free)** | **5 cron triggers, minute-level** ([docs](https://developers.cloudflare.com/workers/configuration/cron-triggers/)) | 100K req/day, 10ms CPU/invocation (I/O wait doesn't count) | **D1** (SQLite): 5GB, 5M row reads/day, 100K row writes/day; **KV**: 100K reads/1K writes per day | ✅ **The pick** — only free platform with minute-level cron for news polling |
| **Vercel Hobby** | 100 cron jobs but **once-per-day max cadence** — fails at deploy time if more frequent | Serverless functions | — | ❌ Kills the news engine |
| **Netlify Free** | Scheduled functions, 30s limit, metered from shared 300 credit/month pool | Credit-metered | — | ⚠️ Credit pool risk |
| **GitHub Actions** (public repo) | Free scheduled workflows, ~5 min minimum, **10–30 min delays common** | Generous | Commit artifacts / releases | ✅ Good backup cron for daily jobs (values refresh) |

Known risks with Cloudflare: (a) one cron trigger can multiplex many jobs by branching on the minute, so 5 triggers is not a real ceiling; (b) 10ms CPU is tight but news polling is I/O-bound (CPU only burns on parsing — keep it lean); (c) **Workers egress IPs are datacenter IPs** — ESPN/Reddit bot walls may block them (the same blocks the research sandbox hit). Mitigation: lead with sources verified datacenter-friendly (Rotowire RSS, Bluesky API, Sleeper, FantasyCalc), test ESPN from Workers at deploy time, and fall back to GitHub Actions or dropping ESPN news if blocked.

---

## 6. Open questions / risks register

1. **Yahoo API approval** — manual review, unknown lead time. Apply immediately; Sleeper ships first regardless.
2. **FantasyCalc has no published terms/rate limits** — mitigate with daily caching; optionally email the author.
3. **ESPN (both fantasy API and news JSON) can break or block without notice** — adapter isolation + monitor cwendt94/espn-api issues.
4. **Datacenter-IP bot walls** (ESPN, Reddit) — verify each source from the real deployment IP before counting on it.
5. **Sleeper projections endpoint is undocumented** — could vanish; Boris Chen + FFC ADP + DynastyProcess ECR are the fallback spine for rankings.
6. **Free LLM limits shift constantly** — models/providers must stay in config (spec already requires this).
7. **Bluesky insider coverage** — beat writers confirmed; tier-1 insiders unverified. Validate the curated DID list during build.

---

## 7. Proposed stack (pending sign-off)

- **Runtime/hosting**: Cloudflare Pages (static frontend) + Workers (API + cron) + **D1** (SQLite) + KV (cache). $0, minute-level cron, one platform.
- **Language**: TypeScript end-to-end.
- **Frontend**: **React + Vite SPA**, mobile-first PWA (installable, like Sleeper). Tailwind CSS for the Sleeper-style dark UI.
- **API layer**: **Hono** on Workers (tiny, fast, the standard for CF).
- **Modularity (per spec)**: three adapter interfaces, all config-driven —
  - `PlatformAdapter` (Sleeper → Yahoo → Fleaflicker → ESPN): league/rosters/matchups/settings normalized to one internal model.
  - `ValueSource` (FantasyCalc primary; DynastyProcess, FFC ADP, Sleeper projections as secondaries) + the DynastyProcess ID crosswalk as the canonical player-ID bridge.
  - `NewsSource` (Rotowire RSS, PFT/CBS/Yahoo RSS, Bluesky, ESPN JSON, Sleeper trending) and later `LLMProvider` ({baseUrl, key, model} config table, OpenAI dialect).
- **Cron plan (within 5 free triggers via minute-multiplexing)**: every 2 min in-season → news poll; hourly → Sleeper trending + league sync; daily → FantasyCalc values, Sleeper `/players/nfl` dump, FFC ADP; weekly → DynastyProcess crosswalk refresh.
- **Yahoo OAuth**: handled in a Worker route; tokens in D1 (encrypted) — fine for a friends-scale app; secrets in Workers env.
- **Auth for the app itself (v1)**: none/simple shared link for you + buddies initially; magic-link or Cloudflare Access later if it grows.

**Phase order stays as the spec: Sleeper import → dashboard → Yahoo import → keeper board → cheat sheets → trade calc → news engine; Fleaflicker/ESPN + LLM layer in Phase 2.**
