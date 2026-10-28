const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'fetch-fpi.js');
let content = fs.readFileSync(filePath, 'utf8');

// Replace the decodeHtmlEntities function with correct entity patterns
const newFunction = `function decodeHtmlEntities(s) {
  return String(s)
    .replace(/&/g, "&")
    .replace(/</g, "<")
    .replace(/>/g, ">")
    .replace(/"/g, '"')
    .replace(/'/g, "'")
    .replace(/'/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&apos;/g, "'");
}`;

content = content.replace(/function decodeHtmlEntities\(s\) \{[\s\S]*?^\}/m, newFunction);

fs.writeSync(fs.openSync(filePath, 'w'), content);
console.log('Fixed decodeHtmlEntities function');