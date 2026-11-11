// Trade analyzer data: one trimmed, edge-cached payload for trade.html.
//
// READ-ONLY. Nothing here writes to ESPN. League rosters come through the GFL dashboard's
// existing ESPN proxy (the league is private and that proxy already holds the login), so this
// project needs no ESPN credentials of its own.
//
// What it assembles for every rostered player in the league, plus the best unrostered ones:
//   - usage from Sleeper's weekly stat feed: snap share, target share, air-yard share, WOPR,
//     carry share, red-zone share - season and last three games.
//     NOTE Sleeper's rec_air_yd is air yards on CATCHES only (rec_yd = rec_air_yd + rec_yar),
//     not air yards on every target. So there is no true aDOT here: "catch depth" is air yards
//     per catch, and the air-yard share / WOPR are built on completed air yards
//   - efficiency from the same feed: catch rate, yards per target, YAC per catch, targets per
//     snap, yards per carry, yards after contact and broken tackles per carry, first downs
//   - expected fantasy points (xFP): a usage model fitted on this season's own player-games,
//     pricing carries, red-zone carries, targets and red-zone targets - separately for RB, WR
//     and TE, since a wideout's target is worth more than a back's. Opportunity only: completed
//     air yards are an outcome and are deliberately kept out. Scored minus expected (FPOE) is
//     the efficiency read: who is running hot or cold on their workload
//   - expected touchdowns (xTD) from the same four inputs, so a gap between expected and
//     scored can be split into touchdown luck (which evens out) and yardage efficiency
//   - defence-vs-position for every NFL defence, built from the same feed, plus how tough
//     each player's schedule has been so far, to compare with what is ahead
//   - a HEALTHY projection for each remaining week through 17: blended usage/production rate,
//     scaled by that week's opponent, zero on a bye. Injury status is sent alongside and the
//     page applies it, because the page also lets you overrule ESPN's status by hand.
//   - when he is due back: ESPN's injury feed publishes an expected return date for the players
//     it lists (25 a team, so not everyone), turned here into the first week he should play
//     again, or 99 for "not this fantasy season". Plus how many straight games he has missed,
//     which is what the page falls back on when no date is published.
// The page does the roster-need and trade-package maths on top of this.

const MY_TEAM = 10;          // The Bryan Football Team
const SEASON = 2026;
const LAST_WEEK = 17;        // league playoffs are weeks 15-17
const GFL = "https://gfl-dashboard.vercel.app/api/espn";
const ESPN_SCHED = `https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/${SEASON}?view=proTeamSchedules_wl`;
const SLEEPER = "https://api.sleeper.app";
const ESPN_INJ_FEED = "https://site.api.espn.com/apis/site/v2/sports/football/nfl/injuries";
// every active NFL player's id and name, public: used only to put names on past waiver bids
const ESPN_PLAYERS = `https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/${SEASON}/players?view=players_wl&scoringPeriodId=0`;
/* ESPN's own projections, one week at a time, for the 500 most-owned players. This is ESPN's
   public full-PPR default league (the same scoring as this one, kickers and defences included),
   so it needs no login and covers free agents. The rank filters only trim the payload. */
const ESPN_PROJ = `https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/${SEASON}/segments/0/leaguedefaults/3?view=kona_player_info`;
async function espnWeek(w) {
  const filter = { players: { filterSlotIds: { value: [0, 2, 4, 6, 17, 16] }, sortPercOwned: { sortPriority: 1, sortAsc: false }, limit: 500, offset: 0,
    filterStatsForTopScoringPeriodIds: { value: 1, additionalValue: ["11" + SEASON + w] },
    filterRanksForScoringPeriodIds: { value: [w] }, filterRanksForRankTypes: { value: ["PPR"] }, filterRanksForSlotIds: { value: [0] } } };
  const r = await fetch(ESPN_PROJ + "&scoringPeriodId=" + w, { headers: { "x-fantasy-filter": JSON.stringify(filter), "User-Agent": "adp-board/1.0", Accept: "application/json" }, signal: AbortSignal.timeout(12000) });
  if (!r.ok) throw new Error("espn projections returned " + r.status);
  const out = {};
  for (const p of (await r.json()).players || []) {
    const pl = p.player || {}, s = (pl.stats || []).find(x => x.statSourceId === 1 && x.statSplitTypeId === 1 && x.scoringPeriodId === w);
    if (s && s.appliedTotal != null) out[pl.id] = { v: s.appliedTotal, n: pl.fullName, pos: POS[pl.defaultPositionId], tm: pl.proTeamId };
  }
  if (Object.keys(out).length < 150) throw new Error("espn projections: only " + Object.keys(out).length + " players");
  return out;
}
const SKILL_Q = "position[]=QB&position[]=RB&position[]=WR&position[]=TE&position[]=K&position[]=DEF";
const SKILL = ["QB", "RB", "WR", "TE"];
// how many unrostered players to carry at each position, best first
const POOL = { QB: 30, RB: 60, WR: 80, TE: 30 };

const POS = { 1: "QB", 2: "RB", 3: "WR", 4: "TE", 5: "K", 16: "DST" };
const TEAM = { 0:"FA",1:"ATL",2:"BUF",3:"CHI",4:"CIN",5:"CLE",6:"DAL",7:"DEN",8:"DET",9:"GB",
  10:"TEN",11:"IND",12:"KC",13:"LV",14:"LAR",15:"MIA",16:"MIN",17:"NE",18:"NO",19:"NYG",
  20:"NYJ",21:"PHI",22:"ARI",23:"PIT",24:"LAC",25:"SF",26:"SEA",27:"TB",28:"WSH",29:"CAR",
  30:"JAX",33:"BAL",34:"HOU" };
const TEAM_ID = Object.fromEntries(Object.entries(TEAM).map(([id, ab]) => [ab, +id]));
// Sleeper abbreviations that differ from ESPN's
const FIX = { WAS: "WSH", JAC: "JAX", LA: "LAR", OAK: "LV", SD: "LAC", HST: "HOU", BLT: "BAL", CLV: "CLE", ARZ: "ARI" };
const fix = t => (t ? (FIX[t] || t) : "");
// ESPN lineup slot ids -> the names the page uses
const SLOT = { 0: "QB", 2: "RB", 4: "WR", 6: "TE", 23: "FLEX", 17: "K", 16: "DST" };
const ESPN_INJ = { OUT: "O", DOUBTFUL: "D", QUESTIONABLE: "Q", INJURY_RESERVE: "IR", SUSPENSION: "SUS" };
const SL_INJ = { Questionable: "Q", Doubtful: "D", Out: "O", IR: "IR", PUP: "O", Sus: "SUS" };

