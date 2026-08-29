# 2026 ADP Board — ESPN vs Winks / Yahoo / Sleeper

Draft-day board for one specific league: 12-team ESPN, **full PPR**,
1QB / 2RB / 2WR / 1TE / 1FLEX / 1K / 1DEF.

It puts ESPN's valuation of every draftable player next to three other sources, so you can see
where your ESPN room is mispricing someone — and it doubles as a live board you click players
off of as they go.

**Live:** https://adp-board-2026.vercel.app

## Build

```bash
python3 build.py
```

Stdlib Python only — no dependencies, no install step. `build.py` holds the entire
HTML/CSS/JS template as a Python string and writes `index.html` next to itself.
`index.html` is generated but committed, because Vercel serves it as a static file and does
not run Python.

**Edit the template inside `build.py`.** Direct edits to `index.html` are destroyed on the
next build.

## What it shows

Two tabs, both apples-to-apples:

- **Rank vs Rank** (default) — ESPN's PPR draft rank against each site's overall board rank
- **ADP vs ADP** — ESPN's average draft position against each site's ADP

Column order is fixed: `Avg of 3 | # Player | ESPN | Winks | Yahoo | Sleeper`.

The live board runs 18 rounds / 216 picks. Depth is `TEAMS_N * 18` in `build.py`; ESPN's live
pull defines board membership at runtime.

### Colour

Site columns are shaded by their gap from the ESPN baseline, with the signed gap printed small
beside each number:

- **green** — the player goes *earlier* on that site than on ESPN; the market likes him more
  than your room does
- **red** — he goes *later*; ESPN is paying up
- gaps under 3 picks are a flat dead zone, full saturation at ±25

The **ESPN cell** carries the consensus hue — how many of the three other sites take him at
least 3 picks earlier than ESPN:

| Sites agreeing | Colour |
|---|---|
| 0–1 | none — one site disagreeing isn't a signal |
| 2 | blue |
| 3 | purple |

Hue says how many sites agree; brightness says by how much.

The **Avg number** is a live read against the pick on the clock (players taken off the board,
plus one):

- **red** — not due yet
- **yellow** — consensus says he's due, but ESPN's room won't reach him for a while, so you
  can wait
- **green** — he's slid past his market price and he's there for you

The small dot beside that number keeps the static gap to ESPN, on the green/red scale.
Everything stays neutral until the first player comes off the board.

Players are grouped into positional **tiers**, cut where the board has a real gap. The orange
`cliff` tag marks the last player before a drop.

### Interaction

- **click a row** — player off the board, pick advances
- **Undo**, or Ctrl/Cmd+Z — restores the most recent
- **restore all** — clears the board, pick back to 1
- position filter is single-select
- below 1024px the board narrows to three columns — average, player, Winks. **ESPN gives up
  its column, not Winks**: Winks is the closest full-PPR read on the board, and the ESPN
  baseline is still in every number, since each site cell prints its gap to it. The
  consensus hue moves off the ESPN cell onto the average cell's left edge
- below 640px a tighter phone layout takes over: short header labels, condensed chrome, and
  the player name truncates rather than forcing the table sideways. Fits 360px

## Data sources

Two of the five are not full PPR, and the ESPN baseline is only full PPR on one of the two
tabs. That is the most important thing to hold onto.

Verified against the live sources on 2026-08-20; the method for each is in the notes below.

| Source | Scoring | Matches league | How that was verified |
|---|---|---|---|
| ESPN **rank** | Full PPR | **Yes** | `leaguedefaults/3` is "FFL PPR Scoring" with `playerRankType: PPR` and statId 53 (receptions) = 1.0 |
| ESPN **ADP** | Not scoring-specific | **No** | `ownership.averageDraftPosition` is byte-identical in `leaguedefaults/1` (standard) and `/3` (PPR), while the draft ranks differ for 16 of 40 players |
| Sleeper | Full PPR (`adp_ppr`) | **Yes** | `adp_ppr`, `adp_half_ppr` and `adp_std` are all published and all differ; Chase (109 rec) is 3.3 PPR vs 6.6 standard |
| Hayden Winks | Full PPR | **Yes** | Source article is his Full-PPR hub, and the list ranks Nacua ahead of Bijan; his separate half-PPR list has Bijan 2 / Nacua 4 |
| Yahoo | Unqualified | **No** | The public API exposes a single `draft_analysis.average_pick` with no scoring dimension — an aggregate over Yahoo's whole league population, not a PPR figure |

