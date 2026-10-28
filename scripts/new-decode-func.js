// This file contains the correct decodeHtmlEntities function
// The regex patterns use HTML entity codes: & < > " ' ' &nbsp; &apos;

const newFunc = `function decodeHtmlEntities(s) {
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

console.log(newFunc);