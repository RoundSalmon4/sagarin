#!/usr/bin/env node
/*
 * Build a BCS-style rating for the current season.
 *
 * The old BCS averaged three parts: the Harris poll, the Coaches poll and six
 * computer rankings. Harris is gone, so the AP poll takes its place. Each poll
 * is scored as points divided by the most a team could get (25 for each voter).
 * Every computer gives 25 points for a first place down to 1 for 25th, a team
 * unranked by a computer gets nothing, and the BCS then threw out each team's
 * highest and lowest of the six and kept the middle four over 100.
 *
 * The six computers are Sagarin, Colley, Billingsley, Anderson & Hester, Massey
 * and Wolfe. Sagarin, Colley, Billingsley, Anderson & Hester and Wolfe are read
 * straight from their pages; Massey sits behind Cloudflare, so it is rendered
 * through Firecrawl when FIRECRAWL_API_KEY is set.
 *
 * The score only appears on the site once the CFP rankings are posted, so this
 * stops at data/bcs.json.
 *
 * Writes data/bcs.json. Run after data/ratings.json and data/ap-poll.json.
 *
 *   node scripts/fetch-bcs.js [--out PATH]
 */
"use strict";

const fs = require("fs");
const path = require("path");
const Alias = require("../assets/team-alias.js");
const Sagarin = require("../assets/parser.js");

const RATINGS = path.join(__dirname, "..", "data", "ratings.json");
const POLLS = path.join(__dirname, "..", "data", "ap-poll.json");
const DEFAULT_OUT = path.join(__dirname, "..", "data", "bcs.json");

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

const SAGARIN_URL = "http://sagarin.com/sports/cfsend.htm";
const COLLEY_URL = "https://www.colleyrankings.com/";
const BILLINGSLEY_URL = "https://cfrc.com/";
const ANDERSON_URL = "http://www.andersonsports.com/football/ACF_frnk.html";
const MASSEY_URL = "https://masseyratings.com/cf/ratings";
const WOLFE_URL = "https://wolferatings.com/ratings.htm";
const FIRECRAWL_URL = "https://api.firecrawl.dev/v1/scrape";

// Names the computer sites use that neither match a Sagarin name nor appear in
// the shared ESPN alias list. Keys are normalized, values are Sagarin names.
const COMPUTER_ALIAS = {
  "miami fl": "Miami-Florida",
  "miami fla": "Miami-Florida",
  "brigham young": "BYU",
  "ohio st": "Ohio State",
  "boise st": "Boise State",
  "pitt": "Pittsburgh",
  "appalachian st": "Appalachian State",
  "fresno st": "Fresno State",
  "san diego st": "San Diego State",
  "colorado st": "Colorado State",
  "oklahoma st": "Oklahoma State",
  "oregon st": "Oregon State",
  "kansas st": "Kansas State",
  "michigan st": "Michigan State",
  "mississippi st": "Mississippi State",
  "nc st": "NC State",
  "north carolina st": "NC State",
  "north carolina state": "NC State",
  "va tech": "Virginia Tech",
  "wash st": "Washington State",
  "washington st": "Washington State",
  "w virginia": "West Virginia",
  "w va": "West Virginia",
  "utah st": "Utah State",
  "jacksonville st": "Jacksonville State",
  "w kentucky": "Western Kentucky",
  "middle tenn": "Middle Tennessee",
  "middle tenn st": "Middle Tennessee",
  "ulm": "LouisianaMonroe(ULM)",
  "louisiana monroe": "LouisianaMonroe(ULM)",
  "central florida": "Central Florida(UCF)",
  "fiu": "Fla. International",
  "florida international": "Fla. International",
  "texas san antonio": "UTSA",
  "e carolina": "East Carolina",
  "e michigan": "Eastern Michigan",
  "w michigan": "Western Michigan",
  "c michigan": "Central Michigan",
  "n illinois": "Northern Illinois",
  "s illinois": "Southern Illinois",
  "n iowa": "Northern Iowa",
  "s dakota st": "South Dakota State",
  "n dakota st": "North Dakota State",
  "southern cal": "Southern California",
  "cal": "California"
};

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

