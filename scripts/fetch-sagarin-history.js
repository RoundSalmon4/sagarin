#!/usr/bin/env node
/*
 * Backfill the weekly ratings history from Wayback Machine snapshots of
 * cfsend.htm, writing the same data/history/<season>/week-<n>.json shape as the
 * live archiver.
 *
 * Wayback captured the page at least once most weeks since 2015, so this can
 * recover weeks that were never archived live. Coverage is not guaranteed: a
 * week with no snapshot is simply skipped, and old seasons whose page layout the
 * parser does not understand yet come back with zero teams and are skipped too.
 *
 *   node scripts/fetch-sagarin-history.js [--season 2026] [--dry-run]
 */
"use strict";

const path = require("path");
const Sagarin = require("../assets/parser.js");
const util = require("./history-util.js");

const ROOT = path.join(__dirname, "..");
const CDX = "http://web.archive.org/cdx/search/cdx?url=sagarin.com/sports/cfsend.htm";
const RAW = "https://web.archive.org/web/";
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}
function has(name) { return process.argv.indexOf(name) !== -1; }

async function fetchText(url, tries) {
  let lastErr;
  for (let attempt = 1; attempt <= tries; attempt++) {
    try {
      const res = await fetch(url, { redirect: "follow", headers: { "User-Agent": "sagarin-ratings-site/1.0" } });
      if (!res.ok) throw new Error("HTTP " + res.status);
      return await res.text();
    } catch (err) {
      lastErr = err;
      if (attempt < tries) await new Promise((r) => setTimeout(r, attempt * 2000));
    }
  }
  throw lastErr;
}

function stripText(html) {
  return String(html).replace(/<[^>]*>/g, "").replace(/&nbsp;/gi, " ");
}

function tsToIso(ts) {
  return ts.slice(0, 4) + "-" + ts.slice(4, 6) + "-" + ts.slice(6, 8) + "T" +
    ts.slice(8, 10) + ":" + ts.slice(10, 12) + ":" + ts.slice(12, 14) + "Z";
}

function median(nums) {
  const s = nums.slice().sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

async function snapshots(season) {
  const from = season + "0101";
  const to = (season + 1) + "0215";
  const url = CDX + "&output=json&filter=statuscode:200&collapse=digest&from=" + from + "&to=" + to;
  const res = await fetch(url, { headers: { "User-Agent": "sagarin-ratings-site/1.0" } });
  if (!res.ok) throw new Error("CDX HTTP " + res.status);
  const j = await res.json();
  return j.slice(1).map((row) => row[1]);
}

async function main() {
  const current = util.readJson(path.join(ROOT, "data", "ratings.json"));
  const defaultSeason = (current && current.meta && current.meta.season) || new Date().getUTCFullYear();
  const season = Number(arg("--season", defaultSeason));
  const dryRun = has("--dry-run");

  console.log("backfilling season " + season + (dryRun ? " (dry run)" : ""));
  const tss = await snapshots(season);
  console.log("wayback snapshots: " + tss.length);

  const lo = Date.UTC(season, 7, 1);
  const hi = Date.UTC(season + 1, 1, 15);
  const records = [];

  for (const ts of tss) {
    const page = RAW + ts + "id_/http://sagarin.com/sports/cfsend.htm";
    try {
      const html = await fetchText(page, 3);
      const parsed = Sagarin.parse(html);
      const text = stripText(html);
      const through = util.throughMs(text, season);
      if (!parsed.teams.length) { console.log("  " + ts + " skipped (0 teams)"); continue; }
      if (through === null) { console.log("  " + ts + " skipped (no through date)"); continue; }
      if (through < lo || through > hi) { console.log("  " + ts + " skipped (offseason)"); continue; }
      records.push({ ts: ts, through: through, label: parsed.meta.week, parsed: parsed });
    } catch (err) {
      console.log("  " + ts + " failed: " + err.message);
    }
    await new Promise((r) => setTimeout(r, 700));
  }

  if (!records.length) { console.log("no usable snapshots found"); return; }

  const labeled = records.filter((r) => r.label !== null && r.label !== undefined);
  let anchor;
  if (labeled.length) {
    anchor = median(labeled.map((r) => r.through - r.label * WEEK_MS));
  } else {
    anchor = records.reduce((a, b) => (a.through < b.through ? a : b)).through;
    console.log("no WEEK labels found, anchoring at the earliest snapshot");
  }

  const byWeek = {};
  records.sort((a, b) => (a.ts < b.ts ? -1 : 1));
  records.forEach((r) => {
    r.week = Math.round((r.through - anchor) / WEEK_MS);
    byWeek[r.week] = r;
  });

  let wrote = 0, skipped = 0;
  Object.keys(byWeek).map(Number).sort((a, b) => a - b).forEach((week) => {
    const r = byWeek[week];
    const file = util.weekFile(ROOT, season, week);
    const existing = util.readJson(file);
    if (existing && existing.signature === r.parsed.signature) {
      console.log("  week " + week + " already archived");
      skipped++;
      return;
    }
    const obj = util.compact(r.parsed, {
      season: season,
      week: week,
      through: r.parsed.meta.through || util.isoDay(r.through),
      through_date: util.isoDay(r.through),
      captured_at: tsToIso(r.ts),
      source: RAW + r.ts + "/http://sagarin.com/sports/cfsend.htm"
    });
    if (dryRun) {
      console.log("  would write week " + week + " (" + obj.teams.length + " teams, through " + obj.through_date + ")");
    } else {
      util.writeJson(file, obj);
      console.log("  wrote week " + week + " (" + obj.teams.length + " teams, through " + obj.through_date + ")");
    }
    wrote++;
  });

  console.log((dryRun ? "dry run: " : "") + wrote + " week(s) " + (dryRun ? "to write" : "written") + ", " + skipped + " already present");
}

main().catch((err) => {
  console.error("error: " + err.message);
  process.exit(1);
});
