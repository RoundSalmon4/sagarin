#!/usr/bin/env node
// Full stochastic simulation runner for CI: replicates browser computeSim() exactly.
// Loads ratings + ESPN data, runs 10,000 simulations, writes sim-12.json and sim-24.json.

const fs = require('fs');
const path = require('path');

const SIGMA = 15.5;
const P4 = ["SEC", "BIG TEN", "BIG 12", "ACC"];
const G6 = ["AMERICAN", "CONF-USA", "MAC", "MOUNTAIN WEST", "SUN BELT", "PAC-12"];
const NEUTRAL_CCG = { "ACC": true, "SEC": true, "BIG TEN": true, "BIG 12": true, "MAC": true };
const SIMS = 10000;
const AT_LARGE_LOSS_PENALTY = 5;
const AT_LARGE_SOS_WEIGHT = 0;
const AT_LARGE_CHAMPION_BONUS = 0;

function mergeConf(c) {
  if (c === "SUN BELT EAST" || c === "SUN BELT WEST") return "SUN BELT";
  return c;
}

function erf(x) {
  var s = x < 0 ? -1 : 1;
  x = Math.abs(x);
  var t = 1 / (1 + 0.3275911 * x);
  var y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return s * y;
}

function normCdf(z) { return 0.5 * (1 + erf(z / Math.SQRT2)); }

function getRec(rec, team) {
  return rec[team] || (rec[team] = { cw: 0, cl: 0, ow: 0, ol: 0 });
}

function cloneRecords(rec) {
  var out = {};
  Object.keys(rec).forEach(function (k) {
    var r = rec[k];
    out[k] = { cw: r.cw, cl: r.cl, ow: r.ow, ol: r.ol };
  });
  return out;
}

function champScore(team, std, method) {
  var r = std[team.team] || { cw: 0, cl: 0, ow: 0, ol: 0 };
  var cwp = (r.cw + r.cl) ? r.cw / (r.cw + r.cl) : 0;
  var owp = (r.ow + r.ol) ? r.ow / (r.ow + r.ol) : 0;
  return cwp * 1e6 + owp * 1e3 + (team[method] || 0);
}

function conferenceOrder(teams, method, std) {
  var byConf = {};
  teams.forEach(function (t) {
    var c = mergeConf(t.conference);
    (byConf[c] = byConf[c] || []).push(t);
  });
  var order = {};
  Object.keys(byConf).forEach(function (c) {
    order[c] = byConf[c].slice().sort(function (a, b) { return champScore(b, std, method) - champScore(a, std, method); });
  });
  return order;
}

function ccgResult(conf, top, second, method, homeEdge) {
  var neutral = !!NEUTRAL_CCG[conf];
  var edge = neutral ? 0 : homeEdge;
  var spread = top[method] - second[method] + edge;
  var p = normCdf(spread / SIGMA);
  return { conf: conf, a: top, b: second, neutral: neutral, spread: spread, p: p, winner: p >= 0.5 ? top : second };
}

function ccgOutcomes(teams, method, homeEdge, regRec, stochastic) {
  var order = conferenceOrder(teams, method, regRec);
  var out = {};
  Object.keys(order).forEach(function (c) {
    if (c === "I-A IND.") return;
    var list = order[c];
    if (!list[0] || !list[1]) return;
    var m = ccgResult(c, list[0], list[1], method, homeEdge);
    var win = (stochastic ? Math.random() : 0.5) < m.p ? m.a : m.b;
    out[c] = { winner: win, loser: win === m.a ? m.b : m.a, matchup: m };
  });
  return out;
}

function foldCcg(rec, ccgs) {
  Object.keys(ccgs).forEach(function (c) {
    var rw = getRec(rec, ccgs[c].winner.team);
    rw.cw += 1; rw.ow += 1;
    var rl = getRec(rec, ccgs[c].loser.team);
    rl.cl += 1; rl.ol += 1;
  });
}

function applyResult(rec, confOf, h, a, hWin) {
  var same = h && a && confOf[h.team] && confOf[h.team] === confOf[a.team] && confOf[h.team] !== "I-A IND.";
  if (h) { var rh = getRec(rec, h.team); rh.ow += hWin ? 1 : 0; rh.ol += hWin ? 0 : 1; if (same) { rh.cw += hWin ? 1 : 0; rh.cl += hWin ? 0 : 1; } }
  if (a) { var ra = getRec(rec, a.team); ra.ow += hWin ? 0 : 1; ra.ol += hWin ? 1 : 0; if (same) { ra.cw += hWin ? 0 : 1; ra.cl += hWin ? 1 : 0; } }
}

