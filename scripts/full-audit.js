const fs = require('fs');
const ratings = JSON.parse(fs.readFileSync('data/ratings.json', 'utf8'));
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

const sagarinTeams = ratings.teams.filter(t => t.level === 'A').map(t => t.team);
let missing = [];
sagarinTeams.forEach(t => {
  if (!fpiOf(t)) missing.push(t);
});
console.log('Missing FPI for:', missing.length === 0 ? 'NONE' : missing.join(', '));

const testTeams = ['Georgia', 'Ohio State', 'Alabama', 'Texas', 'Notre Dame', 'Texas A&M', "Hawai'i", 'Louisiana-Lafayette', 'Miami-Florida'];
testTeams.forEach(t => {
  const d = fpiOf(t);
  console.log('  ' + t + ': ' + (d ? 'FPI=' + d.score + ' (rank ' + d.rank + ')' : 'MISSING'));
});