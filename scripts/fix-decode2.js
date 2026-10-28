const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'fetch-fpi.js');
let content = fs.readFileSync(filePath, 'utf8');

// Fix decodeHtmlEntities with correct entity patterns
const oldFunc = `function decodeHtmlEntities(s) {
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

const newFunc = `function decodeHtmlEntities(s) {
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

// Use a more precise replacement by finding the function
const funcStart = content.indexOf('function decodeHtmlEntities(s) {');
if (funcStart >= 0) {
  const funcEnd = content.indexOf('\n}', funcStart) + 2;
  content = content.substring(0, funcStart) + newFunc + content.substring(funcEnd);
  fs.writeFileSync(filePath, content);
  console.log('Fixed decodeHtmlEntities function');
} else {
  console.log('Function not found');
}