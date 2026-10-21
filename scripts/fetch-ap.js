#!/usr/bin/env node
/*
 * Fetch the college football polls and match each ranked team to a Sagarin team
 * name: the AP Top 25 and the AFCA Coaches Poll come from ESPN's rankings
 * endpoint, the CFP committee rankings come from the CFP site's own API once
 * the committee starts posting them in November. The CFP poll drives the site
 * when it is available; until then the AP poll does. All of them are written so
 * the Head to Head page can show them. The AP and Coaches polls are released
 * Sunday afternoons, the CFP rankings on Tuesday nights, so this runs on a
 * Sunday evening schedule and again midweek (see .github/workflows/update-ap.yml).
 *
 * Writes data/ap-poll.json. Run weekly so the browser never calls ESPN directly.
 *
 *   node scripts/fetch-ap.js [--out PATH]
 */
"use strict";

const fs = require("fs");
const path = require("path");
const Alias = require("../assets/team-alias.js");
const Sagarin = require("../assets/parser.js");

const ESPN_BASE = "https://site.web.api.espn.com/apis/site/v2/sports/football/college-football";
const CFP_API = "https://collegefootballplayoff.com/api/v2/rankings";
const RATINGS = path.join(__dirname, "..", "data", "ratings.json");
const ESPN = path.join(__dirname, "..", "data", "espn-games.json");
const DEFAULT_OUT = path.join(__dirname, "..", "data", "ap-poll.json");

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

