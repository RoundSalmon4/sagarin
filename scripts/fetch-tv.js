#!/usr/bin/env node
/*
 * Prefetch the upcoming TV schedule from ESPN's scoreboard so the browser never
 * calls ESPN. For a window of weeks starting at the current Sagarin week we pull
 * the FBS and FCS scoreboards and keep each game's kickoff time, TV listing and
 * betting lines, plus the team ids the site already knows how to map.
 *
 * Writes data/tv-games.json.
 *
 *   node scripts/fetch-tv.js [--out PATH] [--weeks N]
 */
"use strict";

const fs = require("fs");
const path = require("path");
const Sagarin = require("../assets/parser.js");

const ESPN_BASE = "https://site.web.api.espn.com/apis/site/v2/sports/football/college-football";
const RATINGS = path.join(__dirname, "..", "data", "ratings.json");
const DEFAULT_OUT = path.join(__dirname, "..", "data", "tv-games.json");

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
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

function tvName(c) {
  const names = [];
  (c.broadcasts || []).forEach((b) => (b.names || []).forEach((n) => names.push(n)));
  if (!names.length) (c.geoBroadcasts || []).forEach((g) => { if (g.media && g.media.shortName) names.push(g.media.shortName); });
  return Array.from(new Set(names)).join(", ");
}

function gameFromEvent(ev) {
  const c = (ev.competitions || [])[0];
  if (!c) return null;
  const bySide = {};
  (c.competitors || []).forEach((comp) => {
    if (comp.team) bySide[comp.homeAway] = comp;
  });
  const home = bySide.home, away = bySide.away;
  if (!home || !away) return null;
  const odds = (c.odds || [])[0] || null;
  const status = (c.status && c.status.type) || {};
  return {
    id: ev.id,
    date: ev.date,
    week: ev.week ? ev.week.number : null,
    neutral: !!c.neutralSite,
    completed: !!status.completed,
    homeId: home.team.id,
    awayId: away.team.id,
    homeName: home.team.shortDisplayName || home.team.displayName || home.team.name,
    awayName: away.team.shortDisplayName || away.team.displayName || away.team.name,
    homeScore: home.score ? Number(home.score.value) : null,
    awayScore: away.score ? Number(away.score.value) : null,
    tv: tvName(c),
    spread: odds && typeof odds.spread === "number" ? odds.spread : null,
    details: odds ? odds.details || "" : "",
    overUnder: odds && typeof odds.overUnder === "number" ? odds.overUnder : null
  };
}

async function main() {
  const outPath = arg("--out", DEFAULT_OUT);
  const weeksWanted = Number(arg("--weeks", "2"));

  const ratings = JSON.parse(fs.readFileSync(RATINGS, "utf8"));
  const season = ratings.meta.season;
  const startWeek = (ratings.meta.week || 1) + 1;

  const games = {};
  for (let w = startWeek; w < startWeek + weeksWanted; w++) {
    let got = 0;
    for (const group of ["80", "81"]) {
      try {
        const j = await fetchJson(ESPN_BASE + "/scoreboard?week=" + w + "&seasontype=2&groups=" + group + "&limit=500", 3);
        (j.events || []).forEach((ev) => {
          const g = gameFromEvent(ev);
          if (g) { games[g.id] = g; got++; }
        });
      } catch (err) {
        console.error("  week " + w + " group " + group + " failed: " + err.message);
      }
    }
    console.log("  week " + w + ": " + got + " games");
  }

  const list = Object.keys(games).map((id) => games[id]).sort((a, b) => (a.date < b.date ? -1 : 1));

  const signature = Sagarin.hash(list.map((g) => g.id + ":" + g.tv + ":" + g.spread + ":" + g.completed).join("|"));
  let existing = null;
  try { existing = JSON.parse(fs.readFileSync(outPath, "utf8")); } catch (e) { existing = null; }

  const out = {
    source: ESPN_BASE + "/scoreboard",
    fetched_at: new Date().toISOString(),
    season: season,
    startWeek: startWeek,
    games: list,
    signature: signature
  };
  if (existing && existing.signature === signature && existing.fetched_at) {
    out.fetched_at = existing.fetched_at;
  }

  const withTv = list.filter((g) => g.tv).length;
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2) + "\n", "utf8");
  console.log("wrote " + list.length + " games (" + withTv + " with TV), weeks " + startWeek + "-" +
    (startWeek + weeksWanted - 1) + ", signature " + signature +
    (existing && existing.signature === signature ? " (unchanged)" : " (updated)"));
}

main().catch((err) => {
  console.error("error: " + err.message);
  process.exit(1);
});
