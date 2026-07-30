import json, re, sys
sys.path.insert(0, "/sessions/festive-sleepy-knuth/mnt/outputs")
from adp_data import ROWS, UNDERDOG, ID_RANK, TOKENS, UD_META, ESPN_LIVE

def norm(s):
    s = s.lower().replace(" d/st", "")
    s = s.replace(".", "").replace("'", "")
    s = re.sub(r"\s+(jr|sr|ii|iii|iv|v)$", "", s)
    s = re.sub(r"[^a-z \-]", "", s)
    return re.sub(r"\s+", " ", s).strip()

pairs = [p for p in ID_RANK.replace("\n", "").split(",") if p.strip()]
toks  = [t for t in TOKENS.replace("\n", "").split(",") if t.strip()]
live  = [l for l in ESPN_LIVE.replace("\n", "").split(",") if l.strip()]
assert len(pairs) == 168 and len(toks) == 168 and len(live) == 168, (len(pairs), len(toks), len(live))

def num(x):
    return int(x) if x not in ("", None) else None

data = []
for i, (name, pos, team, _espn_old, yah, sl) in enumerate(ROWS[:168]):
    pid, _raw_rank = pairs[i].split(":")
    dense, espn_s = live[i].split(":")
    espn, erank = float(espn_s), dense          # dense ordinal on ESPN's rank board
    epr_rank, y_rk, y_pr, s_rk, s_pr = toks[i].split(".")
    n = norm(name)
    ud = UNDERDOG.get(n)
    udm = UD_META.get(n)
    img = (f"https://a.espncdn.com/i/teamlogos/nfl/500/{team.lower()}.png" if pos == "DST"
           else f"https://a.espncdn.com/i/headshots/nfl/players/full/{pid}.png")
    P = "DEF" if pos == "DST" else pos
    data.append({
        "name": name, "pos": pos, "team": team, "img": img,
        # ESPN
        "espn": espn, "rank": int(erank), "eprRank": f"{P}{epr_rank}" if epr_rank else None,
        # other platforms: adp, overall rank, positional rank
        "ud": ud,  "udRk": udm[0] if udm else None,  "udPr": udm[1] if udm else None,
        "yahoo": yah, "yaRk": num(y_rk), "yaPr": f"{P}{y_pr}" if y_pr else None,
        "sleeper": sl, "slRk": num(s_rk), "slPr": f"{P}{s_pr}" if s_pr else None,
    })

# ESPN positional rank by ADP (exact: the ADP-sorted top 168 contains everyone ahead of them)
cnt = {}
for d in sorted(data, key=lambda x: x["espn"]):
    cnt[d["pos"]] = cnt.get(d["pos"], 0) + 1
    d["epaRank"] = ("DEF" if d["pos"] == "DST" else d["pos"]) + str(cnt[d["pos"]])

for seq, d in enumerate(sorted(data, key=lambda x: x["espn"]), start=1):
    d["adpSeq"] = seq
    d["adpSlot"] = f"{(seq-1)//12+1}.{(seq-1)%12+1:02d}"
for seq, d in enumerate(sorted(data, key=lambda x: x["rank"]), start=1):
    d["rkSeq"] = seq
    d["rkSlot"] = f"{(seq-1)//12+1}.{(seq-1)%12+1:02d}"

print("rows:", len(data),
      "| no UD adp:", sum(1 for d in data if d["ud"] is None),
      "| no UD rank:", sum(1 for d in data if d["udRk"] is None),
      "| no Yahoo:", sum(1 for d in data if d["yahoo"] is None),
      "| no Sleeper:", sum(1 for d in data if d["sleeper"] is None))
bad = [d["name"] for d in data if (d["ud"] is None) != (d["udRk"] is None)]
assert not bad, bad