function decode(s) {
  return String(s)
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#8217;|&rsquo;/g, "'")
    .replace(/&ndash;|&#8211;/g, "-")
    .replace(/&mdash;|&#8212;/g, "-")
    .replace(/&quot;/g, '"')
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function getText(url, tries) {
  let lastErr;
  for (let attempt = 1; attempt <= (tries || 4); attempt++) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 30000);
      const res = await fetch(url, {
        headers: { "User-Agent": UA, "Accept": "text/html,application/xhtml+xml" },
        signal: ctrl.signal,
        redirect: "follow"
      });
      clearTimeout(timer);
      if (!res.ok) throw new Error("HTTP " + res.status);
      return await res.text();
    } catch (err) {
      lastErr = err;
      if (attempt < (tries || 4)) await new Promise((r) => setTimeout(r, attempt * 1500));
    }
  }
  throw lastErr;
}

// Colley puts the current top 25 in the first column of the homepage, before
// the basketball list.
function parseColley(html) {
  const start = html.indexOf("Football&mdash;");
  const end = html.indexOf("Hoops&mdash;");
  const block = html.slice(start === -1 ? 0 : start, end === -1 ? html.length : end);
  const out = [];
  const re = /(\d+)\.\s*<a[^>]*>([^<]+)<\/a>/g;
  let m;
  while ((m = re.exec(block))) {
    const rank = parseInt(m[1], 10);
    if (rank >= 1 && rank <= 25) out.push({ rank: rank, team: decode(m[2]) });
  }
  return out;
}

// Anderson & Hester rows look like:
//   <td><div align="center">1.</div></td><td>Indiana</td><td>.861</td>
function parseAnderson(html) {
  const out = [];
  const re = /<div align="center">(\d+)\.<\/div><\/td>\s*<td[^>]*>([^<]+)<\/td>/g;
  let m;
  while ((m = re.exec(html))) {
    const rank = parseInt(m[1], 10);
    if (rank >= 1 && rank <= 25) out.push({ rank: rank, team: decode(m[2]) });
  }
  return out;
}

// Billingsley week pages are a table with season, week, rank, team, ... cells.
function parseBillingsley(html) {
  const out = [];
  const rows = html.match(/<tr\b[^>]*>[\s\S]*?<\/tr>/g) || [];
  rows.forEach((row) => {
    const cells = (row.match(/<td\b[^>]*>[\s\S]*?<\/td>/g) || []).map(decode);
    if (cells.length < 5) return;
    const rank = parseInt(cells[2], 10);
    if (!(rank >= 1 && rank <= 25)) return;
    const team = cells[3];
    if (!team) return;
    out.push({ rank: rank, team: team });
  });
  return out;
}

// Massey comes back from Firecrawl as a markdown table. The rating cell holds
// the overall rank and the value, like "1<br>9.23".
function parseMassey(markdown) {
  const out = [];
  const lines = String(markdown).split("\n");
  const start = lines.findIndex((l) => l.indexOf("| Team | Rec |") === 0);
  if (start === -1) return out;
  for (let i = start + 2; i < lines.length && lines[i].indexOf("|") === 0; i++) {
    if (lines[i].indexOf("| [") !== 0) continue;
    const cells = lines[i].split("|").map((c) => c.trim());
    const name = cells[1] && cells[1].match(/\[([^\]]+)\]/);
    const rank = cells[4] && cells[4].match(/^(\d+)/);
    if (name && rank) {
      const n = parseInt(rank[1], 10);
      if (n >= 1 && n <= 25) out.push({ rank: n, team: name[1] });
    }
  }
  return out;
}

// Wolfe prints a fixed-width list: " 1 Miami FL  FBS 6 0 ...".
function parseWolfe(text) {
  const fbs = [];
  String(text).split("\n").forEach((line) => {
    const m = line.match(/^\s*(\d+)\s+(.+?)\s+(FBS|FCS|II|III|NAIA)\s+\d+\s+\d+\s+\d+\s+\d+\s+[-\d.]+/);
    if (m && m[3] === "FBS") fbs.push(m[2].trim());
  });
  return fbs.slice(0, 25).map((team, i) => ({ rank: i + 1, team: team }));
}

