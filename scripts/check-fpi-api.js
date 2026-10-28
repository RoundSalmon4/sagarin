const https = require('https');

https.get('https://www.espn.com/college-football/fpi/_/view/fpi', {headers:{'User-Agent':'Mozilla/5.0'}}, (res) => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => {
    // Extract all table rows
    const tableRows = d.match(/<tr[^>]*data-idx="\d+"[\s\S]*?<\/tr>/g) || [];
    console.log('Ranked rows found:', tableRows.length);
    
    tableRows.forEach((row, i) => {
      // Extract team name from the TeamLink__Name anchor
      const nameMatch = row.match(/<a[^>]*class="AnchorLink[^"]*"[^>]*>([^<]+)<\/a>/);
      const teamName = nameMatch ? nameMatch[1] : 'UNKNOWN';
      
      // Extract team ID from href
      const idMatch = row.match(/\/team\/_\/(id\/)?(\d+)\//);
      const teamId = idMatch ? idMatch[2] : 'UNKNOWN';
      
      // Extract all TD contents
      const tds = row.match(/<td[^>]*>[\s\S]*?<\/td>/g) || [];
      const tdTexts = tds.map(td => td.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim());
      
      console.log(`${i+1}. ${teamName} (ID: ${teamId}) | ${tdTexts.join(' | ')}`);
    });
  });
});

setTimeout(() => process.exit(0), 20000);