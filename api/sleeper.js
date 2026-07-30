// Sleeper ADP proxy (full PPR).
// Sleeper's projections endpoint is CORS-open but ~4.7 MB. This trims it to the players who
// actually have an ADP and edge-caches the result.
// adp_ppr is the full-PPR figure, which matches the target league. Sleeper reports 999 for
// players it has no ADP for, and publishes no ADP at all for kickers or defenses.

const URL = "https://api.sleeper.app/projections/nfl/2026?season_type=regular&order_by=adp_ppr";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "public, s-maxage=900, stale-while-revalidate=3600");

  try {
    const r = await fetch(URL, { headers: { "User-Agent": "adp-board/1.0" } });
    if (!r.ok) throw new Error("sleeper returned " + r.status);
    const j = await r.json();

    const players = [];
    for (const o of j) {
      const p = o.player || {};
      const v = o.stats && o.stats.adp_ppr;
      if (!v || v >= 900) continue;
      const pos = p.position === "DEF" ? "DST" : p.position;
      const name = pos === "DST" ? (p.last_name || "") : ((p.first_name || "") + " " + (p.last_name || "")).trim();
      if (!name) continue;
      players.push({ name, pos, team: p.team_abbr || p.team || "", adp: +v.toFixed(1) });
    }

    if (players.length < 100) throw new Error("only " + players.length + " players with ADP");
    players.sort((a, b) => a.adp - b.adp);

    const pc = {};
    players.forEach((x, i) => {
      x.rk = i + 1;
      pc[x.pos] = (pc[x.pos] || 0) + 1;
      x.pr = pc[x.pos];
    });

    res.status(200).json({ source: "sleeper", scoring: "full ppr", pulled: new Date().toISOString(), count: players.length, players });
  } catch (e) {
    res.status(502).json({ source: "sleeper", error: String(e.message || e) });
  }
}
