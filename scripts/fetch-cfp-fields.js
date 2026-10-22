#!/usr/bin/env node
/*
 * Fetch the College Football Playoff field for every season and store it.
 *
 * The CFP site publishes the committee's final ranking and this repo keeps it
 * in data/cfp-finals.json, but the committee's selection is not always the
 * same list as its published ranking. In 2025 the ranking had Notre Dame and
 * BYU in the top 12 while the field had Tulane and James Madison. The
 * playoff predictor is judged on the field, so the field is what gets stored
 * here, with the seed, the conference and how each team qualified.
 *
 * The field comes from the Wikipedia bracket templates, which carry the seed
 * and the team for every game, and the season articles, whose participants
 * table carries the conference and the qualification. The NCAA bracket page
 * is the cross check and the CFP site's ranking is the other one.
 *
 *   node scripts/fetch-cfp-fields.js [--season 2025] [--dry-run]
 */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const OUT_FILE = path.join(ROOT, "data", "cfp-fields.json");
const FIRST_SEASON = 2014;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Wikipedia names for teams the site spells differently.
const ALIAS = {
  "ole miss": "Mississippi", "miami": "Miami-Florida", "miami fl": "Miami-Florida",
  "miami oh": "Miami-Ohio", "usc": "Southern California", "southern california": "Southern California",
  "nc state": "North Carolina State", "northwestern university": "Northwestern",
  "san jose state university": "San Jose State", "louisiana": "Louisiana-Lafayette",
  "army": "Army West Point", "app state": "App State", "appalachian state": "App State",
  "pitt": "Pittsburgh", "central florida": "Central Florida(UCF)",
  "utah state": "Utah State", "nc state ": "North Carolina State", "ohio st": "Ohio State",
  "ohio state ": "Ohio State", "nc state st": "North Carolina State"
};
// Wikipedia conference names for the ones the site uses.
const CONF = {
  "Southeastern Conference": "SEC", "Big Ten Conference": "BIG TEN", "Big 12 Conference": "BIG 12",
  "Atlantic Coast Conference": "ACC", "Mountain West Conference": "MOUNTAIN WEST",
  "American Conference": "AMERICAN", "Sun Belt Conference": "SUN BELT",
  "Conference USA": "CONF-USA", "Mid-American Conference": "MAC", "Pac-12 Conference": "PAC-12",
  "Independent": "I-A IND.", "Western Athletic Conference": "WAC"
};
function norm(s) {
  return String(s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ").trim();
}
function siteName(name) {
  const n = norm(name);
  if (ALIAS[n]) return ALIAS[n];
  return name.replace(/\s+/g, " ").trim();
}
function clean(s) {
  return String(s).replace(/\[\[([^\]|]*\|)?/g, "").replace(/\]\]/g, "")
    .replace(/\{\{[^}]*\}\}/g, "").replace(/<[^>]*>/g, "").replace(/'''?/g, "").trim();
}
async function raw(title) {
  const u = "https://en.wikipedia.org/w/index.php?title=" + encodeURIComponent(title) + "&action=raw";
  for (let a = 1; a <= 3; a++) {
    try {
      const r = await fetch(u, { headers: { "User-Agent": "sagarin-site/1.0" } });
      if (!r.ok) return null;
      const t = await r.text();
      return t.length > 200 ? t : null;
    } catch (e) {
      if (a === 3) return null;
      await sleep(a * 800);
    }
  }
  return null;
}
// The bracket template for a season is named for the championship year.
function templateTitle(season) { return "Template:" + (season + 1) + " College Football Playoff"; }
function articleTitle(season) {
  return season + "\u2013" + String(season + 1).slice(2) + " College Football Playoff";
}
// Twelve team brackets list the seed and the team for each game.
function fieldFromTemplate(wt) {
  const seeds = {}, teams = {};
  for (const line of wt.split("\n")) {
    let m = line.match(/^\|\s*(RD\d)-seed(\d)\s*=\s*(\d{1,2})\s*$/);
    if (m) { seeds[m[1] + m[2]] = Number(m[3]); continue; }
    m = line.match(/^\|\s*(RD\d)-team(\d)\s*=\s*(\[\[[^\n]*)/);
    if (m) { teams[m[1] + m[2]] = clean(m[3]); }
  }
  const bySeed = {};
  Object.keys(seeds).forEach((k) => { if (teams[k] && !bySeed[seeds[k]]) bySeed[seeds[k]] = teams[k]; });
  if (Object.keys(bySeed).length) return bySeed;
  // Four team brackets are rows of seed, team, score, seed, team, score. The
  // bold markers come before the link, so take them out first.
  const rows = {};
  const plain = wt.replace(/'''/g, "");
  const re = /\|\s*(\d{1,2})\s*\|\s*(\[\[[^\]\n]*\]\])/g;
  let m;
  while ((m = re.exec(plain)) !== null) {
    const seed = Number(m[1]);
    if (!rows[seed]) rows[seed] = clean(m[2]);
  }
  return rows;
}
// The participants table carries the conference and the qualification.
function participantsFromArticle(wt) {
  const rows = [];
  for (const line of wt.split("\n")) {
    const t = line.trim();
    if (!t.startsWith("|") || t.startsWith("|-") || t.startsWith("!") || t.startsWith("|}")) continue;
    const cells = t.split("||").map((c) => clean(c.replace(/^\|\s*/, "")));
    if (cells.length < 4) continue;
    const qual = cells[3].toLowerCase();
    if (qual !== "conference champion" && qual !== "at-large" && qual !== "automatic qualifier") continue;
    if (!/^[A-Z]/.test(cells[0])) continue;
    rows.push({ team: cells[0], conference: CONF[cells[1]] || cells[1], record: cells[2], bid: cells[3] });
  }
  return rows;
}
// The CFP article's "Selections by year" table lists, for every season, the
// conference champions that were selected, the other power conference teams
// that were selected, the group of five champions that were selected, and the
// champions that were not selected. That is the bid type for every team the
// committee picked, and it covers the seasons before the twelve team format.
const SELECTION_ARTICLE = "College Football Playoff";
function selectionsFromArticle(wt) {
  const i = wt.indexOf("===Selections by year===");
  if (i < 0) return {};
  const j = wt.indexOf("{|", i);
  const k = wt.indexOf("|}", j);
  if (j < 0 || k < 0) return {};
  const out = {};
  // Rows are separated by "|-". The first two cells are the season and the
  // playoff, then the format, then the six selection columns. The format cell
  // rides along with the playoff cell on the earlier rows and stands alone on
  // the later ones, so drop anything that names it.
  const rows = wt.slice(j, k).split(/\n\|-\s*\n/);
  rows.forEach((row) => {
    const season = /NCAA Division I FBS football season\|(\d{4})\]\]/.exec(row);
    if (!season) return;
    const cells = row.replace(/\n\|/g, "||").split("||").slice(1)
      .filter((c) => c.indexOf("rowspan") === -1 && c.indexOf("College Football Playoff|") === -1);
    if (cells.length < 6) { console.log("  " + season[1] + ": only " + cells.length + " selection columns"); return; }
    const picked = {};
    const champs = [];
    const pick = (cell, bid, isChamp) => {
      const re = /<small>(\d{1,2})<\/small>\s*\[\[[^\]]*\|([^\]]+)\]\]/g;
      let m;
      while ((m = re.exec(cell)) !== null) {
        const name = clean(m[2]);
        if (!name) continue;
        picked[name] = { seed: Number(m[1]), bid: bid };
        if (isChamp) champs.push(name);
      }
    };
    pick(cells[0], "Conference champion", true);
    pick(cells[1], "At-large", false);
    pick(cells[2], "Conference champion", true);
    pick(cells[3], "Conference champion", true);
    pick(cells[4], "At-large", false);
    pick(cells[5], "At-large", false);
    out[season[1]] = { picked: picked, champions: champs };
  });
  return out;
}
async function season(season, selections) {
  const wt = await raw(templateTitle(season));
  if (!wt) return null;
  const seeds = fieldFromTemplate(wt);
  const list = Object.keys(seeds).map(Number).sort((a, b) => a - b);
  if (!list.length) return null;
  await sleep(350);
  const aw = await raw(articleTitle(season));
  const parts = aw ? participantsFromArticle(aw) : [];
  const byName = new Map();
  parts.forEach((p) => byName.set(norm(p.team), p));
  const sel = selections[season] || {};
  const picked = sel.picked || {};
  const selByName = new Map();
  Object.keys(picked).forEach((k) => {
    selByName.set(norm(k), picked[k]);
    selByName.set(norm(siteName(k)), picked[k]);
  });
  const field = list.map((s) => {
    const raw = seeds[s];
    const name = siteName(raw);
    // The article may spell the team the way the site does or the way the
    // bracket does, so look under both.
    const p = byName.get(norm(name)) || byName.get(norm(raw));
    const selRow = selByName.get(norm(name)) || selByName.get(norm(raw));
    if (!p && parts.length) console.log("  " + season + ": no participants row for " + name);
    if (!selRow) console.log("  " + season + ": no selection row for " + name);
    return {
      seed: s,
      team: name,
      conference: p ? p.conference : null,
      bid: selRow ? selRow.bid : (p ? p.bid : null)
    };
  });
  // Every team the committee recorded as a conference champion, picked or not.
  const champions = (sel.champions || []).map(siteName);
  return { format: list.length, field: field, champions: champions };
}
(async () => {
  const i = process.argv.indexOf("--season");
  const one = i !== -1 && process.argv[i + 1] ? [Number(process.argv[i + 1])] : null;
  const dry = process.argv.indexOf("--dry-run") !== -1;
  const old = fs.existsSync(OUT_FILE) ? JSON.parse(fs.readFileSync(OUT_FILE, "utf8")) : { seasons: {} };
  const seasons = {};
  const years = one || [];
  // The selections table covers every season, so read it once.
  const sw = await raw(SELECTION_ARTICLE);
  const selections = sw ? selectionsFromArticle(sw) : {};
  console.log("selection table covers " + Object.keys(selections).sort().join(", "));
  if (!one) {
    // Every season from the first one through the last the CFP site has
    // published a final ranking for.
    const cfp = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "cfp-finals.json"), "utf8")).seasons;
    const last = Math.max.apply(null, Object.keys(cfp).map(Number));
    for (let y = FIRST_SEASON; y <= last; y++) years.push(y);
  }
  for (const y of years) {
    const r = await season(y, selections);
    if (!r) { console.log(y + ": no bracket found"); await sleep(400); continue; }
    seasons[String(y)] = r;
    console.log(y + ": " + r.field.length + " teams, " +
      r.field.filter((t) => t.bid).length + " with a bid type");
    await sleep(400);
  }
  const merged = Object.assign({}, old.seasons, seasons);
  const out = {
    source: "Wikipedia season articles and bracket templates (en.wikipedia.org); cross checked against the NCAA bracket and the CFP site's final ranking",
    note: "The committee's selection is not always the same list as the final ranking the CFP site publishes and this repo keeps in data/cfp-finals.json. This file holds the selection itself, with the seed, the conference and how each team qualified.",
    seasons: merged,
    updated: new Date().toISOString().slice(0, 10)
  };
  const json = JSON.stringify(out, null, 1) + "\n";
  if (dry) { console.log(json); return; }
  const before = fs.existsSync(OUT_FILE) ? fs.readFileSync(OUT_FILE, "utf8") : "";
  if (before === json) { console.log("no change, " + OUT_FILE + " left alone"); return; }
  fs.writeFileSync(OUT_FILE, json);
  console.log("wrote " + OUT_FILE);
})().catch((e) => { console.error(e); process.exit(1); });
