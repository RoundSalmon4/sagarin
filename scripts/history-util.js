#!/usr/bin/env node
/*
 * Shared helpers for the weekly ratings archive under data/history.
 *
 * Both the live archiver (archive-ratings.js) and the Wayback backfill
 * (fetch-sagarin-history.js) write the same shape, one file per season week:
 *
 *   data/history/<season>/week-<n>.json
 *
 * The payload keeps the meta line and a trimmed copy of each team row. The full
 * parsed file (predictions, conference table, the sched-rank columns we do not
 * use) is left in data/ratings.json so the history stays small and easy to diff.
 */
"use strict";

const fs = require("fs");
const path = require("path");

const TEAM_FIELDS = [
  "rank", "team", "level", "conference", "confLevel",
  "rating", "w", "l", "sched",
  "predictor", "goldenMean", "recent", "strongRecent"
];

const MONTHS = {
  JANUARY: 0, FEBRUARY: 1, MARCH: 2, APRIL: 3, MAY: 4, JUNE: 5,
  JULY: 6, AUGUST: 7, SEPTEMBER: 8, OCTOBER: 9, NOVEMBER: 10, DECEMBER: 11
};

// "AUGUST 29" or "2025 SEPTEMBER 13" plus a season -> epoch ms (UTC).
function throughMs(text, season) {
  const m = /through results of\s+(?:(\d{4})\s+)?([A-Za-z]+)\s+(\d{1,2})/i.exec(text);
  if (!m) return null;
  const mon = MONTHS[m[2].toUpperCase()];
  if (mon === undefined) return null;
  return Date.UTC(season, mon, parseInt(m[3], 10));
}

// Same date as a plain yyyy-mm-dd string.
function isoDay(ms) {
  return new Date(ms).toISOString().slice(0, 10);
}

// "OCTOBER 17" plus a season -> epoch ms (UTC), for the live page meta line.
function metaThroughMs(through, season) {
  const m = /^([A-Za-z]+)\s+(\d{1,2})/.exec(String(through || "").trim());
  if (!m) return null;
  const mon = MONTHS[m[1].toUpperCase()];
  if (mon === undefined) return null;
  return Date.UTC(season, mon, parseInt(m[2], 10));
}

function compact(parsed, meta) {
  return {
    season: meta.season,
    week: meta.week,
    through: meta.through,
    through_date: meta.through_date || null,
    captured_at: meta.captured_at,
    source: meta.source,
    signature: parsed.signature,
    homeAdvantage: parsed.meta.homeAdvantage,
    teams: parsed.teams.map(function (t) {
      const o = {};
      TEAM_FIELDS.forEach(function (f) { o[f] = t[f]; });
      return o;
    })
  };
}

function weekFile(repoRoot, season, week) {
  return path.join(repoRoot, "data", "history", String(season), "week-" + week + ".json");
}

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch (e) { return null; }
}

function writeJson(file, obj) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(obj, null, 2) + "\n", "utf8");
}

module.exports = {
  TEAM_FIELDS, MONTHS,
  throughMs, metaThroughMs, isoDay,
  compact, weekFile, readJson, writeJson
};
