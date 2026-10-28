function decodeHtmlEntities(s) {
  return String(s)
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"')
    .replace(/'/g, "'")
    .replace(/'/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&apos;/g, "'");
}

const tests = [
  "Texas A&M Aggies",
  "Louisiana Ragin' Cajuns",
  "Hawai'i Rainbow Warriors",
  "Louisiana Ragin&apos; Cajuns"
];

tests.forEach(t => {
  console.log('Input:', t);
  console.log('Output:', decodeHtmlEntities(t));
  console.log('---');
});