// Trade analyzer data: one trimmed, edge-cached payload for trade.html.
//
// READ-ONLY. Nothing here writes to ESPN. League rosters come through the GFL dashboard's
// existing ESPN proxy (the league is private and that proxy already holds the login), so this
// project needs no ESPN credentials of its own.
//
// What it assembles for every rostered player in the league:
//   - usage from Sleeper's weekly stat feed: snap share, target share, air-yard share, WOPR,
//     aDOT, carry share, red-zone share - season and last three games
//   - expected fantasy points (xFP): a usage model fitted on this season's own player-games,
//     pricing carries, red-zone carries, targets, red-zone targets and air yards. Scored minus
//     expected (FPOE) is the efficiency read: who is running hot or cold on their workload
//   - defence-vs-position for every NFL defence, built from the same feed
//   - a projection for each remaining week through 17: blended usage/production rate, scaled
//     by that week's opponent, zero on a bye, discounted for injury status
// The page does the roster-need and trade-package maths on top of this.

const MY_TEAM = 10;          // The Bryan Football Team
const SEASON = 2026;
const LAST_WEEK = 17;        // league playoffs are weeks 15-17
const GFL = "https://gfl-dashboard.vercel.app/api/espn";
const ESPN_SCHED = `https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/${SEASON}?view=proTeamSchedules_wl`;
const SLEEPER = "https://api.sleeper.app";
const SKILL = "position[]=QB&position[]=RB&position[]=WR&position[]=TE";

const POS = { 1: "QB", 2: "RB", 3: "WR", 4: "TE", 5: "K", 16: "DST" };
const TEAM = { 0:"FA",1:"ATL",2:"BUF",3:"CHI",4:"CIN",5:"CLE",6:"DAL",7:"DEN",8:"DET",9:"GB",
  10:"TEN",11:"IND",12:"KC",13:"LV",14:"LAR",15:"MIA",16:"MIN",17:"NE",18:"NO",19:"NYG",
  20:"NYJ",21:"PHI",22:"ARI",23:"PIT",24:"LAC",25:"SF",26:"SEA",27:"TB",28:"WSH",29:"CAR",
  30:"JAX",33:"BAL",34:"HOU" };
// Sleeper abbreviations that differ from ESPN's
const FIX = { WAS: "WSH", JAC: "JAX", LA: "LAR", OAK: "LV", SD: "LAC", HST: "HOU", BLT: "BAL", CLV: "CLE", ARZ: "ARI" };
const fix = t => (t ? (FIX[t] || t) : "");
// ESPN lineup slot ids -> the names the page uses
const SLOT = { 0: "QB", 2: "RB", 4: "WR", 6: "TE", 23: "FLEX", 17: "K", 16: "DST" };

