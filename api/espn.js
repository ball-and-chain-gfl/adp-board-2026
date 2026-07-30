// ESPN ADP + PPR draft rank proxy.
// ESPN's endpoint allows cross-origin calls, but the raw payload is multi-megabyte. This trims
// it to what the board needs and edge-caches it, so draft-day loads stay small.
//
// Two ESPN quirks handled here:
//  1. leaguedefaults/3 is the full-PPR default league (matches the target league scoring).
//  2. draftRanksByRankType.PPR.rank is NOT contiguous - no player holds rank 37-68, etc. So we
//     also emit a dense ordinal over ESPN's own rank ordering, which is what's comparable to
//     the other sites' board ranks.

const SRC = "https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/2026/segments/0/leaguedefaults/3?view=kona_player_info";

const POS = { 1: "QB", 2: "RB", 3: "WR", 4: "TE", 5: "K", 16: "DST" };
const TEAM = { 0:"FA",1:"ATL",2:"BUF",3:"CHI",4:"CIN",5:"CLE",6:"DAL",7:"DEN",8:"DET",9:"GB",
  10:"TEN",11:"IND",12:"KC",13:"LV",14:"LAR",15:"MIA",16:"MIN",17:"NE",18:"NO",19:"NYG",
  20:"NYJ",21:"PHI",22:"ARI",23:"PIT",24:"LAC",25:"SF",26:"SEA",27:"TB",28:"WSH",29:"CAR",
  30:"JAX",33:"BAL",34:"HOU" };

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=1800");

  try {
    const filter = {
      players: {
        filterSlotIds: { value: [0, 2, 4, 6, 17, 16] },
        sortDraftRanks: { sortPriority: 100, sortAsc: true, value: "PPR" },
        limit: 400, offset: 0,
      },
    };
    const r = await fetch(SRC, {
      headers: { "x-fantasy-filter": JSON.stringify(filter), "User-Agent": "adp-board/1.0" },
    });
    if (!r.ok) throw new Error("espn returned " + r.status);
    const j = await r.json();

    const players = (j.players || []).map(p => {
      const pl = p.player || {};
      const dr = (pl.draftRanksByRankType || {}).PPR;
      return {
        id: pl.id,
        name: pl.fullName,
        pos: POS[pl.defaultPositionId] || "?",
        team: TEAM[pl.proTeamId] || "FA",
        adp: pl.ownership && pl.ownership.averageDraftPosition ? +pl.ownership.averageDraftPosition.toFixed(1) : null,
        rawRank: dr ? dr.rank : null,
      };
    }).filter(x => x.name && x.adp !== null && x.rawRank !== null);

    if (players.length < 150) throw new Error("only " + players.length + " usable players");

    players.sort((a, b) => a.rawRank - b.rawRank);
    const rc = {};
    players.forEach((x, i) => {
      x.rank = i + 1;
      rc[x.pos] = (rc[x.pos] || 0) + 1;
      x.prByRank = rc[x.pos];
    });

    const ac = {};
    players.slice().sort((a, b) => a.adp - b.adp).forEach(x => {
      ac[x.pos] = (ac[x.pos] || 0) + 1;
      x.prByAdp = ac[x.pos];
    });

    res.status(200).json({ source: "espn", scoring: "full ppr", pulled: new Date().toISOString(), count: players.length, players });
  } catch (e) {
    res.status(502).json({ source: "espn", error: String(e.message || e) });
  }
}
