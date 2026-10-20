#!/usr/bin/env node
/*
 * Copy the current data/ratings.json into the weekly history store:
 *
 *   data/history/<season>/week-<n>.json
 *
 * Runs at the end of the weekly data refresh, so every week going forward is
 * kept. Idempotent: if the week is already archived with the same signature it
 * does nothing, so a repeat run (or a Monday safety run) leaves the tree clean.
 *
 *   node scripts/archive-ratings.js [--ratings PATH]
 */
"use strict";

const path = require("path");
const util = require("./history-util.js");

const ROOT = path.join(__dirname, "..");

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

function main() {
  const ratingsPath = arg("--ratings", path.join(ROOT, "data", "ratings.json"));
  const data = util.readJson(ratingsPath);
  if (!data || !data.meta) {
    console.error("no ratings.json to archive");
    process.exit(1);
  }

  const season = data.meta.season;
  const week = data.meta.week;
  if (season === null || season === undefined || week === null || week === undefined) {
    console.log("ratings.json has no season/week yet, nothing to archive");
    return;
  }

  const file = util.weekFile(ROOT, season, week);
  const existing = util.readJson(file);
  if (existing && existing.signature === data.signature) {
    console.log("week " + week + " already archived (signature " + data.signature + ")");
    return;
  }

  const ms = util.metaThroughMs(data.meta.through, season);
  const obj = util.compact(data, {
    season: season,
    week: week,
    through: data.meta.through,
    through_date: ms === null ? null : util.isoDay(ms),
    captured_at: data.fetched_at || new Date().toISOString(),
    source: data.source
  });

  util.writeJson(file, obj);
  console.log("archived week " + week + " to " + path.relative(ROOT, file) + " (" + obj.teams.length + " teams)");
}

main();
