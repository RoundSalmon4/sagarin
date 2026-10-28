const fs = require('fs');
const path = require('path');

// Correct decodeHtmlEntities function with proper entity regex patterns
const correctFunc = `function decodeHtmlEntities(s) {
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

fs.writeFileSync(path.join(__dirname, 'correct-decode-func.txt'), correctFunc);
console.log('Wrote correct function to file');
console.log(correctFunc);