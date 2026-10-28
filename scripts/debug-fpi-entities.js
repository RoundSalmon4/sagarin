const https = require('https');

https.get('https://www.espn.com/college-football/fpi/_/view/fpi', {headers:{'User-Agent':'Mozilla/5.0'}}, (res) => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => {
    // Extract all team rows
    const rowRegex = /<tr[^>]*data-idx="(\d+)"[\s\S]*?<\/tr>/g;
    let match;
    while ((match = rowRegex.exec(d)) !== null) {
      const idx = match[1];
      const rowHtml = match[0];
      const nameMatch = rowHtml.match(/<a[^>]*class="AnchorLink[^"]*"[^>]*>([^<]+)<\/a>/);
      if (nameMatch) {
        const name = nameMatch[1].trim();
        if (name.includes('Texas A') || name.includes('Hawai') || name.includes('Louisiana Ragin') || name.includes('Louisiana-Laf')) {
          console.log(`Idx ${idx}: Raw: ${JSON.stringify(name)}`);
          console.log(`       Decoded: ${decodeHtmlEntities(name)}`);
        }
      }
    }
  });
});

function decodeHtmlEntities(s) {
  return String(s)
    .replace(/&/g, "&")
    .replace(/'/g, "'")
    .replace(/'/g, "'")
    .replace(/"/g, '"')
    .replace(/</g, "<")
    .replace(/>/g, ">")
    .replace(/&nbsp;/g, " ");
}

setTimeout(() => process.exit(0), 15000);