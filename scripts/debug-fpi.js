const https = require('https');

https.get('https://www.espn.com/college-football/fpi/_/view/fpi', {headers:{'User-Agent':'Mozilla/5.0'}}, (res) => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => {
    const tables = d.match(/<table[\s\S]*?<\/table>/g) || [];
    
    // Parse Table 1 (the FPI data table)
    const table1 = tables[1];
    const rowRegex = /<tr[^>]*data-idx="(\d+)"[\s\S]*?<\/tr>/g;
    const rows = [];
    let match;
    while ((match = rowRegex.exec(table1)) !== null) {
      rows.push({ idx: parseInt(match[1], 10), html: match[0] });
    }
    
    console.log('Table 1 rows with data-idx:', rows.length);
    
    rows.slice(0, 10).forEach(r => {
      const tds = r.html.match(/<td[^>]*>([\s\S]*?)<\/td>/g) || [];
      console.log(`Row ${r.idx}: ${tds.length} TDs`);
      tds.forEach((td, i) => {
        const text = td.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
        if (text) console.log(`  TD${i}: ${text.substring(0, 80)}`);
      });
    });
    
    // Also check headers
    const headerMatch = table1.match(/<thead[\s\S]*?<\/thead>/);
    if (headerMatch) {
      console.log('\nTable 1 headers:');
      console.log(headerMatch[0].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
    }
  });
});

setTimeout(() => process.exit(0), 20000);