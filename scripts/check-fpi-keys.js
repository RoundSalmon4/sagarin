const fpi = JSON.parse(require('fs').readFileSync('data/fpi.json', 'utf8'));

// Check the actual keys for the missing teams
const keys = Object.keys(fpi.byTeam);
keys.forEach(k => {
  if (k.toLowerCase().includes('texas a') || k.toLowerCase().includes('louisiana-laf') || k.toLowerCase().includes('hawai')) {
    console.log('Key:', JSON.stringify(k), '->', fpi.byTeam[k].score);
  }
});