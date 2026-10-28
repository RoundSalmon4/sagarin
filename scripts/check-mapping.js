const fs = require('fs');
const fetchScript = fs.readFileSync('scripts/fetch-fpi.js', 'utf8');

// Extract the mapping
const mapStart = fetchScript.indexOf('const FpiToSagarin = {');
const mapEnd = fetchScript.indexOf('};', mapStart) + 2;
const mapStr = fetchScript.substring(mapStart, mapEnd);

// Check Texas A&M mappings
const lines = mapStr.split('\n');
lines.forEach(line => {
  if (line.toLowerCase().includes('texas a')) {
    console.log(line.trim());
  }
});

// Also check the normalize function behavior
function normalize(s) {
  return String(s)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[.'&]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

console.log('\nnormalize("Texas A&M Aggies"):', normalize("Texas A&M Aggies"));
console.log('normalize("Texas A&M Aggies"):', normalize("Texas A&M Aggies"));