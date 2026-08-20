# 2026 ADP Board — ESPN vs Winks / Underdog / Yahoo / Sleeper

Draft-day board for one specific league: 12-team ESPN, **full PPR**,
1QB / 2RB / 2WR / 1TE / 1FLEX / 1K / 1DEF.

It puts ESPN's valuation of every draftable player next to four other sources, so you can see
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

Column order is fixed: `Avg of 4 | # Player | ESPN | Winks | Underdog | Yahoo | Sleeper`.

The live board runs 18 rounds / 216 picks. Depth is `TEAMS_N * 18` in `build.py`; ESPN's live
pull defines board membership at runtime.

### Colour

Site columns are shaded by their gap from the ESPN baseline, with the signed gap printed small
beside each number:

- **green** — the player goes *earlier* on that site than on ESPN; the market likes him more
  than your room does
- **red** — he goes *later*; ESPN is paying up
- gaps under 3 picks are a flat dead zone, full saturation at ±25

The **ESPN cell** carries the consensus hue — how many of the four other sites take him at
least 3 picks earlier than ESPN:

| Sites agreeing | Colour |
|---|---|
| 0–1 | none — one site disagreeing isn't a signal |
| 2 | blue |
| 3 | indigo |
| 4 | purple |

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
- below 1024px the four site columns are hidden and rows condense; there is deliberately no
  phone layout

## Data sources

Two of the five are not full PPR. That is the most important thing to hold onto.

| Source | Scoring | Matches league | Access | Coverage at 216 |
|---|---|---|---|---|
| ESPN | Full PPR | **Yes** | Live API | 216 |
| Sleeper | Full PPR (`adp_ppr`) | **Yes** | Live API | 212 |
| Hayden Winks | Full PPR | **Yes** | Static snapshot, 8/06 | 210 |
| Yahoo | Half PPR | No | Live API | 202 |
| Underdog | Half PPR, best ball | No | Scraped | 175 |

Yahoo and Underdog underprice reception volume. Sleeper and Winks are the cleanest
comparisons. Underdog best ball drafts no kickers or defenses at all, which is most of why its
coverage is lowest.

The Winks column is a hand-pulled snapshot rather than a feed: it shows `8/06` where the others
show `live <timestamp>`, and it needs re-pulling when he republishes. It must be his
**full-PPR** table — his separate half-PPR list is a materially different ranking, so
`build.py` asserts the fingerprint (Nacua 2, Bijan 4) at build time.

Serverless functions in `api/*.js` are CORS proxies, payload trimmers and edge caches. Yahoo
sends no CORS headers, Sleeper's raw payload is ~4.7 MB, and Underdog publishes no open ADP
endpoint at all — that column is scraped from a server-rendered table.

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
`TOKENS`, `ID_RANK`, `ESPN_LIVE` and `UD_META` in `adp_data.py` by 48 players.
