const fs = require('fs');
const yaml = require('js-yaml');
const content = fs.readFileSync('.github/workflows/fetch-fpi.yml', 'utf8');
try {
  const parsed = yaml.load(content);
  console.log('YAML parsed successfully:', JSON.stringify(parsed, null, 2));
} catch (e) {
  console.log('YAML parse error:', e.message);
}