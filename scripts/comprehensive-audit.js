// Comprehensive audit of all calculations
const fs = require('fs');
const ratings = JSON.parse(fs.readFileSync('data/ratings.json', 'utf8'));
const espn = JSON.parse(fs.readFileSync('data/espn-games.json', 'utf8'));
const fpi = JSON.parse(fs.readFileSync('data/fpi.json', 'utf8'));

const Alias = require('../assets/team-alias.js');
const FpiAlias = Alias.FpiAlias || {};

function normalize(s) {
  return String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[.'&]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

function fpiOf(name) {
  if (!fpi || !fpi.byTeam) return null;
  if (fpi.byTeam[name]) return fpi.byTeam[name];
  var norm = normalize(name);
  var alias = FpiAlias && FpiAlias[norm];
  if (alias && fpi.byTeam[alias]) return fpi.byTeam[alias];
  return null;
}

function getTeamMethodScore(team, method) {
  if (method === 'fpi') {
    var f = fpiOf(team.team);
    if (f) return f.score;
    return team.predictor;
  }
  return team[method] || 0;
}

const SIGMA = 15.5;
function normCdf(z) { const erf = (x) => { const s = x < 0 ? -1 : 1; x = Math.abs(x); const t = 1 / (1 + 0.3275911 * x); const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x); return s * y; }; return 0.5 * (1 + erf(z / Math.SQRT2)); }

console.log('=== AUDIT: Head to Head Spread Calculation ===');
const georgia = ratings.teams.find(t => t.team === 'Georgia');
const ohioState = ratings.teams.find(t => t.team === 'Ohio State');

// Test with predictor
const edge = 3.65;
const spreadPredictor = (ohioState.predictor - georgia.predictor) + edge;
const wpPredictor = normCdf(spreadPredictor / SIGMA);
console.log('Ohio State vs Georgia (predictor): spread=' + spreadPredictor.toFixed(1) + ', wp=' + (wpPredictor*100).toFixed(0) + '%');

// Test with FPI
const ohioFpi = fpiOf('Ohio State').score;
const georgiaFpi = fpiOf('Georgia').score;
const spreadFPI = (ohioFpi - georgiaFpi) + edge;
const wpFPI = normCdf(spreadFPI / SIGMA);
console.log('Ohio State vs Georgia (FPI): spread=' + spreadFPI.toFixed(1) + ', wp=' + (wpFPI*100).toFixed(0) + '%');

console.log('\n=== AUDIT: Projected Records (Team Predictor) ===');
// Georgia team predictor with predictor method
const idx = {};
espn.teams.forEach(t => { [t.location, t.name, t.displayName].forEach(v => { const k = normalize(v || ''); if (k && !idx[k]) idx[k] = t; }); });

var espnIdToSag = {};
ratings.teams.forEach(function(st) {
  var k = normalize(st.team);
  var et = idx[k] || idx[Alias[k]];
  if (et) espnIdToSag[et.id] = st;
});

const georgiaEspn = idx[normalize(georgia.team)] || idx[Alias[normalize(georgia.team)]];
const id = String(georgiaEspn.id);
const games = espn.games.filter(g => String(g.homeId) === id || String(g.awayId) === id);

const confKey = {};
ratings.teams.forEach(t => confKey[t.team] = t.conference);
const myConf = confKey['Georgia'];

const homeEdge = 3.65;
let projWins = 0, projConfWins = 0, projConfLosses = 0, remaining = 0;
games.forEach(g => {
  if (!g.completed) {
    const isHome = String(g.homeId) === id;
    const oppId = isHome ? g.awayId : g.homeId;
    const oppSag = espnIdToSag[oppId];
    if (!oppSag) return;
    const isConf = confKey[oppSag.team] === myConf && myConf !== 'I-A IND.';
    const spread = (georgia.predictor - oppSag.predictor) + (isHome ? homeEdge : -homeEdge);
    const wp = normCdf(spread / SIGMA);
    remaining++;
    if (wp >= 0.5) projWins++;
    if (isConf) { if (wp >= 0.5) projConfWins++; else projConfLosses++; }
  }
});
console.log('Georgia predictor: ' + georgia.predictor);
console.log('Current: 6-1, Remaining: ' + remaining + ', Projected wins: ' + projWins);
console.log('Projected overall: ' + (6 + projWins) + '-' + (1 + remaining - projWins));
console.log('Projected conf: ' + projConfWins + '-' + projConfLosses);

console.log('\n=== AUDIT: Conference Predictor (SEC) ===');
// SEC teams
const SEC_TEAMS = ratings.teams.filter(t => t.conference === 'SEC' && t.level === 'A');

const edge2 = 3.65;
const regRec = {};
function getRec(rec, team) { return rec[team] || (rec[team] = { cw: 0, cl: 0, ow: 0, ol: 0 }); }

// Completed games
const allGames = espn.games;
allGames.forEach(g => {
  if (!g.completed || g.homeScore === null || g.awayScore === null) return;
  const h = espnIdToSag[g.homeId];
  const a = espnIdToSag[g.awayId];
  if (!h || !a) return;
  const hWin = g.homeScore > g.awayScore;
  if (confKey[h.team] === 'SEC' && confKey[a.team] === 'SEC') {
    const rh = getRec(regRec, h.team); rh.cw += hWin ? 1 : 0; rh.cl += hWin ? 0 : 1;
    const ra = getRec(regRec, a.team); ra.cw += hWin ? 0 : 1; ra.cl += hWin ? 1 : 0;
  }
  const rh = getRec(regRec, h.team); rh.ow += hWin ? 1 : 0; rh.ol += hWin ? 0 : 1;
  const ra = getRec(regRec, a.team); ra.ow += hWin ? 0 : 1; ra.ol += hWin ? 1 : 0;
});

// Remaining SEC games
const secGames = allGames.filter(g => {
  const h = espnIdToSag[g.homeId];
  const a = espnIdToSag[g.awayId];
  return h && a && confKey[h.team] === 'SEC' && confKey[a.team] === 'SEC' && (!g.completed || g.homeScore === null);
});

secGames.forEach(g => {
  const h = espnIdToSag[g.homeId];
  const a = espnIdToSag[g.awayId];
  const spread = (h.predictor - a.predictor) + 3.65;
  const wp = normCdf(spread / SIGMA);
  const hWin = wp >= 0.5;
  
  const rh = getRec(regRec, h.team); rh.cw += hWin ? 1 : 0; rh.cl += hWin ? 0 : 1; rh.ow += hWin ? 1 : 0; rh.ol += hWin ? 0 : 1;
  const ra = getRec(regRec, a.team); ra.cw += hWin ? 0 : 1; ra.cl += hWin ? 1 : 0; ra.ow += hWin ? 0 : 1; ra.ol += hWin ? 1 : 0;
});

// Check SEC standings
console.log('SEC standings after projected remaining:');
SEC_TEAMS.forEach(t => {
  const r = regRec[t.team] || { cw: 0, cl: 0, ow: 0, ol: 0 };
  console.log('  ' + t.team + ': ' + r.cw + '-' + r.cl + ' (' + r.ow + '-' + r.ol + ')');
});

// CCG
const secSorted = SEC_TEAMS.slice().sort((a, b) => {
  const ra = regRec[a.team] || { cw: 0, cl: 0, ow: 0, ol: 0 };
  const rb = regRec[b.team] || { cw: 0, cl: 0, ow: 0, ol: 0 };
  const cwpa = (ra.cw + ra.cl) ? ra.cw / (ra.cw + ra.cl) : 0;
  const cwpb = (rb.cw + rb.cl) ? rb.cw / (rb.cw + rb.cl) : 0;
  if (cwpb !== cwpa) return cwpb - cwpa;
  const owpa = (ra.ow + ra.ol) ? ra.ow / (ra.ow + ra.ol) : 0;
  const owpb = (rb.ow + rb.ol) ? rb.ow / (rb.ow + rb.ol) : 0;
  if (owpb !== owpa) return owpb - owpa;
  return b.predictor - a.predictor;
});

console.log('\nSEC CCG: top 2');
console.log('1:', secSorted[0].team);
console.log('2:', secSorted[1].team);

const spread = (secSorted[0].predictor - secSorted[1].predictor) + 0; // neutral
const wp = normCdf(spread / SIGMA);
console.log('CCG spread:', spread.toFixed(1), 'wp:', (wp*100).toFixed(0) + '%');
console.log('Winner:', wp >= 0.5 ? secSorted[0].team : secSorted[1].team);

const winner = wp >= 0.5 ? secSorted[0].team : secSorted[1].team;
const loser = wp >= 0.5 ? secSorted[1].team : secSorted[0].team;

function getRec2(rec, team) { return rec[team] || (rec[team] = { cw: 0, cl: 0, ow: 0, ol: 0 }); }
getRec2(regRec, winner).cw += 1; getRec2(regRec, winner).ow += 1;
getRec2(regRec, loser).cl += 1; getRec2(regRec, loser).ol += 1;

console.log('\nFinal SEC with CCG:');
SEC_TEAMS.forEach(t => {
  const r = regRec[t.team] || { cw: 0, cl: 0, ow: 0, ol: 0 };
  console.log('  ' + t.team + ': ' + r.cw + '-' + r.cl + ' (' + r.ow + '-' + r.ol + ')');
});