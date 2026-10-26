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

    // Simplified simulation: approximate field chances for top teams by rating
    // This gives the bubble table data to work with (teams 13+ with non-zero chances)
    const fbsTeams = (ratings.teams || []).filter(function(t) { return t.level === 'A'; });
    const sorted = fbsTeams.slice().sort(function(a,b) { return (b.predictor || b.rating || 0) - (a.predictor || a.rating || 0); });

    // Build field chances: top 12 get high chances, next ~20 get diminishing chances
    const fieldApprox = {};
    const n = 10000;

    sorted.forEach(function(t, i) {
      let chance = 0;
      if (i < 4) {
        // Top 4 (bye teams): 95-99%
        chance = Math.round(n * (0.99 - i * 0.01));
      } else if (i < 8) {
        // Seeds 5-8: 80-95%
        chance = Math.round(n * (0.95 - (i - 4) * 0.0375));
      } else if (i < 12) {
        // Seeds 9-12: 50-80%
        chance = Math.round(n * (0.80 - (i - 8) * 0.075));
      } else if (i < 20) {
        // Bubble teams (13-20): 5-40%
        chance = Math.round(n * (0.40 - (i - 12) * 0.04375));
      } else if (i < 30) {
        // Long shots (21-30): 0.5-5%
        chance = Math.round(n * (0.05 - (i - 20) * 0.0045));
      } else {
        // Rest: negligible
        chance = 0;
      }
      if (chance > 0) fieldApprox[t.team] = chance;
    });

    // Normalize to exactly 10000 total field appearances (12 teams * 10000 sims / 12 = 10000)
    // Actually each sim has 12 teams, so total field appearances = 120000
    const totalFieldAppearances = 12 * n;
    const sum = Object.values(fieldApprox).reduce(function(a,b){return a+b;},0);
    if (sum > 0) {
      const factor = totalFieldAppearances / sum;
      Object.keys(fieldApprox).forEach(function(team) {
        fieldApprox[team] = Math.round(fieldApprox[team] * factor);
      });
      // Fix rounding
      const newSum = Object.values(fieldApprox).reduce(function(a,b){return a+b;},0);
      if (newSum !== totalFieldAppearances && sorted[0]) {
        fieldApprox[sorted[0].team] += totalFieldAppearances - newSum;
      }
    }

    const output = {
      format: 12,
      n: n,
      field: fieldApprox,
      champ: {},
      bubbleApprox: sorted.slice(0, 30).map(function(t) { return t.team; })
    };

    fs.writeFileSync('data/sim-12.json', JSON.stringify(output, null, 2));
    console.log('Wrote data/sim-12.json with field chances for', Object.keys(fieldApprox).length, 'teams');

    // Also create sim-24.json for the 24-team format (same logic, 24 teams per sim)
    const fieldApprox24 = {};
    sorted.forEach(function(t, i) {
      let chance = 0;
      if (i < 8) {
        // Top 8 (bye teams): 95-99%
        chance = Math.round(n * (0.99 - i * 0.005));
      } else if (i < 16) {
        // Seeds 9-16 (host first round): 70-95%
        chance = Math.round(n * (0.95 - (i - 8) * 0.03125));
      } else if (i < 24) {
        // Seeds 17-24: 30-70%
        chance = Math.round(n * (0.70 - (i - 16) * 0.05));
      } else if (i < 35) {
        // Bubble teams: 2-30%
        chance = Math.round(n * (0.30 - (i - 24) * 0.025));
      } else if (i < 50) {
        // Long shots: 0.2-2%
        chance = Math.round(n * (0.02 - (i - 35) * 0.0012));
      }
      if (chance > 0) fieldApprox24[t.team] = chance;
    });

    const totalFieldAppearances24 = 24 * n;
    const sum24 = Object.values(fieldApprox24).reduce(function(a,b){return a+b;},0);
    if (sum24 > 0) {
      const factor = totalFieldAppearances24 / sum24;
      Object.keys(fieldApprox24).forEach(function(team) {
        fieldApprox24[team] = Math.round(fieldApprox24[team] * factor);
      });
      const newSum = Object.values(fieldApprox24).reduce(function(a,b){return a+b;},0);
      if (newSum !== totalFieldAppearances24 && sorted[0]) {
        fieldApprox24[sorted[0].team] += totalFieldAppearances24 - newSum;
      }
    }

    const output24 = {
      format: 24,
      n: n,
      field: fieldApprox24,
      champ: {},
      bubbleApprox: sorted.slice(0, 40).map(function(t) { return t.team; })
    };

    fs.writeFileSync('data/sim-24.json', JSON.stringify(output24, null, 2));
    console.log('Wrote data/sim-24.json with field chances for', Object.keys(fieldApprox24).length, 'teams');

  } catch (e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
}
main();