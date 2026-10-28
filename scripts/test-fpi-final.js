const fpi = JSON.parse(require('fs').readFileSync('data/fpi.json', 'utf8'));

function fpiOf(name) {
  if (!fpi || !fpi.byTeam) return null;
  if (fpi.byTeam[name]) return fpi.byTeam[name];
  return null;
}

// Test the previously missing teams
const testTeams = [
  'Texas A&M',
  'Louisiana-Lafayette',
  "Hawai'i"
];

testTeams.forEach(t => {
  const result = fpiOf(t);
  console.log(t + ' -> ' + (result ? 'FOUND: ' + result.score + ' (rank ' + result.rank + ')' : 'NOT FOUND'));
});

// Test all teams
const ratings = JSON.parse(require('fs').readFileSync('data/ratings.json', 'utf8'));
const sagarinTeams = ratings.teams.filter(t => t.level === 'A').map(t => t.team);

let found = 0, notFound = 0;
sagarinTeams.forEach(t => {
  if (fpiOf(t)) found++; else { notFound++; console.log('MISSING:', t); }
});
console.log('Found:', found, 'Not found:', notFound, 'Total:', sagarinTeams.length);