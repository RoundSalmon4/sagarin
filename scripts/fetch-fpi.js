#!/usr/bin/env node
/* Fetch ESPN FPI (Football Power Index) for the current season.
 * Parses the FPI table from the ESPN FPI page (two tables joined by data-idx).
 * Writes data/fpi.json. Intended for predictor/sim/head-to-head reference.
 */
"use strict";

const fs = require('fs');
const path = require('path');

const DEFAULT_OUT = path.join(__dirname, '..', 'data', 'fpi.json');
const ESPN_FPI_PAGE = 'https://www.espn.com/college-football/fpi/_/view/fpi';

// FPI team name (ESPN display name) -> Sagarin team name mapping
const FpiToSagarin = {
  "air force falcons": "Air Force",
  "akron zips": "Akron",
  "alabama crimson tide": "Alabama",
  "app state mountaineers": "Appalachian State",
  "arizona state sun devils": "Arizona State",
  "arizona wildcats": "Arizona",
  "arkansas razorbacks": "Arkansas",
  "arkansas state red wolves": "Arkansas State",
  "army black knights": "Army West Point",
  "auburn tigers": "Auburn",
  "byu cougars": "BYU",
  "ball state cardinals": "Ball State",
  "baylor bears": "Baylor",
  "boise state broncos": "Boise State",
  "boston college eagles": "Boston College",
  "bowling green falcons": "Bowling Green",
  "buffalo bulls": "Buffalo",
  "california golden bears": "California",
  "central michigan chippewas": "Central Michigan",
  "charlotte 49ers": "Charlotte",
  "cincinnati bearcats": "Cincinnati",
  "clemson tigers": "Clemson",
  "coastal carolina chanticleers": "Coastal Carolina",
  "colorado buffaloes": "Colorado",
  "colorado state rams": "Colorado State",
  "delaware blue hens": "Delaware",
  "duke blue devils": "Duke",
  "east carolina pirates": "East Carolina",
  "eastern michigan eagles": "Eastern Michigan",
  "florida atlantic owls": "Florida Atlantic",
  "florida gators": "Florida",
  "florida international panthers": "Fla. International",
  "florida state seminoles": "Florida State",
  "fresno state bulldogs": "Fresno State",
  "georgia bulldogs": "Georgia",
  "georgia southern eagles": "Georgia Southern",
  "georgia state panthers": "Georgia State",
  "georgia tech yellow jackets": "Georgia Tech",
  "hawaii rainbow warriors": "Hawai'i",
  "houston cougars": "Houston",
  "illinois fighting illini": "Illinois",
  "indiana hoosiers": "Indiana",
  "iowa hawkeyes": "Iowa",
  "iowa state cyclones": "Iowa State",
  "jacksonville state gamecocks": "Jacksonville State",
  "james madison dukes": "James Madison",
  "kansas jayhawks": "Kansas",
  "kansas state wildcats": "Kansas State",
  "kennesaw state owls": "Kennesaw State",
  "kent state golden flashes": "Kent State",
  "kentucky wildcats": "Kentucky",
  "lsu tigers": "LSU",
  "liberty flames": "Liberty",
  "louisiana ragin cajuns": "Louisiana-Lafayette",
  "texas a m aggies": "Texas A&M",
  "louisiana tech bulldogs": "Louisiana Tech",
  "louisville cardinals": "Louisville",
  "marshall thundering herd": "Marshall",
  "maryland terrapins": "Maryland",
  "massachusetts minutemen": "Massachusetts",
  "memphis tigers": "Memphis",
  "miami oh redhawks": "Miami-Ohio",
  "miami hurricanes": "Miami-Florida",
  "michigan state spartans": "Michigan State",
  "michigan wolverines": "Michigan",
  "middle tennessee blue raiders": "Middle Tennessee",
  "minnesota golden gophers": "Minnesota",
  "mississippi state bulldogs": "Mississippi State",
  "missouri state bears": "Missouri State",
  "missouri tigers": "Missouri",
  "nc state wolfpack": "NC State",
  "navy midshipmen": "Navy",
  "nebraska cornhuskers": "Nebraska",
  "nevada wolf pack": "Nevada",
  "new mexico lobos": "New Mexico",
  "new mexico state aggies": "New Mexico State",
  "north carolina tar heels": "North Carolina",
  "north dakota state bison": "North Dakota State",
  "north texas mean green": "North Texas",
  "northern illinois huskies": "Northern Illinois",
  "northwestern wildcats": "Northwestern",
  "notre dame fighting irish": "Notre Dame",
  "ohio bobcats": "Ohio",
  "ohio state buckeyes": "Ohio State",
  "oklahoma sooners": "Oklahoma",
  "oklahoma state cowboys": "Oklahoma State",
  "old dominion monarchs": "Old Dominion",
  "ole miss rebels": "Mississippi",
  "oregon ducks": "Oregon",
  "oregon state beavers": "Oregon State",
  "penn state nittany lions": "Penn State",
  "pittsburgh panthers": "Pittsburgh",
  "purdue boilermakers": "Purdue",
  "rice owls": "Rice",
  "rutgers scarlet knights": "Rutgers",
  "smu mustangs": "SMU",
  "sacramento state hornets": "Sacramento State",
  "sam houston bearkats": "Sam Houston State",
  "san diego state aztecs": "San Diego State",
  "san jose state spartans": "San Jose State",
  "south alabama jaguars": "South Alabama",
  "south carolina gamecocks": "South Carolina",
  "south florida bulls": "South Florida",
  "southern miss golden eagles": "Southern Miss",
  "stanford cardinal": "Stanford",
  "syracuse orange": "Syracuse",
  "tcu horned frogs": "TCU",
  "temple owls": "Temple",
  "tennessee volunteers": "Tennessee",
  "texas a&m aggies": "Texas A&M",
  "texas longhorns": "Texas",
  "texas state bobcats": "Texas State",
  "texas tech red raiders": "Texas Tech",
  "toledo rockets": "Toledo",
  "troy trojans": "Troy",
  "tulane green wave": "Tulane",
  "tulsa golden hurricane": "Tulsa",
  "uab blazers": "UAB",
  "ucf knights": "Central Florida(UCF)",
  "ucla bruins": "UCLA",
  "uconn huskies": "Connecticut",
  "ul monroe warhawks": "LouisianaMonroe(ULM)",
  "unlv rebels": "UNLV",
  "usc trojans": "Southern California",
  "utep miners": "UTEP",
  "utsa roadrunners": "UTSA",
  "utah state aggies": "Utah State",
  "utah utes": "Utah",
  "vanderbilt commodores": "Vanderbilt",
  "virginia cavaliers": "Virginia",
  "virginia tech hokies": "Virginia Tech",
  "wake forest demon deacons": "Wake Forest",
  "washington huskies": "Washington",
  "washington state cougars": "Washington State",
  "west virginia mountaineers": "West Virginia",
  "western kentucky hilltoppers": "Western Kentucky",
  "western michigan broncos": "Western Michigan",
  "wisconsin badgers": "Wisconsin",
  "wyoming cowboys": "Wyoming"
};

