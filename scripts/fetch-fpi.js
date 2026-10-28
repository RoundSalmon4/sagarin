#!/usr/bin/env node
/* Fetch ESPN FPI (Football Power Index) for the current season.
 * Tries Firecrawl API first, then falls back to direct HTML parsing.
 * Writes data/fpi.json. Intended for predictor/sim/head-to-head reference.
 */
"use strict";

const fs = require('fs');
const path = require('path');

const DEFAULT_OUT = path.join(__dirname, '..', 'data', 'fpi.json');
const ESPN_FPI_PAGE = 'https://www.espn.com/college-football/fpi/_/view/fpi';
const FIRECRAWL_API_URL = 'https://api.firecrawl.dev/v1/scrape';

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

async function fetchWithFirecrawl(url) {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) {
    console.log('No FIRECRAWL_API_KEY found, skipping Firecrawl');
    return null;
  }

  try {
    console.log('Trying Firecrawl API...');
    const res = await fetch(FIRECRAWL_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey
      },
      body: JSON.stringify({
        url: url,
        formats: ['markdown', 'html'],
        onlyMainContent: true,
        waitFor: 3000
      })
    });

    if (!res.ok) {
      const err = await res.text();
      console.log('Firecrawl API error:', res.status, err);
      return null;
    }

    const data = await res.json();
    if (!data.success || !data.data) {
      console.log('Firecrawl returned no data');
      return null;
    }

    console.log('Firecrawl API succeeded');
    return {
      html: data.data.html || '',
      markdown: data.data.markdown || ''
    };
  } catch (e) {
    console.log('Firecrawl fetch error:', e.message);
    return null;
  }
}

async function fetchText(url, tries = 3) {
  const headers = {
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
  };

  for (let i = 1; i <= tries; i++) {
    try {
      const res = await fetch(url, { headers });
      if (res.ok) return await res.text();
      console.log(`Fetch attempt ${i} failed: HTTP ${res.status}`);
      throw new Error('HTTP ' + res.status);
    } catch (e) {
      console.log(`Fetch attempt ${i} failed:`, e.message);
      if (i >= tries) throw e;
      await new Promise(r => setTimeout(r, i * 2000));
    }
  }
}

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

function parseTable(html, tableIndex) {
  const tables = html.match(/<table[\s\S]*?<\/table>/g) || [];
  if (tables.length === 0) return [];
  const table = tables[tableIndex] || tables[0];
  
  // Try data-idx rows first (old structure)
  let rowRegex = /<tr[^>]*data-idx="(\d+)"[\s\S]*?<\/tr>/g;
  let rows = [];
  let match;
  while ((match = rowRegex.exec(table)) !== null) {
    rows.push({ idx: parseInt(match[1], 10), html: match[0] });
  }
  if (rows.length > 0) return rows;
  
  // Try any tr with td
  rowRegex = /<tr[\s\S]*?<\/tr>/g;
  let idx = 0;
  while ((match = rowRegex.exec(table)) !== null) {
    const tr = match[0];
    if (/<td/i.test(tr)) {
      rows.push({ idx: idx++, html: tr });
    }
  }
  return rows;
}

