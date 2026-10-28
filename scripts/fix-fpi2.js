const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'fetch-fpi.js');
let content = fs.readFileSync(filePath, 'utf8');

// Fix the extra closing braces - replace the pattern with just one closing brace
content = content.replace(
  /(\.replace\(\/&apos;\/g, "'"\);\n\}\}\}\}\}\s*)async function fetchText/,
  '$1async function fetchText'
);

fs.writeFileSync(filePath, content);
console.log('Fixed extra braces');