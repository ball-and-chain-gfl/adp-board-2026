# 2026 ADP Board — ESPN vs Underdog / Yahoo / Sleeper

Cross-platform fantasy football ADP comparison board for a 12-team, full-PPR ESPN league
(1QB / 2RB / 2WR / 1TE / 1FLEX / 1K / 1DEF), covering the first 14 rounds (168 picks).

## What it shows

Two tabs, both apples-to-apples:

- **ADP vs ADP** — ESPN's average draft position against each site's ADP
- **Rank vs Rank** — ESPN's PPR draft rank against each site's overall board rank

Each cell is shaded by its gap from the ESPN baseline. Green means the player goes *earlier*
on that site than on ESPN (the market values him above his ESPN price). Red means he goes
*later* (ESPN is paying up). Full saturation at ±25 picks.

The ESPN cell itself lights up **purple** when all three sites take him earlier and **blue**
when two of three do, scaled by how far off ESPN is.

Under every number is the **round.pick** that figure lands on for a 12-team board, shaded by
how many rounds away it is from ESPN.

Players are grouped into positional **tiers** cut where the board has a real gap; the orange
`cliff` tag marks the last player before a drop. Filter to one position and the round bands
become tier bands.

## Scoring caveats

| Source | Scoring | Matches the league |
|---|---|---|
| ESPN | Full PPR | Yes |
| Sleeper | Full PPR (`adp_ppr`) | Yes |
| Yahoo | Half PPR | No |
| Underdog | Half PPR, best ball | No |

Yahoo and Underdog underprice reception volume relative to full PPR, and Underdog best ball
drafts no kickers or defenses. Sleeper is the cleanest comparison.

## Data

Pulled 2026-07-29 from ESPN's live draft results API and PPR draft ranks, Yahoo's public
fantasy API, Sleeper's projections endpoint, and Underdog best ball ADP via Sharp Football
Analysis. All 168 rows were diffed field by field against the live sources with zero
mismatches. ESPN ADP is a live feed and drifts through the day.

`build.py` regenerates `index.html` from `adp_data.py`.
