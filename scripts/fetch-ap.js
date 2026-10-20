#!/usr/bin/env node
/*
 * Fetch the AP Top 25 from ESPN's college football rankings endpoint and match
 * each ranked team to a Sagarin team name. The poll is released Sunday
 * afternoons at 2 p.m. Eastern during the season, so this runs on a Sunday
 * evening schedule (see .github/workflows/update-ap.yml).
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

  return fetchJson(ESPN_BASE + "/rankings", 4).then((json) => {
    const polls = json.rankings || [];
    const ap = polls.filter((p) => /^AP\b|AP Top/i.test(p.name) || p.shortName === "AP Poll")[0];
    if (!ap) throw new Error("AP poll not found in rankings response");

    const ranks = (ap.ranks || [])
      .slice()
      .sort((a, b) => a.current - b.current)
      .map((r) => {
        const id = r.team && r.team.id ? String(r.team.id) : "";
        const espnName = r.team ? (r.team.shortDisplayName || r.team.displayName || r.team.name) : "";
        const sagarin = espnIdToSag[id] || null;
        return { rank: r.current, id: id, espn: espnName, sagarin: sagarin };
      });

    const byTeam = {};
    ranks.forEach((r) => { if (r.sagarin && !(r.sagarin in byTeam)) byTeam[r.sagarin] = r.rank; });

    const signature = Sagarin.hash(ranks.map((r) => r.rank + ":" + r.id).join("|"));
    let existing = null;
    try { existing = JSON.parse(fs.readFileSync(outPath, "utf8")); } catch (e) { existing = null; }

    const out = {
      source: ESPN_BASE + "/rankings",
      poll: ap.name,
      fetched_at: new Date().toISOString(),
      season: season,
      poll_date: ap.date || null,
      poll_updated: ap.lastUpdated || null,
      ranks: ranks,
      byTeam: byTeam,
      signature: signature
    };
    if (existing && existing.signature === signature && existing.fetched_at) {
      out.fetched_at = existing.fetched_at;
    }

    const unmatched = ranks.filter((r) => !r.sagarin).map((r) => r.espn);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, JSON.stringify(out, null, 2) + "\n", "utf8");
    console.log("wrote " + ranks.length + " AP ranks (" + Object.keys(byTeam).length + " matched)" +
      (unmatched.length ? ", unmatched: " + unmatched.join(", ") : "") +
      ", signature " + signature + (existing && existing.signature === signature ? " (unchanged)" : " (updated)"));
  });
}

main().catch((err) => {
  console.error("error: " + err.message);
  process.exit(1);
});
