function decodeHtmlEntities(s) {
  return String(s)
    .replace(/&/g, "&")
    .replace(/</g, "<")
    .replace(/>/g, ">")
    .replace(/"/g, '"')
    .replace(/'/g, "'")
    .replace(/'/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&apos;/g, "'");
}

// Test with actual entity codes (what we extract from HTML)
const raw = "Texas A&M Aggies";  // This string has literal & a m p ; characters
console.log('Input:', JSON.stringify(raw));
console.log('Has &:', raw.includes('&'));
console.log('Regex test:', /&/g.test(raw));

const result = decodeHtmlEntities(raw);
console.log('Output:', JSON.stringify(result));
console.log('---');

// Test the specific regex
console.log('Direct replace:', raw.replace(/&/g, '&'));