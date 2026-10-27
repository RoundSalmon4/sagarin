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

// Get completed games through Oct 17
const completed = espn.games.filter(g => g.completed && g.date && g.date <= '2026-10-18T00:00Z');
console.log('Completed games through Oct 17:', completed.length);

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

const scored = completed.map(g => ({ game: g, score: score(g) }))
  .filter(s => s.score.value > 0)
  .sort((a, b) => b.score.value - a.score.value);

console.log('Mapped games:', scored.length);
console.log('\nTop 30 with dates:');
scored.slice(0, 30).forEach((s, i) => {
  const g = s.game;
  const date = g.date.split('T')[0];
  console.log((i+1) + '. ' + s.score.value + ' - ' + s.score.aTeam + ' @ ' + s.score.bTeam + ' (' + g.awayScore + '-' + g.homeScore + ') ' + date + ' margin=' + s.score.margin.toFixed(1));
});