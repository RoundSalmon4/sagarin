const fs = require('fs');
const ratings = JSON.parse(fs.readFileSync('data/history/2026/week-7.json', 'utf8'));
const espn = JSON.parse(fs.readFileSync('data/espn-games.json', 'utf8'));

const Alias = require('../assets/team-alias.js');

function normalizeName(s) {
  return String(s)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g,'')
    .replace(/[.'&]/g,'')
    .replace(/[^a-z0-9]+/g,' ')
    .trim();
}

const idx = {};
espn.teams.forEach(function(t) {
  [t.location, t.name, t.displayName].forEach(function(v) {
    const k = normalizeName(v || "");
    if (k && !idx[k]) idx[k] = t;
  });
});

const espnIdToSag = {};
ratings.teams.forEach(function (st) {
  const k = normalizeName(st.team);
  const et = idx[k] || idx[Alias[k]];
  if (et) { espnIdToSag[et.id] = st; }
});

// Get completed games on Oct 17 specifically (Week 7 games)
const week7Games = espn.games.filter(g => 
  g.completed && g.date && g.date.startsWith('2026-10-17')
);
console.log('Week 7 games (Oct 17):', week7Games.length);

// Score function
function score(g) {
  const a = espnIdToSag[g.awayId];
  const b = espnIdToSag[g.homeId];
  if (!a || !b) return { value: 0 };

  const METHOD = 'predictor';
  const edge = 3.8;
  const margin = Math.abs((b[METHOD] + 3.8) - a[METHOD]);
  const closeness = 1 / (1 + Math.pow(margin / 10, 2));
  const avg = (a[METHOD] + b[METHOD]) / 2;
  const quality = Math.max(0, Math.min(1, (avg - 55) / 40));
  const value = Math.round(100 * (0.40 * (1 / (1 + Math.pow(margin / 10, 2))) + 0.22 * quality));
  return { value, margin, aTeam: a.team, bTeam: b.team };
}

const scored = week7Games.map(g => ({ game: g, score: score(g) }))
  .filter(s => s.score.value > 0)
  .sort((a, b) => b.score.value - a.score.value);

console.log('Week 7 (Oct 17) games ranked by watchability:');
scored.forEach((s, i) => {
  const g = s.game;
  console.log((i+1) + '. ' + s.score.value + ' - ' + s.score.aTeam + ' @ ' + s.score.bTeam + ' (' + g.awayScore + '-' + g.homeScore + ') margin=' + s.score.margin.toFixed(1));
});

// Also check close games
console.log('\nClose games (margin <= 7):');
const close = scored.filter(s => s.score.margin <= 7);
close.forEach((s, i) => {
  const g = s.game;
  console.log((i+1) + '. ' + s.score.value + ' - ' + s.score.aTeam + ' @ ' + s.score.bTeam + ' (' + g.awayScore + '-' + g.homeScore + ') margin=' + s.score.margin.toFixed(1));
});

// Upsets
console.log('\nUpsets (away won, home favored by >7):');
const upsets = scored.filter(s => {
  const g = s.game;
  const homeFavored = (ratingMap[s.score.bTeam] && ratingMap[s.score.aTeam]) 
    ? (ratingMap[s.score.bTeam].predictor + 3.8) - ratingMap[s.score.aTeam].predictor 
    : 0;
  return g.awayScore > g.homeScore && homeFavored > 7;
});
upsets.forEach((s, i) => {
  const g = s.game;
  console.log((i+1) + '. ' + s.score.aTeam + ' @ ' + s.score.bTeam + ' (' + g.awayScore + '-' + g.homeScore + ')');
});

const ratingMap = {};
ratings.teams.forEach(t => { ratingMap[t.team] = t; });