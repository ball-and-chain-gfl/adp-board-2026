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
// The page does the roster-need and trade-package maths on top of this.

const MY_TEAM = 10;          // The Bryan Football Team
const SEASON = 2026;
const LAST_WEEK = 17;        // league playoffs are weeks 15-17
const GFL = "https://gfl-dashboard.vercel.app/api/espn";
const ESPN_SCHED = `https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/${SEASON}?view=proTeamSchedules_wl`;
const SLEEPER = "https://api.sleeper.app";
const SKILL_Q = "position[]=QB&position[]=RB&position[]=WR&position[]=TE";
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
        getJSON(`${SLEEPER}/stats/nfl/${SEASON}/${i + 1}?season_type=regular&${SKILL_Q}`).catch(() => []))
    );

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
          w, tm: fix(x.team), opp: fix(x.opponent), pts: s.pts_ppr || 0,
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
        tw.tgt += g.tgt; tw.air += Math.max(0, g.air); tw.att += g.att; tw.rz += g.rzt + g.rza;
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

    // ---- season + last-three lines for everyone, and position ranks across the NFL
    const minG = Math.max(2, Math.floor(played * 0.4));
    const byKey = {}, byName = {};
    for (const p of Object.values(P)) {
      p.gs.sort((a, b) => a.w - b.w);
      p.S = agg(p.pos, p.gs);
      p.R = agg(p.pos, p.gs.slice(-3));
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

    // the rate everything is projected from: half usage (xFP), half production, each leaning
    // 60/40 toward the last three games once there is enough season to lean on
    const baseOf = (sp, fallback) => {
      if (!sp || !sp.S.g) return fallback || 0;
      const S = sp.S, R = sp.R, lean = S.g >= 4 ? 0.6 : 0;
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
        prk: sp.prk || null, xrk: sp.xrk || null, pl,
        l3: { ppg: r1(R.ppg), xfp: r1(R.xfp), snap: r3(R.snap), ts: r3(R.ts), cs: r3(R.cs), td: R.td, xtd: r1(R.xtd) },
      };
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
          espn: r1(sr.appliedAverage), base: r1(base), wk: slate(pl.proTeamId, pos, base),
          ...(sp && sp.S.g ? statBlock(sp) : {}),
        };
        ids.push(String(pl.id));
      }
      teams.push({
        id: t.id, name: ti.name || ((ti.location || "") + " " + (ti.nickname || "")).trim() || "Team " + t.id,
        abbrev: ti.abbrev || "", w: ov.wins || 0, l: ov.losses || 0, pf: r1(ov.pointsFor), players: ids,
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
            base: r1(base), wk: slate(TEAM_ID[p.tm], pos, base), ...statBlock(p),
          };
        });
    }

    const counts = ((settings.settings || {}).rosterSettings || {}).lineupSlotCounts || {};
    const slots = {};
    for (const [id, name] of Object.entries(SLOT)) slots[name] = counts[id] || 0;

    res.status(200).json({
      pulled: new Date().toISOString(), season: SEASON, me: MY_TEAM,
      through: played, minG, weeks, playoffs: [15, 16, 17], slots,
      deadline: ((settings.settings || {}).tradeSettings || {}).deadlineDate || null,
      model: Object.fromEntries(SKILL.map(p => [p, coef[p].map(r3)])), tdModel: Object.fromEntries(Object.entries(tdc).map(([p, c]) => [p, c.map(r3)])),
      teams, players,
    });
  } catch (e) {
    res.setHeader("Cache-Control", "no-store");
    res.status(502).json({ source: "trade", error: String(e.message || e) });
  }
}
