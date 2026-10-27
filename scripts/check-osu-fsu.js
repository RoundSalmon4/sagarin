const fs = require('fs');
const ratings = JSON.parse(fs.readFileSync('data/history/2026/week-7.json', 'utf8'));
const espn = JSON.parse(fs.readFileSync('data/espn-games.json', 'utf8'));

const Alias = require('../assets/team-alias.js');

function normalizeName(s) {
  return String(s || '')
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
  const k = st.team.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[.'&]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
  const et = idx[k] || idx[Alias[k]];
  if (et) { espnIdToSag[et.id] = st; }
});

const ratingMap = {};
ratings.teams.forEach(t => { ratingMap[t.team] = t; });

// Get the Oregon State @ Fresno State game
const game = espn.games.find(g => 
  (g.awayName === 'Oregon State' && g.homeName === 'Fresno State') ||
  (g.awayName === 'Fresno State' && g.homeName === 'Oregon State')
);

if (!game) {
  console.log('Game not found in ESPN data');
} else {
  console.log('Found game:', game.awayName, '@', game.homeName, '(', game.awayScore, '-', game.homeScore, ')', 'date:', game.date);
  
  const a = ratingMap['Oregon State'];
  const b = ratingMap['Fresno State'];
  
  if (a && b) {
    const METHOD = 'predictor';
    const edge = 3.8;
    const margin = Math.abs((b.predictor + 3.8) - a.predictor);
    const closeness = 1 / (1 + Math.pow(margin / 10, 2));
    const avg = (a.predictor + b.predictor) / 2;
    const quality = Math.max(0, Math.min(1, (avg - 55) / 40));
    
    // Both teams are in PAC-12, same division
    // Check if both are in field/bubble from simulation
    // Simplified: neither in field/bubble (they're mid-tier PAC-12)
    const inA = false, inB = false, bubA = false, bubB = false;
    let stakes = 0.05; // neither in field/bubble
    
    // Check CCG implications
    // Both in PAC-12, same division (would be same division in 2026 PAC-12 which has no divisions)
    // But they're in PAC-12 which has no divisions in 2026
    let ccgImplications = 0;
    let divRace = 0;
    
    const margin = Math.abs((b.predictor + 3.8) - a.predictor);
    const closeness = 1 / (1 + Math.pow(margin / 10, 2));
    const avg = (a.predictor + b.predictor) / 2;
    const quality = Math.max(0, Math.min(1, (avg - 55) / 40));
    
    const value = Math.round(100 * (0.35 * (1 / (1 + Math.pow(margin / 10, 2))) + 0.25 * 0.05 + 0.15 * quality + 0.10 * 0 + 0.05 * 0));
    console.log('Watchability score:', value);
    console.log('Margin:', margin.toFixed(1));
    console.log('Closeness:', closeness.toFixed(2));
    console.log('Quality:', quality.toFixed(2));
    console.log('Stakes:', 0.05);
    console.log('CCG Implications:', 0);
    console.log('Division Race:', 0);
  }
}