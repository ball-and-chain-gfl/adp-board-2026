// Underdog best ball ADP proxy (half-PPR).
// Underdog publishes no open ADP endpoint, so this parses Sharp Football Analysis' published
// table, which is server-rendered into the page HTML. Cross-origin and no CORS headers, hence
// the proxy. This is the most brittle source on the board: if Sharp changes their table markup
// this returns an error and the client falls back to the baked-in snapshot.

const SRC = "https://www.sharpfootballanalysis.com/fantasy/fantasy-football-adp-half-ppr-underdog-best-ball/";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=21600");

  try {
    const r = await fetch(SRC, { headers: { "User-Agent": "Mozilla/5.0 (compatible; adp-board/1.0)" } });
    if (!r.ok) throw new Error("source returned " + r.status);
    const html = await r.text();

    const players = [];
    const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let m;
    while ((m = rowRe.exec(html)) !== null) {
      const cells = [...m[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)]
        .map(c => c[1].replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&#\d+;/g, "").replace(/\s+/g, " ").trim());
      if (cells.length < 5) continue;
      const pos = cells[1];
      const adp = parseFloat(cells[4]);
      if (!/^(QB|RB|WR|TE)$/.test(pos)) continue;
      if (!/^[A-Z]{1,3}\d+$/.test(cells[3])) continue;
      if (!isFinite(adp)) continue;
      players.push({ name: cells[0], pos, team: cells[2], adp });
    }

    if (players.length < 100) throw new Error("parsed only " + players.length + " rows; table markup may have changed");
    players.sort((a, b) => a.adp - b.adp);

    const pc = {};
    players.forEach((x, i) => {
      x.rk = i + 1;
      pc[x.pos] = (pc[x.pos] || 0) + 1;
      x.pr = pc[x.pos];
    });

    res.status(200).json({ source: "underdog", scoring: "half-ppr best ball", pulled: new Date().toISOString(), count: players.length, players });
  } catch (e) {
    res.status(502).json({ source: "underdog", error: String(e.message || e) });
  }
}
