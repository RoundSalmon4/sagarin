const Alias = require('../assets/team-alias.js');
const FpiAlias = Alias.FpiAlias || {};

function normalize(s) {
  return String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[.'&]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

// Check Hawaii
console.log('FpiAlias hawaii:', FpiAlias['hawaii']);
console.log('FpiAlias hawai i:', FpiAlias['hawai i']);
console.log('FpiAlias keys with hawai:', Object.keys(FpiAlias).filter(k => k.includes('hawai')));

const test1 = normalize("Hawai'i");
const test2 = normalize("Hawaii'i");
console.log('normalize Hawaii 1:', test1);
console.log('normalize Hawaii 2:', test2);
console.log('FpiAlias key for test1:', FpiAlias[test1]);
console.log('FpiAlias key for test2:', FpiAlias[test2]);