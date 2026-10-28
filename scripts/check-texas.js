const fs = require('fs');
const fpi = JSON.parse(fs.readFileSync('data/fpi.json', 'utf8'));

// Check what the byTeam keys are for Texas A&M
const keys = Object.keys(fpi.byTeam);
keys.forEach(k => {
  if (k.toLowerCase().includes('texas a')) {
    console.log('Key:', JSON.stringify(k), '->', fpi.byTeam[k].score);
  }
});

// Check the byEspnName keys
const espnKeys = Object.keys(fpi.byEspnName);
espnKeys.forEach(k => {
  if (k.toLowerCase().includes('texas a')) {
    console.log('ESPN Key:', JSON.stringify(k), '->', fpi.byEspnName[k].score);
  }
});