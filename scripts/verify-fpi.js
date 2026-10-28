const fpi = JSON.parse(require('fs').readFileSync('data/fpi.json', 'utf8'));

// Check byTeam keys are Sagarin names
const keys = Object.keys(fpi.byTeam);
console.log('byTeam keys (first 10):', keys.slice(0, 10));
console.log('Texas A&M in byTeam:', 'Texas A&M' in fpi.byTeam);
console.log('Georgia in byTeam:', 'Georgia' in fpi.byTeam);
console.log('Miami-Florida in byTeam:', 'Miami-Florida' in fpi.byTeam);
console.log('Central Florida(UCF) in byTeam:', 'Central Florida(UCF)' in fpi.byTeam);
console.log('Southern California in byTeam:', 'Southern California' in fpi.byTeam);
console.log('LouisianaMonroe(ULM) in byTeam:', 'LouisianaMonroe(ULM)' in fpi.byTeam);