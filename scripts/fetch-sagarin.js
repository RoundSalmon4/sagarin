#!/usr/bin/env node
/*
 * Pull the current cfsend.htm page, run it through the shared parser and write
 * data/ratings.json for the site. Used by the weekly GitHub Action and by hand.
 *
 *   node scripts/fetch-sagarin.js [--source URL] [--out PATH]
 *
 * fetched_at only moves when the data actually changes, so a no-op run leaves
 * the file untouched and the Action can skip the commit.
 */
"use strict";

const fs = require("fs");
const path = require("path");
const Sagarin = require("../assets/parser.js");

const DEFAULT_SOURCE = "http://sagarin.com/sports/cfsend.htm";
const DEFAULT_OUT = path.join(__dirname, "..", "data", "ratings.json");

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

async function fetchText(url, tries) {
  let lastErr;
  for (let attempt = 1; attempt <= tries; attempt++) {
    try {
      const res = await fetch(url, {
        redirect: "follow",
        headers: { "User-Agent": "sagarin-ratings-site/1.0" }
      });
      if (!res.ok) throw new Error("HTTP " + res.status);
      return await res.text();
    } catch (err) {
      lastErr = err;
      if (attempt < tries) {
        await new Promise((r) => setTimeout(r, attempt * 3000));
      }
    }
  }
  throw lastErr;
}

function readExisting(outPath) {
  try {
    return JSON.parse(fs.readFileSync(outPath, "utf8"));
  } catch (err) {
    return null;
  }
}

async function main() {
  const source = arg("--source", DEFAULT_SOURCE);
  const outPath = arg("--out", DEFAULT_OUT);

  console.log("fetching " + source);
  const html = await fetchText(source, 4);

  const parsed = Sagarin.parse(html);
  if (!parsed.teams.length) {
    throw new Error("parser found no teams, page layout may have changed");
  }

  const existing = readExisting(outPath);
  const unchanged = existing && existing.signature === parsed.signature;

  const out = {
    source: source,
    signature: parsed.signature,
    fetched_at: unchanged ? existing.fetched_at : new Date().toISOString(),
    meta: parsed.meta,
    conferences: parsed.conferences,
    teams: parsed.teams,
    predictions: parsed.predictions
  };

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2) + "\n", "utf8");

  console.log(
    "week " +
      parsed.meta.week +
      ", " +
      parsed.teams.length +
      " teams, " +
      parsed.conferences.length +
      " conferences, " +
      parsed.predictions.regular.length +
      " predictions, signature " +
      parsed.signature +
      (unchanged ? " (unchanged)" : " (updated)")
  );
}

main().catch((err) => {
  console.error("error: " + err.message);
  process.exit(1);
});
