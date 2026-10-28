const fpi = JSON.parse(require('fs').readFileSync('data/fpi.json', 'utf8'));

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

// Test with exact Sagarin name (with special apostrophe)
const testName = "Hawai'i";
console.log('Test name:', testName);
console.log('Normalized:', normalize(testName));
console.log('FPI lookup:', fpiOf(testName) ? 'FOUND: ' + fpiOf(testName).score : 'MISSING');

// Also test without apostrophe
console.log('Without apostrophe:', fpiOf('Hawaii') ? 'FOUND' : 'MISSING');