const norm = s => String(s || "").toLowerCase().replace(/[.'’]/g, "").replace(/-/g, " ")
  .replace(/\s+(jr|sr|ii|iii|iv|v)$/, "").replace(/\s+/g, " ").trim();
const r1 = x => (x == null || !isFinite(x) ? null : Math.round(x * 10) / 10);
const r3 = x => (x == null || !isFinite(x) ? null : Math.round(x * 1000) / 1000);

async function getJSON(url) {
  const r = await fetch(url, { headers: { "User-Agent": "adp-board/1.0", Accept: "application/json" } });
  if (!r.ok) throw new Error(url.split("?")[0].split("/").slice(2, 4).join("/") + " returned " + r.status);
  return r.json();
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
    const [state, sched, roster, teamsInfo, settings] = await Promise.all([
      getJSON(`${SLEEPER}/v1/state/nfl`),
      getJSON(ESPN_SCHED),
      getJSON(`${GFL}?view=mRoster&seasonId=${SEASON}`),
      getJSON(`${GFL}?view=mTeam&seasonId=${SEASON}`),
      getJSON(`${GFL}?view=mSettings&seasonId=${SEASON}`),
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

    // ---- Sleeper weekly stats, every week played so far
    const played = Math.max(1, Math.min(18, Math.min(+state.week || 1, firstWeek)));
    const weekly = await Promise.all(
      Array.from({ length: played }, (_, i) =>
        getJSON(`${SLEEPER}/stats/nfl/${SEASON}/${i + 1}?season_type=regular&${SKILL}`).catch(() => []))
    );

    const P = {};        // sleeper player id -> { name, pos, tm, gs: [game rows] }
    const TW = {};       // "TEAM|week" -> team totals that week
    const DVP = {};      // defence -> { QB,RB,WR,TE: points allowed, wk: Set }
    weekly.forEach((rows, i) => {
      const w = i + 1;
      for (const x of rows || []) {
        const s = x.stats, pl = x.player || {};
        const pos = pl.position;
        if (!s || !["QB", "RB", "WR", "TE"].includes(pos)) continue;
        const g = {
          w, tm: fix(x.team), opp: fix(x.opponent), pts: s.pts_ppr || 0,
          snp: s.off_snp || 0, tsnp: s.tm_off_snp || 0,
          tgt: s.rec_tgt || 0, air: s.rec_air_yd || 0, rzt: s.rec_rz_tgt || 0,
          att: s.rush_att || 0, rza: s.rush_rz_att || 0,
          patt: s.pass_att || 0, prz: s.pass_rz_att || 0,
        };
        if (!g.snp && !g.tgt && !g.att && !g.patt) continue;   // didn't play
        const p = (P[x.player_id] = P[x.player_id] ||
          { name: ((pl.first_name || "") + " " + (pl.last_name || "")).trim(), pos, gs: [] });
        p.tm = g.tm; p.gs.push(g);
        const tw = (TW[g.tm + "|" + w] = TW[g.tm + "|" + w] || { tgt: 0, air: 0, att: 0, rz: 0 });
        tw.tgt += g.tgt; tw.air += Math.max(0, g.air); tw.att += g.att; tw.rz += g.rzt + g.rza;
        if (g.opp) {
          const d = (DVP[g.opp] = DVP[g.opp] || { QB: 0, RB: 0, WR: 0, TE: 0, wk: new Set() });
          d[pos] += g.pts; d.wk.add(w);
        }
      }
    });
    if (Object.keys(P).length < 150) throw new Error("only " + Object.keys(P).length + " players with stats");

    // ---- expected points model, fitted on this season's player-games
    const sx = [], sy = [], qx = [], qy = [];
    for (const p of Object.values(P)) for (const g of p.gs) {
      if (p.pos === "QB") { if (g.patt >= 10) { qx.push([g.patt - g.prz, g.prz, g.att - g.rza, g.rza]); qy.push(g.pts); } }
      else { sx.push([g.att - g.rza, g.rza, g.tgt - g.rzt, g.rzt, Math.max(0, g.air)]); sy.push(g.pts); }
    }
    const cS = (sx.length > 400 && ols(sx, sy)) || [0.55, 1.3, 1.35, 2.2, 0.03];
    const cQ = (qx.length > 80 && ols(qx, qy)) || [0.38, 0.9, 0.6, 1.5];
    const xfpOf = (pos, g) => pos === "QB"
      ? cQ[0] * (g.patt - g.prz) + cQ[1] * g.prz + cQ[2] * (g.att - g.rza) + cQ[3] * g.rza
      : cS[0] * (g.att - g.rza) + cS[1] * g.rza + cS[2] * (g.tgt - g.rzt) + cS[3] * g.rzt + cS[4] * Math.max(0, g.air);

    function agg(pos, gs) {
      const a = { g: gs.length, pts: 0, x: 0, snp: 0, tsnp: 0, tgt: 0, ttgt: 0, air: 0, tair: 0, att: 0, tatt: 0, rz: 0, trz: 0 };
      for (const g of gs) {
        const tw = TW[g.tm + "|" + g.w] || {};
        a.pts += g.pts; a.x += xfpOf(pos, g); a.snp += g.snp; a.tsnp += g.tsnp;
        a.tgt += g.tgt; a.ttgt += tw.tgt || 0; a.air += Math.max(0, g.air); a.tair += tw.air || 0;
        a.att += g.att; a.tatt += tw.att || 0; a.rz += g.rzt + g.rza; a.trz += tw.rz || 0;
      }
      const n = a.g || 1, ts = a.ttgt ? a.tgt / a.ttgt : 0, ays = a.tair ? a.air / a.tair : 0;
      return {
        g: a.g, ppg: a.pts / n, xfp: a.x / n,
        snap: a.tsnp ? a.snp / a.tsnp : null, ts, ays, wopr: 1.5 * ts + 0.7 * ays,
        adot: a.tgt ? a.air / a.tgt : null, cs: a.tatt ? a.att / a.tatt : 0,
        rz: a.trz ? a.rz / a.trz : 0, tpg: a.tgt / n, apg: a.att / n,
      };
    }

    // ---- season + last-three lines for everyone, and position ranks across the NFL
    const minG = Math.max(2, Math.floor(played * 0.4));
    const byKey = {}, byName = {};
    for (const [id, p] of Object.entries(P)) {
      p.gs.sort((a, b) => a.w - b.w);
      p.S = agg(p.pos, p.gs);
      p.R = agg(p.pos, p.gs.slice(-3));
      const k = norm(p.name);
      // two players can share a name; keep the one who has played more
      if (!byKey[k + "|" + p.pos] || byKey[k + "|" + p.pos].S.g < p.S.g) byKey[k + "|" + p.pos] = p;
      if (!byName[k] || byName[k].S.g < p.S.g) byName[k] = p;
    }
    for (const pos of ["QB", "RB", "WR", "TE"]) {
      const pool = Object.values(P).filter(p => p.pos === pos && p.S.g >= minG);
      pool.slice().sort((a, b) => b.S.ppg - a.S.ppg).forEach((p, i) => (p.prk = i + 1));
      pool.slice().sort((a, b) => b.S.xfp - a.S.xfp).forEach((p, i) => (p.xrk = i + 1));
    }

    // ---- defence vs position: points allowed per game, as a multiplier and a 1-32 rank
    // rank follows ESPN's convention: 1 = stingiest, 32 = gives up the most
    const dvp = {};
    for (const pos of ["QB", "RB", "WR", "TE"]) {
      const list = Object.entries(DVP).filter(([, d]) => d.wk.size)
        .map(([tm, d]) => ({ tm, v: d[pos] / d.wk.size }));
      const avg = list.reduce((s, x) => s + x.v, 0) / (list.length || 1);
      list.sort((a, b) => a.v - b.v).forEach((x, i) => {
        // half the gap to average: nine-odd games of points allowed is a noisy sample
        const m = Math.max(0.8, Math.min(1.2, 1 + 0.5 * (x.v / avg - 1)));
        (dvp[x.tm] = dvp[x.tm] || {})[pos] = { m, rk: i + 1, v: x.v };
      });
    }

    // ---- league rosters
    const seasonRow = stats => (stats || []).find(s =>
      s.seasonId === SEASON && s.statSourceId === 0 && s.statSplitTypeId === 0 && s.scoringPeriodId === 0);
    const info = {};
    for (const t of teamsInfo.teams || []) info[t.id] = t;

    const players = {}, teams = [];
    for (const t of roster.teams || []) {
      const ti = info[t.id] || {}, ov = (ti.record || {}).overall || {};
      const ids = [];
      for (const e of (t.roster && t.roster.entries) || []) {
        const pl = (e.playerPoolEntry || {}).player || {};
        const pos = POS[pl.defaultPositionId];
        if (!pos || !pl.id) continue;
        const tm = TEAM[pl.proTeamId] || "FA";
        const sr = seasonRow(pl.stats) || {};
        const ir = e.lineupSlotId === 21;
        const inj = ir ? "IR" : ({ OUT: "O", DOUBTFUL: "D", QUESTIONABLE: "Q", INJURY_RESERVE: "IR", SUSPENSION: "SUS" }[pl.injuryStatus] || "");
        const sp = pos === "K" || pos === "DST" ? null : (byKey[norm(pl.fullName) + "|" + pos] || byName[norm(pl.fullName)]);
        const S = sp && sp.S, R = sp && sp.R;

        // the rate everything is projected from: half usage (xFP), half production, each
        // leaning 60/40 toward the last three games once there is enough season to lean on
        let base;
        if (S && S.g) {
          const lean = S.g >= 4 ? 0.6 : 0;
          base = 0.5 * (lean * R.xfp + (1 - lean) * S.xfp) + 0.5 * (lean * R.ppg + (1 - lean) * S.ppg);
        } else base = sr.appliedAverage || 0;

        const wk = weeks.map((w, i) => {
          const g = (games[pl.proTeamId] || {})[w];
          if (!g) return { w, o: "BYE", p: 0 };
          const d = (dvp[TEAM[g.opp]] || {})[pos];
          let avail = 1;
          if (inj === "O" || inj === "IR" || inj === "SUS") avail = i < 2 ? 0 : 0.85;
          else if (inj === "D") avail = i === 0 ? 0.25 : 1;
          else if (inj === "Q") avail = i === 0 ? 0.8 : 1;
          return { w, o: (g.home ? "" : "@") + TEAM[g.opp], rk: d ? d.rk : null, p: r1(base * (d ? d.m : 1) * avail) };
        });

        players[pl.id] = {
          id: pl.id, n: pl.fullName, pos, tm, inj, t: t.id,
          espn: r1(sr.appliedAverage), base: r1(base), wk,
          ...(S ? {
            g: S.g, ppg: r1(S.ppg), xfp: r1(S.xfp), fpoe: r1(S.ppg - S.xfp),
            snap: r3(S.snap), ts: r3(S.ts), ays: r3(S.ays), wopr: r3(S.wopr), adot: r1(S.adot),
            cs: r3(S.cs), rz: r3(S.rz), tpg: r1(S.tpg), apg: r1(S.apg),
            prk: sp.prk || null, xrk: sp.xrk || null,
            l3: { ppg: r1(R.ppg), xfp: r1(R.xfp), snap: r3(R.snap), ts: r3(R.ts), cs: r3(R.cs) },
          } : {}),
        };
        ids.push(pl.id);
      }
      teams.push({
        id: t.id, name: ti.name || ((ti.location || "") + " " + (ti.nickname || "")).trim() || "Team " + t.id,
        abbrev: ti.abbrev || "", w: ov.wins || 0, l: ov.losses || 0, pf: r1(ov.pointsFor), players: ids,
      });
    }
    if (!teams.some(t => t.id === MY_TEAM)) throw new Error("team " + MY_TEAM + " not in league payload");

    const counts = ((settings.settings || {}).rosterSettings || {}).lineupSlotCounts || {};
    const slots = {};
    for (const [id, name] of Object.entries(SLOT)) slots[name] = counts[id] || 0;

    res.status(200).json({
      pulled: new Date().toISOString(), season: SEASON, me: MY_TEAM,
      through: played, weeks, playoffs: [15, 16, 17], slots,
      deadline: ((settings.settings || {}).tradeSettings || {}).deadlineDate || null,
      model: { skill: cS.map(r3), qb: cQ.map(r3) },
      teams, players,
    });
  } catch (e) {
    res.setHeader("Cache-Control", "no-store");
    res.status(502).json({ source: "trade", error: String(e.message || e) });
  }
}