const norm = s => String(s || "").toLowerCase().replace(/[.'’]/g, "").replace(/-/g, " ")
  .replace(/\s+(jr|sr|ii|iii|iv|v)$/, "").replace(/\s+/g, " ").trim();
const r1 = x => (x == null || !isFinite(x) ? null : Math.round(x * 10) / 10);
const r3 = x => (x == null || !isFinite(x) ? null : Math.round(x * 1000) / 1000);

async function getJSON(url) {
  const r = await fetch(url, { headers: { "User-Agent": "adp-board/1.0", Accept: "application/json" } });
  if (!r.ok) throw new Error(url.split("?")[0].split("/").slice(2, 4).join("/") + " returned " + r.status);
  return r.json();
}

// ---- Yahoo expert notes. The two analysts' author pages list their latest pieces (mostly
// podcast clips, one waiver-wire show a week). There is no feed, so this reads each listing's
// tracking attribute for the title and link, and matches player names against the link's slug
// (titles are cut short at the first apostrophe; slugs never are). The waiver show's own page
// carries a tag list of every player it covers, which is read too. Optional: if Yahoo is down
// or changes its markup, the page simply shows no expert notes.
const YAHOO = "https://sports.yahoo.com";
const AUTHORS = [["Norris", "josh-norris"], ["Winks", "hayden-winks"]];
async function getText(url) {
  const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (compatible; adp-board/1.0)", Accept: "text/html" },
    signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(url + " returned " + r.status);
  return r.text();
}
const unent = s => String(s || "").replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&#x2F;/g, "/");
function authorItems(html) {
  const out = [], seen = new Set();
  for (const m of html.matchAll(/data-ylk="([^"]*)"/g)) {
    const y = m[1], uri = (/tar_uri:([^;]+)/.exec(y) || [])[1], t = (/slk:(.*?);tar:/.exec(y) || [])[1];
    if (!uri || !/^\/(?:[a-z]+\/)?(article|video)\/[a-z0-9-]+\.html$/.test(uri) || seen.has(uri)) continue;
    seen.add(uri);
    out.push({ uri, t: unent(t), k: uri.includes("/video/") ? "video" : "article" });
  }
  return out;
}
const slugText = uri => uri.split("/").pop().replace(/-\d+\.html$/, "").replace(/-+/g, " ");
const isWaiver = s => /waiver|pickup|pick up|flier|add\b|streamer|stash/i.test(s);

// one retry after a short wait: a single dropped connection shouldn't cost a week of stats
async function getRetry(url) {
  try { return await getJSON(url); }
  catch (e) { await new Promise(r => setTimeout(r, 400)); return getJSON(url); }
}

// Least squares with no intercept. Tiny ridge keeps it solvable if two columns line up.
function ols(X, y) {
  const n = X[0].length, A = Array.from({ length: n }, () => Array(n + 1).fill(0));
  for (let i = 0; i < X.length; i++)
    for (let a = 0; a < n; a++) {
      A[a][n] += X[i][a] * y[i];
      for (let b = 0; b < n; b++) A[a][b] += X[i][a] * X[i][b];
    }
  for (let a = 0; a < n; a++) A[a][a] *= 1.0001;
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    if (Math.abs(A[p][c]) < 1e-9) return null;
    [A[c], A[p]] = [A[p], A[c]];
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = A[r][c] / A[c][c];
      for (let k = c; k <= n; k++) A[r][k] -= f * A[c][k];
    }
  }
  const out = A.map((row, i) => row[n] / row[i]);
  return out.every(isFinite) ? out : null;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "public, s-maxage=1800, stale-while-revalidate=86400");

  try {
    const [state, sched, roster, teamsInfo, settings, injFeed, matchups, ...authorPages] = await Promise.all([
      getJSON(`${SLEEPER}/v1/state/nfl`),
      getJSON(ESPN_SCHED),
      getJSON(`${GFL}?view=mRoster&seasonId=${SEASON}`),
      getJSON(`${GFL}?view=mTeam&seasonId=${SEASON}`),
      getJSON(`${GFL}?view=mSettings&seasonId=${SEASON}`),
      getJSON(ESPN_INJ_FEED).catch(() => null),      // big and optional: the page copes without it
      getJSON(`${GFL}?view=mMatchupScore&seasonId=${SEASON}`).catch(() => null),   // who plays whom each week
      ...AUTHORS.map(([, slug]) => getText(`${YAHOO}/author/${slug}/`).catch(() => null)),
    ]);

    // ---- NFL schedule: who each team plays each week, and which weeks are still fully ahead
    const now = Date.now();
    const games = {};              // games[proTeamId][week] = { opp, home, date }
    const weekDates = {};          // every kickoff in a week
    for (const t of (sched.settings && sched.settings.proTeams) || []) {
      if (!TEAM[t.id] || t.id === 0) continue;
      games[t.id] = {};
      const by = t.proGamesByScoringPeriod || {};
      for (const w of Object.keys(by)) {
        const g = by[w][0];
        if (!g) continue;
        const home = g.homeProTeamId === t.id;
        games[t.id][+w] = { opp: home ? g.awayProTeamId : g.homeProTeamId, home, date: g.date };
        (weekDates[+w] = weekDates[+w] || []).push(g.date);
      }
    }
    let firstWeek = LAST_WEEK + 1;
    for (let w = 1; w <= LAST_WEEK; w++)
      if (weekDates[w] && weekDates[w].every(d => d > now)) { firstWeek = w; break; }
    const weeks = [];
    for (let w = firstWeek; w <= LAST_WEEK; w++) weeks.push(w);

    // ---- expected return dates, by ESPN id where the feed links one and by name otherwise
    const retById = {}, retByName = {};
    for (const t of (injFeed && injFeed.injuries) || []) for (const i of t.injuries || []) {
      const ms = Date.parse((i.details || {}).returnDate || "");
      if (!isFinite(ms)) continue;
      const a = i.athlete || {}, m = /\/id\/(\d+)\//.exec(((a.links || [])[0] || {}).href || "");
      if (m) retById[m[1]] = ms;
      if (a.displayName) retByName[norm(a.displayName)] = ms;
    }
    // the first remaining week his team plays on or after that date; 99 = not this fantasy season
    const backWeek = (ms, proTeamId) => {
      if (ms == null) return null;
      for (let w = firstWeek; w <= LAST_WEEK; w++) {
        const g = (games[proTeamId] || {})[w];
        if (g && g.date + 432e5 >= ms) return w;
      }
      return 99;
    };

    // ---- Sleeper weekly stats, every week played so far
    const played = Math.max(1, Math.min(18, Math.min(+state.week || 1, firstWeek)));
    const [weekly, txWeeks, espnNames, espnProj] = await Promise.all([
      Promise.all(Array.from({ length: played }, (_, i) =>
        getRetry(`${SLEEPER}/stats/nfl/${SEASON}/${i + 1}?season_type=regular&${SKILL_Q}`).catch(() => null))),
      // the league's transactions, a week at a time: every waiver bid, won or lost. Optional.
      Promise.all(Array.from({ length: Math.min(18, firstWeek) }, (_, i) =>
        getRetry(`${GFL}?view=mTransactions2&scoringPeriodId=${i + 1}&seasonId=${SEASON}`).catch(() => null))),
      fetch(ESPN_PLAYERS, { headers: { "X-Fantasy-Filter": '{"filterActive":{"value":true}}', Accept: "application/json" }, signal: AbortSignal.timeout(8000) })
        .then(r => (r.ok ? r.json() : [])).catch(() => []),
      Promise.all(weeks.map(w => espnWeek(w).catch(() => espnWeek(w)).catch(() => null))),   // one retry each
    ]);
    /* Vegas implied points: over/under split by the spread. ESPN's scoreboard carries lines for
       the current week and the next; later weeks have none yet. vegas[TEAM][week] = points. */
    const vegas = {};
    await Promise.all(weeks.slice(0, 3).map(async w => {
      try {
        const sb = await getJSON(`https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?seasontype=2&week=${w}&dates=${SEASON}`);
        for (const e of sb.events || []) {
          const c = (e.competitions || [])[0] || {}, o = (c.odds || [])[0];
          if (!o || o.overUnder == null) continue;
          const tms = (c.competitors || []).map(x => (x.team || {}).abbreviation).filter(Boolean);
          if (tms.length !== 2) continue;
          const m = /^([A-Z]{2,4})\s+(-?\d+(?:\.\d+)?)/.exec(o.details || "");
          const fav = m ? m[1] : null, line = m ? Math.abs(+m[2]) : 0;
          for (const t of tms) (vegas[t] = vegas[t] || {})[w] = o.overUnder / 2 + (fav ? (t === fav ? line / 2 : -line / 2) : 0);
        }
      } catch (e) {}
    }));

    // A week that has been played and comes back empty is a failed fetch, not a quiet week.
    // Serving it would build every projection on part of the season (and the edge would cache
    // it), so fail instead: the page keeps its last good copy.
    for (let w = 1; w < firstWeek && w <= played; w++)
      if (!Array.isArray(weekly[w - 1]) || weekly[w - 1].length < 100) throw new Error("week " + w + " stats did not load");

    /* ---- scoring: the league is full PPR and Sleeper's pts_ppr matches it, with one exception.
       ESPN's settings are read for what an interception costs; Sleeper's number assumes -1. */
    const item = id => (((settings.settings || {}).scoringSettings || {}).scoringItems || []).find(x => x.statId === id);
    const recPts = (item(53) || {}).points, intPts = (item(20) || {}).points;
    const intAdj = intPts != null ? intPts - -1 : 0;

    /* ---- kickers and defences -------------------------------------------------------------
       Scored by the league's own ESPN rules (read from its settings), from Sleeper's raw stats.
       KD[key] = { pos, sid, name, tm, gs:[{w, opp, pts}] }; PF/PA are every team's points for
       and against by week, read off the defences' points-allowed lines. */
    const dItem = (id, dflt) => { const it = item(id); if (!it) return dflt; const o = (it.pointsOverrides || {})["16"]; return o != null ? o : it.points != null ? it.points : dflt; };
    const kItem = (id, dflt) => { const it = item(id); return it && it.points != null ? it.points : dflt; };
    const paPts = pa => (pa <= 0 ? dItem(89, 5) : pa <= 6 ? dItem(90, 4) : pa <= 13 ? dItem(91, 3) : pa <= 17 ? dItem(92, 1) : pa <= 27 ? 0 : pa <= 34 ? dItem(123, -1) : pa <= 45 ? dItem(124, -3) : dItem(125, -5));
    const yaPts = ya => (ya < 100 ? dItem(128, 5) : ya < 200 ? dItem(129, 3) : ya < 300 ? dItem(130, 2) : ya < 350 ? 0 : ya < 400 ? dItem(132, -1) : ya < 450 ? dItem(133, -3) : ya < 500 ? dItem(134, -5) : ya < 550 ? dItem(135, -6) : dItem(136, -7));
    const dstPts = s => (s.sack || 0) * dItem(99, 1) + (s.int || 0) * dItem(95, 2) + ((s.fum_rec || 0) + (s.def_st_fum_rec || 0)) * dItem(96, 2)
      + (s.blk_kick || 0) * dItem(97, 2) + (s.safe || 0) * dItem(98, 2) + ((s.def_td || 0) + (s.def_st_td || 0)) * dItem(103, 6)
      + (s.def_2pt || 0) * dItem(206, 2) + paPts(s.pts_allow || 0) + yaPts(s.yds_allow != null ? s.yds_allow : 325);
    const kPts = s => ((s.fgm_0_19 || 0) + (s.fgm_20_29 || 0) + (s.fgm_30_39 || 0)) * kItem(80, 3) + (s.fgm_40_49 || 0) * kItem(77, 4)
      + ((s.fgm_50_59 != null ? s.fgm_50_59 : s.fgm_50p || 0)) * kItem(198, 5) + (s.fgm_60p || 0) * kItem(201, 6)
      + (s.fgmiss || 0) * kItem(85, -1) + (s.xpm || 0) * kItem(86, 1) + (s.xpmiss || 0) * kItem(88, 0);
    const KD = {}, PA = {}, PF = {}, SKD = {};
    weekly.forEach((rows, i) => {
      const w = i + 1;
      for (const x of rows || []) {
        const s = x.stats, pl = x.player || {}, pos = pl.position, tm = fix(x.team), opp = fix(x.opponent);
        if (!s || !tm || !opp || (pos !== "K" && pos !== "DEF")) continue;
        if (pos === "DEF") {
          if (s.pts_allow == null) continue;
          (PA[tm] = PA[tm] || {})[w] = s.pts_allow; (PF[opp] = PF[opp] || {})[w] = s.pts_allow;
          (SKD[tm] = SKD[tm] || {})[w] = { s: s.sack || 0, opp };
          const u = (KD["DST|" + tm] = KD["DST|" + tm] || { pos: "DST", sid: x.player_id, name: (pl.last_name || tm) + " D/ST", tm, gs: [] });
          u.gs.push({ w, opp, pts: dstPts(s) });
        } else {
          if (!s.fga && !s.xpa) continue;
          const u = (KD["K|" + x.player_id] = KD["K|" + x.player_id] || { pos: "K", sid: x.player_id, name: ((pl.first_name || "") + " " + (pl.last_name || "")).trim(), gs: [] });
          u.tm = fix(pl.team) || tm;
          u.gs.push({ w, opp, tm, pts: kPts(s), fga: s.fga || 0, fgm: s.fgm || 0, xpa: s.xpa || 0 });
        }
      }
    });

    const P = {};        // sleeper player id -> { name, pos, tm, gs: [game rows] }
    const TW = {};       // "TEAM|week" -> team totals that week
    const DVP = {};      // defence -> { QB,RB,WR,TE: points allowed, wk: Set }
    weekly.forEach((rows, i) => {
      const w = i + 1;
      for (const x of rows || []) {
        const s = x.stats, pl = x.player || {};
        const pos = pl.position;
        if (!s || !SKILL.includes(pos)) continue;
        const g = {
          w, tm: fix(x.team), opp: fix(x.opponent), pts: (s.pts_ppr || 0) + intAdj * (s.pass_int || 0),
          snp: s.off_snp || 0, tsnp: s.tm_off_snp || 0,
          tgt: s.rec_tgt || 0, air: s.rec_air_yd || 0, rzt: s.rec_rz_tgt || 0,
          rec: s.rec || 0, ryd: s.rec_yd || 0, yar: s.rec_yar || 0, rfd: s.rec_fd || 0,
          att: s.rush_att || 0, rza: s.rush_rz_att || 0,
          uyd: s.rush_yd || 0, yac: s.rush_yac || 0, btk: s.rush_btkl || 0, ufd: s.rush_fd || 0,
          patt: s.pass_att || 0, prz: s.pass_rz_att || 0,
          td: (s.rec_td || 0) + (s.rush_td || 0),
        };
        if (!g.snp && !g.tgt && !g.att && !g.patt) continue;   // didn't play
        const p = (P[x.player_id] = P[x.player_id] ||
          { sid: x.player_id, name: ((pl.first_name || "") + " " + (pl.last_name || "")).trim(), pos, gs: [] });
        p.tm = fix(pl.team) || g.tm;
        p.inj = SL_INJ[pl.injury_status] || "";
        p.gs.push(g);
        const tw = (TW[g.tm + "|" + w] = TW[g.tm + "|" + w] || { tgt: 0, air: 0, att: 0, rz: 0 });
        tw.tgt += g.tgt; tw.air += Math.max(0, g.air); tw.att += g.att; tw.rz += g.rzt + g.rza; tw.patt = (tw.patt || 0) + g.patt;
        if (g.opp) {
          const d = (DVP[g.opp] = DVP[g.opp] || { QB: 0, RB: 0, WR: 0, TE: 0, wk: new Set() });
          d[pos] += g.pts; d.wk.add(w);
        }
      }
    });
    if (Object.keys(P).length < 150) throw new Error("only " + Object.keys(P).length + " players with stats");

    // ---- expected points model, fitted on this season's player-games
    // columns: [carry, red-zone carry, target, red-zone target]; QB: [pass, rz pass, carry, rz carry]
    const DEF = { QB: [0.38, 0.9, 0.6, 1.5], RB: [0.6, 1.5, 1.5, 2.5], WR: [0.6, 1.5, 1.75, 2.9], TE: [0.6, 1.5, 1.6, 2.8] };
    const fit = { QB: [[], []], RB: [[], []], WR: [[], []], TE: [[], []] };
    for (const p of Object.values(P)) for (const g of p.gs) {
      if (p.pos === "QB") { if (g.patt < 10) continue; fit.QB[0].push([g.patt - g.prz, g.prz, g.att - g.rza, g.rza]); }
      else fit[p.pos][0].push([g.att - g.rza, g.rza, g.tgt - g.rzt, g.rzt]);
      fit[p.pos][1].push(g.pts);
    }
    const coef = {};
    for (const pos of SKILL) {
      const c = (fit[pos][0].length > 80 && ols(fit[pos][0], fit[pos][1])) || DEF[pos];
      // a thin column (wideout carries) can fit to nonsense; fall back to the default for it
      coef[pos] = c.map((v, i) => (v > 0 && v < 6 ? v : DEF[pos][i]));
    }
    // touchdowns from the same inputs (not QBs: passing scores are a different animal)
    const DEFTD = { RB: [0.012, 0.19, 0.012, 0.2], WR: [0.01, 0.15, 0.035, 0.24], TE: [0.01, 0.15, 0.03, 0.24] };
    const tdc = {};
    for (const pos of ["RB", "WR", "TE"]) {
      const rows = [];
      for (const p of Object.values(P)) if (p.pos === pos) for (const g of p.gs) rows.push(g.td);
      const c = (fit[pos][0].length > 80 && ols(fit[pos][0], rows)) || DEFTD[pos];
      tdc[pos] = c.map((v, i) => (v > 0 && v < 1 ? v : DEFTD[pos][i]));
    }
    const xtdOf = (pos, g) => {
      const c = tdc[pos];
      return c ? c[0] * (g.att - g.rza) + c[1] * g.rza + c[2] * (g.tgt - g.rzt) + c[3] * g.rzt : 0;
    };
    const xfpOf = (pos, g) => {
      const c = coef[pos];
      return pos === "QB"
        ? c[0] * (g.patt - g.prz) + c[1] * g.prz + c[2] * (g.att - g.rza) + c[3] * g.rza
        : c[0] * (g.att - g.rza) + c[1] * g.rza + c[2] * (g.tgt - g.rzt) + c[3] * g.rzt;
    };

    function agg(pos, gs) {
      const a = { pts: 0, x: 0, snp: 0, tsnp: 0, tgt: 0, ttgt: 0, air: 0, tair: 0, att: 0, tatt: 0, rz: 0, trz: 0,
        rec: 0, ryd: 0, yar: 0, fd: 0, uyd: 0, yac: 0, btk: 0, td: 0, xtd: 0 };
      for (const g of gs) {
        const tw = TW[g.tm + "|" + g.w] || {};
        a.pts += g.pts; a.x += xfpOf(pos, g); a.snp += g.snp; a.tsnp += g.tsnp;
        a.tgt += g.tgt; a.ttgt += tw.tgt || 0; a.air += Math.max(0, g.air); a.tair += tw.air || 0;
        a.att += g.att; a.tatt += tw.att || 0; a.rz += g.rzt + g.rza; a.trz += tw.rz || 0;
        a.rec += g.rec; a.ryd += g.ryd; a.yar += g.yar; a.fd += g.rfd + g.ufd;
        a.uyd += g.uyd; a.yac += g.yac; a.btk += g.btk; a.td += g.td; a.xtd += xtdOf(pos, g);
      }
      const n = gs.length || 1, ts = a.ttgt ? a.tgt / a.ttgt : 0, ays = a.tair ? a.air / a.tair : 0;
      // rate stats need a real sample behind them, or two carries read as 12 a pop
      const T = a.tgt >= 10, C = a.att >= 10;
      return {
        g: gs.length, ppg: a.pts / n, xfp: a.x / n, td: a.td, xtd: pos === "QB" ? null : a.xtd,
        snap: a.tsnp ? a.snp / a.tsnp : null, ts, ays, wopr: 1.5 * ts + 0.7 * ays,
doc: a.rec >= 8 ? a.air / a.rec : null, cs: a.tatt ? a.att / a.tatt : 0,
        rz: a.trz ? a.rz / a.trz : 0, tpg: a.tgt / n, apg: a.att / n,
        opp: (a.att + a.tgt) / n, rzg: a.rz / n, fdg: a.fd / n,
        tps: T && a.snp ? a.tgt / a.snp : null, cr: T ? a.rec / a.tgt : null,
        ypt: T ? a.ryd / a.tgt : null, yacr: T && a.rec ? a.yar / a.rec : null,
        ypc: C ? a.uyd / a.att : null, yaco: C ? a.yac / a.att : null, bt: C ? a.btk / a.att : null,
      };
    }

    /* ---- what a ROLE is, by position, and when it has really changed -------------------------
       A role is a share of the offence, not a box score. Three quiet games on the same snaps and
       the same share of the ball is a cold stretch; it says nothing about the job.
         QB      the job is binary: he is the starter or he isn't, and only games he plays are
                 counted, so a starting quarterback's role never "shrinks". A dip in his snap
                 share is a game he left hurt, which the injury status already covers. No shift.
         RB      his share of the team's carries and targets, each priced by what the xFP model
                 says a carry and a target are worth to a back, on a league-average workload
         WR, TE  the same, where targets do nearly all the work
       A role CHANGE needs two witnesses: the share of the ball moved AND the playing time moved
       the same way. The change is the smaller of the two, last three games against everything
       before them. A receiver who ran every route but drew fewer targets has not lost his role;
       a quarterback who took every snap in three bad games has not either. */
    let la = 0, lt = 0, ln = 0;
    for (const tw of Object.values(TW)) { la += tw.att; lt += tw.tgt; ln++; }
    const LG = { att: ln ? la / ln : 26, tgt: ln ? lt / ln : 33 };      // league-average carries and targets a team-game
    const roleIdx = (pos, A) => coef[pos][0] * LG.att * A.cs + coef[pos][2] * LG.tgt * A.ts;
    const rel = (a, b) => (b > 0 ? a / b - 1 : 0);
    const shiftOf = p => {
      if (p.gs.length < 5) return 0;                                    // need three recent games and at least two before
      const B = agg(p.pos, p.gs.slice(0, -3)), R = p.R;
      if (p.pos === "QB") return 0;
      const snap = rel(R.snap || 0, B.snap || 0);
      const opp = rel(roleIdx(p.pos, R), roleIdx(p.pos, B));
      return Math.sign(opp) === Math.sign(snap) ? Math.sign(opp) * Math.min(Math.abs(opp), Math.abs(snap)) : 0;
    };

    // ---- season + last-three lines for everyone, and position ranks across the NFL
    const minG = Math.max(2, Math.floor(played * 0.4));
    const byKey = {}, byName = {};
    for (const p of Object.values(P)) {
      p.gs.sort((a, b) => a.w - b.w);
      p.S = agg(p.pos, p.gs);
      p.R = agg(p.pos, p.gs.slice(-3));
      p.shift = Math.max(-1, Math.min(2, shiftOf(p)));
      const k = norm(p.name);
      // two players can share a name; keep the one who has played more
      if (!byKey[k + "|" + p.pos] || byKey[k + "|" + p.pos].S.g < p.S.g) byKey[k + "|" + p.pos] = p;
      if (!byName[k] || byName[k].S.g < p.S.g) byName[k] = p;
    }
    for (const pos of SKILL) {
      const pool = Object.values(P).filter(p => p.pos === pos && p.S.g >= minG);
      pool.slice().sort((a, b) => b.S.ppg - a.S.ppg).forEach((p, i) => (p.prk = i + 1));
      pool.slice().sort((a, b) => b.S.xfp - a.S.xfp).forEach((p, i) => (p.xrk = i + 1));
    }

    // ---- defence vs position: points allowed per game, as a multiplier and a 1-32 rank
    // rank follows ESPN's convention: 1 = stingiest, 32 = gives up the most
    const dvp = {};
    for (const pos of SKILL) {
      const list = Object.entries(DVP).filter(([, d]) => d.wk.size)
        .map(([tm, d]) => ({ tm, v: d[pos] / d.wk.size }));
      const avg = list.reduce((s, x) => s + x.v, 0) / (list.length || 1);
      list.sort((a, b) => a.v - b.v).forEach((x, i) => {
        // half the gap to average: nine-odd games of points allowed is a noisy sample
        const m = Math.max(0.8, Math.min(1.2, 1 + 0.5 * (x.v / avg - 1)));
        (dvp[x.tm] = dvp[x.tm] || {})[pos] = { m, rk: i + 1, v: x.v };
      });
    }

    /* ---- kicker and defence projections ---------------------------------------------------
       What the research on streaming agrees on: a defence's week is mostly its OPPONENT (how
       few points that offence scores and how many sacks and turnovers it gives up), and a
       kicker's is mostly how many points his team is expected to score. There are no free
       rest-of-season betting lines, so both are built from this season's results:
         DST   own = the unit's points a game;  matchup = points a game the opponent has given
               up to defences
         K     own = the kicker's points a game;  matchup = his team's expected points that
               week = its scoring average + what the opponent allows - the league average
       Projection = league average + b1 x (own - average) + b2 x (matchup - average), with b1
       and b2 fitted on this season's games, each game predicted from the OTHER games only
       (so a result never predicts itself). Small samples shrink the weights by themselves. */
    const mean = a => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
    const loo = (arr, w) => { const o = arr.filter(g => g.w !== w); return o.length ? mean(o.map(g => g.pts)) : null; };
    const tmAvg = (M, tm, skip) => { const v = Object.entries(M[tm] || {}).filter(([w]) => +w !== skip).map(([, p]) => p); return v.length ? mean(v) : null; };
    const lgPts = mean(Object.values(PF).flatMap(m => Object.values(m)));
    /* ---- the inputs Hayden Winks charts each week (Yahoo, data from nflfastR) ------------------
       Defences: the opponent's Vegas implied points against a projected sack rate, which he
       defines as 67% the opponent offence's sack rate + 33% the defence's own, last 8 games.
       Kickers: the team's Vegas implied points against its field-goal attempts a game.
       Here: sack rate = sacks / dropbacks (pass attempts + sacks) over each side's last 8 games;
       implied points = the betting line where ESPN has one, otherwise the team's scoring average
       + what the opponent allows - the league average. */
    const recent = m => Object.keys(m || {}).map(Number).sort((a, b) => b - a).slice(0, 8);
    const defSack = {}, offSack = {}, taken = {};
    for (const [tm, m] of Object.entries(SKD)) for (const [w, x] of Object.entries(m)) (taken[x.opp] = taken[x.opp] || {})[w] = x.s;
    for (const tm of Object.keys(SKD)) {
      let s = 0, db = 0;
      for (const w of recent(SKD[tm])) { const x = SKD[tm][w]; s += x.s; db += ((TW[x.opp + "|" + w] || {}).patt || 0) + x.s; }
      defSack[tm] = db ? s / db : null;
    }
    for (const tm of Object.keys(taken)) {
      let s = 0, db = 0;
      for (const w of recent(taken[tm])) { s += taken[tm][w]; db += ((TW[tm + "|" + w] || {}).patt || 0) + taken[tm][w]; }
      offSack[tm] = db ? s / db : null;
    }
    const lgSack = mean(Object.values(defSack).filter(x => x != null));
    const projSack = (def, off) => 0.67 * (offSack[off] != null ? offSack[off] : lgSack) + 0.33 * (defSack[def] != null ? defSack[def] : lgSack);
    const teamAvg = (M, tm) => { const v = Object.values(M[tm] || {}); return v.length ? mean(v) : null; };
    const lgAll = mean(Object.values(PF).flatMap(m => Object.values(m)));
    const implied = (tm, opp, w) => {
      if ((vegas[tm] || {})[w] != null) return { v: vegas[tm][w], vg: 1 };
      const off = teamAvg(PF, tm), def = teamAvg(PA, opp);
      return { v: (off != null ? off : lgAll) + (def != null ? def : lgAll) - lgAll, vg: 0 };
    };

    const kdModel = {};
    for (const pos of ["DST", "K"]) {
      const units = Object.values(KD).filter(u => u.pos === pos && u.gs.length);
      const lg = mean(units.flatMap(u => u.gs.map(g => g.pts)));
      // points a game each team has given up to this position
      const given = {};
      for (const u of units) for (const g of u.gs) (given[g.opp] = given[g.opp] || []).push({ w: g.w, pts: g.pts });
      const match = (tm, opp, skip) => {
        if (pos === "DST") { const a = (given[opp] || []).filter(g => g.w !== skip); return a.length ? mean(a.map(g => g.pts)) : lg; }
        const off = tmAvg(PF, tm, skip), def = tmAvg(PA, opp, skip);
        return (off != null ? off : lgPts) + (def != null ? def : lgPts) - lgPts;
      };
      const lgM = pos === "DST" ? lg : lgPts;
      const X = [], y = [];
      for (const u of units) for (const g of u.gs) {
        const own = loo(u.gs, g.w);
        if (own == null) continue;
        X.push([own - lg, match(g.tm || u.tm, g.opp, g.w) - lgM]); y.push(g.pts - lg);
      }
      /* One season of games is a noisy sample (kickers above all), so the fit is blended with
         what published multi-season studies found, counted as PRIOR_N games' worth: defences
         about a quarter own form and half matchup; kickers about 0.3 own form and 0.2 points
         per point of team total (4for4's implied-total buckets: ~5.9 to ~9.2 kicker points
         across the range). As the season adds games the data outweighs the prior. */
      const prior = pos === "DST" ? [0.25, 0.5] : [0.3, 0.2], PRIOR_N = 300;
      const fit = X.length > 80 ? ols(X, y) : null;
      const b = prior.map((p0, i) => { const f = fit && fit[i] >= -0.5 && fit[i] <= 1.5 ? fit[i] : null;
        return f == null ? p0 : Math.max(0, (X.length * f + PRIOR_N * p0) / (X.length + PRIOR_N)); });
      kdModel[pos] = { lg: r1(lg), own: r3(b[0]), match: r3(b[1]), n: X.length, fit: fit ? fit.map(r3) : null };
      // how soft each opponent is for this position, 1 = stingiest, 32 = softest
      const soft = Object.keys(games).map(id => TEAM[id]).filter(Boolean).map(tm => ({ tm, v: pos === "DST" ? match(null, tm) : (tmAvg(PA, tm) != null ? tmAvg(PA, tm) : lgPts) }))
        .sort((a, b2) => a.v - b2.v);
      const softRk = Object.fromEntries(soft.map((x, i) => [x.tm, i + 1]));
      for (const u of units) {
        u.ppg = mean(u.gs.map(g => g.pts));
        u.wk = weeks.map(w => {
          const g = (games[TEAM_ID[u.tm]] || {})[w];
          if (!g) return { w, o: "BYE", p: 0 };
          const opp = TEAM[g.opp];
          const x = { w, o: (g.home ? "" : "@") + opp, rk: softRk[opp] || null, p: r1(Math.max(0, lg + b[0] * (u.ppg - lg) + b[1] * (match(u.tm, opp) - lgM))) };
          if (pos === "DST") { const i = implied(opp, u.tm, w); x.sr = r3(projSack(u.tm, opp)); x.oi = r1(i.v); x.vg = i.vg; }
          else { const i = implied(u.tm, opp, w); x.it = r1(i.v); x.vg = i.vg; }
          return x;
        });
        const live = u.wk.filter(x => x.o !== "BYE");
        // rest-of-season averages of those inputs
        if (pos === "DST") { u.sr = live.length ? mean(live.map(x => x.sr)) : null; u.oip = live.length ? mean(live.map(x => x.oi)) : null; }
        else u.ip = live.length ? mean(live.map(x => x.it)) : null;
        u.base = live.length ? mean(live.map(x => x.p)) : u.ppg;
        u.pl = Array(played).fill(null); for (const g of u.gs) u.pl[g.w - 1] = r1(g.pts);
        u.last = Math.max(...u.gs.map(g => g.w));
      }
    }
    const kdOf = (pos, name, proTeamId) => (pos === "DST" ? KD["DST|" + TEAM[proTeamId]]
      : Object.values(KD).find(u => u.pos === "K" && norm(u.name) === norm(name)) || null);
    const kdBlock = u => {
      const b = { g: u.gs.length, ppg: r1(u.ppg), pl: u.pl, base: r1(u.base), wk: u.wk };
      if (u.pos !== "K") return Object.assign(b, { sr: r3(u.sr), oip: r1(u.oip), dsk: r3(defSack[u.tm]) });
      b.ip = r1(u.ip);
      // field-goal attempts a game and accuracy are his; team points and game totals are the
      // scoring environment he kicks in (his team's games this season)
      const fga = u.gs.reduce((s, g) => s + g.fga, 0), fgm = u.gs.reduce((s, g) => s + g.fgm, 0);
      const tg = Object.keys(PF[u.tm] || {});
      return Object.assign(b, { fga: r1(fga / u.gs.length), fgp: fga ? r3(fgm / fga) : null, xpa: r1(u.gs.reduce((s, g) => s + g.xpa, 0) / u.gs.length),
        tpg: tg.length ? r1(mean(tg.map(w => PF[u.tm][w]))) : null, gt: tg.length ? r1(mean(tg.map(w => PF[u.tm][w] + ((PA[u.tm] || {})[w] || 0)))) : null });
    };

    // the rate everything is projected from: half usage (xFP), half production, on the SEASON.
    // The last three games only get a say when the role itself moved - up to 60% of the weight
    // once it has moved by a quarter or more. A cold stretch in the same role changes nothing.
    const baseOf = (sp, fallback) => {
      if (!sp || !sp.S.g) return fallback || 0;
      const S = sp.S, R = sp.R, lean = 0.6 * Math.min(1, Math.abs(sp.shift || 0) / 0.25);
      return 0.5 * (lean * R.xfp + (1 - lean) * S.xfp) + 0.5 * (lean * R.ppg + (1 - lean) * S.ppg);
    };
    // healthy projection for each remaining week; the page applies injuries
    const slate = (proTeamId, pos, base) => weeks.map(w => {
      const g = (games[proTeamId] || {})[w];
      if (!g) return { w, o: "BYE", p: 0 };
      const d = (dvp[TEAM[g.opp]] || {})[pos];
      return { w, o: (g.home ? "" : "@") + TEAM[g.opp], rk: d ? d.rk : null, p: r1(base * (d ? d.m : 1)) };
    });
    const statBlock = sp => {
      const S = sp.S, R = sp.R, pl = Array(played).fill(null);
      for (const g of sp.gs) pl[g.w - 1] = r1(g.pts);
      // how stingy the defences he has already played were against his position (1 = toughest)
      const faced = sp.gs.map(g => ((dvp[g.opp] || {})[sp.pos] || {}).rk).filter(x => x != null);
      return {
        td: S.td, xtd: r1(S.xtd), fsos: faced.length ? r1(faced.reduce((a, b) => a + b, 0) / faced.length) : null,
        g: S.g, ppg: r1(S.ppg), xfp: r1(S.xfp), fpoe: r1(S.ppg - S.xfp),
        snap: r3(S.snap), ts: r3(S.ts), ays: r3(S.ays), wopr: r3(S.wopr), doc: r1(S.doc),
        cs: r3(S.cs), rz: r3(S.rz), tpg: r1(S.tpg), apg: r1(S.apg),
        opp: r1(S.opp), rzg: r1(S.rzg), fdg: r1(S.fdg),
        tps: r3(S.tps), cr: r3(S.cr), ypt: r1(S.ypt), yacr: r1(S.yacr),
        ypc: r1(S.ypc), yaco: r1(S.yaco), bt: r3(S.bt),
        prk: sp.prk || null, xrk: sp.xrk || null, pl, rs: r3(sp.shift || 0),
        l3: { ppg: r1(R.ppg), xfp: r1(R.xfp), snap: r3(R.snap), ts: r3(R.ts), cs: r3(R.cs), td: R.td, xtd: r1(R.xtd) },
      };
    };

    const missed = (sp, proTeamId) => {
      if (!sp) return null;
      const has = new Set(sp.gs.map(g => g.w)); let n = 0;
      for (let w = played; w >= 1; w--) {
        const g = (games[proTeamId] || {})[w];
        if (!g || g.date > now) continue;
        if (has.has(w)) break;
        n++;
      }
      return n;
    };

    // ---- league rosters
    const seasonRow = stats => (stats || []).find(s =>
      s.seasonId === SEASON && s.statSourceId === 0 && s.statSplitTypeId === 0 && s.scoringPeriodId === 0);
    const info = {};
    for (const t of teamsInfo.teams || []) info[t.id] = t;

    const players = {}, teams = [], used = new Set();
    for (const t of roster.teams || []) {
      const ti = info[t.id] || {}, ov = (ti.record || {}).overall || {};
      const ids = [];
      for (const e of (t.roster && t.roster.entries) || []) {
        const pl = (e.playerPoolEntry || {}).player || {};
        const pos = POS[pl.defaultPositionId];
        if (!pos || !pl.id) continue;
        const sr = seasonRow(pl.stats) || {};
        const inj = e.lineupSlotId === 21 ? "IR" : (ESPN_INJ[pl.injuryStatus] || "");
        const sp = pos === "K" || pos === "DST" ? null : (byKey[norm(pl.fullName) + "|" + pos] || byName[norm(pl.fullName)]);
        if (sp) used.add(sp);
        const base = baseOf(sp, sr.appliedAverage);
        players[pl.id] = {
          id: String(pl.id), n: pl.fullName, pos, tm: TEAM[pl.proTeamId] || "FA", inj, t: t.id,
          ret: backWeek(retById[pl.id] != null ? retById[pl.id] : retByName[norm(pl.fullName)], pl.proTeamId),
          miss: missed(sp, pl.proTeamId),
          espn: r1(sr.appliedAverage), base: r1(base), wk: slate(pl.proTeamId, pos, base),
          ...(sp && sp.S.g ? statBlock(sp) : {}),
        };
        if (pos === "K" || pos === "DST") {
          const u = kdOf(pos, pl.fullName, pl.proTeamId);
          if (u && u.wk) { u.used = true; Object.assign(players[pl.id], kdBlock(u)); }
        }
        ids.push(String(pl.id));
      }
      teams.push({
        id: t.id, name: ti.name || ((ti.location || "") + " " + (ti.nickname || "")).trim() || "Team " + t.id,
        abbrev: ti.abbrev || "", logo: /^https:\/\//.test(ti.logo || "") ? ti.logo : null,
        w: ov.wins || 0, l: ov.losses || 0, pf: r1(ov.pointsFor), players: ids,
      });
    }
    if (!teams.some(t => t.id === MY_TEAM)) throw new Error("team " + MY_TEAM + " not in league payload");

    // ---- the best of who is NOT on a roster, so the player table covers the whole pool
    for (const pos of SKILL) {
      Object.values(P).filter(p => p.pos === pos && !used.has(p) && p.S.g >= 2)
        .sort((a, b) => Math.max(b.S.xfp, b.S.ppg) - Math.max(a.S.xfp, a.S.ppg))
        .slice(0, POOL[pos]).forEach(p => {
          const base = baseOf(p);
          players["s" + p.sid] = {
            id: "s" + p.sid, sid: p.sid, n: p.name, pos, tm: p.tm || "FA", inj: p.inj || "", t: 0,
            ret: backWeek(retByName[norm(p.name)], TEAM_ID[p.tm]), miss: missed(p, TEAM_ID[p.tm]),
            base: r1(base), wk: slate(TEAM_ID[p.tm], pos, base), ...statBlock(p),
          };
        });
    }

    // ---- every kicker and defence nobody has: defences all of them, kickers who kicked lately
    for (const u of Object.values(KD)) {
      if (u.used || !u.wk || !TEAM_ID[u.tm]) continue;
      if (u.pos === "K" && u.last < played - 2) continue;
      players["s" + u.sid] = { id: "s" + u.sid, sid: u.sid, n: u.name, pos: u.pos, tm: u.tm, inj: "", t: 0, ret: null, miss: 0, ...kdBlock(u) };
    }

    // ---- my fantasy schedule: who I play in each remaining regular-season week
    const regWeeks = (((settings.settings || {}).scheduleSettings || {}).matchupPeriodCount) || 14;
    const opps = {}, lgSched = {};   // lgSched: every regular-season game left, for the standings odds
    for (const m of (matchups && matchups.schedule) || []) {
      const w = m.matchupPeriodId, hm = (m.home || {}).teamId, aw = (m.away || {}).teamId;
      if (w >= firstWeek && w <= regWeeks && hm && aw) (lgSched[w] = lgSched[w] || []).push([hm, aw]);
      if (w < firstWeek || w > regWeeks || (hm !== MY_TEAM && aw !== MY_TEAM)) continue;
      const o = hm === MY_TEAM ? aw : hm;
      if (o) opps[w] = o;
    }

    const counts = ((settings.settings || {}).rosterSettings || {}).lineupSlotCounts || {};
    const slots = {};
    for (const [id, name] of Object.entries(SLOT)) slots[name] = counts[id] || 0;

    // ---- FAAB: the league budget and what every team has left to spend
    const acq = (settings.settings || {}).acquisitionSettings || {};
    /* Every waiver bid this season, oldest first: who, which week, how much, and whether it won.
       A bid that lost to a higher one (FAILED_INVALIDPLAYERSOURCE) still shows what the team was
       willing to pay, so it is kept. Cancelled and blocked claims are not. */
    const nameOf = {};
    for (const x of Array.isArray(espnNames) ? espnNames : []) if (x && x.id) nameOf[x.id] = x.fullName;
    const seen = new Set(), hist = [];
    for (const wk of txWeeks) for (const x of (wk && wk.transactions) || []) {
      if (x.type !== "WAIVER" || x.bidAmount == null || seen.has(x.id)) continue;
      if (x.status !== "EXECUTED" && x.status !== "FAILED_INVALIDPLAYERSOURCE") continue;
      seen.add(x.id);
      const add = (x.items || []).find(i => i.type === "ADD") || {};
      hist.push({ t: x.teamId, w: x.scoringPeriodId, a: x.bidAmount, won: x.status === "EXECUTED" ? 1 : 0,
        n: nameOf[add.playerId] || (players[add.playerId] || {}).n || null, d: x.processDate || x.proposedDate || 0 });
    }
    hist.sort((a, b) => a.d - b.d);
    for (const x of hist) delete x.d;
    const faab = acq.isUsingAcquisitionBudget ? {
      budget: acq.acquisitionBudget || 0, min: acq.minimumBid != null ? acq.minimumBid : 1,
      left: Object.fromEntries(teams.map(t => [t.id,
        Math.max(0, (acq.acquisitionBudget || 0) - (((info[t.id] || {}).transactionCounter || {}).acquisitionBudgetSpent || 0))])),
      hist,
    } : null;

    // ---- expert notes: every recent piece by either analyst, and which of our players it names
    const items = [], byUri = {};
    AUTHORS.forEach(([who], i) => {
      if (!authorPages[i]) return;
      for (const it of authorItems(authorPages[i])) {
        if (byUri[it.uri]) { if (!byUri[it.uri].a.includes(who)) byUri[it.uri].a.push(who); continue; }
        const x = { a: [who], t: it.t, u: YAHOO + it.uri, k: it.k, tags: [] };
        byUri[it.uri] = x; items.push(x);
      }
    });
    // the waiver shows publish a tag for each player they cover; read the latest two
    const shows = items.filter(x => x.k === "article" && isWaiver(x.t + " " + slugText(x.u))).slice(0, 2);
    await Promise.all(shows.map(async x => {
      try {
        const h = await getText(x.u), m = /"othertags":\[([^\]]*)\]/.exec(h);
        if (m) x.tags = JSON.parse("[" + m[1] + "]").filter(s => typeof s === "string");
        const d = /"datePublished":"([^"]+)"/.exec(h);
        if (d) x.d = d[1];
      } catch (e) {}
    }));
    const names = Object.values(players).filter(p => SKILL.includes(p.pos)).map(p => {
      const k = norm(p.n).replace(/[^a-z0-9 ]/g, "");
      return { id: p.id, re: new RegExp("(^| )" + k + "s?( |$)") };
    });
    for (const x of items) {
      const txt = norm(slugText(x.u) + " " + x.tags.join(" ")).replace(/[^a-z0-9 ]/g, " ");
      x.ids = names.filter(n => n.re.test(txt)).map(n => n.id);
      x.wv = isWaiver(x.t + " " + slugText(x.u));
    }
    // a clip cut from the waiver show doesn't say so in its title, only in its description
    // ("...is a waiver wire option entering Week 10"), so read the clips that name a free agent
    const clips = items.filter(x => x.k === "video" && !x.wv && x.ids.some(id => !players[id].t)).slice(0, 12);
    await Promise.all(clips.map(async x => {
      try {
        const h = await getText(x.u);
        const desc = (/"description":"([^"]*)"/.exec(h) || [])[1] || "";
        if (/waiver/i.test(desc)) x.wv = true;
        const d = /"uploadDate":"([^"]+)"/.exec(h);
        if (d) x.d = d[1];
      } catch (e) {}
    }));
    // How the notes are used: a free agent named in a waiver piece is one the analysts think has
    // a new role the season numbers haven't caught up with (a starter hurt, a depth chart flip).
    // So he is projected on his last three games alone instead of the season blend - only ever
    // upward - and that feeds his lineup value and FAAB bid like anyone else's. `xp` names who.
    let picks = 0;
    for (const x of items) if (x.wv) for (const id of x.ids) {
      const pl = players[id];
      if (!pl || pl.t) continue;
      const sp = P[pl.sid];
      if (!pl.xp) { pl.xp = []; picks++; }
      for (const a of x.a) if (!pl.xp.includes(a)) pl.xp.push(a);
      if (!sp || !sp.R.g || pl.xpRole) continue;
      const recent = 0.5 * sp.R.xfp + 0.5 * sp.R.ppg;
      if (recent > (pl.base || 0)) { pl.base = r1(recent); pl.wk = slate(TEAM_ID[pl.tm], pl.pos, recent); pl.xpRole = true; }
    }
    const experts = { ok: Object.fromEntries(AUTHORS.map(([who], i) => [who, !!authorPages[i]])), picks };

    /* ---- ESPN's projections replace the model's, wherever ESPN has one ------------------------
       Each remaining week takes ESPN's projected points. A week ESPN projects at zero (out, or
       not expected to play) is flagged `z` and carries the player's average for the weeks he
       does play, so the page can show him at zero by default and still answer "what if he's
       healthy" when I overrule it. `base` becomes that average; `own` keeps the model's number
       for reference. The model stays as the fallback for anyone ESPN doesn't cover. */
    const eIdx = {}, eDst = {};
    for (const m of espnProj) for (const [id, x] of Object.entries(m || {})) {
      if (x.pos === "DST") eDst[TEAM[x.tm]] = id; else if (x.n) eIdx[norm(x.n) + "|" + x.pos] = id;
    }
    let espnN = 0;
    for (const pl of Object.values(players)) {
      const eid = pl.t ? pl.id : pl.pos === "DST" ? eDst[pl.tm] : eIdx[norm(pl.n) + "|" + pl.pos];
      if (eid == null) continue;
      const vals = weeks.map((w, i) => (espnProj[i] && espnProj[i][eid] ? espnProj[i][eid].v : null));
      if (vals.every(v => v == null)) continue;
      const plays = vals.filter(v => v > 0);
      const healthy = plays.length ? mean(plays) : pl.base || 0;
      pl.wk = pl.wk.map((x, i) => {
        if (x.o === "BYE") return x;
        const v = vals[i];
        return v > 0 ? { ...x, p: r1(v) } : v === 0 ? { ...x, p: r1(healthy), z: 1 } : { ...x, p: r1(healthy) };
      });
      pl.own = pl.base; pl.base = r1(healthy); pl.ep = 1; delete pl.xpRole;
      espnN++;
    }

    res.status(200).json({
      pulled: new Date().toISOString(), season: SEASON, me: MY_TEAM,
      through: played, minG, weeks, playoffs: [15, 16, 17], slots,
      scoring: { rec: recPts != null ? recPts : null, int: intPts != null ? intPts : null },
      sched: lgSched, playoffTeams: (((settings.settings || {}).scheduleSettings || {}).playoffTeamCount) || 6,
      opps, kd: kdModel, vegasWeeks: [...new Set(Object.values(vegas).flatMap(m => Object.keys(m).map(Number)))].sort((a, b) => a - b), proj: { src: espnN ? "espn" : "model", players: espnN, weeks: espnProj.filter(Boolean).length },
      deadline: ((settings.settings || {}).tradeSettings || {}).deadlineDate || null,
      // first and last kickoff of each week ahead: which weeks are over before the trade deadline
      weekTimes: Object.fromEntries(weeks.filter(w => weekDates[w]).map(w => [w, [Math.min(...weekDates[w]), Math.max(...weekDates[w])]])),
      model: Object.fromEntries(SKILL.map(p => [p, coef[p].map(r3)])), tdModel: Object.fromEntries(Object.entries(tdc).map(([p, c]) => [p, c.map(r3)])),
      teams, players, faab, experts,
    });
  } catch (e) {
    res.setHeader("Cache-Control", "no-store");
    res.status(502).json({ source: "trade", error: String(e.message || e) });
  }
}
