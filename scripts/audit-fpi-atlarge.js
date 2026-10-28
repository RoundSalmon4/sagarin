// FPI Playoff Predictor At-Large Scoring Audit
const fs = require('fs');
const ratings = JSON.parse(fs.readFileSync('data/ratings.json', 'utf8'));
const fpi = JSON.parse(fs.readFileSync('data/fpi.json', 'utf8'));
const resume = JSON.parse(fs.readFileSync('data/resume-weights.json', 'utf8'));

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

// Check FPI at-large weights
const fpiWeights = resume.byMethod.fpi;
console.log('FPI weights:', fpiWeights);

// Check at-large score for a few teams
const teams = ratings.teams.filter(t => t.level === 'A').slice(0, 10);
teams.forEach(t => {
  const fpiScore = getTeamMethodScore(t, 'fpi');
  // Simulate at-large score with typical values
  const ol = 1; // 1 loss
  const sched = t.sched || 0;
  const avgSched = 0; // simplified
  const isChamp = false;
  
  const atLargeScore = fpiScore - fpiWeights.lossPenalty * ol + fpiWeights.sosWeight * (sched - avgSched) + (isChamp ? fpiWeights.championBonus : 0);
  console.log(t.team + ': FPI=' + fpiScore.toFixed(1) + ', AtLargeScore=' + atLargeScore.toFixed(2));
});

console.log('\nWeights:', resume.byMethod.fpi);
console.log('(lossPenalty=1.7 means 1 loss = -1.7 at-large points)');
console.log('(championBonus=1.2 means winning conference = +1.2 at-large points)');