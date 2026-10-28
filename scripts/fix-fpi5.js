const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'fetch-fpi.js');
let content = fs.readFileSync(filePath, 'utf8');

// Find the decodeHtmlEntities function end (first } at column 0 after function)
const funcIdx = content.indexOf('function decodeHtmlEntities');
let braceLevel = 0;
let inFunction = false;
let endIdx = -1;

for (let i = funcIdx; i < content.length; i++) {
  if (content[i] === '{') {
    braceLevel++;
    inFunction = true;
  } else if (content[i] === '}') {
    braceLevel--;
    if (inFunction && braceLevel === 0) {
      endIdx = i;
      break;
    }
  }
}

if (endIdx >= 0) {
  // Find the next non-whitespace, non-} character after endIdx
  let pos = endIdx + 1;
  while (pos < content.length && (content[pos] === '}' || content[pos] === '\n' || content[pos] === '\r' || content[pos] === ' ' || content[pos] === '\t')) {
    if (content[pos] === '}') {
      // This is an extra brace, remove it
      content = content.substring(0, pos) + content.substring(pos + 1);
      pos--; // Stay at same position since we removed a char
    }
    pos++;
  }
  
  fs.writeFileSync(filePath, content);
  console.log('Fixed extra braces after decodeHtmlEntities');
}