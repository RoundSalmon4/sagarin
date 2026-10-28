const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'fetch-fpi.js');
let content = fs.readFileSync(filePath, 'utf8');

// The issue: regex patterns in decodeHtmlEntities use /&/g which matches & character
// Need to change to /&/g which matches the entity &
// In the source code, this means the regex literal should be /&/g

// Find the function and replace the specific patterns
const patterns = [
  // [search regex in source, replacement regex in source]
  [/\.replace\(\/&\/g,/g, '.replace(/&/g,'],
  [/\.replace\(\/<\//g,/g, '.replace(/</g,'],
  [/\.replace\(\/>\//g,/g, '.replace(/>/g,'],
  [/\.replace\(\/"\/g,/g, '.replace(/"/g,'],
  [/\.replace\(\/'/g,/g, ".replace(/'/g,"],
  [/\.replace\(\/'\//g,/g, ".replace(/'/g,"],
  [/\.replace\(\/&nbsp;\//g,/g, '.replace(/&nbsp;/g,'],
  [/\.replace\(\/&apos;\//g,/g, '.replace(/&apos;/g,'],
];

let changed = false;
for (const [search, replace] of patterns) {
  const newContent = content.replace(search, replace);
  if (newContent !== content) {
    content = newContent;
    changed = true;
  }
}

// Also fix the replacement strings
content = content.replace(/"&"/g, '"&"');
content = content.replace(/"</g, '"<"');
content = content.replace(/">"/g, '">"');
content = content.replace(/"'"/g, '"\""');
content = content.replace(/"'"/g, '"\'"');

if (changed) {
  fs.writeFileSync(filePath, content);
  console.log('Fixed decodeHtmlEntities patterns');
} else {
  console.log('No changes made - patterns not found');
  // Debug: show what's actually in the file
  const idx = content.indexOf('function decodeHtmlEntities');
  if (idx >= 0) {
    console.log(content.substring(idx, idx + 500));
  }
}