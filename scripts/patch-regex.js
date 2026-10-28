const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'fetch-fpi.js');
let content = fs.readFileSync(filePath, 'utf8');

// The regex patterns need to be: /&/g, /</g, />/g, /"/g, /'/g, /'/g, /&nbsp;/g, /&apos;/g
// In JavaScript source, these are written with the literal entity codes
// We need to replace the incorrect /&/g etc. with the correct ones

// Find the decodeHtmlEntities function
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
    let funcBody = content.substring(funcStart, end + 1);
    
    // Replace the regex patterns - we need to write the literal entity codes
    // The entity codes are: & < > " ' ' &nbsp; &apos;
    // In regex: /&/g, /</g, />/g, /"/g, /'/g, /'/g, /&nbsp;/g, /&apos;/g
    
    // Build the correct function body with literal entity codes in regex
    const correctBody = `function decodeHtmlEntities(s) {
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

    content = content.substring(0, funcStart) + correctBody + content.substring(end + 1);
    fs.writeFileSync(filePath, content);
    console.log('Patched decodeHtmlEntities with correct entity regex patterns');
  }
}