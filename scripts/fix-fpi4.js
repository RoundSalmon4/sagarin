const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'fetch-fpi.js');
let content = fs.readFileSync(filePath, 'utf8');

// Find the decodeHtmlEntities function
const funcIdx = content.indexOf('function decodeHtmlEntities');
if (funcIdx >= 0) {
  // Find the end of the function (the closing brace at the same indentation level)
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
    console.log('Function ends at:', endIdx);
    console.log('Context after:', JSON.stringify(content.substring(endIdx, endIdx + 50)));
    
    // Check for extra braces after the function
    let pos = endIdx + 1;
    let extraBraces = 0;
    while (pos < content.length && content[pos] === '}') {
      extraBraces++;
      pos++;
    }
    console.log('Extra braces after function:', extraBraces);
    
    if (extraBraces > 0) {
      content = content.substring(0, endIdx + 1) + content.substring(endIdx + 1 + extraBraces);
      fs.writeFileSync(filePath, content);
      console.log('Removed', extraBraces, 'extra braces');
    }
  }
}