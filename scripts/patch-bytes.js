const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'fetch-fpi.js');
let content = fs.readFileSync(filePath, 'utf8');

// Find the decodeHtmlEntities function and replace the regex patterns
// We need to change /&/g -> /&/g, /</g -> /</g, etc.
// In the source, these are written with literal entity codes

const funcStart = content.indexOf('function decodeHtmlEntities(s) {');
if (funcStart >= 0) {
  let braceLevel = 0;
  let inFunc = false;
  let end = -1;
  for (let i = funcStart; i < content.length; i++) {
    if (content[i] === '{') { braceLevel++; inFunc = true; }
    else if (content[i] === '}') { braceLevel--; if (inFunc && braceLevel === 0) { end = i; break; } }
  }
  
  if (end >= 0) {
    // Convert to buffer for byte-level manipulation
    const buf = Buffer.from(content, 'utf8');
    
    // Find the byte positions of the regex patterns in the function
    const funcBuf = buf.subarray(funcStart, end + 1);
    const funcStr = funcBuf.toString('utf8');
    
    // Replace the regex patterns in the function string
    // The patterns are: /&/g -> /&/g, /</g -> /</g, etc.
    // We need to write the literal entity codes in the regex
    
    let newFuncStr = funcStr
      .replace(/\/&\/g/g, '/&/g')
      .replace(/\/<\//g, '/</g')
      .replace(/\/>\//g, '/>/g')
      .replace(/\/"/g, '/"/g')
      .replace(/\/'/g, "/'/g")
      .replace(/\/'\//g, '/\'/g')
      .replace(/\/&nbsp;\//g, '/&nbsp;/g')
      .replace(/\/&apos;\//g, '/&apos;/g');
    
    // Also fix the replacement strings
    newFuncStr = newFuncStr
      .replace(/"&"/g, '"&"')
      .replace(/"</g, '"<"')
      .replace(/">"/g, '">"')
      .replace(/"'"/g, '"\""')
      .replace(/"'"/g, '"\'"');
    
    // Write back
    const newFuncBuf = Buffer.from(newFuncStr, 'utf8');
    const newBuf = Buffer.concat([
      buf.subarray(0, funcStart),
      newFuncBuf,
      buf.subarray(end + 1)
    ]);
    
    fs.writeFileSync(filePath, newBuf);
    console.log('Patched decodeHtmlEntities at byte level');
  }
}