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

// Simulate what we extract from HTML (the raw entity codes)
const tests = [
  "Texas A&M Aggies",           // This is what we get from regex - literal & a m p ;
  "Louisiana Ragin' Cajuns", // literal & # x 2 7 ;
  "Hawai'i Rainbow Warriors",
  "Louisiana Ragin&apos; Cajuns"
];

tests.forEach(t => {
  console.log('Input:', JSON.stringify(t));
  console.log('Output:', JSON.stringify(decodeHtmlEntities(t)));
  console.log('---');
});