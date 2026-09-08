# 2026 ADP Board — Sleeper vs Winks / Yahoo / ESPN

Draft-day board for one specific league: 12-team **Sleeper**, **full PPR**,
1QB / 2RB / 2WR / 1TE / 1FLEX / 1K / 1DEF.

It puts Sleeper's ADP for every draftable player next to three other sources, so you can see
where your Sleeper room is mispricing someone — and it doubles as a live board you click players
off of as they go.

**Live:** https://adp-board-2026.vercel.app

> Originally built against ESPN. Swapped to Sleeper on 2026-09-07: Sleeper is now the spine and
> ESPN is a comparison column. See **Sleeper is the spine** below for what that changed.

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

One view, keyed to **Sleeper ADP**. Sleeper publishes a single metric — its "rank" is just that
ADP re-numbered — so there is nothing to put on a second tab. The old Rank vs Rank / ADP vs ADP
strip is gone.

Column order is fixed: `Avg of 3 | # Player | Sleeper ADP | Winks rk | Yahoo | ESPN`.

Three of the four numbers are ADP and directly comparable. **Winks publishes rankings only**, so
his column is labelled `rk` and rendered as an integer — same scale, different thing.

The board runs 18 rounds / 216 picks. Depth is `TEAMS_N * 18` in `build.py`, and Sleeper's live
ADP defines who is on it.

### Colour

The three comparison columns are shaded by their gap from the Sleeper baseline, with the signed
gap printed small beside each number:

- **green** — the player goes *earlier* on that source than on Sleeper; it likes him more than
  your room does
- **red** — he goes *later*; Sleeper is paying up
- gaps under 3 picks are a flat dead zone, full saturation at ±25

The **Sleeper cell** carries the consensus hue — how many of the three other sources take him at
least 3 picks earlier than Sleeper:

| Sources agreeing | Colour |
|---|---|
| 0–1 | none — one source disagreeing isn't a signal |
| 2 | blue |
| 3 | purple |

Hue says how many agree; brightness says by how much.

### Once the draft starts, every number column goes live

Before the first pick, all four number columns show the static read above. Once players start
coming off the board they switch to a **draft clock** measured against the pick actually on the
clock (players taken, plus one):

- **red** — not due yet
- **yellow** — the consensus says he's due, but Sleeper's own board won't reach him for a while,
  so you can wait
- **green** — he's slid past his market price and he's there for you

The handover is `TAKEN` going above zero. A clock reading before pick 1 says nothing, since every
number is ahead of it — so the pre-draft state is the gap read, and the whole market is legible
while you prep. The yellow override measures against **Sleeper's own number**, because Sleeper is
the room you're drafting in.

The `rd n` beside the average is the round the consensus average lands in.

Players are grouped into positional **tiers**, cut where the board has a real gap. The orange
`cliff` tag marks the last player before a drop.

### Interaction

- **click a row** — player off the board, pick advances
- **Undo**, or Ctrl/Cmd+Z — restores the most recent
- **restore all** — clears the board, pick back to 1
- position filter is single-select
- below 1024px the board narrows to three columns — average, player, Winks. **The Sleeper column
  is the one hidden**, not Winks: every remaining cell prints its gap to Sleeper, and the `#` and
  round slot already carry Sleeper's own position, since the board is ordered by it. The consensus
  hue moves off the Sleeper cell onto the average cell's left edge
- below 640px a tighter phone layout takes over: short header labels, condensed chrome, and the
  player name truncates rather than forcing the table sideways. Fits 360px

## Sleeper is the spine

Sleeper's live ADP decides board membership, and it is the baseline every gap is measured
against. Three consequences worth knowing:

- **Sleeper's raw list is not just skill players.** It carries DB, FB, LB, DL and P entries with
  real ADP — one DB sits inside the top 216. Membership is filtered to QB/RB/WR/TE/K/DST. ESPN's
  slot filter used to do this for free.
- **Headshots still come from ESPN.** Sleeper's projections endpoint publishes no player id at
  all, so images are built from ESPN ids joined on the normalised name. ESPN is a comparison
  column now but remains a hard dependency for pictures. The baked snapshot stores each ESPN id
  so headshots survive an ESPN outage; a player ESPN doesn't carry gets no image and the `onerror`
  hides it. Currently that's 1 of 216.
- **K and DST are in.** Sleeper now publishes ADP for both — 15 defenses and 16 kickers inside
  the top 216, so 31 of your 216 slots. The old proxy comment claiming Sleeper publishes none for
  them was wrong.