function loadResumeWeights(resume) {
  var lossPenalty = AT_LARGE_LOSS_PENALTY;
  var sosWeight = AT_LARGE_SOS_WEIGHT;
  var championBonus = AT_LARGE_CHAMPION_BONUS;
  if (resume) {
    if (typeof resume.lossPenalty === "number") lossPenalty = resume.lossPenalty;
    if (typeof resume.sosWeight === "number") sosWeight = resume.sosWeight;
    if (typeof resume.championBonus === "number") championBonus = resume.championBonus;
  }
  return { lossPenalty, sosWeight, championBonus };
}

function espnW(team, espnRecord) { return espnRecord && espnRecord[team] ? espnRecord[team].w : 0; }
function espnL(team, espnRecord) { return espnRecord && espnRecord[team] ? espnRecord[team].l : 0; }
function espnConfW(team, espnConfRecord) { return espnConfRecord && espnConfRecord[team] ? espnConfRecord[team].w : 0; }
function espnConfL(team, espnConfRecord) { return espnConfRecord && espnConfRecord[team] ? espnConfRecord[team].l : 0; }

function buildField(teams, method, format, regRec, ccgs, resumeWeights, espnRecord, espnConfRecord) {
  var is12 = Number(format) === 12;
  var champs = {};

  if (is12 && ccgs) {
    Object.keys(ccgs).forEach(function (c) { champs[c] = ccgs[c].winner; });
  } else {
    var order = conferenceOrder(teams, method, regRec);
    Object.keys(order).forEach(function (c) {
      if (c === "I-A IND.") return;
      if (order[c][0]) champs[c] = order[c][0];
    });
  }

  var std = regRec;
  if (is12 && ccgs) { std = cloneRecords(regRec); foldCcg(std, ccgs); }

  var seeds = [null];
  var bid = {};

  var ap = { primary: "cfp", byTeam: null }; // CFP not available in CI, fallback to resume
  var hasCfp = false;
  var cfpRank = null;

  // Resume score weights
  var avgSched = 0;
  for (var ai = 0; ai < teams.length; ai++) avgSched += teams[ai].sched || 0;
  avgSched = teams.length ? avgSched / teams.length : 0;
  var champOf = {};
  Object.keys(champs).forEach(function (c) { champOf[champs[c].team] = true; });

  function atLargeScore(t) {
    var r = std[t.team];
    return t[method] - resumeWeights.lossPenalty * (r ? r.ol : 0) + resumeWeights.sosWeight * ((t.sched || 0) - avgSched)
      + (champOf[t.team] ? resumeWeights.championBonus : 0);
  }
  function byResume(a, b) { return (atLargeScore(b) - atLargeScore(a)) || (b[method] - a[method]); }
  var ranked = teams.slice().sort(byResume);
  function rankOf(t) { return ranked.indexOf(t) + 1; }
  function cfpOrder(a, b) {
    var ra = cfpRank && cfpRank[a.team] ? cfpRank[a.team] : 999;
    var rb = cfpRank && cfpRank[b.team] ? cfpRank[b.team] : 999;
    return ra - rb;
  }

  if (is12) {
    var qual = P4.map(function (c) { return champs[c]; }).filter(Boolean);
    qual.forEach(function (t) { bid[t.team] = "P4 champ (" + mergeConf(t.conference) + ")"; });

    var g6 = ranked.filter(function (t) { return G6.indexOf(mergeConf(t.conference)) !== -1; })[0];
    if (g6) { qual.push(g6); bid[g6.team] = "G6 bid (" + mergeConf(g6.conference) + ")"; }

    var nd = ranked.filter(function (t) { return t.team === "Notre Dame"; })[0];
    var ndCfpRank = nd && cfpRank ? cfpRank[nd.team] : null;
    if (nd && (ndCfpRank ? ndCfpRank <= 12 : rankOf(nd) <= 12)) {
      qual.push(nd);
      bid[nd.team] = ndCfpRank ? "At-large (CFP top 12)" : "At-large (top 12)";
    }

    var used = {};
    qual.forEach(function (t) { used[t.team] = true; });

    var challengers = teams.filter(function (t) { return !used[t.team]; });
    if (hasCfp) challengers.sort(cfpOrder);
    else challengers.sort(byResume);

    var atLarge = challengers.slice(0, 12 - qual.length);
    atLarge.forEach(function (t) { bid[t.team] = "At-large"; });

    var field = qual.concat(atLarge);
    if (hasCfp) field.sort(cfpOrder);
    else field.sort(byResume);
    field.forEach(function (t) { seeds.push(t); });
  } else {
    var p4 = P4.map(function (c) { return champs[c]; }).filter(Boolean);
    p4.forEach(function (t) { bid[t.team] = "P4 champ (" + mergeConf(t.conference) + ")"; });
    var g6 = ranked.filter(function (t) { return G6.indexOf(mergeConf(t.conference)) !== -1; })[0];
    if (g6) bid[g6.team] = "G6 bid (" + mergeConf(g6.conference) + ")";
    var auto = p4.concat(g6 ? [g6] : []);
    var autoNames = {};
    auto.forEach(function (t) { autoNames[t.team] = true; });
    var challengers = teams.filter(function (t) { return !autoNames[t.team]; })
      .sort(function (a, b) { return (atLargeScore(b) - atLargeScore(a)) || (b[method] - a[method]); });
    var atLarge24 = challengers.slice(0, 19);
    atLarge24.forEach(function (t) { bid[t.team] = "At-large"; });
    auto.concat(atLarge24)
      .sort(function (a, b) { return (atLargeScore(b) - atLargeScore(a)) || (b[method] - a[method]); })
      .forEach(function (t) { seeds.push(t); });
  }
  return { seeds: seeds, bid: bid, atLarge: challengers };
}