async function fetchMassey() {
  const key = process.env.FIRECRAWL_API_KEY || process.env.FC_KEY;
  if (!key) throw new Error("Massey needs FIRECRAWL_API_KEY in the environment");
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 90000);
  const res = await fetch(FIRECRAWL_URL, {
    method: "POST",
    headers: { "Authorization": "Bearer " + key, "Content-Type": "application/json" },
    body: JSON.stringify({ url: MASSEY_URL, formats: ["markdown"], onlyMainContent: false, waitFor: 6000 }),
    signal: ctrl.signal
  });
  clearTimeout(timer);
  if (!res.ok) throw new Error("Firecrawl HTTP " + res.status);
  const json = await res.json();
  if (!json.success) throw new Error("Firecrawl: " + (json.error || "failed"));
  return (json.data && json.data.markdown) || "";
}

function main() {
  const outPath = arg("--out", DEFAULT_OUT);
  const ratings = JSON.parse(fs.readFileSync(RATINGS, "utf8"));
  const polls = JSON.parse(fs.readFileSync(POLLS, "utf8"));
  const season = ratings.meta.season;

  const bySag = {};
  const byAlias = {};
  ratings.teams.forEach((t) => {
    const k = normalize(t.team);
    if (k) bySag[k] = t.team;
    const a = Alias[k];
    if (a && !(a in byAlias)) byAlias[a] = t.team;
  });

  function match(name) {
    const k = normalize(name);
    return bySag[k] || byAlias[k] || COMPUTER_ALIAS[k] || null;
  }

  // Keep one entry per rank and make sure a site change did not quietly break
  // the parse. Anything other than a full 1-25 stops the run before it writes.
  function validate(label, ranks) {
    const seen = {};
    ranks.forEach((r) => { if (!(r.rank in seen)) seen[r.rank] = r; });
    const keys = Object.keys(seen).map(Number).sort((a, b) => a - b);
    if (keys.length !== 25 || keys[0] !== 1 || keys[24] !== 25) {
      throw new Error(label + " expected ranks 1-25, got " + keys.length);
    }
    return keys.map((n) => seen[n]);
  }

  // Sagarin's overall RATING, limited to FBS and numbered from the top of that
  // group. The BCS used Sagarin's Elo Chess, which the page no longer prints.
  const sagarin = ratings.teams
    .filter((t) => t.level === "A")
    .slice()
    .sort((a, b) => a.rank - b.rank)
    .slice(0, 25)
    .map((t, i) => ({ rank: i + 1, team: t.team }));

  return Promise.all([
    getText(COLLEY_URL).then(parseColley),
    getText(BILLINGSLEY_URL).then((home) => {
      const m = home.match(/\/weekly-rankings\/(\d{4})\/(\d+)/);
      if (!m) throw new Error("Billingsley week link not found");
      return getText("https://cfrc.com" + m[0]).then(parseBillingsley);
    }),
    getText(ANDERSON_URL).then(parseAnderson),
    fetchMassey().then(parseMassey),
    getText(WOLFE_URL).then(parseWolfe)
  ]).then(([colley, billingsley, anderson, massey, wolfe]) => {
    const systems = [
      { key: "sagarin", label: "Sagarin", ranks: sagarin },
      { key: "colley", label: "Colley", ranks: colley },
      { key: "billingsley", label: "Billingsley", ranks: billingsley },
      { key: "anderson", label: "Anderson & Hester", ranks: anderson },
      { key: "massey", label: "Massey", ranks: massey },
      { key: "wolfe", label: "Wolfe", ranks: wolfe }
    ];
    systems.forEach((s) => { s.ranks = validate(s.label, s.ranks); });

    const computerRanks = {};
    const unmatched = [];
    systems.forEach((s) => {
      s.ranks.forEach((r) => {
        const team = s.key === "sagarin" ? r.team : match(r.team);
        if (!team) { unmatched.push(s.label + ": " + r.team); return; }
        if (!computerRanks[team]) computerRanks[team] = {};
        if (computerRanks[team][s.key] == null) computerRanks[team][s.key] = r.rank;
      });
    });

    // Human polls: points over the maximum for that poll. Teams outside a top
    // 25 score zero, which is how the BCS treated them.
    function pollPct(poll, team) {
      if (!poll) return null;
      const r = (poll.ranks || []).filter((x) => x.sagarin === team)[0];
      if (!r || r.points == null) return null;
      const max = poll.maxPoints || (poll.voters || 0) * 25;
      return max ? r.points / max : null;
    }

    const ap = polls.polls && polls.polls.ap;
    const coaches = polls.polls && polls.polls.usa;
    if (!ap) throw new Error("AP poll not found in " + POLLS);
    if (!coaches) throw new Error("Coaches poll not found in " + POLLS);

    const teams = {};
    const list = [];
    ratings.teams.forEach((t) => {
      const ranks = computerRanks[t.team] || {};
      // Six point values, 25 down to 1 for a ranking and 0 for a miss. Drop the
      // highest and the lowest and sum the middle four, over 100.
      const values = systems.map((s) => (ranks[s.key] ? 26 - ranks[s.key] : 0)).sort((a, b) => a - b);
      const computer = values.slice(1, 5).reduce((sum, v) => sum + v, 0) / 100;
      const apPct = pollPct(ap, t.team) || 0;
      const coachesPct = pollPct(coaches, t.team) || 0;
      const score = (apPct + coachesPct + computer) / 3;
      const rec = {
        score: score,
        ap: apPct,
        coaches: coachesPct,
        computer: computer,
        apRank: ap.byTeam[t.team] || null,
        coachesRank: coaches.byTeam[t.team] || null,
        computerRanks: ranks
      };
      teams[t.team] = rec;
      list.push({ team: t.team, score: score, apRank: rec.apRank, coachesRank: rec.coachesRank, computer: computer });
    });

    const rankOf = {};
    ratings.teams.forEach((t) => { rankOf[t.team] = t.rank; });
    list.sort((a, b) => b.score - a.score || rankOf[a.team] - rankOf[b.team]);
    const ranks = list.map((r, i) => {
      teams[r.team].rank = i + 1;
      return { rank: i + 1, team: r.team, score: r.score, apRank: r.apRank, coachesRank: r.coachesRank, computer: r.computer };
    });

    const inputs = systems.map((s) => s.label + " " + s.ranks.length);
    const signature = Sagarin.hash(
      ranks.slice(0, 40).map((r) => r.rank + ":" + r.team + ":" + r.score.toFixed(6)).join("|")
    );
    const out = {
      source: [SAGARIN_URL, COLLEY_URL, BILLINGSLEY_URL, ANDERSON_URL, MASSEY_URL, WOLFE_URL],
      fetched_at: new Date().toISOString(),
      season: season,
      through: ratings.meta.through || null,
      method: "BCS: (AP + Coaches + computer) / 3, Harris replaced by AP. Six computers, high and low dropped, middle four over 100.",
      inputs: inputs,
      signature: signature,
      ranks: ranks,
      teams: teams
    };

    let existing = null;
    try { existing = JSON.parse(fs.readFileSync(outPath, "utf8")); } catch (e) { existing = null; }
    if (existing && existing.signature === signature && existing.fetched_at) out.fetched_at = existing.fetched_at;

    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, JSON.stringify(out, null, 2) + "\n", "utf8");

    console.log("wrote bcs " + inputs.join(", ") + ", signature " + signature +
      (existing && existing.signature === signature ? " (unchanged)" : " (updated)"));
    if (unmatched.length) console.log("unmatched: " + unmatched.join("; "));
    console.log("top 10: " + ranks.slice(0, 10).map((r) => r.rank + " " + r.team + " " + r.score.toFixed(4)).join(", "));
  });
}

main().catch((err) => {
  console.error("error: " + err.message);
  process.exit(1);
});
