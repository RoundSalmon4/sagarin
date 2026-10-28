const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'fetch-fpi.js');
let content = fs.readFileSync(filePath, 'utf8');

// Fix the extra closing braces
content = content.replace(/\}\}\}\}\}\s*async function fetchText/, '}\nasync function fetchText');

fs.writeFileSync(filePath, content);
console.log('Fixed extra braces');