function normalize(s) {
  return String(s)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[.'&]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// HTML entity patterns as literal strings (using concatenation to avoid write-tool conversion)
const ENT = {
  AMP: '&' + 'amp;',
  LT: '&' + 'lt;',
  GT: '&' + 'gt;',
  QUOT: '&' + 'quot;',
  APOS: '&' + '#x27;',
  APOS2: '&' + '#39;',
  NBSP: '&' + 'nbsp;'
};

function decodeHtmlEntities(s) {
  return String(s)
    .replace(new RegExp(ENT.AMP, 'g'), ' & ')
    .replace(new RegExp(ENT.LT, 'g'), '<')
    .replace(new RegExp(ENT.GT, 'g'), '>')
    .replace(new RegExp(ENT.QUOT, 'g'), '"')
    .replace(new RegExp(ENT.APOS, 'g'), "'")
    .replace(new RegExp(ENT.APOS2, 'g'), "'")
    .replace(new RegExp(ENT.NBSP, 'g'), ' ')
    .replace(new RegExp(ENT.APOS, 'g'), "'");
}


async function fetchText(url, tries = 4) {
  for (let i = 1; i <= tries; i++) {
    try {
      const res = await fetch(url, { 
        headers: { 
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Sec-Fetch-User': '?1',
          'Upgrade-Insecure-Requests': '1'
        } 
      });
      if (res.ok) return await res.text();
      throw new Error('HTTP ' + res.status);
    } catch (e) {
      if (i >= tries) throw e;
      await new Promise(r => setTimeout(r, i * 2000));
    }
  }
}

function parseTable(html, tableIndex) {
  const tables = html.match(/<table[\s\S]*?<\/table>/g) || [];
  if (tableIndex >= tables.length) return [];
  const table = tables[tableIndex];
  
  const rowRegex = /<tr[^>]*data-idx="(\d+)"[\s\S]*?<\/tr>/g;
  const rows = [];
  let match;
  while ((match = rowRegex.exec(table)) !== null) {
    rows.push({ idx: parseInt(match[1], 10), html: match[0] });
  }
  return rows;
}

function parseTeamRows(rows) {
  const teams = {};
  for (const row of rows) {
    const nameMatch = row.html.match(/<a[^>]*class="AnchorLink[^"]*"[^>]*>([^<]+)<\/a>/);
    let teamName = nameMatch ? nameMatch[1].trim() : null;
    teamName = teamName ? decodeHtmlEntities(teamName) : null;
    
    const idMatch = row.html.match(/\/team\/_\/(?:id\/)?(\d+)\//);
    const teamId = idMatch ? idMatch[1] : null;
    
    const tds = row.html.match(/<td[^>]*>([\s\S]*?)<\/td>/g) || [];
    let conference = tds[1] ? tds[1].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim() : null;
    conference = conference ? decodeHtmlEntities(conference) : null;
    
    if (teamName) {
      teams[row.idx] = { name: teamName, teamId: teamId, conference: conference };
    }
  }
  return teams;
}

function parseFpiRows(rows) {
  const fpiData = {};
  for (const row of rows) {
    const tds = row.html.match(/<td[^>]*>([\s\S]*?)<\/td>/g) || [];
    if (tds.length >= 2) {
      const fpiScore = parseFloat(tds[1].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim());
      const record = tds[0] ? tds[0].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim() : null;
      const rank = parseInt(tds[2] ? tds[2].replace(/<[^>]+>/g, '').trim() : (row.idx + 1), 10);
      
      if (!isNaN(fpiScore)) {
        fpiData[row.idx] = { score: fpiScore, record: record, rank: rank };
      }
    }
  }
  return fpiData;
}

async function main() {
  try {
    console.log('Fetching ESPN FPI from ' + ESPN_FPI_PAGE);
    const html = await fetchText(ESPN_FPI_PAGE);
    
    console.log('Parsing team table (table 0)...');
    const teamRows = parseTable(html, 0);
    console.log('Found ' + teamRows.length + ' team rows');
    
    console.log('Parsing FPI table (table 1)...');
    const fpiRows = parseTable(html, 1);
    console.log('Found ' + fpiRows.length + ' FPI rows');
    
    const teams = parseTeamRows(teamRows);
    const fpiData = parseFpiRows(fpiRows);
    
    const rankings = [];
    for (const idx in teams) {
      const team = teams[idx];
      const fpi = fpiData[idx];
      if (fpi) {
        rankings.push({
          rank: fpi.rank,
          team: team.name,
          teamId: team.teamId,
          conference: team.conference,
          score: fpi.score,
          record: fpi.record
        });
      }
    }
    
    rankings.sort((a, b) => a.rank - b.rank);
    
    console.log('Joined ' + rankings.length + ' teams with FPI scores');
    
    if (rankings.length < 100) {
      throw new Error('Too few teams parsed (' + rankings.length + '), something went wrong');
    }
    
    const byTeam = {};
    const byEspnName = {};
    rankings.forEach(r => {
      const espnKey = normalize(r.team);
      const sagarinName = FpiToSagarin[espnKey] || r.team;
      byTeam[sagarinName] = { score: r.score, rank: r.rank, record: r.record, teamId: r.teamId, conference: r.conference };
      byEspnName[r.team] = { score: r.score, rank: r.rank, record: r.record, teamId: r.teamId, conference: r.conference };
    });
    
    const out = {
      source: [ESPN_FPI_PAGE],
      fetched_at: new Date().toISOString(),
      season: 2026,
      note: 'FPI parsed from ESPN FPI page tables. Used for predictor/sim/head-to-head reference.',
      signature: 'fpi-' + Date.now().toString(36),
      method: 'ESPN FPI: Football Power Index for predictor/sim/head-to-head; not strict-Sagarin data',
      inputs: ['ESPN FPI'],
      ranks: rankings.slice(0, 25).map(r => ({ rank: r.rank, team: r.team, score: r.score, record: r.record, conference: r.conference })),
      byTeam: byTeam,
      byEspnName: byEspnName
    };
    
    fs.mkdirSync(path.dirname(DEFAULT_OUT), { recursive: true });
    fs.writeFileSync(DEFAULT_OUT, JSON.stringify(out, null, 2) + '\n', 'utf8');
    console.log('Wrote ' + DEFAULT_OUT + ' with ' + rankings.length + ' teams, signature ' + out.signature);
    console.log('Top 5:', rankings.slice(0, 5).map(r => r.team + ' (' + r.score + ')').join(', '));
  } catch (e) {
    console.error('FPI fetch error:', e.message, e.stack);
    process.exit(1);
  }
}

main();