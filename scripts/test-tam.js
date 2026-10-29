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

console.log('Texas A&M:', fpiOf('Texas A&M') ? 'FOUND: ' + fpiOf('Texas A&M').score : 'MISSING');
console.log('Texas A&M Aggies:', fpiOf('Texas A&M Aggies') ? 'FOUND: ' + fpiOf('Texas A&M Aggies').score : 'MISSING');
console.log('Normalized Texas A&M:', normalize('Texas A&M'));
console.log('Normalized Texas A&M Aggies:', normalize('Texas A&M Aggies'));
console.log('Alias texas am aggies:', FpiAlias['texas am aggies']);