#!/usr/bin/env node
/*
 * Download team logos once and host them in the repo, so the browser never has
 * to hit ESPN CDN on page load. Logos come from ESPN's team logo CDN:
 *   https://a.espncdn.com/i/teamlogos/ncaa/500/{id}.png        (light)
 *   https://a.espncdn.com/i/teamlogos/ncaa/500-dark/{id}.png   (dark)
 * Only teams already matched in data/espn-games.json are fetched.
 *
 * Writes assets/logos/{id}.png, assets/logos/{id}-dark.png, and a small
 * data/logos.json manifest the site reads to know which files exist.
 *
 *   node scripts/fetch-logos.js [--force] [--concurrency N]
 */
"use strict";

const fs = require("fs");
const path = require("path");
const Sagarin = require("../assets/parser.js");

const ESPN_LOGO = "https://a.espncdn.com/i/teamlogos/ncaa/500";
const ESPN_CONF_LOGO = "https://a.espncdn.com/i/teamlogos/ncaa_conf/500";
const RATINGS = path.join(__dirname, "..", "data", "ratings.json");
const ESPN = path.join(__dirname, "..", "data", "espn-games.json");
const OUT_DIR = path.join(__dirname, "..", "assets", "logos");
const CONF_DIR = path.join(__dirname, "..", "assets", "conf-logos");
const MANIFEST = path.join(__dirname, "..", "data", "logos.json");

// Sagarin conference name to ESPN conference id. Ids come from ESPN's standings
// groups (FBS group=80, FCS group=81); divisions share their parent's logo.
const CONF_MAP = {
  "SEC": 8,
  "BIG TEN": 5,
  "BIG 12": 4,
  "ACC": 1,
  "PAC-12": 9,
  "AMERICAN": 151,
  "MOUNTAIN WEST": 17,
  "CONF-USA": 12,
  "MAC": 15,
  "SUN BELT EAST": 37,
  "SUN BELT WEST": 37,
  "I-A IND.": 18,
  "MISSOURI VALLEY": 21,
  "BIG SKY": 20,
  "IVY LEAGUE": 22,
  "SOUTHERN": 29,
  "UAC": 177,
  "SOUTHLAND": 30,
  "OVC-BIG SOUTH": 179,
  "COASTAL ATHLETIC": 48,
  "PATRIOT": 27,
  "SWAC-EAST": 31,
  "SWAC-WEST": 31,
  "MEAC": 24,
  "NORTHEAST": 25,
  "PIONEER": 28
};

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

async function fetchBuf(url, tries) {
  let lastErr;
  for (let attempt = 1; attempt <= tries; attempt++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": "sagarin-site/1.0" } });
      if (!res.ok) throw new Error("HTTP " + res.status);
      return Buffer.from(await res.arrayBuffer());
    } catch (err) {
      lastErr = err;
      if (attempt < tries) await new Promise((r) => setTimeout(r, attempt * 1200));
    }
  }
  throw lastErr;
}

async function pool(items, size, worker) {
  let i = 0;
  const runners = Array.from({ length: Math.min(size, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      await worker(items[idx]);
    }
  });
  await Promise.all(runners);
}

async function main() {
  const force = process.argv.indexOf("--force") !== -1;
  const concurrency = Number(arg("--concurrency", "8"));

  const espn = JSON.parse(fs.readFileSync(ESPN, "utf8"));
  const ids = espn.teams.map((t) => String(t.id)).filter(Boolean);
  let season = null;
  try { season = JSON.parse(fs.readFileSync(RATINGS, "utf8")).meta.season; } catch (e) {}

  fs.mkdirSync(OUT_DIR, { recursive: true });

  const have = { light: [], dark: [] };
  let downloaded = 0;
  let skipped = 0;

  console.log("fetching logos for " + ids.length + " teams");
  await pool(ids, concurrency, async (id) => {
    const targets = [
      { url: ESPN_LOGO + "/" + id + ".png", file: path.join(OUT_DIR, id + ".png"), key: "light" },
      { url: ESPN_LOGO + "-dark/" + id + ".png", file: path.join(OUT_DIR, id + "-dark.png"), key: "dark" }
    ];
    for (const t of targets) {
      if (!force && fs.existsSync(t.file)) {
        have[t.key].push(id);
        skipped++;
        continue;
      }
      try {
        const buf = await fetchBuf(t.url, 3);
        fs.writeFileSync(t.file, buf);
        have[t.key].push(id);
        downloaded++;
      } catch (err) {
        // No logo for this team (some FCS schools); leave it out of the manifest.
      }
    }
  });

  have.light.sort();
  have.dark.sort();

  // Conference logos.
  let confNames = [];
  try { confNames = JSON.parse(fs.readFileSync(RATINGS, "utf8")).conferences.map((c) => c.name); } catch (e) {}
  fs.mkdirSync(CONF_DIR, { recursive: true });
  const conf = [];
  for (const name of confNames) {
    const id = CONF_MAP[name];
    if (!id) { console.error("  no ESPN id for conference " + name); continue; }
    const rec = { name: name, id: String(id), light: false, dark: false };
    const targets = [
      { url: ESPN_CONF_LOGO + "/" + id + ".png", file: path.join(CONF_DIR, id + ".png"), key: "light" },
      { url: ESPN_CONF_LOGO + "-dark/" + id + ".png", file: path.join(CONF_DIR, id + "-dark.png"), key: "dark" }
    ];
    for (const t of targets) {
      if (!force && fs.existsSync(t.file)) { rec[t.key] = true; skipped++; continue; }
      try {
        const buf = await fetchBuf(t.url, 3);
        fs.writeFileSync(t.file, buf);
        rec[t.key] = true;
        downloaded++;
      } catch (err) {
        // A few smaller conferences have no logo on the CDN; skip them.
      }
    }
    conf.push(rec);
  }
  conf.sort((a, b) => a.name.localeCompare(b.name));

  const confSig = conf.map((c) => c.name + ":" + c.id + ":" + c.light + ":" + c.dark).join(",");
  const signature = Sagarin.hash(have.light.join(",") + "|" + have.dark.join(",") + "|" + confSig);
  let existing = null;
  try { existing = JSON.parse(fs.readFileSync(MANIFEST, "utf8")); } catch (e) { existing = null; }

  const out = {
    source: ESPN_LOGO,
    fetched_at: new Date().toISOString(),
    season: season,
    light: have.light,
    dark: have.dark,
    conf: conf,
    signature: signature
  };
  if (existing && existing.signature === signature && existing.fetched_at) {
    out.fetched_at = existing.fetched_at;
  }

  fs.writeFileSync(MANIFEST, JSON.stringify(out, null, 2) + "\n", "utf8");
  const withLogo = conf.filter((c) => c.light || c.dark).length;
  console.log("logos: " + have.light.length + " light, " + have.dark.length + " dark; " +
    withLogo + "/" + conf.length + " conference logos (" +
    downloaded + " downloaded, " + skipped + " already present), signature " + signature +
    (existing && existing.signature === signature ? " (unchanged)" : " (updated)"));
}

main().catch((err) => {
  console.error("error: " + err.message);
  process.exit(1);
});