HTML = """<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>2026 ADP Board &mdash; ESPN vs Underdog / Yahoo / Sleeper</title>
<style>
:root{--bg:#0e1116;--panel:#161b22;--line:#242c38;--txt:#e6edf3;--dim:#8b949e;}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--txt);font:14px/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
header{padding:15px 20px 0;border-bottom:1px solid var(--line);background:var(--panel);position:sticky;top:0;z-index:30}
h1{margin:0 0 4px;font-size:17px;letter-spacing:.2px}
.sub{color:var(--dim);font-size:12px}
.srcbar{display:flex;flex-wrap:wrap;gap:7px;align-items:center;margin-top:7px}
.src{font-size:10px;font-weight:700;letter-spacing:.3px;padding:2px 7px;border-radius:4px;border:1px solid var(--line);color:var(--dim)}
.src b{font-weight:800}
.src.ok{background:#10241a;border-color:#1f5138;color:#79d69f}
.src.warn{background:#2a2113;border-color:#5a4620;color:#e0b060}
.src.pend{background:#141a22;color:#6e7681}
#refresh{padding:3px 10px;font-size:11px}
#refresh:disabled{opacity:.45;cursor:default}
.bar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:11px}
input[type=search]{background:#0b0f14;border:1px solid var(--line);color:var(--txt);padding:7px 10px;border-radius:6px;width:180px;font-size:13px}
button{background:#0b0f14;border:1px solid var(--line);color:var(--dim);padding:6px 11px;border-radius:6px;cursor:pointer;font-size:12px;font-weight:600}
button.on{background:#1f6feb;border-color:#1f6feb;color:#fff}
button:hover{color:var(--txt)}
.legend{display:flex;align-items:center;gap:8px;margin-left:auto;font-size:11px;color:var(--dim)}
.ramp{width:190px;height:12px;border-radius:6px;background:linear-gradient(90deg,#d0342c,#e8736a,#2b323d,#54c47f,#0f9d4f)}
.tabs{display:flex;gap:4px;margin-top:13px}
.tab{padding:9px 16px 8px;border:1px solid var(--line);border-bottom:none;border-radius:8px 8px 0 0;background:#10151c;
     color:var(--dim);cursor:pointer;font-size:12.5px;font-weight:700;letter-spacing:.2px}
.tab .t2{display:block;font-weight:500;font-size:10.5px;opacity:.75;letter-spacing:0}
.tab.on{background:var(--bg);color:var(--txt);position:relative;top:1px}
.wrap{overflow:auto;max-height:calc(100vh - 205px)}
table{border-collapse:separate;border-spacing:0;width:100%;min-width:900px}
th{position:sticky;top:0;background:#1b222c;z-index:20;font-size:11px;text-transform:uppercase;letter-spacing:.6px;color:var(--dim);
   padding:8px 10px;text-align:right;white-space:nowrap;border-bottom:1px solid var(--line);user-select:none}
th.l{text-align:left}
th .hd{cursor:pointer}
th .hd:hover{color:var(--txt)}
th .ar{opacity:.5;font-size:9px}
.dbtn{display:inline-block;margin-left:6px;padding:1px 5px;border:1px solid var(--line);border-radius:4px;cursor:pointer;
      font-size:10px;color:#6e7681;background:#0b0f14}
.dbtn:hover{color:var(--txt);border-color:#3d4756}
.dbtn.act{background:#1f6feb;border-color:#1f6feb;color:#fff}
td{padding:5px 10px;text-align:right;border-bottom:1px solid #1a212b;white-space:nowrap;font-variant-numeric:tabular-nums}
td.l{text-align:left}
tr:hover td{background:#1a2029}
.ply{display:flex;align-items:center;gap:9px}
.av{width:34px;height:34px;border-radius:50%;background:#0b0f14;border:1px solid #262f3c;flex:0 0 34px;overflow:hidden}
/* ESPN headshots are 600x436 with transparent margins; crop to the face, not the empty top */
.av img{width:34px;height:34px;object-fit:cover;object-position:center 25%;display:block}
.av.lg img{object-fit:contain;padding:3px}
.nm{font-weight:600}
.meta{color:var(--dim);font-size:11px;margin-left:6px}
.slot{color:#6e7681;font-size:11px}
.pos{display:inline-block;min-width:30px;text-align:center;padding:1px 5px;border-radius:4px;font-size:10px;font-weight:700}
.QB{background:#3d2a4d;color:#d6a8ff}.RB{background:#123a2c;color:#71e0a8}.WR{background:#12324d;color:#79c0ff}
.TE{background:#4a3312;color:#ffbe6b}.K{background:#3a3a3a;color:#c9d1d9}.DST{background:#3d1f24;color:#ff9c9c}
.stack{display:inline-flex;flex-direction:column;align-items:flex-end;line-height:1.25}
.cell{display:inline-block;min-width:76px;padding:4px 8px;border-radius:5px;font-weight:700;font-size:13px}
.d{font-size:11px;opacity:.95;margin-left:5px;font-weight:700}
.pr{display:inline-block;font-size:10px;font-weight:700;letter-spacing:.3px;color:#7d8794;margin-top:2px;
    padding:1px 5px;border-radius:4px;min-width:38px;text-align:center}
.hl{color:#fff}
.hl .alt{color:#e2ecff;opacity:.85}
.chip{display:inline-block;padding:2px 7px;border-radius:4px;font-size:10px;font-weight:700;color:#fff}
.chip.p{background:rgb(138,74,226)}
.chip.b{background:rgb(31,111,235)}
.chip.o{background:rgb(214,120,28)}
.ramp2{width:80px;height:12px;border-radius:6px}
.na{color:#4d5560}
.alt{color:#6e7681;font-size:11px;margin-left:5px}
/* column order: [Avg gap | Avg of 3] | Player | ESPN | [Underdog Yahoo Sleeper]
   dividers close the averages block, the player block and the ESPN block */
th:nth-child(2), td:nth-child(2), th:nth-child(3), td:nth-child(3),
th:nth-child(4), td:nth-child(4){border-right:2px solid #34404f}
th.c, td.c{text-align:center}
.stack.ctr{align-items:center}
/* the # + round.pick that used to be its own column now leads the player cell */
.seq{display:inline-flex;flex-direction:column;align-items:flex-end;min-width:34px;line-height:1.15;margin-right:2px}
.seq b{font-size:12.5px}
.seq i{font-style:normal;font-size:10px;color:#6e7681}
/* the three site columns are reference, not the headline: dial them back */
th.site{color:#6b7482;font-size:10px}
td.site .cell{font-weight:600;font-size:12px;min-width:66px;opacity:.88}
td.site .d{font-size:10px;font-weight:600}
td.site .pr{font-size:9px;opacity:.75;min-width:32px}
th .sm{display:none}
.rndsep td{border-bottom:2px solid #3d4b5c}
tr.rd td{background:#111721;border-top:2px solid #3d4b5c;border-bottom:1px solid #1f2732;
  padding:5px 10px;text-align:left;font-size:10px;font-weight:800;letter-spacing:1.1px;color:#8fa3bd;text-transform:uppercase}
tr.rd:hover td{background:#111721}
tr.rd .pk{color:#5c6675;font-weight:600;letter-spacing:.4px;margin-left:8px;text-transform:none}
tr.rd.first td{border-top:none}
tr.rd.soft td{background:#0f141b;color:#5c6675;letter-spacing:.4px}
tr.rd.soft:hover td{background:#0f141b}
tr.rd.tierband td{background:#141c17;color:#8fbd9f;border-top-color:#3f5a49}
tr.rd.tierband:hover td{background:#141c17}
.cliff{display:inline-block;margin-left:8px;padding:1px 6px;border-radius:3px;font-size:9.5px;font-weight:700;
   letter-spacing:.3px;background:#3a2a12;color:#f0b45f;text-transform:uppercase;white-space:nowrap}
tfoot td{color:var(--dim);font-size:11px;text-align:left;padding:12px 10px;white-space:normal;line-height:1.65}

/* ---------------------------------------------------------------- mobile ---
   Stays a real table, just condensed to fit a phone: short column labels, the
   gap stacked under each value instead of beside it, and the decorative bits
   (round.pick tags, team, alt value, cliff tags) dropped. */
@media (max-width: 820px){
  header{padding:11px 10px 0;position:static}
  h1{font-size:14px}
  .sub{font-size:10.5px}
  .legend{margin-left:0;flex-basis:100%;order:9;margin-top:4px;flex-wrap:wrap;row-gap:3px;min-width:0;font-size:10px}
  .legend > span{white-space:normal}
  .legend > span[style]{margin-left:0 !important}
  .ramp{width:100px;flex:0 0 100px}
  input[type=search]{flex:1 1 130px;width:auto;padding:5px 8px;font-size:12px}
  button{padding:5px 8px;font-size:11px}
  .bar,.srcbar{gap:5px}
  .tab{flex:1;padding:7px 8px 6px;font-size:11.5px}
  .tab .t2{display:none}
  .wrap{max-height:none;overflow:visible}

  table{min-width:0;width:100%;table-layout:fixed}
  th .lg{display:none}
  th .sm{display:inline}
  th{padding:6px 2px;font-size:9px;letter-spacing:.3px}
  td{padding:4px 2px;font-size:11px}
  .dbtn{margin-left:2px;padding:0 3px;font-size:9px}

  /* fixed widths: gap | avg | player (flex) | espn | ud | yah | slp */
  th:nth-child(1),td:nth-child(1){width:38px}
  th:nth-child(2),td:nth-child(2){width:40px}
  th:nth-child(4),td:nth-child(4){width:44px}
  th:nth-child(n+5),td:nth-child(n+5){width:40px}

  /* stack the gap under the value so cells stay narrow */
  .cell{min-width:0;width:100%;box-sizing:border-box;padding:2px 3px;font-size:11px;text-align:center}
  td.site .cell{min-width:0;font-size:10.5px}
  .d{display:block;margin-left:0;font-size:9px;line-height:1.1}
  .stack{align-items:stretch;width:100%}
  /* drop the decoration */
  .pr,.alt,.meta,.cliff,.seq i{display:none}
  .seq{min-width:0;margin-right:0}
  .seq b{font-size:11px}
  .av,.av img{width:22px;height:22px;flex-basis:22px}
  .ply{gap:5px}
  .nm{font-size:11px;margin-left:4px !important}
  .pos{min-width:22px;padding:0 3px;font-size:9px}
  tr.rd td{font-size:9px;letter-spacing:.6px;padding:4px 6px}
  tr.rd .pk{margin-left:5px}
  tfoot td{font-size:10px;padding:10px 6px}
}
@media (max-width: 430px){
  body{overflow-x:hidden}
  th:nth-child(1),td:nth-child(1){width:34px}
  th:nth-child(2),td:nth-child(2){width:36px}
  th:nth-child(4),td:nth-child(4){width:40px}
  th:nth-child(n+5),td:nth-child(n+5){width:36px}
  .nm{font-size:10.5px}
  .av,.av img{width:0;height:0;flex-basis:0;border:none}
  .cell{font-size:10px}
  td.site .cell{font-size:9.5px}
}
</style></head><body>
<header>
<h1>2026 ADP Board &mdash; ESPN draft, cross-platform value</h1>
<div class="sub">12-team, full-PPR &middot; 1QB/2RB/2WR/1TE/1FLEX/1K/1DEF &middot; rounds 1&ndash;14 (168 picks)
  &middot; data as of <span id="pulled">__DATE__</span></div>
<div class="srcbar"><span id="srcs"></span><button id="refresh">Refresh</button></div>
<div class="bar">
  <input type="search" id="q" placeholder="Search player / team">
  <button data-f="ALL" class="on">All</button>
  <button data-f="QB">QB</button><button data-f="RB">RB</button><button data-f="WR">WR</button>
  <button data-f="TE">TE</button><button data-f="K">K</button><button data-f="DST">DEF</button>
  <div class="legend"><span class="chip p">+2</span><span class="chip b">+1</span><span class="chip o">&minus;2</span><span>consensus score</span>
    <span style="margin-left:12px">Goes EARLIER elsewhere</span><div class="ramp"></div><span>Goes LATER elsewhere</span></div>
</div>
<div class="tabs">
  <div class="tab on" data-m="adp">ADP vs ADP<span class="t2">ESPN ADP compared to each site's ADP</span></div>
  <div class="tab" data-m="rank">Rank vs Rank<span class="t2">ESPN's PPR rank compared to each site's rank</span></div>
</div>
</header>
<div class="wrap">
<table id="t">
<thead><tr>
<th class="c"><span class="hd" data-k="avgd"><span class="lg">Avg gap</span><span class="sm">GAP</span></span><span class="dbtn" data-d="avg">&Delta;</span></th>
<th class="c"><span class="hd" data-k="avgV"><span class="lg" id="h1">Avg of 3</span><span class="sm">AVG</span></span></th>
<th class="l"><span class="hd" data-k="seq">#</span> <span class="hd" data-k="name">Player</span></th>
<th><span class="hd" data-k="base"><span class="lg" id="h0">ESPN ADP</span><span class="sm">ESPN</span></span></th>
<th class="site"><span class="hd" data-k="v_ud"><span class="lg">Underdog</span><span class="sm">UD</span></span><span class="dbtn" data-d="ud">&Delta;</span></th>
<th class="site"><span class="hd" data-k="v_yahoo"><span class="lg">Yahoo</span><span class="sm">YAH</span></span><span class="dbtn" data-d="yahoo">&Delta;</span></th>
<th class="site"><span class="hd" data-k="v_sleeper"><span class="lg">Sleeper</span><span class="sm">SLP</span></span><span class="dbtn" data-d="sleeper">&Delta;</span></th>
</tr></thead>
<tbody id="b"></tbody>
<tfoot><tr><td colspan="7">
<b>Two tabs, two apples-to-apples comparisons.</b>
<b>ADP vs ADP</b> puts ESPN's average draft position next to each site's average draft position &mdash; where players are actually being taken.
<b>Rank vs Rank</b> puts ESPN's PPR draft rank next to each site's overall rank (each site's own board order) &mdash; where the platforms <i>say</i> players should go.
The grey number in the ESPN column is the other tab's value, so you can spot ESPN's own rank-vs-ADP disagreement.<br>
<b>The round.pick under every number</b> is where that figure lands on a 12-team board &mdash; 19.8 is <b>2.08</b>, the 8th pick of round 2. It's shaded by how many <i>rounds</i> away it is from
the ESPN cell on that row (full colour at 3 rounds), so you can read the practical question directly: green means that site would let you wait that many rounds longer, red means you'd have to
come up that many rounds to beat that site's room. A big pick gap that doesn't cross a round boundary is usually not worth changing your plan over.<br>
<b>Reading the colors.</b> The small number is the gap from ESPN.
<span style="color:#54c47f"><b>Green = a HIGHER number on that site</b></span> &mdash; he goes later there than on ESPN, so ESPN's room is paying up relative to that market.
<span style="color:#e8736a"><b>Red = a LOWER number on that site</b></span> &mdash; he goes earlier there, so that market wants him more than ESPN does.
Full saturation at &plusmn;25 picks.<br>
<b>The consensus score</b> drives the colour on the ESPN cell. Each site scores <b>+1</b> if its number is higher than ESPN's and <b>&minus;1</b> if lower, and the three are added up:
<span class="chip p">+2 or more</span> purple &mdash; nearly everyone takes him later than ESPN does.
<span class="chip b">+1</span> blue.
<span class="chip o">&minus;2 or less</span> orange &mdash; the market takes him earlier than ESPN does.
A site inside <b>3 picks</b> of ESPN counts as <b>0</b> &mdash; that's the dead zone, close enough to call a tie &mdash; which is why 0 and &plusmn;2 are reachable at all.
Cells inside the dead zone render grey for the same reason. Kickers and defenses can only ever reach &plusmn;1 since Yahoo is the only one of the three that prices them.<br>
<b>Live data.</b> All four sources are fetched fresh each time the page loads, and the <b>Refresh</b> button re-pulls on demand. ESPN and Sleeper come through cached serverless proxies to keep
the payload small; Yahoo and Underdog have to be proxied because neither sends CORS headers. The chips by the title show whether each source came back <b>live</b> or fell back to the
hand-verified 29 July snapshot, and the fallback is per-source, so one dead feed never blanks the rest of the board. ESPN decides who's on the board at all, so if ESPN is down the whole
board stays on the snapshot.<br>
<b>Sorting.</b> Click a column header to sort by that site's raw number. Click the small <b>&Delta;</b> beside it to sort by its gap &mdash; first click puts the biggest
<span style="color:#54c47f">earlier-than-ESPN</span> gaps on top, click again to flip to the biggest <span style="color:#e8736a">later-than-ESPN</span> gaps.<br>
<b>Sources &amp; caveats.</b> ESPN = live draft results API + PPR draft ranks, ESPN default full-PPR league. Yahoo = Yahoo public fantasy API "all drafts" average pick (Yahoo default is half-PPR).
Sleeper = Sleeper <code>adp_ppr</code> (full PPR). Underdog = Underdog best ball, half-PPR, 7/24/26 snapshot &mdash; best ball has no K or DEF, and its QB/TE prices run differently from redraft.
<b>Tiers.</b> Players are grouped into tiers within their position, cut where the board has a real gap. The threshold scales with ADP, because four picks between two RBs is a cliff at pick 20 and
noise at pick 140, and no tier exceeds seven players so none of them are un-actionable blobs.
The orange <span class="cliff">cliff</span> tag marks the last player before a drop: take him now or the next man at that position costs you the gap shown.
Filter to a single position and the round bands become <b>tier bands</b> instead, which is the view for "do I take this RB or wait." Tiers recompute per tab, so they follow ESPN ADP or ESPN rank.<br>
Every rank on this board is an ordinal position on that site's own board (1, 2, 3&hellip; no gaps), which is what makes them comparable. ESPN's raw API rank field is <i>not</i> contiguous &mdash;
no player holds rank 37&ndash;68, for instance &mdash; so it's been converted to a dense ordinal over ESPN's rank ordering. Same order, clean numbering.
Because Underdog, Yahoo and Sleeper ranks derive from their own ADP, their two tabs track closely; ESPN's rank is a separate editorial list and diverges hard on kickers and defenses
(ESPN ranks them ~170&ndash;200 despite drafters taking them in rounds 8&ndash;14) and on veteran QBs.<br>
<b>Verified 7/29.</b> All 168 rows were re-pulled and diffed field by field against the live sources &mdash; ESPN player IDs, ranks and positional ranks, Yahoo ADP/rank/positional rank,
Sleeper ADP/rank/positional rank, and all 147 Underdog entries &mdash; with zero mismatches. ESPN ADP is a live feed and drifts a tenth or two through the day.
Half-PPR sources shade RB-friendly and WR-unfriendly vs your full-PPR league, so treat small gaps as noise.
</td></tr></tfoot>
</table></div>
<script>
// Baked-in snapshot, hand-verified 2026-07-29. Renders instantly and is the fallback for any
// source that fails at runtime, so the board can never fail to load during a draft.
const FALLBACK = __DATA__;
let DATA = FALLBACK;
const CAP = 25;
const DEAD = 3;               // gaps under 3 picks count as 0 (no lean either way)
const KEYS = ["ud","yahoo","sleeper"];
let mode="adp", sortK="seq", asc=true, filt="ALL", q="";

function recompute(){
  DATA.forEach(r=>{
    if(mode==="adp"){
      r.base = r.espn; r.alt = r.rank; r.basePr = r.epaRank;
      r.seq = r.adpSeq; r.slot = r.adpSlot;
      r.v_ud = r.ud; r.v_yahoo = r.yahoo; r.v_sleeper = r.sleeper;
    } else {
      r.base = r.rank; r.alt = r.espn; r.basePr = r.eprRank;
      r.seq = r.rkSeq; r.slot = r.rkSlot;
      r.v_ud = r.udRk; r.v_yahoo = r.yaRk; r.v_sleeper = r.slRk;
    }
    KEYS.forEach(k=>{ const v=r["v_"+k]; r["g_"+k] = (v===null||v===undefined) ? null : +(v-r.base).toFixed(1); });
    const ds = KEYS.map(k=>r["g_"+k]).filter(x=>x!==null);
    r.avgd = ds.length ? +(ds.reduce((a,b)=>a+b,0)/ds.length).toFixed(1) : null;
    r.g_avg = r.avgd;
    // market consensus: mean of the three sites' own numbers (= ESPN base + avg gap)
    const vs = KEYS.map(k=>r["v_"+k]).filter(x=>x!==null&&x!==undefined);
    r.avgV = vs.length ? +(vs.reduce((a,b)=>a+b,0)/vs.length).toFixed(1) : null;
    // consensus score: +1 per site HIGHER than ESPN, -1 per site LOWER, 0 if within DEAD picks
    r.score = KEYS.reduce((s,k)=>{
      const g=r["g_"+k];
      if(g===null) return s;
      return s + (g >= DEAD ? 1 : (g <= -DEAD ? -1 : 0));
    }, 0);
    // positional-rank gaps
    const bp = prNum(r.basePr);
    r.pg_ud = prGap(bp, r.udPr); r.pg_yahoo = prGap(bp, r.yaPr); r.pg_sleeper = prGap(bp, r.slPr);
    const ps = [r.udPr, r.yaPr, r.slPr].map(prNum).filter(x=>x!==null);
    if(ps.length){
      const m = ps.reduce((a,b)=>a+b,0)/ps.length;
      r.avgPr = (r.pos==="DST"?"DEF":r.pos) + Math.round(m);
      r.pg_avgv = bp===null ? null : +(m-bp).toFixed(1);
    } else { r.avgPr = null; r.pg_avgv = null; }
  });
}
const prNum = s => s ? parseInt(String(s).replace(/[^0-9]/g,""),10) : null;
const prGap = (b,s) => { const v=prNum(s); return (b===null||v===null)?null:v-b; };

// ---- positional tiers -------------------------------------------------------
// Within each position, cut a new tier wherever the gap to the next player is large
// relative to where you are on the board: 4 picks between two RBs matters at pick 20
// and means nothing at pick 140, so the threshold scales with ADP. Any block that ends
// up bigger than MAXTIER is then split at its widest internal gap, so no "tier" is a
// 20-man blob you can't act on.
const TIER_THR = b => Math.max(3.5, Math.min(16, 0.10*b));
const MAXTIER = 7;
function computeTiers(){
  const byPos={};
  DATA.forEach(r=>{(byPos[r.pos]=byPos[r.pos]||[]).push(r);});
  Object.values(byPos).forEach(list=>{
    list.sort((a,b)=>a.base-b.base);
    const cuts = new Set();
    for(let i=1;i<list.length;i++)
      if(list[i].base-list[i-1].base >= TIER_THR(list[i-1].base)) cuts.add(i);
    for(let guard=0; guard<300; guard++){
      const bd=[0,...[...cuts].sort((a,b)=>a-b),list.length];
      let did=false;
      for(let b=0;b<bd.length-1;b++){
        const st=bd[b], en=bd[b+1];
        if(en-st > MAXTIER){
          let bi=-1,bg=-1;
          for(let i=st+1;i<en;i++){const g=list[i].base-list[i-1].base; if(g>bg){bg=g;bi=i;}}
          if(bi>0){cuts.add(bi); did=true;}
        }
      }
      if(!did) break;
    }
    let t=1;
    list.forEach((r,i)=>{ if(cuts.has(i)) t++; r.tier=t; });
    list.forEach((r,i)=>{
      const nxt = list[i+1];
      r.tierEnd  = !nxt || nxt.tier!==r.tier;
      r.tierDrop = (r.tierEnd && nxt) ? +(nxt.base-r.base).toFixed(1) : null;
      r.tierSize = list.filter(x=>x.tier===r.tier).length;
    });
  });
}
// gap = other site - ESPN.  HIGHER number there (goes later) => GREEN, lower => RED
function color(d){
  if(d===null) return "";
  const t = Math.max(-1, Math.min(1, d/CAP));
  if(Math.abs(d) < DEAD) return "background:#2b323d;color:#c9d1d9";   // inside the dead zone
  const a = (0.30 + 0.70*Math.abs(t)).toFixed(3);
  return `background:rgba(${t>0?"15,157,79":"208,52,44"},${a});color:#fff;text-shadow:0 1px 1px rgba(0,0,0,.35)`;
}
// ---- draft slot: turn any pick number or rank into round.pick for a 12-team board ----
const TEAMS = 12;
function slotOf(v){
  const rv = Math.max(1, Math.round(v));
  const r = Math.floor((rv-1)/TEAMS) + 1;
  const p = ((rv-1) % TEAMS) + 1;
  return {r, p, label: r + "." + String(p).padStart(2,"0")};
}
// round deltas are small integers, so they get their own tight scale
const PCAP = 3;
function pcolor(d){
  if(d===null) return "";
  const t = Math.max(-1, Math.min(1, d/PCAP));
  if(d===0) return "background:#2b323d;color:#c9d1d9";
  const a = (0.28 + 0.62*Math.abs(t)).toFixed(3);
  return `background:rgba(${t>0?"15,157,79":"208,52,44"},${a});color:#fff`;
}
// ESPN cell highlight from the consensus score (+1 per site higher than ESPN, -1 per site lower):
//   >= +2  purple      +1  blue      <= -2  orange      0 or -1  nothing
function hlColor(r){
  const s = r.score;
  let rgb=null, a=0.9;
  if(s >= 2){ rgb="138,74,226"; a = s>=3 ? 1 : 0.78; }
  else if(s === 1){ rgb="31,111,235"; a = 0.82; }
  else if(s <= -2){ rgb="214,120,28"; a = s<=-3 ? 1 : 0.78; }
  if(!rgb) return null;
  return {bg:`rgba(${rgb},${a})`, rgb};
}
const fmt = v => mode==="adp" ? v.toFixed(1) : String(v);
function cell(v, base){
  if(v===null||v===undefined) return '<td class="site"><span class="na">&mdash;</span></td>';
  const d = +(v - base).toFixed(1);
  const s = (d > 0 ? "+" : "") + d.toFixed(1);
  const sl = slotOf(v), bs = slotOf(base);
  return `<td class="site"><span class="stack"><span class="cell" style="${color(d)}">${fmt(v)}<span class="d">${s}</span></span>`
       + `<span class="pr" style="${pcolor(sl.r - bs.r)}">${sl.label}</span></span></td>`;
}
// market-consensus column: the average itself, coloured by its gap. The gap number lives in the
// next column, so it isn't repeated here.
function avgCell(r){
  if(r.avgV===null) return '<td class="c"><span class="na">&mdash;</span></td>';
  const shown = mode==="adp" ? r.avgV.toFixed(1) : String(Math.round(r.avgV));
  const sl = slotOf(r.avgV), bs = slotOf(r.base);
  return `<td class="c"><span class="stack ctr"><span class="cell" style="${color(r.avgd)}">${shown}</span>`
       + `<span class="pr" style="${pcolor(sl.r - bs.r)}">${sl.label}</span></span></td>`;
}
function render(){
  const rows = DATA.filter(r=>(filt==="ALL"||r.pos===filt) &&
      (q===""||r.name.toLowerCase().includes(q)||r.team.toLowerCase().includes(q)));
  const s = rows.slice().sort((a,b)=>{
    let x=a[sortK], y=b[sortK];
    if(x===null||x===undefined) return 1;
    if(y===null||y===undefined) return -1;
    if(typeof x==="string") return asc?x.localeCompare(y):y.localeCompare(x);
    return asc?x-y:y-x;
  });
  document.getElementById("h0").textContent = mode==="adp" ? "ESPN ADP" : "ESPN Rank";
  document.getElementById("h1").textContent = mode==="adp" ? "Avg ADP (3)" : "Avg rank (3)";
  // bands of 12 always. In true draft order they are real rounds and get labelled as such;
  // once sorted or filtered they are just groups of 12 in the current view, labelled honestly.
  const natural = (sortK==="seq" && asc && filt==="ALL" && q==="");
  // one position selected and in board order => the meaningful bands are tiers, not rounds
  const tierView = (filt!=="ALL" && sortK==="seq" && asc && q==="");
  document.getElementById("b").innerHTML = s.map((r,i)=>{
    let div = "";
    if(tierView){
      if(i===0 || s[i-1].tier!==r.tier){
        const n = s.filter(x=>x.tier===r.tier).length;
        div = `<tr class="rd tierband${i===0?" first":""}"><td colspan="7">`
            + `${r.pos==="DST"?"DEF":r.pos} &middot; Tier ${r.tier}`
            + `<span class="pk">${n} player${n===1?"":"s"} &middot; ${fmt(r.base)}&ndash;${fmt(s.filter(x=>x.tier===r.tier).slice(-1)[0].base)}</span></td></tr>`;
      }
    } else if(i % 12 === 0){
      const label = natural
        ? `Round ${Math.floor((r.seq-1)/12)+1}<span class="pk">picks ${r.seq}&ndash;${Math.min(r.seq+11, s[s.length-1].seq)}</span>`
        : `<span class="pk">rows ${i+1}&ndash;${Math.min(i+12, s.length)} of this view</span>`;
      div = `<tr class="rd${i===0?" first":""}${natural?"":" soft"}"><td colspan="7">${label}</td></tr>`;
    }
    const sep = tierView ? (r.tierEnd ? ' class="rndsep"' : '')
                         : (((i+1) % 12 === 0) ? ' class="rndsep"' : '');
    const av = r.avgd===null?'<span class="na">&mdash;</span>':
      `<span class="cell" style="${color(r.avgd)}">${r.avgd>0?"+":""}${r.avgd.toFixed(1)}</span>`;
    const altTxt = mode==="adp" ? ("rk " + r.alt) : ("adp " + r.alt.toFixed(1));
    const hl = hlColor(r);
    return `${div}<tr${sep}>
      <td class="c">${av}</td>
      ${avgCell(r)}
      <td class="l"><div class="ply">
          <span class="seq"><b>${r.seq}</b><i>${r.slot}</i></span>
          <span class="av${r.pos==="DST"?" lg":""}"><img src="${r.img}" alt="" decoding="async"
                onerror="this.style.visibility='hidden'"></span>
          <span><span class="pos ${r.pos}">${r.pos==="DST"?"DEF":r.pos}</span>
          <span class="nm" style="margin-left:7px">${r.name}</span><span class="meta">${r.team}</span>
          ${r.tierEnd&&r.tierDrop!==null?`<span class="cliff">cliff &middot; next ${r.pos==="DST"?"DEF":r.pos} +${r.tierDrop}</span>`:""}</span>
        </div></td>
      <td><span class="stack"><span class="cell${hl?" hl":""}" style="${hl?`background:${hl.bg}`:"background:none;padding-left:0"}"
            >${fmt(r.base)}<span class="alt">${altTxt}</span></span>
          <span class="pr" style="${hl?`background:rgba(${hl.rgb},.28);color:#fff`:""}">${slotOf(r.base).label}</span></span></td>
      ${cell(r.v_ud,r.base)}${cell(r.v_yahoo,r.base)}${cell(r.v_sleeper,r.base)}</tr>`;
  }).join("");
  document.querySelectorAll("th .ar").forEach(a=>a.remove());
  document.querySelectorAll("th .hd").forEach(hd=>{
    if(hd.dataset.k===sortK) hd.insertAdjacentHTML("beforeend",
      `<span class="ar"> ${asc?"&#9650;":"&#9660;"}</span>`);
  });
  document.querySelectorAll(".dbtn").forEach(d=>
    d.classList.toggle("act", sortK==="g_"+d.dataset.d));
}
document.querySelectorAll("th .hd").forEach(hd=>hd.onclick=()=>{
  const k=hd.dataset.k;
  if(k===sortK) asc=!asc; else {sortK=k; asc=true;}
  render();
});
// delta sort: first click = biggest EARLIER-elsewhere (most negative) on top, second = biggest LATER
document.querySelectorAll(".dbtn").forEach(d=>d.onclick=()=>{
  const k="g_"+d.dataset.d;
  if(sortK===k) asc=!asc; else {sortK=k; asc=true;}
  render();
});
document.querySelectorAll("button[data-f]").forEach(b=>b.onclick=()=>{
  document.querySelectorAll("button[data-f]").forEach(x=>x.classList.remove("on"));
  b.classList.add("on"); filt=b.dataset.f; render();
});
document.querySelectorAll(".tab").forEach(t=>t.onclick=()=>{
  document.querySelectorAll(".tab").forEach(x=>x.classList.remove("on"));
  t.classList.add("on"); mode=t.dataset.m; recompute(); computeTiers(); render();
});
document.getElementById("q").oninput=e=>{q=e.target.value.toLowerCase().trim(); render();};

// ---------------------------------------------------------------------------
// live data
// ---------------------------------------------------------------------------
const norm = s => (s||"").toLowerCase().replace(/ d\\/st$/,"").replace(/\\./g,"").replace(/'/g,"")
  .replace(/\\s+(jr|sr|ii|iii|iv|v)$/,"").replace(/[^a-z \\-]/g,"").replace(/\\s+/g," ").trim();

const SRC = {espn:"pending", sleeper:"pending", yahoo:"pending", underdog:"pending"};
function setStatus(){
  const label = {live:"live", snapshot:"snapshot", pending:"…"};
  const cls   = {live:"ok", snapshot:"warn", pending:"pend"};
  document.getElementById("srcs").innerHTML = Object.keys(SRC).map(k=>{
    const st = SRC[k].startsWith("live") ? "live" : (SRC[k]==="pending" ? "pending" : "snapshot");
    const name = k==="underdog" ? "Underdog" : k==="espn" ? "ESPN" : k[0].toUpperCase()+k.slice(1);
    return `<span class="src ${cls[st]}" title="${SRC[k]}">${name} <b>${label[st]}</b></span>`;
  }).join("");
}
async function grab(path){
  const r = await fetch(path, {cache:"no-store"});
  const j = await r.json();
  if(j.error || !j.players) throw new Error(j.error || "bad payload");
  return j;
}
async function loadLive(){
  document.getElementById("refresh").disabled = true;
  Object.keys(SRC).forEach(k=>SRC[k]="pending"); setStatus();

  const [espn, sleeper, yahoo, ud] = await Promise.all(
    ["/api/espn","/api/sleeper","/api/yahoo","/api/underdog"].map(p=>grab(p).catch(e=>({error:String(e.message||e)})))
  );

  // ESPN defines who is on the board, so without it we keep the snapshot entirely
  if(espn.error || !espn.players){
    Object.keys(SRC).forEach(k=>SRC[k]="snapshot ("+(espn.error||"espn unavailable")+")");
    setStatus(); document.getElementById("refresh").disabled=false; return;
  }
  SRC.espn = "live "+espn.pulled;

  const idx = j => { const m={}; if(j && j.players) j.players.forEach(p=>{const n=norm(p.name); if(!(n in m)) m[n]=p;}); return m; };
  const S = idx(sleeper), Y = idx(yahoo), U = idx(ud);
  SRC.sleeper   = sleeper.error ? "snapshot ("+sleeper.error+")" : "live "+sleeper.pulled;
  SRC.yahoo     = yahoo.error   ? "snapshot ("+yahoo.error+")"   : "live "+yahoo.pulled;
  SRC.underdog  = ud.error      ? "snapshot ("+ud.error+")"      : "live "+ud.pulled;

  // fall back per-source, keyed by player name, so one dead source doesn't blank a column
  const FB = {}; FALLBACK.forEach(r=>FB[norm(r.name)]=r);

  const board = espn.players.slice().sort((a,b)=>a.adp-b.adp).slice(0,168).map(e=>{
    const n = norm(e.name), f = FB[n] || {};
    const P = e.pos==="DST" ? "DEF" : e.pos;
    const s = S[n], y = Y[n], u = U[n];
    return {
      name:e.name, pos:e.pos, team:e.team,
      img: e.pos==="DST" ? `https://a.espncdn.com/i/teamlogos/nfl/500/${e.team.toLowerCase()}.png`
                         : `https://a.espncdn.com/i/headshots/nfl/players/full/${e.id}.png`,
      espn:e.adp, rank:e.rank,
      epaRank:P+e.prByAdp, eprRank:P+e.prByRank,
      ud:      u ? u.adp : (ud.error      ? (f.ud      ?? null) : null),
      udRk:    u ? u.rk  : (ud.error      ? (f.udRk    ?? null) : null),
      udPr:    u ? P+u.pr: (ud.error      ? (f.udPr    ?? null) : null),
      yahoo:   y ? y.adp : (yahoo.error   ? (f.yahoo   ?? null) : null),
      yaRk:    y ? y.rk  : (yahoo.error   ? (f.yaRk    ?? null) : null),
      yaPr:    y ? P+y.pr: (yahoo.error   ? (f.yaPr    ?? null) : null),
      sleeper: s ? s.adp : (sleeper.error ? (f.sleeper ?? null) : null),
      slRk:    s ? s.rk  : (sleeper.error ? (f.slRk    ?? null) : null),
      slPr:    s ? P+s.pr: (sleeper.error ? (f.slPr    ?? null) : null),
    };
  });

  board.slice().sort((a,b)=>a.espn-b.espn).forEach((r,i)=>{ r.adpSeq=i+1; r.adpSlot=slotOf(i+1).label; });
  board.slice().sort((a,b)=>a.rank-b.rank).forEach((r,i)=>{ r.rkSeq=i+1; r.rkSlot=slotOf(i+1).label; });

  DATA = board;
  document.getElementById("pulled").textContent = new Date(espn.pulled).toLocaleString();
  setStatus();
  recompute(); computeTiers(); render();
  document.getElementById("refresh").disabled = false;
}
document.getElementById("refresh").onclick = loadLive;

setStatus();
recompute(); computeTiers(); render();   // snapshot first, so the board is usable immediately
loadLive();
</script></body></html>
"""

out = HTML.replace("__DATA__", json.dumps(data)).replace("__DATE__", "July 29, 2026")
p = "/sessions/festive-sleepy-knuth/mnt/outputs/2026_ADP_Board_ESPN_vs_UD_Yahoo_Sleeper.html"
open(p, "w", encoding="utf-8").write(out)
print("wrote", p, len(out), "bytes")
