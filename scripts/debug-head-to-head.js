const fs = require('fs');
const ratings = JSON.parse(fs.readFileSync('data/ratings.json', 'utf8'));
const fpi = JSON.parse(fs.readFileSync('data/fpi.json', 'utf8'));

// Test FPI lookup
function fpiOf(name) {
  if (!fpi || !fpi.byTeam) return null;
  if (fpi.byTeam[name]) return fpi.byTeam[name];
  return null;
}

// Test some teams
const testTeams = ['Georgia', 'Ohio State', 'Alabama', 'Texas', 'Notre Dame'];
testTeams.forEach(t => {
  const result = fpiOf(t);
  console.log(t + ' -> ' + (result ? result.score : 'NOT FOUND'));
});

// Now test the full flow
console.log('\nFPI data has', Object.keys(fpi.byTeam).length, 'teams');
console.log('Georgia in FPI:', 'Georgia' in fpi.byTeam);
console.log('Miami-Florida in FPI:', 'Miami-Florida' in fpi.byTeam);