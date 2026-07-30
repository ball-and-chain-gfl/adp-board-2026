// Yahoo ADP proxy.
// Yahoo's public read-only fantasy API needs no auth, but sends no CORS headers, so the
// browser can't call it directly. This runs server-side on Vercel and re-serves it as JSON.
// Verified 2026-07-29: pub-api-ro responds to unauthenticated server-side requests.
// Pages are fetched in parallel to stay inside the Hobby-plan function timeout.

const PAGES = 14;
const PER = 25;

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "public, s-maxage=900, stale-while-revalidate=3600");

  try {
    const urls = [];
    for (let p = 0; p < PAGES; p++) {
      urls.push("https://pub-api-ro.fantasysports.yahoo.com/fantasy/v2/game/nfl/players"
        + ";sort=AR;start=" + (p * PER) + ";count=" + PER + ";out=draft_analysis?format=json_f");
    }
    const pages = await Promise.all(urls.map(u =>
      fetch(u, { headers: { "User-Agent": "adp-board/1.0" } })
        .then(r => r.ok ? r.json() : null).catch(() => null)
    ));

    const players = [];
    for (const j of pages) {
      if (!j) continue;
      const list = (j.fantasy_content && j.fantasy_content.game && j.fantasy_content.game.players) || [];
      for (const o of list) {
        const pl = o.player || o;
        const adp = parseFloat((pl.draft_analysis || {}).average_pick);
        if (!pl.name || !isFinite(adp)) continue;
        players.push({
          name: pl.name.full,
          pos: String(pl.display_position || "").split(",")[0].replace("DEF", "DST"),
          team: pl.editorial_team_abbr || "",
          adp: adp,
        });
      }
    }

    if (players.length < 100) throw new Error("only " + players.length + " players returned");
    players.sort((a, b) => a.adp - b.adp);

    const pc = {};
    players.forEach((x, i) => {
      x.rk = i + 1;
      pc[x.pos] = (pc[x.pos] || 0) + 1;
      x.pr = pc[x.pos];
    });

    res.status(200).json({ source: "yahoo", scoring: "half-ppr", pulled: new Date().toISOString(), count: players.length, players });
  } catch (e) {
    res.status(502).json({ source: "yahoo", error: String(e.message || e) });
  }
}