function normalize(s) {
  return String(s)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[.'&]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

async function fetchJson(url, tries) {
  let lastErr;
  for (let attempt = 1; attempt <= tries; attempt++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": "sagarin-site/1.0" } });
      if (!res.ok) throw new Error("HTTP " + res.status);
      return await res.json();
    } catch (err) {
      lastErr = err;
      if (attempt < tries) await new Promise((r) => setTimeout(r, attempt * 1500));
    }
  }
  throw lastErr;
}

function main() {
  const outPath = arg("--out", DEFAULT_OUT);

  const ratings = JSON.parse(fs.readFileSync(RATINGS, "utf8"));
  const season = ratings.meta.season;
  const espn = JSON.parse(fs.readFileSync(ESPN, "utf8"));

  // Build ESPN id <-> Sagarin name using the same matching as the site.
  const idx = {};
  espn.teams.forEach((t) => {
    [t.location, t.name, t.displayName].forEach((v) => {
      const k = normalize(v || "");
      if (k && !idx[k]) idx[k] = t;
    });
  });
  const espnIdToSag = {};
  ratings.teams.forEach((st) => {
    const k = normalize(st.team);
    const et = idx[k] || idx[Alias[k]];
    if (et) espnIdToSag[String(et.id)] = st.team;
  });

  // School name -> Sagarin name, for the CFP list, which comes with school
  // names instead of ESPN ids.
  const byName = {};
  ratings.teams.forEach((st) => {
    const k = normalize(st.team);
    if (k && !(k in byName)) byName[k] = st.team;
  });
  ratings.teams.forEach((st) => {
    const a = Alias[normalize(st.team)];
    if (a && !(a in byName)) byName[a] = st.team;
  });

  return fetchJson(ESPN_BASE + "/rankings", 4).then((json) => {
    const polls = json.rankings || [];
    const apPoll = pick(polls, "ap", /^AP\b|AP Top/i);
    if (!apPoll) throw new Error("AP poll not found in rankings response");
    const coachesPoll = pick(polls, "usa", /Coaches|AFCA/i, ["fcs", "afca"]);
    const cfpPoll = pick(polls, "cfp", /Playoff Committee|CFP/i, ["fcs", "afca"]);

    const trimmed = { ap: trimPoll(apPoll, espnIdToSag) };
    if (coachesPoll) trimmed.usa = trimPoll(coachesPoll, espnIdToSag);
    if (cfpPoll) trimmed.cfp = trimPoll(cfpPoll, espnIdToSag);

    // The committee poll is not on ESPN, it comes from the CFP site.
    return fetchCfp(season, byName).then((cfp) => {
      if (cfp) trimmed.cfp = cfp;

      // The committee poll drives the site once it is posted. Until then it is AP.
      const primaryKey = trimmed.cfp ? "cfp" : "ap";
      const primary = trimmed[primaryKey];
      const primaryLabel = primaryKey === "cfp" ? "CFP" : "AP";

      const signature = Sagarin.hash(
        Object.keys(trimmed).sort().map((k) => k + ":" + trimmed[k].ranks.map((r) =>
          r.rank + ":" + r.espn + ":" + (r.points == null ? "" : r.points) + ":" +
          (r.firstPlaceVotes == null ? "" : r.firstPlaceVotes)).join("|")).join("~")
      );
      let existing = null;
      try { existing = JSON.parse(fs.readFileSync(outPath, "utf8")); } catch (e) { existing = null; }

      const out = {
        source: ESPN_BASE + "/rankings",
        fetched_at: new Date().toISOString(),
        season: season,
        primary: primaryKey,
        primaryLabel: primaryLabel,
        poll: primary.name,
        poll_date: primary.date || null,
        poll_updated: primary.updated || null,
        ranks: primary.ranks,
        byTeam: primary.byTeam,
        polls: trimmed,
        signature: signature
      };
      if (existing && existing.signature === signature && existing.fetched_at) {
        out.fetched_at = existing.fetched_at;
      }

      const parts = Object.keys(trimmed).map((k) => {
        const poll = trimmed[k];
        const unmatched = poll.ranks.filter((r) => !r.sagarin).map((r) => r.espn);
        return k + " " + poll.ranks.length + "/" + Object.keys(poll.byTeam).length +
          (unmatched.length ? " (unmatched: " + unmatched.join(", ") + ")" : "");
      });
      fs.mkdirSync(path.dirname(outPath), { recursive: true });
      fs.writeFileSync(outPath, JSON.stringify(out, null, 2) + "\n", "utf8");
      console.log("wrote " + parts.join(", ") + ", primary " + primaryLabel +
        ", signature " + signature + (existing && existing.signature === signature ? " (unchanged)" : " (updated)"));
    });
  });
}

// The CFP committee rankings, from the CFP site's own API. The list is
// published on Tuesday nights in November and December and each release is
// tagged with the calendar year of the season it belongs to, so only the
// releases of the current season count. A failure here is not fatal: the AP
// and Coaches polls still get written.
function fetchCfp(season, byName) {
  return fetchJson(CFP_API, 2).then((releases) => {
    const list = (releases || []).filter((r) => Number(r.year) === Number(season));
    if (!list.length) return null;
    const rel = list.sort((a, b) => new Date(b.releaseDate) - new Date(a.releaseDate))[0];
    const ranks = (rel.teams || [])
      .slice()
      .sort((a, b) => a.rank - b.rank)
      .map((t) => ({
        rank: t.rank,
        id: "",
        espn: t.team,
        sagarin: byName[normalize(t.team)] || null
      }));
    if (!ranks.length) return null;
    const byTeam = {};
    ranks.forEach((r) => { if (r.sagarin && !(r.sagarin in byTeam)) byTeam[r.sagarin] = r.rank; });
    return {
      id: String(rel.id),
      name: "CFP Rankings",
      shortName: "CFP Rankings",
      type: "cfp",
      source: CFP_API,
      date: rel.releaseDate || null,
      updated: rel.releaseDate || null,
      ranks: ranks,
      byTeam: byTeam
    };
  }).catch((err) => {
    console.log("CFP rankings not available: " + err.message);
    return null;
  });
}

function pick(polls, type, nameRe, skip) {
  const skipTypes = skip || [];
  const usable = polls.filter((p) => skipTypes.indexOf(p.type) === -1);
  return usable.filter((p) => p.type === type)[0] ||
    usable.filter((p) => nameRe.test(p.name || "") || nameRe.test(p.shortName || ""))[0] || null;
}

function trimPoll(poll, espnIdToSag) {
  const ranks = (poll.ranks || [])
    .slice()
    .sort((a, b) => a.current - b.current)
    .map((r) => {
      const id = r.team && r.team.id ? String(r.team.id) : "";
      const espnName = r.team ? (r.team.shortDisplayName || r.team.displayName || r.team.name) : "";
      return {
        rank: r.current,
        id: id,
        espn: espnName,
        sagarin: espnIdToSag[id] || null,
        points: typeof r.points === "number" ? r.points : null,
        firstPlaceVotes: typeof r.firstPlaceVotes === "number" ? r.firstPlaceVotes : null
      };
    });
  const byTeam = {};
  ranks.forEach((r) => { if (r.sagarin && !(r.sagarin in byTeam)) byTeam[r.sagarin] = r.rank; });
  // The BCS turned a poll into a 0-1 value by dividing the team's points by the
  // most it could get (25 for each voter). The voters are the first-place votes,
  // so the polls carry their own maximum.
  const voters = ranks.reduce((n, r) => n + (r.firstPlaceVotes || 0), 0);
  return {
    id: poll.id,
    name: poll.name,
    shortName: poll.shortName || "",
    type: poll.type || "",
    date: poll.date || null,
    updated: poll.lastUpdated || null,
    voters: voters,
    maxPoints: voters * 25,
    ranks: ranks,
    byTeam: byTeam
  };
}

main().catch((err) => {
  console.error("error: " + err.message);
  process.exit(1);
});
