// Full trace of conference predictor for Georgia (SEC) using FPI method - after fix
const fs = require('fs');
const ratings = JSON.parse(fs.readFileSync('data/ratings.json', 'utf8'));
const espn = JSON.parse(fs.readFileSync('data/espn-games.json', 'utf8'));
const fpi = JSON.parse(fs.readFileSync('data/fpi.json', 'utf8'));

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

const confKey = {};
ratings.teams.forEach(t => confKey[t.team] = t.conference);

// SEC teams
const SEC_TEAMS = ratings.teams.filter(t => t.conference === 'SEC' && t.level === 'A');

const edge = 3.65;
const regRec = {};
function getRec(rec, team) { return rec[team] || (rec[team] = { cw: 0, cl: 0, ow: 0, ol: 0 }); }

function getTeamMethodScore(teamNameOrObj, method) {
  if (method === "fpi") {
    var teamName = typeof teamNameOrObj === "string" ? teamNameOrObj : teamNameOrObj.team;
    var f = fpi.byTeam ? fpi.byTeam[teamName] : null;
    if (f) return f.score;
    var t = ratings.teams.find(t => t.team === teamName);
    return t ? t.predictor : 0;
  }
  return typeof teamNameOrObj === "string" ? null : (teamNameOrObj[method] || 0);
}

// Completed games
const games = espn.games;
games.forEach(g => {
  if (!g.completed || g.homeScore === null || g.awayScore !== null) return;
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
const secGames = games.filter(g => {
  const h = espnIdToSag[g.homeId];
  const a = espnIdToSag[g.awayId];
  return h && a && confKey[h.team] === 'SEC' && confKey[a.team] === 'SEC' && (!g.completed || g.homeScore === null);
});

console.log('Remaining SEC games with FPI (after fix):');
secGames.forEach(g => {
  const h = espnIdToSag[g.homeId];
  const a = espnIdToSag[g.awayId];
  const hScore = getTeamMethodScore(h, 'fpi');
  const aScore = getTeamMethodScore(a, 'fpi');
  const spread = (hScore - aScore) + edge;
  const wp = normCdf(spread / SIGMA);
  console.log('  ' + h.team + ' vs ' + a.team + ' (at ' + h.team + ') - spread: ' + spread.toFixed(1) + ' wp: ' + (wp*100).toFixed(0) + '%');
});

// Now project all remaining SEC games
secGames.forEach(g => {
  const h = espnIdToSag[g.homeId];
  const a = espnIdToSag[g.awayId];
  const hScore = getTeamMethodScore(h, 'fpi');
  const aScore = getTeamMethodScore(a, 'fpi');
  const spread = (hScore - aScore) + edge;
  const wp = normCdf(spread / SIGMA);
  const hWin = wp >= 0.5;
  
  const rh = getRec(regRec, h.team); rh.cw += hWin ? 1 : 0; rh.cl += hWin ? 0 : 1; rh.ow += hWin ? 1 : 0; rh.ol += hWin ? 0 : 1;
  const ra = getRec(regRec, a.team); ra.cw += hWin ? 0 : 1; ra.cl += hWin ? 1 : 0; ra.ow += hWin ? 0 : 1; ra.ol += hWin ? 1 : 0;
});

console.log('\nSEC standings after projected remaining (FPI - after fix):');
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
  return (b.predictor || 0) - (a.predictor || 0);
});

console.log('\nSEC CCG: top 2');
console.log('1:', secSorted[0].team);
console.log('2:', secSorted[1].team);

const spread = ((fpi.byTeam[secSorted[0].team] ? fpi.byTeam[secSorted[0].team].score : secSorted[0].predictor) - 
                (fpi.byTeam[secSorted[1].team] ? fpi.byTeam[secSorted[1].team].score : secSorted[1].predictor)) + 0;
const wp = normCdf(spread / SIGMA);
console.log('CCG spread:', spread.toFixed(1), 'wp:', (wp*100).toFixed(0) + '%');
console.log('Winner:', wp >= 0.5 ? secSorted[0].team : secSorted[1].team);

const winner = wp >= 0.5 ? secSorted[0].team : secSorted[1].team;
const loser = wp >= 0.5 ? secSorted[1].team : secSorted[0].team;
getRec(regRec, winner).cw += 1; getRec(regRec, winner).ow += 1;
getRec(regRec, loser).cl += 1; getRec(regRec, loser).ol += 1;

console.log('\nFinal SEC with CCG (FPI - after fix):');
SEC_TEAMS.forEach(t => {
  const r = regRec[t.team] || { cw: 0, cl: 0, ow: 0, ol: 0 };
  console.log('  ' + t.team + ': ' + r.cw + '-' + r.cl + ' (' + r.ow + '-' + r.ol + ')');
});