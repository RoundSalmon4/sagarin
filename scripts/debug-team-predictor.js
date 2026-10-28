// Full trace of team predictor for Georgia using PREDICTOR method
const fs = require('fs');
const ratings = JSON.parse(fs.readFileSync('data/ratings.json', 'utf8'));
const espn = JSON.parse(fs.readFileSync('data/espn-games.json', 'utf8'));

const SIGMA = 15.5;
function normCdf(z) {
  const erf = (x) => { const s = x < 0 ? -1 : 1; x = Math.abs(x); const t = 1 / (1 + 0.3275911 * x); const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x); return s * y; };
  return 0.5 * (1 + erf(z / Math.SQRT2));
}

// Build espnIdToSag
const Alias = require('../assets/team-alias.js');
function normalize(s) { return String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[.'&]/g, '').replace(/[^a-z0-9]+/g, ' ').trim(); }
const idx = {};
espn.teams.forEach(t => { [t.location, t.name, t.displayName].forEach(v => { const k = normalize(v || ''); if (k && !idx[k]) idx[k] = t; }); });

var espnIdToSag = {};
ratings.teams.forEach(function(st) {
  var k = normalize(st.team);
  var et = idx[k] || idx[Alias[k]];
  if (et) espnIdToSag[et.id] = st;
});

const georgiaSag = ratings.teams.find(t => t.team === 'Georgia');
const georgiaEspn = idx[normalize(georgiaSag.team)] || idx[Alias[normalize(georgiaSag.team)]];
const id = String(georgiaEspn.id);

const games = espn.games.filter(g => String(g.homeId) === id || String(g.awayId) === id).sort((a, b) => a.date < b.date ? -1 : 1);

const confKey = {};
ratings.teams.forEach(t => confKey[t.team] = t.conference);
const myConf = confKey['Georgia'];

// Current ESPN record
let curW = 0, curL = 0, curCW = 0, curCL = 0;

const homeEdge = 3.65;
let projWins = 0, projConfWins = 0, projConfLosses = 0;
let remaining = 0;

games.forEach(g => {
  const isHome = String(g.homeId) === id;
  const oppId = isHome ? g.awayId : g.homeId;
  const oppSag = espnIdToSag[oppId];
  
  if (!oppSag) {
    console.log('No mapping for opp:', oppId);
    return;
  }
  
  const isConf = confKey[oppSag.team] === myConf && myConf !== 'I-A IND.';
  
  if (g.completed && g.homeScore !== null && g.awayScore !== null) {
    const won = isHome ? g.homeScore > g.awayScore : g.awayScore > g.homeScore;
    curW += won ? 1 : 0;
    curL += won ? 0 : 1;
    if (isConf) { curCW += won ? 1 : 0; curCL += won ? 0 : 1; }
  } else {
    const spread = (georgiaSag.predictor - oppSag.predictor) + (isHome ? homeEdge : -homeEdge);
    const wp = normCdf(spread / SIGMA);
    
    console.log('REM: ' + (isHome ? 'vs ' : '@ ') + oppSag.team + ' - spread: ' + spread.toFixed(1) + ' - wp: ' + (wp*100).toFixed(0) + '%' + (isConf ? ' CONF' : ''));
    
    remaining++;
    if (wp >= 0.5) projWins++;
    if (isConf) { if (wp >= 0.5) projConfWins++; else projConfLosses++; }
  }
});

console.log('\nCurrent ESPN: ' + curW + '-' + curL + ' (' + curCW + '-' + curCL + ')');
console.log('Remaining:', remaining, 'Projected wins:', projWins);
console.log('Projected overall: ' + (curW + projWins) + '-' + (curL + remaining - projWins));
console.log('Projected conf: ' + (curCW + projConfWins) + '-' + (curCL + projConfLosses));