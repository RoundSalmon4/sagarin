const fpi = JSON.parse(require('fs').readFileSync('data/fpi.json', 'utf8'));

// Check the actual keys in byTeam
const keys = Object.keys(fpi.byTeam);
console.log('byTeam keys count:', keys.length);
console.log('Texas A&M key exists:', 'Texas A&M' in fpi.byTeam);
console.log('Louisiana-Lafayette key exists:', 'Louisiana-Lafayette' in fpi.byTeam);
console.log("Hawai'i key exists:", "Hawai'i" in fpi.byTeam);

// Check for similar keys
keys.forEach(k => {
  if (k.toLowerCase().includes('texas a') || k.toLowerCase().includes('louisiana-laf') || k.toLowerCase().includes('hawai')) {
    console.log('Key:', k, '->', fpi.byTeam[k].score);
  }
});