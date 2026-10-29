const fs = require('fs');
const c = fs.readFileSync('scripts/fetch-fpi.js', 'utf8');
const idx = c.indexOf('const FpiToSagarin = {');
const endIdx = c.indexOf('};', idx) + 2;
const objStr = c.substring(idx + 19, endIdx);
const FpiToSagarin = JSON.parse('{' + objStr.substring(objStr.indexOf('{') + 1, objStr.lastIndexOf('}')) + '}');
console.log('texas a m aggies:', FpiToSagarin['texas a m aggies']);
console.log('texas a&m aggies:', FpiToSagarin['texas a&m aggies']);
console.log('texas am aggies:', FpiToSagarin['texas am aggies']);