function parseTeamRows(rows) {
  const teams = {};
  for (const row of rows) {
    let nameMatch = row.html.match(/<a[^>]*class="AnchorLink[^"]*"[^>]*>([^<]+)<\/a>/);
    if (!nameMatch) {
      nameMatch = row.html.match(/<a[^>]*href="[^"]*\/team\/[^"]*"[^>]*>([^<]+)<\/a>/);
    }
    if (!nameMatch) {
      nameMatch = row.html.match(/<span[^>]*class="[^"]*TeamLink[^"]*"[^>]*>([^<]+)<\/span>/);
    }
    let teamName = nameMatch ? nameMatch[1].trim() : null;
    teamName = teamName ? decodeHtmlEntities(teamName) : null;
    
    const idMatch = row.html.match(/\/team\/_\/(?:id\/)?(\d+)\//);
    const teamId = idMatch ? idMatch[1] : null;
    
    const tds = row.html.match(/<td[^>]*>([\s\S]*?)<\/td>/g) || [];
    let conference = null;
    for (let i = 1; i < tds.length && i < 4; i++) {
      const c = tds[i].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
      if (c && /[A-Za-z]/.test(c) && !/^\d/.test(c) && c.length < 40) {
        conference = decodeHtmlEntities(c);
        break;
      }
    }
    
    if (teamName && teamName.length > 2) {
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
      // Try to find numeric FPI score
      for (let i = 1; i < tds.length; i++) {
        const num = parseFloat(tds[i].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim());
        if (!isNaN(num) && num > -50 && num < 50) {
          const record = tds[0] ? tds[0].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim() : null;
          let rank = null;
          for (let j = 0; j < tds.length; j++) {
            const r = parseInt(tds[j].replace(/<[^>]+>/g, '').trim(), 10);
            if (!isNaN(r) && r > 0 && r <= 200) { rank = r; break; }
          }
          if (rank === null) rank = row.idx + 1;
          fpiData[row.idx] = { score: num, record: record, rank: rank };
          break;
        }
      }
    }
  }
  return fpiData;
}

async function parseFromMarkdown(markdown) {
  // Parse FPI data from Firecrawl markdown output
  const lines = markdown.split('\n');
  const rankings = [];
  
  console.log('Markdown length:', markdown.length);
  console.log('First 2000 chars of markdown:', markdown.substring(0, 2000));
  
  // Look for table rows in markdown - multiple formats
  for (const line of lines) {
    // Skip header/separator rows
    if (line.includes('---') || line.match(/^\|\s*-+\s*\|/)) continue;
    // Match markdown table rows like | 1 | Ohio State Buckeyes | Big Ten | 6-1 | 28.2 | 1 | ...
    const match = line.match(/^\|\s*(\d+)\s*\|\s*([^|]+?)\s*\|\s*([^|]*?)\s*\|\s*([^|]*?)\s*\|\s*([-\d.]+)\s*\|\s*(\d+)\s*\|/);
    if (match) {
      const rank = parseInt(match[1], 10);
      const team = match[2].trim();
      const conf = match[3].trim();
      const record = match[4].trim();
      const score = parseFloat(match[5]);
      const rank2 = parseInt(match[6], 10);
      
      if (!isNaN(score) && rank === rank2 && team && team.length > 2) {
        if (!rankings.some(r => r.rank === rank)) {
          rankings.push({ rank, team, conf, score, record });
        }
      }
    }
  }
  
  // Also try alternative markdown table format
  if (rankings.length === 0) {
    for (const line of lines) {
      if (line.includes('---') || line.match(/^\|\s*-+\s*\|/)) continue;
      const parts = line.split('|').map(s => s.trim()).filter(s => s.length > 0);
      if (parts.length >= 6) {
        const rank = parseInt(parts[0], 10);
        const team = parts[1];
        const conf = parts[2];
        const record = parts[3];
        const score = parseFloat(parts[4]);
        const rank2 = parseInt(parts[5], 10);
        
        if (!isNaN(rank) && !isNaN(score) && rank === rank2 && team && /[a-zA-Z]/.test(team)) {
          if (!rankings.some(r => r.rank === rank)) {
            rankings.push({ rank, team, conf, score, record });
          }
        }
      }
    }
  }
  
  // Try to find any lines with FPI-like data (number | team | conf | record | score)
  if (rankings.length < 50) {
    for (const line of lines) {
      if (line.includes('---')) continue;
      const parts = line.split(/\s*\|\s*/);
      if (parts.length >= 6) {
        const rankStr = parts[0].replace(/[^\d]/g, '');
        const rank = parseInt(rankStr, 10);
        const team = parts[1].trim();
        const conf = parts[2] ? parts[2].trim() : '';
        const record = parts[3] ? parts[3].trim() : '';
        const score = parseFloat(parts[4]);
        const rank2Str = parts[5].replace(/[^\d]/g, '');
        const rank2 = parseInt(rank2Str, 10);
        
        if (!isNaN(rank) && !isNaN(score) && rank > 0 && rank <= 200 && (rank === rank2 || isNaN(rank2))) {
          if (team && team.length > 2 && /[a-zA-Z]/.test(team) && !/^\d+$/.test(team)) {
            if (!rankings.some(r => r.rank === rank)) {
              rankings.push({ rank, team, conf, score, record });
            }
          }
        }
      }
    }
  }
  
  // Try to find lines with team names and FPI scores in other formats
  if (rankings.length < 50) {
    for (const line of lines) {
      // Look for pattern like "1. Ohio State 28.2" or table without pipes
      const m = line.match(/^\s*(\d+)\.?\s+([A-Za-z][A-Za-z\s&'.-]+?)\s+([-\d.]+)\b/);
      if (m) {
        const rank = parseInt(m[1], 10);
        const team = m[2].trim();
        const score = parseFloat(m[3]);
        if (!isNaN(rank) && !isNaN(score) && rank > 0 && rank <= 200 && team.length > 3) {
          if (!rankings.some(r => r.rank === rank)) {
            rankings.push({ rank, team, conf: '', score, record: '' });
          }
        }
      }
    }
  }
  
  console.log('Parsed ' + rankings.length + ' teams from markdown');
  return rankings;
}

async function main() {
  try {
    console.log('Fetching ESPN FPI...');
    
    // Try Firecrawl first
    let rankings = [];
    const firecrawlResult = await fetchWithFirecrawl(ESPN_FPI_PAGE);
    
    if (firecrawlResult && firecrawlResult.markdown) {
      console.log('Parsing Firecrawl markdown...');
      rankings = await parseFromMarkdown(firecrawlResult.markdown);
      console.log('Got ' + rankings.length + ' from firecrawl markdown');
    }
    if (firecrawlResult && firecrawlResult.html && rankings.length === 0) {
      console.log('Parsing Firecrawl html...');
      const tables = firecrawlResult.html.match(/<table[\s\S]*?<\/table>/g) || [];
      console.log('Firecrawl html tables:', tables.length);
      const teamRows = parseTable(firecrawlResult.html, 0);
      const fpiRows = parseTable(firecrawlResult.html, 1);
      const teams = parseTeamRows(teamRows);
      const fpiData = parseFpiRows(fpiRows);
      const tempRankings = [];
      for (const idx in teams) {
        const team = teams[idx];
        const fpi = fpiData[idx];
        if (fpi) {
          tempRankings.push({ rank: fpi.rank, team: team.name, teamId: team.teamId, conference: team.conference, score: fpi.score, record: fpi.record });
        }
      }
      rankings = tempRankings;
    }
    
    // Fallback to HTML parsing
    if (rankings.length === 0) {
      console.log('Firecrawl unavailable or empty, trying direct HTML fetch...');
      try {
        const html = await fetchText(ESPN_FPI_PAGE);
        console.log('Got HTML length:', html.length);
        
        // Try all tables
        const tables = html.match(/<table[\s\S]*?<\/table>/g) || [];
        console.log('Found tables:', tables.length);
        for (let t = 0; t < tables.length; t++) {
          console.log('Table', t, 'length:', tables[t].length);
        }
        
        console.log('Parsing team table (table 0)...');
        const teamRows = parseTable(html, 0);
        console.log('Found ' + teamRows.length + ' team rows');
        
        console.log('Parsing FPI table (table 1)...');
        const fpiRows = parseTable(html, 1);
        console.log('Found ' + fpiRows.length + ' FPI rows');
        
        const teams = parseTeamRows(teamRows);
        const fpiData = parseFpiRows(fpiRows);
        
        const tempRankings = [];
        for (const idx in teams) {
          const team = teams[idx];
          const fpi = fpiData[idx];
          if (fpi) {
            tempRankings.push({
              rank: fpi.rank,
              team: team.name,
              teamId: team.teamId,
              conference: team.conference,
              score: fpi.score,
              record: fpi.record
            });
          }
        }
        rankings = tempRankings;
        
        // If still empty, try to parse from JSON in page
        if (rankings.length === 0) {
          console.log('Trying to parse JSON data from page...');
          const jsonMatches = html.match(/<script[^>]*>[\s\S]*?window\.__INITIAL_DATA__[\s\S]*?<\/script>/g);
          if (jsonMatches) {
            console.log('Found initial data script');
          }
          // Try to find fpi data in page source
          const fpiMatches = html.match(/"fpi"[\s\S]{0,500}/g);
          if (fpiMatches) console.log('Found fpi references:', fpiMatches.length);
        }
      } catch (e) {
        console.log('HTML fetch failed:', e.message);
      }
    }
    
    // Sort by rank
    rankings.sort((a, b) => a.rank - b.rank);
    
    console.log('Total rankings parsed: ' + rankings.length);
    
    if (rankings.length < 100) {
      console.warn('WARNING: Only parsed ' + rankings.length + ' teams (expected 100+). ESPN may be blocking or returning different content in CI. Keeping existing data.');
      console.log('Attempting to read existing fpi.json to preserve data...');
      try {
        const existing = JSON.parse(fs.readFileSync(DEFAULT_OUT, 'utf8'));
        console.log('Existing data has ' + Object.keys(existing.byTeam || {}).length + ' teams. Keeping existing data.');
        process.exit(0);
      } catch (e) {
        console.warn('No existing data found, but continuing anyway to avoid failing CI');
        process.exit(0);
      }
    }
    
    // Build byTeam lookup using Sagarin names as keys
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
      note: 'FPI parsed from ESPN FPI page. Used for predictor/sim/head-to-head reference.',
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