## Data sources

The baseline is now unambiguously full PPR, which it never was on the old ADP tab — ESPN's ADP
is not scoring-specific. Two of the three comparison columns still don't match the league.

Verified against the live sources; the method for each is in the notes below.

| Source | Role | Scoring | Matches league | How that was verified |
|---|---|---|---|---|
| Sleeper | **baseline** | Full PPR (`adp_ppr`) | **Yes** | `adp_ppr`, `adp_half_ppr` and `adp_std` are all published and all differ; Chase at 109 projected receptions is 3.3 PPR vs 6.6 standard |
| Hayden Winks | comparison (rank) | Full PPR | **Yes** | Source article is his Full-PPR hub, and the list ranks Nacua ahead of Bijan; his separate half-PPR list has Bijan 2 / Nacua 4 |
| Yahoo | comparison (ADP) | Unqualified | **No** | The public API exposes a single `draft_analysis.average_pick` with no scoring dimension — an aggregate over Yahoo's whole league population |
| ESPN | comparison (ADP) | Not scoring-specific | **No** | `ownership.averageDraftPosition` is byte-identical in `leaguedefaults/1` (standard) and `/3` (PPR), while the draft ranks differ for 51 of 60 players |

**ESPN moved from spine to comparison, and that helped.** Its ADP is a global cross-format
aggregate, so when it was the baseline every gap on the ADP tab was measured against a number
that wasn't the league's scoring. As a comparison column it's just one mismatched source among
three, and the baseline underneath it is genuine full PPR.

ESPN's `draftRanksByRankType.PPR.rank` *is* genuinely full PPR and is no longer used, since
Sleeper has no equivalent to compare it against. The proxy still returns it.

### Full-PPR alternatives, already searched (2026-08-29)

Don't redo this. Neither mismatched column can be fixed by picking a different field or feed:

- **Yahoo has no PPR split at all.** One game key (470, type `full`), one
  `draft_analysis.average_pick`. Passing `;is_ppr=1`, `;is_ppr=0` or `;scoring_type=ppr` returns
  byte-identical ADP, so the parameters are simply ignored.
- **Sharp publishes a full-PPR ADP page** —
  `fantasy-football-adp-ppr-draftkings-best-ball` (DraftKings is full PPR, and the page says so)
  — **but it is a season stale.** `datePublished` and `dateModified` are both 2025-08-29 and it
  carries none of the 2026 rookies. Worth re-checking next preseason: it would be a genuine
  full-PPR comparison column.

Coverage of the 216-pick board, measured 2026-09-07:

| Sleeper | ESPN | Winks | Yahoo |
|---|---|---|---|
| 216 | 215 | 214 | 203 |

The Winks column is a hand-pulled snapshot rather than a feed: it shows `8/26` where the others
show `live <timestamp>`, and it needs re-pulling when he republishes. It must be his
**full-PPR** table — his separate half-PPR list is a materially different ranking, so
`build.py` asserts that ordering at build time — the *order*, not absolute ranks: he reorders
the top freely between publishes, and an absolute fingerprint failed the build on a legitimate
re-rank.

Serverless functions in `api/*.js` are CORS proxies, payload trimmers and edge caches. Yahoo
sends no CORS headers and Sleeper's raw payload is ~8.7 MB.

**Underdog was removed on 2026-08-29.** It was half PPR, best ball, had the thinnest coverage of
the board, and was the only scraped source.

## Failure behaviour

- any one comparison source dies → only its column falls back, per player, keyed by normalised
  name; the others stay live
- **Sleeper dies → the entire baked snapshot is kept**, because Sleeper defines who is even on
  the board
- the board renders the snapshot *before* any network call resolves, so it is never blank
- fallbacks are reported **only to the browser console** (`console.warn`), not on screen.
  The header status chips were removed and `setStatus()` is now dead code — it looks for an
  `id="srcs"` element the template no longer renders. With devtools closed there is no way
  to tell a stale column from a live one

The snapshot in `adp_data.py` is **216 rows, Sleeper-ordered, regenerated 2026-09-07** — the same
depth as the live board, so an outage no longer costs you rounds 15–18. It is one row per player
rather than the four index-aligned strings it used to be (`ROWS` / `ID_RANK` / `TOKENS` /
`ESPN_LIVE`), which had to be extended in lockstep and corrupted the fallback silently on a
single misalignment.
