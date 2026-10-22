#!/usr/bin/env node
/*
 * Fit the resume score used by the playoff predictor:
 *   rating - lossPenalty*losses + sosWeight*(schedule - mean schedule)
 *
 * The loss penalty is fixed. The SOS weight is the value that maximizes the
 * rank correlation (Spearman) between the resume order and the CFP committee's
 * final top 25, averaged over every archived season. Inputs live in
 * data/cfp-finals.json and data/sagarin-finals.json; this writes
 * data/resume-weights.json. Add --refresh to pull the inputs again first.
 *
 *   node scripts/calibrate-resume.js [--penalty 5] [--refresh]
 */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const CFP_FILE = path.join(ROOT, "data", "cfp-finals.json");
const SAG_FILE = path.join(ROOT, "data", "sagarin-finals.json");
const OUT_FILE = path.join(ROOT, "data", "resume-weights.json");
const CFP_API = "https://collegefootballplayoff.com/api/v2/rankings?year=";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}
function normalize(s) {
  return String(s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[.'&()]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

// CFP school names that differ from the Sagarin name.
const ALIAS = {
  "ole miss": "Mississippi", "miami": "Miami-Florida", "miami fl": "Miami-Florida",
  "miami oh": "Miami-Ohio", "usc": "Southern California",
  "southern california": "Southern California", "nc state": "North Carolina State",
  "northwestern university": "Northwestern", "san jose state university": "San Jose State",
  "louisiana": "Louisiana-Lafayette", "army": "Army West Point",
  "app state": "App State", "pitt": "Pittsburgh"
};

function matchTeam(name, teams) {
  const n = normalize(name);
  let hit = teams.filter((t) => normalize(t.team) === n);
  if (hit.length === 1) return hit[0];
  const a = ALIAS[n];
  if (a) { hit = teams.filter((t) => t.team === a); if (hit.length === 1) return hit[0]; }
  hit = teams.filter((t) => normalize(t.team).indexOf(n) !== -1 || n.indexOf(normalize(t.team)) !== -1);
  return hit.length === 1 ? hit[0] : null;
}

function spearman(a, b) {
  const n = a.length;
  const rk = (v) => {
    const idx = v.map((_, i) => i).sort((i, j) => v[i] - v[j]);
    const r = new Array(n);
    idx.forEach((k, i) => { r[k] = i + 1; });
    return r;
  };
  const ra = rk(a), rb = rk(b);
  let d = 0;
  for (let i = 0; i < n; i++) d += (ra[i] - rb[i]) * (ra[i] - rb[i]);
  return 1 - (6 * d) / (n * (n * n - 1));
}
function loadInputs() {
  const cfp = JSON.parse(fs.readFileSync(CFP_FILE, "utf8")).seasons;
  const sag = JSON.parse(fs.readFileSync(SAG_FILE, "utf8")).seasons;
  return Object.keys(cfp).filter((y) => sag[y] && sag[y].teams && sag[y].teams.length > 100).sort().map((y) => {
    const teams = sag[y].teams;
    const avg = teams.reduce((s, t) => s + (t.sched || 0), 0) / teams.length;
    const rows = [];
    cfp[y].forEach((t, i) => { const m = matchTeam(t.team, teams); if (m) rows.push({ r: i + 1, t: m }); });
    return { season: y, avg: avg, rows: rows, count: teams.length, through: sag[y].through || "" };
  });
}

function meanSpearman(data, penalty, w) {
  let sum = 0;
  data.forEach((d) => {
    const s = d.rows.map((o) => -(o.t.rating - penalty * (o.t.l || 0) + w * ((o.t.sched || 0) - d.avg)));
    sum += spearman(s, d.rows.map((o) => o.r));
  });
  return sum / data.length;
}

function fit(data, penalty) {
  let best = { w: 0, score: -Infinity };
  for (let w = 0; w <= 1.5001; w += 0.05) {
    const score = meanSpearman(data, penalty, w);
    if (score > best.score + 1e-9) best = { w: Math.round(w * 100) / 100, score: score };
  }
  return best;
}

const round4 = (x) => Math.round(x * 10000) / 10000;
async function get(url, tries) {
  let last;
  for (let a = 1; a <= tries; a++) {
    try {
      const r = await fetch(url, { headers: { "User-Agent": "sagarin-site/1.0" } });
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r;
    } catch (e) { last = e; await sleep(a * 1000); }
  }
  throw last;
}

// CFP finals come from the committee's own API. The final ranking each season
// is the December release, so a season only counts once the API shows one.
async function cfpFinal(y) {
  const r = await get(CFP_API + y, 4);
  let j;
  try { j = JSON.parse(await r.text()); } catch (e) { return null; }
  const a = Array.isArray(j) ? j : (j.rankings || []);
  if (!a.length) return null;
  const f = a.slice().sort((p, q) => String(q.releaseDate || "").localeCompare(String(p.releaseDate || "")))[0];
  const date = (f.releaseDate || "").slice(0, 10);
  if (!/-12-/.test(date)) return null;
  return { date: date, teams: (f.teams || []).map((t) => ({ rank: t.rank, team: t.team })) };
}
async function sagFinal(Parser, y) {
  // Sagarin final: the last capture in early December, a week later in 2020.
  const cdx = "http://web.archive.org/cdx/search/cdx?url=sagarin.com/sports/cfsend.htm&from=" + y + "0101&to=" + y + "1231&output=json&fl=timestamp,statuscode";
  const caps = (await (await get(cdx, 4)).json()).slice(1).filter((x) => x[1] === "200").map((x) => x[0]);
  const to = y + "12" + (y === 2020 ? "22" : "15");
  const win = caps.filter((t) => t.slice(0, 8) >= y + "1201" && t.slice(0, 8) <= to);
  if (!win.length) return null;
  const ts = win[win.length - 1];
  const parsed = Parser.parse(await (await get("https://web.archive.org/web/" + ts + "/http://sagarin.com/sports/cfsend.htm", 5)).text());
  return {
    through: parsed.meta.through || null,
    week: parsed.meta.week || null,
    captured: ts,
    teams: parsed.teams.filter((t) => t.level === "A").map((t) => ({ rank: t.rank, team: t.team, rating: t.rating, w: t.w, l: t.l, sched: t.sched }))
  };
}
async function refresh() {
  const Parser = require(path.join(ROOT, "assets", "parser.js"));
  const cfp = { source: "collegefootballplayoff.com/api/v2/rankings (final release of each season)", seasons: {} };
  const sag = { source: "web.archive.org snapshots of sagarin.com/sports/cfsend.htm (around the conference championships)", seasons: {} };
  const end = new Date().getUTCFullYear();
  const oldSag = fs.existsSync(SAG_FILE) ? JSON.parse(fs.readFileSync(SAG_FILE, "utf8")).seasons : {};
  for (let y = 2014; y <= end; y++) {
    const f = await cfpFinal(y);
    if (f) cfp.seasons[y] = f.teams;
    console.log("cfp", y, f ? f.date + " " + f.teams.length : "no final yet");
    await sleep(200);
    if (!f) continue;
    if (oldSag[y] && oldSag[y].teams && oldSag[y].teams.length > 100) { sag.seasons[y] = oldSag[y]; continue; }
    const s = await sagFinal(Parser, y);
    if (s) { sag.seasons[y] = s; console.log("sag", y, s.captured, "FBS", s.teams.length); }
    else console.log("sag", y, "no capture");
    await sleep(400);
  }
  const need = Object.keys(cfp.seasons).filter((y) => !(oldSag[y] && oldSag[y].teams && oldSag[y].teams.length > 100));
  if (!need.length) {
    console.log("no new final CFP ranking past " + Object.keys(cfp.seasons).sort().slice(-1)[0] + ", nothing to update");
    return false;
  }
  fs.writeFileSync(CFP_FILE, JSON.stringify(cfp, null, 1) + "\n");
  fs.writeFileSync(SAG_FILE, JSON.stringify(sag, null, 1) + "\n");
  return true;
}
async function main() {
  const penalty = Number(arg("--penalty", 5));
  if (process.argv.indexOf("--refresh") !== -1) {
    console.log("refreshing inputs from the CFP API and Wayback Machine...");
    if ((await refresh()) === false) { console.log("weights left unchanged"); return; }
  }
  const data = loadInputs();
  const base = meanSpearman(data, penalty, 0);
  const best = fit(data, penalty);
  const out = {
    lossPenalty: penalty,
    sosWeight: best.w,
    method: "rank-correlation-fit",
    target: "CFP final top 25",
    seasons: data.map((d) => d.season),
    teamCounts: data.map((d) => d.count),
    fit: { sosWeight: best.w, meanSpearman: round4(best.score), meanSpearmanNoSos: round4(base) },
    source: "collegefootballplayoff.com/api/v2/rankings; web.archive.org snapshots of sagarin.com/sports/cfsend.htm",
    updated: new Date().toISOString().slice(0, 10)
  };
  fs.writeFileSync(OUT_FILE, JSON.stringify(out, null, 2) + "\n");
  console.log("seasons " + out.seasons.join(","));
  console.log("loss penalty " + penalty + ", sos weight " + best.w);
  console.log("mean Spearman: no SOS " + round4(base) + ", with SOS " + round4(best.score));
}
main().catch((e) => { console.error(e); process.exit(1); });
