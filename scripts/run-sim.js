#!/usr/bin/env node
// Simplified simulation runner for CI: loads ratings + ESPN data,
// computes deterministic projection, then writes bubble + sim JSON.
const fs = require('fs');
const path = require('path');

function main() {
  try {
    const ratings = JSON.parse(fs.readFileSync('data/ratings.json', 'utf8'));
    const espnGames = JSON.parse(fs.readFileSync('data/espn-games.json', 'utf8'));
    const resume = JSON.parse(fs.readFileSync('data/resume-weights.json', 'utf8'));

    // Simplified simulation output: use deterministic field from ratings
    // plus a basic bubble estimate from at-large ranking depth.
    // For full stochastic sim, load assets/playoff.js in a browser context.

    // Read division data for context
    const divisionsRaw = fs.readFileSync('assets/divisions.js', 'utf8');
    // Not executed here - just referenced by site

    // Use deterministic projection + approximate field counts for immediate use
    var projTeams = (ratings.teams || []).filter(function(t) { return t.level === 'A'; }).sort(function(a,b) { return (b.predictor || b.rating || 0) - (a.predictor || a.rating || 0); }).slice(0, 12);
    var fieldApprox = {};
    projTeams.forEach(function(t, i) { fieldApprox[t.team] = Math.round((11 - i) / 11 * 10000 / 12); });
    var sum = Object.values(fieldApprox).reduce(function(a,b){return a+b;},0);
    if (sum && projTeams[0]) fieldApprox[projTeams[0].team] = Math.round(fieldApprox[projTeams[0].team] + (10000 - sum));

    const output = {
      format: 12,
      n: 10000,
      field: fieldApprox,
      champ: {},
      bubbleApprox: ratings.teams.filter(t => t.level === 'A').slice().sort((a,b) => (b.rating || b.predictor || 0) - (a.rating || a.predictor || 0)).slice(0, 20).map(t => t.team)
    };

    fs.writeFileSync('data/sim-12.json', JSON.stringify(output, null, 2));
    console.log('Wrote data/sim-12.json (simplified)');
  } catch (e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
}
main();
