#!/usr/bin/env node
/*
 * Prefetch ESPN data for the site:
 *   - the FBS team list (for name matching)
 *   - every FBS team's season schedule, deduped into one games list
 * Writes data/espn-games.json. Run weekly from the Action so the browser never
 * has to call ESPN directly.
 *
 *   node scripts/fetch-espn.js [--out PATH] [--concurrency N]
 */
"use strict";

const fs = require("fs");
const path = require("path");
const Alias = require("../assets/team-alias.js");
const Sagarin = require("../assets/parser.js");

const ESPN_BASE = "https://site.web.api.espn.com/apis/site/v2/sports/football/college-football";
const DEFAULT_OUT = path.join(__dirname, "..", "data", "espn-games.json");
const RATINGS = path.join(__dirname, "..", "data", "ratings.json");

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

function trimTeam(t) {
  return { id: t.id, displayName: t.displayName, location: t.location, name: t.name, abbreviation: t.abbreviation };
}

// Pull the few season numbers the site shows for a team: total offense and
// total defense (yards per game), points per game and games played. "Own" comes
// from results.stats, "against" from results.opponent, which is the aggregate
// of what opponents did against this team.
function trimStats(j) {
  if (!j || !j.results) return null;
  var own = (j.results.stats && j.results.stats.categories) || [];
  var against = [];
  var opp = j.results.opponent;
  if (opp) Object.keys(opp).forEach(function (k) { if (opp[k] && opp[k].stats) against.push(opp[k]); });
  function stat(cats, cat, field) {
    for (var i = 0; i < cats.length; i++) {
      if (cats[i].name !== cat) continue;
      var arr = cats[i].stats || [];
      for (var k = 0; k < arr.length; k++) if (arr[k].name === field) return arr[k].value;
    }
    return undefined;
  }
  var oy = stat(own, "passing", "yardsPerGame");
  var pp = stat(own, "passing", "totalPointsPerGame");
  var gp = stat(own, "general", "gamesPlayed");
  if (oy === undefined || pp === undefined || gp === undefined) return null;
  var out = { oy: oy, pp: pp, gp: gp };
  var dy = stat(against, "passing", "yardsPerGame");
  var pa = stat(against, "passing", "totalPointsPerGame");
  if (dy !== undefined) out.dy = dy;
  if (pa !== undefined) out.pa = pa;
  return out;
}

async function pool(items, size, worker) {
  const results = [];
  let i = 0;
  const runners = Array.from({ length: Math.min(size, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await worker(items[idx], idx);
    }
  });
  await Promise.all(runners);
  return results;
}

async function main() {
  const outPath = arg("--out", DEFAULT_OUT);
  const concurrency = Number(arg("--concurrency", "6"));

  const ratings = JSON.parse(fs.readFileSync(RATINGS, "utf8"));
  const season = ratings.meta.season;
  const allTeams = ratings.teams;

  console.log("fetching ESPN team list");
  const teamJson = await fetchJson(ESPN_BASE + "/teams?limit=1000", 4);
  const espnTeams = teamJson.sports[0].leagues[0].teams.map((x) => trimTeam(x.team));

  const idx = {};
  espnTeams.forEach((t) => {
    [t.location, t.name, t.displayName].forEach((v) => {
      const k = normalize(v || "");
      if (k && !idx[k]) idx[k] = t;
    });
  });

  const targets = [];
  const teams = {};
  allTeams.forEach((st) => {
    const k = normalize(st.team);
    const et = idx[k] || idx[Alias[k]];
    if (et) {
      targets.push({ sagarin: st.team, id: et.id });
      teams[et.id] = et;
    }
  });
  console.log("matched " + targets.length + " of " + allTeams.length + " rated teams to ESPN");

  const games = {};
  let done = 0;
  await pool(targets, concurrency, async (t) => {
    try {
      const j = await fetchJson(ESPN_BASE + "/teams/" + t.id + "/schedule", 3);
      (j.events || []).forEach((ev) => {
        const c = (ev.competitions || [])[0];
        if (!c) return;
        const competitors = c.competitors || [];
        if (competitors.length !== 2) return;
        const bySide = {};
        competitors.forEach((comp) => {
          if (!comp.team) return;
          bySide[comp.homeAway] = comp;
          teams[comp.team.id] = teams[comp.team.id] || trimTeam(comp.team);
        });
        const home = bySide.home;
        const away = bySide.away;
        if (!home || !away) return;
        games[ev.id] = {
          id: ev.id,
          date: ev.date,
          neutral: !!c.neutralSite,
          completed: !!(c.status && c.status.type && c.status.type.completed),
          homeId: home.team.id,
          awayId: away.team.id,
          homeScore: home.score ? Number(home.score.value) : null,
          awayScore: away.score ? Number(away.score.value) : null
        };
      });
    } catch (err) {
      console.error("  schedule failed for " + t.sagarin + ": " + err.message);
    }
    done++;
    if (done % 25 === 0) console.log("  " + done + "/" + targets.length);
  });

  const stats = {};
  await pool(targets, concurrency, async (t) => {
    try {
      const j = await fetchJson(ESPN_BASE + "/teams/" + t.id + "/statistics?season=" + season, 3);
      const s = trimStats(j);
      if (s) stats[t.id] = s;
    } catch (err) {
      console.error("  statistics failed for " + t.sagarin + ": " + err.message);
    }
  });
  console.log("got season statistics for " + Object.keys(stats).length + " of " + targets.length + " teams");

  const out = {
    source: ESPN_BASE,
    fetched_at: new Date().toISOString(),
    season: season,
    teams: Object.keys(teams).map((id) => teams[id]),
    games: Object.keys(games).map((id) => games[id]).sort((a, b) => (a.date < b.date ? -1 : 1)),
    stats: stats
  };

  // Only move fetched_at when something actually changed, so a quiet run leaves
  // the file alone and the Action skips the commit.
  const signature = Sagarin.hash(
    out.teams.map((t) => t.id).join(",") + "|" +
    out.games.map((g) => g.id + ":" + g.homeScore + ":" + g.awayScore + ":" + g.completed).join("|") + "|" +
    Object.keys(out.stats).sort().map((id) => id + ":" + out.stats[id].oy + ":" + out.stats[id].pp + ":" +
      out.stats[id].gp + ":" + out.stats[id].dy + ":" + out.stats[id].pa).join("|")
  );
  let existing = null;
  try { existing = JSON.parse(fs.readFileSync(outPath, "utf8")); } catch (e) { existing = null; }
  out.signature = signature;
  if (existing && existing.signature === signature && existing.fetched_at) {
    out.fetched_at = existing.fetched_at;
  }

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2) + "\n", "utf8");
  console.log("wrote " + out.games.length + " games, " + out.teams.length + " teams, signature " + signature +
    (existing && existing.signature === signature ? " (unchanged)" : " (updated)"));
}

main().catch((err) => {
  console.error("error: " + err.message);
  process.exit(1);
});
