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
table{border-collapse:separate;border-spacing:0;width:100%;min-width:1000px}
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
/* vertical group dividers: ESPN | the 3 sites | the 2 averages */
th:nth-child(3), td:nth-child(3), th:nth-child(6), td:nth-child(6){border-right:2px solid #34404f}
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
</style></head><body>
<header>
<h1>2026 ADP Board &mdash; ESPN draft, cross-platform value</h1>
<div class="sub">12-team, full-PPR &middot; 1QB/2RB/2WR/1TE/1FLEX/1K/1DEF &middot; rounds 1&ndash;14 (168 picks) &middot; pulled __DATE__</div>
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
<th class="l"><span class="hd" data-k="seq">#</span></th>
<th class="l"><span class="hd" data-k="name">Player</span></th>
<th><span class="hd" data-k="base" id="h0">ESPN ADP</span></th>
<th><span class="hd" data-k="v_ud">Underdog</span><span class="dbtn" data-d="ud">&Delta;</span></th>
<th><span class="hd" data-k="v_yahoo">Yahoo</span><span class="dbtn" data-d="yahoo">&Delta;</span></th>
<th><span class="hd" data-k="v_sleeper">Sleeper</span><span class="dbtn" data-d="sleeper">&Delta;</span></th>
<th><span class="hd" data-k="avgV" id="h1">Avg of 3</span></th>
<th><span class="hd" data-k="avgd">Avg gap</span><span class="dbtn" data-d="avg">&Delta;</span></th>
</tr></thead>
<tbody id="b"></tbody>
<tfoot><tr><td colspan="8">
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
A score of 0 or &minus;1 gets no highlight. Kickers and defenses can only ever reach &plusmn;1 since Yahoo is the only one of the three that prices them.<br>
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
const DATA = __DATA__;
const CAP = 25;
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
    // consensus score: +1 for each site whose number is HIGHER than ESPN, -1 for each lower
    r.score = KEYS.reduce((s,k)=>{ const g=r["g_"+k]; return s + (g===null?0:(g>0?1:(g<0?-1:0))); }, 0);
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
  if(Math.abs(t) < 0.05) return "background:#2b323d;color:#c9d1d9";
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
  if(v===null||v===undefined) return '<td><span class="na">&mdash;</span></td>';
  const d = +(v - base).toFixed(1);
  const s = (d > 0 ? "+" : "") + d.toFixed(1);
  const sl = slotOf(v), bs = slotOf(base);
  return `<td><span class="stack"><span class="cell" style="${color(d)}">${fmt(v)}<span class="d">${s}</span></span>`
       + `<span class="pr" style="${pcolor(sl.r - bs.r)}">${sl.label}</span></span></td>`;
}
// market-consensus column: the average itself, coloured by its gap. The gap number lives in the
// next column, so it isn't repeated here.
function avgCell(r){
  if(r.avgV===null) return '<td><span class="na">&mdash;</span></td>';
  const shown = mode==="adp" ? r.avgV.toFixed(1) : String(Math.round(r.avgV));
  const sl = slotOf(r.avgV), bs = slotOf(r.base);
  return `<td><span class="stack"><span class="cell" style="${color(r.avgd)}">${shown}</span>`
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
        div = `<tr class="rd tierband${i===0?" first":""}"><td colspan="8">`
            + `${r.pos==="DST"?"DEF":r.pos} &middot; Tier ${r.tier}`
            + `<span class="pk">${n} player${n===1?"":"s"} &middot; ${fmt(r.base)}&ndash;${fmt(s.filter(x=>x.tier===r.tier).slice(-1)[0].base)}</span></td></tr>`;
      }
    } else if(i % 12 === 0){
      const label = natural
        ? `Round ${Math.floor((r.seq-1)/12)+1}<span class="pk">picks ${r.seq}&ndash;${Math.min(r.seq+11, s[s.length-1].seq)}</span>`
        : `<span class="pk">rows ${i+1}&ndash;${Math.min(i+12, s.length)} of this view</span>`;
      div = `<tr class="rd${i===0?" first":""}${natural?"":" soft"}"><td colspan="8">${label}</td></tr>`;
    }
    const sep = tierView ? (r.tierEnd ? ' class="rndsep"' : '')
                         : (((i+1) % 12 === 0) ? ' class="rndsep"' : '');
    const av = r.avgd===null?'<span class="na">&mdash;</span>':
      `<span class="cell" style="${color(r.avgd)}">${r.avgd>0?"+":""}${r.avgd.toFixed(1)}</span>`;
    const altTxt = mode==="adp" ? ("rk " + r.alt) : ("adp " + r.alt.toFixed(1));
    const hl = hlColor(r);
    return `${div}<tr${sep}>
      <td class="l"><b>${r.seq}</b> <span class="slot">${r.slot}</span></td>
      <td class="l"><div class="ply">
          <span class="av${r.pos==="DST"?" lg":""}"><img src="${r.img}" alt="" decoding="async"
                onerror="this.style.visibility='hidden'"></span>
          <span><span class="pos ${r.pos}">${r.pos==="DST"?"DEF":r.pos}</span>
          <span class="nm" style="margin-left:7px">${r.name}</span><span class="meta">${r.team}</span>
          ${r.tierEnd&&r.tierDrop!==null?`<span class="cliff">cliff &middot; next ${r.pos==="DST"?"DEF":r.pos} +${r.tierDrop}</span>`:""}</span>
        </div></td>
      <td><span class="stack"><span class="cell${hl?" hl":""}" style="${hl?`background:${hl.bg}`:"background:none;padding-left:0"}"
            >${fmt(r.base)}<span class="alt">${altTxt}</span></span>
          <span class="pr" style="${hl?`background:rgba(${hl.rgb},.28);color:#fff`:""}">${slotOf(r.base).label}</span></span></td>
      ${cell(r.v_ud,r.base)}${cell(r.v_yahoo,r.base)}${cell(r.v_sleeper,r.base)}
      ${avgCell(r)}
      <td>${av}</td></tr>`;
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
recompute(); computeTiers(); render();
</script></body></html>
"""

out = HTML.replace("__DATA__", json.dumps(data)).replace("__DATE__", "July 29, 2026")
p = "/sessions/festive-sleepy-knuth/mnt/outputs/2026_ADP_Board_ESPN_vs_UD_Yahoo_Sleeper.html"
open(p, "w", encoding="utf-8").write(out)
print("wrote", p, len(out), "bytes")