function play(a, b, homeSeed, method, homeEdge, stochastic) {
  var ra = a.team[method], rb = b.team[method];
  var spread = homeSeed === null ? ra - rb : (a.seed === homeSeed ? ra + homeEdge - rb : ra - rb - homeEdge);
  var p = normCdf(spread / SIGMA);
  var winner = (stochastic ? Math.random() : 0.5) < p ? a : b;
  return { a: a, b: b, home: homeSeed, p: p, spread: spread, winner: winner, neutral: homeSeed === null };
}

function runOnce(seeds, format, method, homeEdge, stochastic) {
  var is12 = Number(format) === 12;
  var rounds, champion;
  if (is12) {
    var r1 = [
      play({ seed: 8, team: seeds[8] }, { seed: 9, team: seeds[9] }, 8, method, homeEdge, stochastic),
      play({ seed: 5, team: seeds[5] }, { seed: 12, team: seeds[12] }, 5, method, homeEdge, stochastic),
      play({ seed: 7, team: seeds[7] }, { seed: 10, team: seeds[10] }, 7, method, homeEdge, stochastic),
      play({ seed: 6, team: seeds[6] }, { seed: 11, team: seeds[11] }, 6, method, homeEdge, stochastic)
    ];
    var qf = [
      play({ seed: 1, team: seeds[1] }, r1[0].winner, null, method, homeEdge, stochastic),
      play({ seed: 4, team: seeds[4] }, r1[1].winner, null, method, homeEdge, stochastic),
      play({ seed: 2, team: seeds[2] }, r1[2].winner, null, method, homeEdge, stochastic),
      play({ seed: 3, team: seeds[3] }, r1[3].winner, null, method, homeEdge, stochastic)
    ];
    var semis = [
      play(qf[0].winner, qf[1].winner, null, method, homeEdge, stochastic),
      play(qf[2].winner, qf[3].winner, null, method, homeEdge, stochastic)
    ];
    var finals = [play(semis[0].winner, semis[1].winner, null, method, homeEdge, stochastic)];
    champion = finals[0].winner;
  } else {
    var rr = [
      play({ seed: 16, team: seeds[16] }, { seed: 17, team: seeds[17] }, 16, method, homeEdge, stochastic),
      play({ seed: 9, team: seeds[9] }, { seed: 24, team: seeds[24] }, 9, method, homeEdge, stochastic),
      play({ seed: 13, team: seeds[13] }, { seed: 20, team: seeds[20] }, 13, method, homeEdge, stochastic),
      play({ seed: 12, team: seeds[12] }, { seed: 21, team: seeds[21] }, 12, method, homeEdge, stochastic),
      play({ seed: 15, team: seeds[15] }, { seed: 18, team: seeds[18] }, 15, method, homeEdge, stochastic),
      play({ seed: 10, team: seeds[10] }, { seed: 23, team: seeds[23] }, 10, method, homeEdge, stochastic),
      play({ seed: 14, team: seeds[14] }, { seed: 19, team: seeds[19] }, 14, method, homeEdge, stochastic),
      play({ seed: 11, team: seeds[11] }, { seed: 22, team: seeds[22] }, 11, method, homeEdge, stochastic)
    ];
    var r2 = [
      play({ seed: 1, team: seeds[1] }, rr[0].winner, 1, method, homeEdge, stochastic),
      play({ seed: 8, team: seeds[8] }, rr[1].winner, 8, method, homeEdge, stochastic),
      play({ seed: 4, team: seeds[4] }, rr[2].winner, 4, method, homeEdge, stochastic),
      play({ seed: 5, team: seeds[5] }, rr[3].winner, 5, method, homeEdge, stochastic),
      play({ seed: 2, team: seeds[2] }, rr[4].winner, 2, method, homeEdge, stochastic),
      play({ seed: 7, team: seeds[7] }, rr[5].winner, 7, method, homeEdge, stochastic),
      play({ seed: 3, team: seeds[3] }, rr[6].winner, 3, method, homeEdge, stochastic),
      play({ seed: 6, team: seeds[6] }, rr[7].winner, 6, method, homeEdge, stochastic)
    ];
    var qf24 = [
      play(r2[0].winner, r2[1].winner, null, method, homeEdge, stochastic),
      play(r2[2].winner, r2[3].winner, null, method, homeEdge, stochastic),
      play(r2[4].winner, r2[5].winner, null, method, homeEdge, stochastic),
      play(r2[6].winner, r2[7].winner, null, method, homeEdge, stochastic)
    ];
    var semis = [
      play(qf24[0].winner, qf24[1].winner, null, method, homeEdge, stochastic),
      play(qf24[2].winner, qf24[3].winner, null, method, homeEdge, stochastic)
    ];
    var finals = [play(semis[0].winner, semis[1].winner, null, method, homeEdge, stochastic)];
    champion = finals[0].winner;
  }
  return { champion: champion };
}

