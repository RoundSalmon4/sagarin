const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'fetch-fpi.js');
let content = fs.readFileSync(filePath, 'utf8');

// Replace the regex patterns in decodeHtmlEntities
// The patterns are: /&/g -> /&/g, /</g -> /</g, />/g -> />/g, etc.
// We need to change them to match the full entity codes

// Find the decodeHtmlEntities function
const start = content.indexOf('function decodeHtmlEntities(s) {');
if (start >= 0) {
  let braceLevel = 0;
  let inFunc = false;
  let end = -1;
  for (let i = start; i < content.length; i++) {
    if (content[i] === '{') { braceLevel++; inFunc = true; }
    else if (content[i] === '}') { braceLevel--; if (inFunc && braceLevel === 0) { end = i; break; } }
  }
  
  if (end >= 0) {
    let funcBody = content.substring(start, end + 1);
    
    // Replace the regex patterns
    funcBody = funcBody
      .replace(/\/&\/g/g, '/&/g')
      .replace(/\/<\//g, '/</g')
      .replace(/\/>\//g, '/>/g')
      .replace(/\/"/g, '/"/g')
      .replace(/\/'/g, "/'/g")
      .replace(/\/'\//g, '/\'/g')
      .replace(/\/&nbsp;\//g, '/&nbsp;/g')
      .replace(/\/&apos;\//g, '/&apos;/g');
    
    // Also fix the replacement strings
    funcBody = funcBody
      .replace(/"&"/g, '"&"')
      .replace(/"</g, '"<"')
      .replace(/">"/g, '">"')
      .replace(/'"'/g, '"\""')
      .replace(/"'"/g, '"\'"')
      .replace(/"'"/g, '"\'"');
    
    content = content.substring(0, start) + funcBody + content.substring(end + 1);
    fs.writeFileSync(filePath, content);
    console.log('Fixed regex patterns in decodeHtmlEntities');
  }
}