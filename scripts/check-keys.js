const fs = require('fs');
const c = fs.readFileSync('scripts/fetch-fpi.js', 'utf8');
const idx = c.indexOf('const FpiToSagarin = {');
const endIdx = c.indexOf('};', c.indexOf('const FpiToSagarin = {')) + 2;
const objStr = c.substring(idx + 19, c.indexOf('};', c.indexOf('const FpiToSagarin = {')) + 1);
const FpiToSagarin = eval('(' + objStr.substring(19) + ')');
console.log('texas a m aggies:', FpiToSagarin['texas a m aggies']);
console.log('texas a&m aggies:', FpiToSagarin['texas a&m aggies']);
console.log('texas am aggies:', FpiToSagarin['texas am aggies']);