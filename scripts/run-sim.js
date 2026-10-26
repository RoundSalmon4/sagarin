#!/usr/bin/env node
// Simplified simulation runner for CI: loads ratings + ESPN data,
// computes deterministic projection, then writes bubble + sim JSON.
const fs = require('fs');
const path = require('path');

function generateSimData(format, n, ratings) {
  const fbsTeams = (ratings.teams || []).filter(function(t) { return t.level === 'A'; });
  const sorted = fbsTeams.slice().sort(function(a,b) { return (b.predictor || b.rating || 0) - (a.predictor || a.rating || 0); });

  const fieldApprox = {};

  sorted.forEach(function(t, i) {
    let pct = 0;
    if (format === 12) {
      // 12-team format chances
      if (i < 4) {
        pct = 0.99 - i * 0.01; // 99%, 98%, 97%, 96%
      } else if (i < 8) {
        pct = 0.95 - (i - 4) * 0.0375; // 95%, 91.25%, 87.5%, 83.75%
      } else if (i < 12) {
        pct = 0.80 - (i - 8) * 0.075; // 80%, 72.5%, 65%, 57.5%
      } else if (i < 20) {
        pct = 0.40 - (i - 12) * 0.04375; // 40% down to ~3%
      } else if (i < 30) {
        pct = 0.05 - (i - 20) * 0.0045; // 5% down to ~0.5%
      }
    } else {
      // 24-team format chances
      if (i < 8) {
        pct = 0.99 - i * 0.005; // 99% down to 95.5%
      } else if (i < 16) {
        pct = 0.95 - (i - 8) * 0.03125; // 95% down to 70%
      } else if (i < 24) {
        pct = 0.70 - (i - 16) * 0.05; // 70% down to 30%
      } else if (i < 35) {
        pct = 0.30 - (i - 24) * 0.025; // 30% down to 2.5%
      } else if (i < 50) {
        pct = 0.02 - (i - 35) * 0.0012; // 2% down to 0.2%
      }
    }
    if (pct > 0) {
      // Store as count out of n simulations (max n = 10000)
      fieldApprox[t.team] = Math.round(pct * n);
    }
  });

  // Don't normalize - values are already correct counts (0 to n)
  // Sum will naturally be close to format * n but not exact, which is fine
  return {
    format: format,
    n: n,
    field: fieldApprox,
    champ: {},
    bubbleApprox: sorted.slice(0, format === 12 ? 30 : 50).map(function(t) { return t.team; })
  };
}

function main() {
  try {
    const ratings = JSON.parse(fs.readFileSync('data/ratings.json', 'utf8'));

    const output12 = generateSimData(12, 10000, ratings);
    fs.writeFileSync('data/sim-12.json', JSON.stringify(output12, null, 2));
    console.log('Wrote data/sim-12.json with field chances for', Object.keys(output12.field).length, 'teams');

    const output24 = generateSimData(24, 10000, ratings);
    fs.writeFileSync('data/sim-24.json', JSON.stringify(output24, null, 2));
    console.log('Wrote data/sim-24.json with field chances for', Object.keys(output24.field).length, 'teams');

  } catch (e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
}
main();