**ESPN's ADP is the one to watch.** The Rank tab's baseline is genuine full PPR, but the ADP
tab's baseline is ESPN's global cross-format ADP, so on that tab every gap is measured against
a number that is not the league's scoring.

### Full-PPR alternatives, already searched (2026-08-29)

Don't redo this. Neither mismatched column can be fixed by picking a different field or feed:

- **Yahoo has no PPR split at all.** One game key (470, type `full`), one
  `draft_analysis.average_pick` aggregated over their entire league population. Passing
  `;is_ppr=1`, `;is_ppr=0` or `;scoring_type=ppr` returns byte-identical ADP, so the parameters
  are simply ignored — it is not a field we chose wrong.
- **Sharp does publish a full-PPR ADP page** —
  `fantasy-football-adp-ppr-draftkings-best-ball` (DraftKings is full PPR, and the page says so)
  — **but it is a season stale.** `datePublished` and `dateModified` are both 2025-08-29, and it
  carries none of the 2026 rookies. Worth re-checking next preseason: if Sharp refreshes it, it
  is a genuine full-PPR ADP feed and their table markup is the same shape the retired Underdog
  scraper handled, so it would be cheap to add as a fourth comparison column.


Practically: Yahoo underprices reception volume, so **Sleeper and Winks are the cleanest
comparisons** and the only two that match the league on both tabs.

Coverage of the 216-pick board, measured live on 2026-08-20:

| ESPN | Sleeper | Winks | Yahoo |
|---|---|---|---|
| 216 | 216 | 212 | 206 |


The Winks column is a hand-pulled snapshot rather than a feed: it shows `8/26` where the others
show `live <timestamp>`, and it needs re-pulling when he republishes. It must be his
**full-PPR** table — his separate half-PPR list is a materially different ranking, so
`build.py` asserts that ordering at build time — the *order*, not absolute ranks: he reorders
the top freely between publishes, and an absolute fingerprint failed the build on a legitimate
re-rank.

Serverless functions in `api/*.js` are CORS proxies, payload trimmers and edge caches. Yahoo
sends no CORS headers and Sleeper's raw payload is ~4.7 MB.

**Underdog was removed on 2026-08-29.** It was half PPR, best ball, had the thinnest coverage of
the board (no kickers or defenses at all), and was the only scraped source — the most brittle
thing in the project. `api/underdog.js`, the `UNDERDOG` / `UD_META` tables and the column are all
gone. The consensus score is now out of three, so its top hue moved from purple-at-4 to
purple-at-3.

## Failure behaviour

- any one source dies → only its column falls back, per player, keyed by normalised name; the
  others stay live
- ESPN dies → the entire baked snapshot is kept, because ESPN defines who is even on the board
- the board renders the snapshot *before* any network call resolves, so it is never blank
- fallbacks are reported **only to the browser console** (`console.warn`), not on screen.
  The header status chips were removed and `setStatus()` is now dead code — it looks for an
  `id="srcs"` element the template no longer renders. With devtools closed there is no way
  to tell a stale column from a live one

**Known gap:** the baked offline snapshot is 168 rows against a 216-pick live board, so an
ESPN outage mid-draft would cost you rounds 15–18. Closing it means extending `ROWS`,
`TOKENS`, `ID_RANK` and `ESPN_LIVE` in `adp_data.py` by 48 players (one structure fewer
since `UD_META` went with the Underdog column).
