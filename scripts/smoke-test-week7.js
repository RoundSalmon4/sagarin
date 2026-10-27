const fs = require('fs');
const ratings = JSON.parse(fs.readFileSync('data/history/2026/week-7.json', 'utf8'));
const espn = JSON.parse(fs.readFileSync('data/espn-games.json', 'utf8'));

// Build Sagarin team name to rating mapping
const ratingMap = {};
ratings.teams.forEach(t => { ratingMap[t.team] = t; });

// Build ESPN team lookup (same as core.js)
const idx = {};
espn.teams.forEach(function (t) {
  [t.location, t.name, t.displayName].forEach(function (v) {
    const k = normalizeName(v || "");
    if (k && !idx[k]) idx[k] = t;
  });
});

// Load alias mapping
const Alias = require('../assets/team-alias.js');

// Build espnIdToSag mapping (same as core.js)
const espnIdToSag = {};
ratings.teams.forEach(function (st) {
  const k = normalizeName(st.team);
  const et = idx[k] || idx[Alias[k]];
  if (et) { espnIdToSag[et.id] = st; }
});

function normalizeName(s) {
  return String(s)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[.'&]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// Get completed games through Oct 17 (week 7)
const completed = espn.games.filter(g => g.completed && g.date && g.date <= '2026-10-18T00:00Z');
console.log('Completed games through Oct 17:', completed.length);

// Score function (simplified from tv.js)
function score(g) {
  const a = espnIdToSag[g.awayId];
  const b = espnIdToSag[g.homeId];
  if (!a || !b) return { value: 0, reason: 'No rating' };

  const METHOD = 'predictor';
  const edge = 3.8; // home edge for predictor
  const margin = Math.abs((b[METHOD] + 3.8) - a[METHOD]);
  const closeness = 1 / (1 + Math.pow(margin / 10, 2));
  const avg = (a[METHOD] + b[METHOD]) / 2;
  const quality = Math.max(0, Math.min(1, (avg - 55) / 40));

  // Simplified: no playoff stakes, no rivalry
  const value = Math.round(100 * (0.40 * closeness + 0.22 * quality));
  return { value, closeness, quality, margin, aTeam: a.team, bTeam: b.team };
}

const scored = completed.map(g => ({ game: g, score: score(g) }))
  .filter(s => s.score.value > 0)
  .sort((a, b) => b.score.value - a.score.value);

console.log('Mapped games:', scored.length);
console.log('\nTop 20 watchability games:');
scored.slice(0, 20).forEach((s, i) => {
  const g = s.game;
  console.log((i + 1) + '. ' + s.score.value + ' - ' + s.score.aTeam + ' @ ' + s.score.bTeam + ' (' + g.awayScore + '-' + g.homeScore + ') margin=' + s.score.margin.toFixed(1) + ' closeness=' + s.score.closeness.toFixed(2) + ' quality=' + s.score.quality.toFixed(2));
});

// Also show close games (margin <= 7)
console.log('\nClose games (margin <= 7):');
const close = scored.filter(s => s.score.margin <= 7).slice(0, 20);
close.forEach((s, i) => {
  const g = s.game;
  console.log((i + 1) + '. ' + s.score.value + ' - ' + s.score.aTeam + ' @ ' + s.score.bTeam + ' (' + g.awayScore + '-' + g.homeScore + ') margin=' + s.score.margin.toFixed(1));
});

// Upsets (away team won when home was favored by >7)
console.log('\nUpsets (away won, home favored by >7):');
const upsets = scored.filter(s => {
  const g = s.game;
  const homeFavored = (s.score.bTeam && ratingMap[s.score.bTeam] && ratingMap[s.score.aTeam]) 
    ? (ratingMap[s.score.bTeam].predictor + 3.8) - ratingMap[s.score.aTeam].predictor 
    : 0;
  return g.awayScore > g.homeScore && homeFavored > 7;
});
upsets.slice(0, 10).forEach((s, i) => {
  const g = s.game;
  console.log((i + 1) + '. ' + s.score.aTeam + ' @ ' + s.score.bTeam + ' (' + g.awayScore + '-' + g.homeScore + ')');
});