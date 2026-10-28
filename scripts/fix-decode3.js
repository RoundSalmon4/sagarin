const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'fetch-fpi.js');
let content = fs.readFileSync(filePath, 'utf8');

// The regex patterns need to match HTML entities, not just the & character
// Replace each pattern with the correct one
content = content.replace(/.replace\(\/&\/g, "&\"/g, '.replace(/&/g, "&")');
content = content.replace(/.replace\(\/&\/g, "&"/g, '.replace(/&/g, "&")');  // duplicate for safety

// More specific: fix the decodeHtmlEntities function
const patterns = [
  { from: '/&/g, "&"', to: '/&/g, "&"' },
  { from: '/</g, "<"', to: '/</g, "<"' },
  { from: '/>/g, ">"', to: '/>/g, ">"' },
  { from: '//g, \'"\'', to: '//g, \'"\'' },
  { from: '/\\'/g, "\'"', to: '/\\'/g, "\'"' },
  { from: '/\\'/g, "\'"', to: '/\\'/g, "\'"' },
];

// Actually, let's just rewrite the whole function with correct patterns
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

const start = content.indexOf('function decodeHtmlEntities(s) {');
if (start >= 0) {
  // Find the end of the function
  let braceLevel = 0;
  let inFunc = false;
  let end = -1;
  for (let i = start; i < content.length; i++) {
    if (content[i] === '{') { braceLevel++; inFunc = true; }
    else if (content[i] === '}') { braceLevel--; if (inFunc && braceLevel === 0) { end = i; break; } }
  }
  if (end >= 0) {
    content = content.substring(0, start) + newFunc + content.substring(end + 1);
    fs.writeFileSync(filePath, content);
    console.log('Fixed decodeHtmlEntities');
  } else {
    console.log('Could not find function end');
  }
} else {
  console.log('Function not found');
}