function simContext(teams, espnGames, espnIdToSag, method, homeEdge) {
  var confOf = {};
  teams.forEach(function (t) { if (t.level === "A") confOf[t.team] = mergeConf(t.conference); });
  var base = {};
  var games = [];
  espnGames.forEach(function (g) {
    var h = espnIdToSag[g.homeId];
    var a = espnIdToSag[g.awayId];
    if (g.completed && g.homeScore !== null && g.awayScore !== null) {
      applyResult(base, confOf, h, a, g.homeScore > g.awayScore);
    } else if (h && a) {
      var p = normCdf((h[method] - a[method] + (g.neutral ? 0 : homeEdge)) / SIGMA);
      games.push({ h: h.team, a: a.team, p: p, conf: confOf[h.team] === confOf[a.team] && confOf[h.team] !== "I-A IND." });
    } else if (h) {
      applyResult(base, confOf, h, null, true);
    } else if (a) {
      applyResult(base, confOf, null, a, false);
    }
  });
  return { base: base, games: games };
}

function computeSim(format, method, ratings, espnGames, espnIdToSag, resume, homeEdge) {
  var teams = ratings.teams.filter(function (t) { return t.level === "A"; });
  var resumeWeights = loadResumeWeights(resume);
  var ctx = simContext(teams, espnGames, espnIdToSag, method, homeEdge);
  var fieldCount = {}, champCount = {};

  for (var i = 0; i < SIMS; i++) {
    var regRec = cloneRecords(ctx.base);
    for (var j = 0; j < ctx.games.length; j++) {
      var g = ctx.games[j];
      var hw = Math.random() < g.p;
      var rh = getRec(regRec, g.h), ra = getRec(regRec, g.a);
      rh.ow += hw ? 1 : 0; rh.ol += hw ? 0 : 1;
      ra.ow += hw ? 0 : 1; ra.ol += hw ? 1 : 0;
      if (g.conf) { rh.cw += hw ? 1 : 0; rh.cl += hw ? 0 : 1; ra.cw += hw ? 0 : 1; ra.cl += hw ? 1 : 0; }
    }
    var ccgs = (format === 12) ? ccgOutcomes(teams, method, homeEdge, regRec, true) : null;
    var f = buildField(teams, method, format, regRec, ccgs, resumeWeights, null, null);
    for (var k = 1; k < f.seeds.length; k++) { var t = f.seeds[k]; if (t) fieldCount[t.team] = (fieldCount[t.team] || 0) + 1; }
    var r = runOnce(f.seeds, format, method, homeEdge, true);
    var c = r.champion.team.team;
    champCount[c] = (champCount[c] || 0) + 1;
  }
  return { n: SIMS, field: fieldCount, champ: champCount };
}

