const fs = require('fs');
const files = ['assets/playoff.js', 'assets/schedule.js', 'assets/core.js'];
files.forEach((file, i) => {
  const c = fs.readFileSync(file, 'utf8');
  const idx = c.indexOf('fallback');
  if (idx >= 0) {
    console.log('File', file, 'has fallback at:', idx);
    console.log(c.substring(Math.max(0, idx - 50), idx + 50));
  } else {
    console.log('File', file, ': No fallback');
  }
});