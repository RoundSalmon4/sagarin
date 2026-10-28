const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'fetch-fpi.js');
let content = fs.readFileSync(filePath, 'utf8');

// Find the decodeHtmlEntities function end
const searchStr = '.replace(/&apos;/g, "\\\'");';
const idx = content.indexOf(searchStr);
if (idx >= 0) {
  console.log('Found at:', idx);
  // Find the next 200 chars
  console.log('Context:', JSON.stringify(content.substring(idx, idx + 200)));
  
  // Replace the extra braces
  const afterIdx = idx + searchStr.length;
  let braceCount = 0;
  let pos = afterIdx;
  while (pos < content.length && content[pos] === '}') {
    braceCount++;
    pos++;
  }
  console.log('Extra braces:', braceCount);
  
  if (braceCount > 1) {
    content = content.substring(0, afterIdx + 1) + content.substring(afterIdx + braceCount);
    fs.writeFileSync(filePath, content);
    console.log('Fixed - removed', braceCount - 1, 'extra braces');
  }
}