// Team aliases (same as assets/team-alias.js) - normalized Sagarin name -> normalized ESPN name
const TeamAlias = {
  "miami florida": "miami",
  "miami ohio": "miami oh",
  "fla international": "florida international",
  "central florida ucf": "ucf",
  "louisianamonroe ulm": "ul monroe",
  "louisiana lafayette": "louisiana",
  "miss valley state": "mississippi valley state",
  "se missouri state": "southeast missouri state",
  "army west point": "army",
  "connecticut": "uconn",
  "mississippi": "ole miss",
  "southern california": "usc",
  "appalachian state": "app state",
  "sam houston state": "sam houston",
  "monmouth nj": "monmouth",
  "albany ny": "ualbany",
  "tennessee martin": "ut martin",
  "sc state": "south carolina state",
  "cal poly slo": "cal poly",
  "mcneese state": "mcneese",
  "st thomas mn": "st thomas",
  "ark pine bluff": "arkansas pine bluff",
  "liu post": "long island university",
  "stonehill college": "stonehill",
  "grambling state": "grambling",
  "nc central": "north carolina central",
  "nc at": "north carolina at",
  "southern u": "southern",
  "nicholls state": "nicholls",
  "presbyterian college": "presbyterian"
};

function normalizeName(s) {
  return String(s)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[.'&]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function main() {
  try {
    const ratings = JSON.parse(fs.readFileSync('data/ratings.json', 'utf8'));
    const espn = JSON.parse(fs.readFileSync('data/espn-games.json', 'utf8'));
    const resume = JSON.parse(fs.readFileSync('data/resume-weights.json', 'utf8'));
    const bcs = JSON.parse(fs.readFileSync('data/bcs.json', 'utf8')) || null;
    const fpi = JSON.parse(fs.readFileSync('data/fpi.json', 'utf8')) || null;

    // Build ESPN id -> Sagarin team mapping (same as core.js, WITH aliases)
    const teams = ratings.teams;
    const espnTeams = espn.teams || [];
    const espnGames = espn.games || [];

    var idx = {};
    espnTeams.forEach(function (t) {
      [t.location, t.name, t.displayName].forEach(function (v) {
        var k = normalizeName(v || "");
        if (k && !idx[k]) idx[k] = t;
      });
    });

    var espnIdToSag = {};
    teams.forEach(function (st) {
      var k = normalizeName(st.team);
      var alias = TeamAlias[k];
      var et = idx[k] || (alias ? idx[alias] : null);
      if (et) espnIdToSag[et.id] = st;
    });

    // Home edges per method
    var homeEdges = ratings.meta && ratings.meta.homeAdvantage ? ratings.meta.homeAdvantage : {};

    const methods = ["rating", "predictor", "goldenMean", "recent", "strongRecent", "fpi"];
    [12, 24].forEach(function (format) {
      methods.forEach(function (method) {
        if (!homeEdges[method]) {
          console.log(`Skipping method: ${method} (no home edge)`);
          return;
        }
        console.log(`Running simulation: ${format}-team, ${method}...`);
        const result = computeSim(format, method, ratings, espnGames, espnIdToSag, resume, homeEdges[method]);
        // Attach BCS reference for predictor/sim use (strict-Sagarin data excluded from Teams/Conferences)
        if (bcs && bcs.ranks) {
          result.bcs = { source: bcs.source, fetched_at: bcs.fetched_at, signature: bcs.signature, top3: bcs.ranks.slice(0,3).map(function(r){ return { rank: r.rank, team: r.team, score: r.score }; }) };
        }
        if (fpi && fpi.ranks) {
          result.fpi = { source: fpi.source, fetched_at: fpi.fetched_at, signature: fpi.signature, top3: fpi.ranks.slice(0,3).map(function(r){ return { rank: r.rank, team: r.team, score: r.score }; }) };
        }
        const outFile = `data/sim-${format}-${method}.json`;
        fs.writeFileSync(outFile, JSON.stringify(result, null, 2));
        console.log(`Wrote ${outFile} with field chances for ${Object.keys(result.field).length} teams`);
      });
    });

    // Also write predictor-only copies for backward compatibility (watchability / core loader)
    [12, 24].forEach(function (format) {
      const method = "predictor";
      const fileName = format === 12 ? 'data/sim-12.json' : 'data/sim-24.json';
      fs.renameSync(`data/sim-${format}-${method}.json`, fileName);
      console.log(`Renamed predictor result to ${fileName}`);
    });

  } catch (e) {
    console.error('Error:', e.message, e.stack);
    process.exit(1);
  }
}
main();