/* Playoff predictor: projected CFP field. Conference champions come from real
   conference standings built from the prefetched ESPN games. Draws either the
   current 12-team bracket or the proposed 24-team bracket, seeds only by
   default with an option to show predicted results. */
(function () {
  "use strict";
  var SG = window.SG;

  var P4 = ["SEC", "BIG TEN", "BIG 12", "ACC"];
  var G6 = ["AMERICAN", "CONF-USA", "MAC", "MOUNTAIN WEST", "SUN BELT", "PAC-12"];
  var SIMS = 10000;
  // Selection and seeding are a resume call, not a pure power call: the G6 spot,
  // the at-large pool and the seeds are ranked on the selected rating minus a
  // penalty per projected loss plus a bonus for schedule strength, so a weak
  // schedule cannot hide behind a record, plus a bonus for winning the
  // conference, which the committee counts on its own. Weights come from
  // data/resume-weights.json (fit by scripts/calibrate-resume.js).
  var AT_LARGE_LOSS_PENALTY = 5;
  var AT_LARGE_SOS_WEIGHT = 0;
  var AT_LARGE_CHAMPION_BONUS = 0;
  function loadResumeWeights() {
    var r = SG.state.resume || {};
    if (typeof r.lossPenalty === "number") AT_LARGE_LOSS_PENALTY = r.lossPenalty;
    if (typeof r.sosWeight === "number") AT_LARGE_SOS_WEIGHT = r.sosWeight;
    if (typeof r.championBonus === "number") AT_LARGE_CHAMPION_BONUS = r.championBonus;
  }

  var view = { format: "12", method: "predictor", bracketMode: "seeds", field: null, sim: { "12": null, "24": null }, simBusy: false, fieldSort: { key: "seed", dir: 1 } };

  function mergeConf(c) {
    if (c === "SUN BELT EAST" || c === "SUN BELT WEST") return "SUN BELT";
    return c;
  }

  function fbs() {
    return SG.state.data.teams.filter(function (t) { return t.level === "A"; });
  }

  // Projected conference and overall records: completed games use the real
  // result, remaining games are predicted from the chosen rating method.
  function projectedRecords(method) {
    var confOf = {};
    SG.state.data.teams.forEach(function (t) { if (t.level === "A") confOf[t.team] = mergeConf(t.conference); });
    var rec = {};
    function ensure(n) { return rec[n] || (rec[n] = { cw: 0, cl: 0, ow: 0, ol: 0 }); }
    var edge = SG.homeEdge(method);
    var games = (SG.state.espn && SG.state.espn.games) || [];
    games.forEach(function (g) {
      var h = SG.state.espnIdToSag && SG.state.espnIdToSag[g.homeId];
      var a = SG.state.espnIdToSag && SG.state.espnIdToSag[g.awayId];
      var hWin;
      if (g.completed && g.homeScore !== null && g.awayScore !== null) {
        hWin = g.homeScore > g.awayScore;
      } else if (h && a) {
        var hScore = getTeamMethodScore(h, method);
        var aScore = getTeamMethodScore(a, method);
        hWin = (hScore - aScore + (g.neutral ? 0 : edge)) >= 0;
      } else if (h) {
        hWin = true;
      } else if (a) {
        hWin = false;
      } else {
        return;
      }
      var rh = h ? ensure(h.team) : null;
      var ra = a ? ensure(a.team) : null;
      if (rh) { rh.ow += hWin ? 1 : 0; rh.ol += hWin ? 0 : 1; }
      if (ra) { ra.ow += hWin ? 0 : 1; ra.ol += hWin ? 1 : 0; }
      if (h && a) {
        var ch = confOf[h.team], ca = confOf[a.team];
        if (ch && ca && ch === ca && ch !== "I-A IND.") {
          rh.cw += hWin ? 1 : 0; rh.cl += hWin ? 0 : 1;
          ra.cw += hWin ? 0 : 1; ra.cl += hWin ? 1 : 0;
        }
      }
    });
    return rec;
  }

  // Projected title-game outcome for every FBS conference, from the regular
  // records. Deterministic for the live projection, stochastic for the sim.
  // The two participants are chosen from the regular-season records alone.
  function ccgOutcomes(regRec, method, stochastic) {
    var order = conferenceOrder(method, regRec);
    var out = {};
    Object.keys(order).forEach(function (c) {
      if (c === "I-A IND.") return;
      var list = order[c];
      if (!list[0] || !list[1]) return;
      var m = ccgResult(c, list[0], list[1], method);
      var win = (stochastic ? Math.random() : 0.5) < m.p ? m.a : m.b;
      out[c] = { winner: win, loser: win === m.a ? m.b : m.a, matchup: m };
    });
    return out;
  }

  // Projected records with the projected conference title games folded in (the
  // 24-team field has no title games). The winner gets a conference and overall
  // win and the loser a loss, so the field table and the resume see a full season.
  function finalRecords(method, format) {
    var regRec = projectedRecords(method);
    if (Number(format) !== 12) return regRec;
    var ccgs = ccgOutcomes(regRec, method, false);
    var fin = cloneRecords(regRec);
    foldCcg(fin, ccgs);
    return fin;
  }

  function foldCcg(rec, ccgs) {
    Object.keys(ccgs).forEach(function (c) {
      recordGame(rec, ccgs[c].winner.team, true);
      recordGame(rec, ccgs[c].loser.team, false);
    });
  }

  function recordGame(std, team, win) {
    var r = std[team];
    if (!r) return;
    if (win) { r.cw += 1; r.ow += 1; } else { r.cl += 1; r.ol += 1; }
  }

  function cloneRecords(rec) {
    var out = {};
    Object.keys(rec).forEach(function (k) {
      var r = rec[k];
      out[k] = { cw: r.cw, cl: r.cl, ow: r.ow, ol: r.ol };
    });
    return out;
  }

  function getRec(rec, team) {
    return rec[team] || (rec[team] = { cw: 0, cl: 0, ow: 0, ol: 0 });
  }

  function getTeamMethodScore(teamNameOrObj, method) {
    if (method === "fpi") {
      var teamName = typeof teamNameOrObj === "string" ? teamNameOrObj : teamNameOrObj.team;
      var f = SG.fpiOf && SG.fpiOf(teamName);
      if (f) return f.score;
      // Fallback to Sagarin predictor if FPI not available
      var t = SG.teamByName && SG.teamByName(teamName);
      return t ? t.predictor : 0;
    }
    return typeof teamNameOrObj === "string" ? null : (teamNameOrObj[method] || 0);
  }

  function champScore(team, std, method) {
    var r = std[team.team] || { cw: 0, cl: 0, ow: 0, ol: 0 };
    var cwp = (r.cw + r.cl) ? r.cw / (r.cw + r.cl) : 0;
    var owp = (r.ow + r.ol) ? r.ow / (r.ow + r.ol) : 0;
    return cwp * 1e6 + owp * 1e3 + (getTeamMethodScore(team, method) || 0);
  }

  // Conference title games that are played at a neutral site get no home edge.
  // Every other FBS title game is hosted by the higher seed, so that team gets
  // the edge. (2026: ACC, SEC, Big Ten, Big 12 and MAC are neutral; the American,
  // Conference USA, Sun Belt, Mountain West and Pac-12 host on campus.)
  var NEUTRAL_CCG = { "ACC": true, "SEC": true, "BIG TEN": true, "BIG 12": true, "MAC": true };

  function conferenceOrder(method, std) {
    std = std || projectedRecords(method);
    var byConf = {};
    fbs().forEach(function (t) {
      var c = mergeConf(t.conference);
      (byConf[c] = byConf[c] || []).push(t);
    });
    var order = {};
    Object.keys(byConf).forEach(function (c) {
      order[c] = byConf[c].slice().sort(function (a, b) { return champScore(b, std, method) - champScore(a, std, method); });
    });
    return order;
  }

  // Projected title game for one conference. Neutral-site games ignore the home
  // edge; campus games give it to the higher seed (top).
  function ccgResult(conf, top, second, method) {
    var neutral = !!NEUTRAL_CCG[conf];
    var edge = neutral ? 0 : SG.homeEdge(method);
    var spread = (getTeamMethodScore(top, method) - getTeamMethodScore(second, method)) + edge;
    var p = SG.normCdf(spread / SG.SIGMA);
    return { conf: conf, a: top, b: second, neutral: neutral, spread: spread, p: p, winner: p >= 0.5 ? top : second };
  }

  function ccgMatchups(method) {
    var order = conferenceOrder(method);
    var out = [];
    Object.keys(order).forEach(function (c) {
      if (c === "I-A IND.") return;
      var list = order[c];
      if (list[0] && list[1]) out.push(ccgResult(c, list[0], list[1], method));
    });
    out.sort(function (x, y) {
      var px = P4.indexOf(x.conf) !== -1 ? 0 : 1, py = P4.indexOf(y.conf) !== -1 ? 0 : 1;
      if (px !== py) return px - py;
      return y.a[method] - x.a[method];
    });
    return out;
  }

  // Build the field from a records map, so the live projection can pass the
  // projected records and the sim can pass its simulated records.
  function fieldFromRecords(format, method, regRec, ccgs) {
    var teams = fbs();
    var is12 = Number(format) === 12;
    var champs = {};

    // The 12-team CFP keeps conference title games (ccgs); the proposed 24-team
    // field drops them, so its champions are the regular-season winners.
    if (is12 && ccgs) {
      Object.keys(ccgs).forEach(function (c) { champs[c] = ccgs[c].winner; });
    } else {
      var order = conferenceOrder(method, regRec);
      Object.keys(order).forEach(function (c) {
        if (c === "I-A IND.") return;
        if (order[c][0]) champs[c] = order[c][0];
      });
    }

    var std = regRec;
    if (is12 && ccgs) { std = cloneRecords(regRec); foldCcg(std, ccgs); }

    var seeds = [null];
    var bid = {};

    // Check if CFP rankings are available (primary poll is CFP)
    var ap = SG.state.ap;
    var hasCfp = ap && ap.primary === "cfp" && ap.byTeam;
    var cfpRank = hasCfp ? ap.byTeam : null;

    // Resume score: selected rating minus a penalty per projected loss plus the
    // SOS weight times the schedule edge over the FBS average, plus a bonus for
    // the projected conference champion. Drives the G6 spot, the at-large order
    // and the seeds when CFP rankings are not available.
    loadResumeWeights();
    var avgSched = 0;
    for (var ai = 0; ai < teams.length; ai++) avgSched += teams[ai].sched || 0;
    avgSched = teams.length ? avgSched / teams.length : 0;
    // The teams projected to win their conference, so the champion's title is
    // worth something on its own.
    var champOf = {};
    Object.keys(champs).forEach(function (c) { champOf[champs[c].team] = true; });
    function atLargeScore(t) {
      var r = std[t.team];
      return t[method] - AT_LARGE_LOSS_PENALTY * (r ? r.ol : 0) + AT_LARGE_SOS_WEIGHT * ((t.sched || 0) - avgSched)
        + (champOf[t.team] ? AT_LARGE_CHAMPION_BONUS : 0);
    }
    function byResume(a, b) { return (atLargeScore(b) - atLargeScore(a)) || (b[method] - a[method]); }
    var ranked = teams.slice().sort(byResume);
    function rankOf(t) { return ranked.indexOf(t) + 1; }

    // When CFP rankings are available, use them for G6 bid, ND bid, at-large order, and seeding.
    // P4 champs still get auto bids but are seeded by CFP rank.
    function cfpOrder(a, b) {
      var ra = cfpRank[a.team] || 999;
      var rb = cfpRank[b.team] || 999;
      return ra - rb;
    }

    if (is12) {
      var qual = P4.map(function (c) { return champs[c]; }).filter(Boolean);
      qual.forEach(function (t) { bid[t.team] = "P4 champ (" + mergeConf(t.conference) + ")"; });

      // G6 bid: highest G6 team in CFP ranking when available, else resume score
      var g6 = hasCfp
        ? ranked.filter(function (t) { return G6.indexOf(mergeConf(t.conference)) !== -1; }).sort(cfpOrder)[0]
        : ranked.filter(function (t) { return G6.indexOf(mergeConf(t.conference)) !== -1; })[0];
      if (g6) { qual.push(g6); bid[g6.team] = "G6 bid (" + mergeConf(g6.conference) + ")"; }

      // Notre Dame: auto bid if in CFP top 12, else resume top 12
      var nd = ranked.filter(function (t) { return t.team === "Notre Dame"; })[0];
      var ndCfpRank = nd && cfpRank ? cfpRank[nd.team] : null;
      if (nd && (ndCfpRank ? ndCfpRank <= 12 : rankOf(nd) <= 12)) {
        qual.push(nd);
        bid[nd.team] = ndCfpRank ? "At-large (CFP top 12)" : "At-large (top 12)";
      }

      var used = {};
      qual.forEach(function (t) { used[t.team] = true; });

      // At-large and seeding: CFP rank when available, else resume score
      var challengers = teams.filter(function (t) { return !used[t.team]; });
      if (hasCfp) challengers.sort(cfpOrder);
      else challengers.sort(byResume);

      var atLarge = challengers.slice(0, 12 - qual.length);
      atLarge.forEach(function (t) { bid[t.team] = "At-large"; });

      // Final field: auto bids + at-large, seeded by CFP rank or resume
      var field = qual.concat(atLarge);
      if (hasCfp) field.sort(cfpOrder);
      else field.sort(byResume);
      field.forEach(function (t) { seeds.push(t); });
    } else {
      // 24-team format logic unchanged (CFP rankings not used for 24-team yet)
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
    // atLarge is the full resume ranking of teams that missed the auto bids, so
    // callers (the TV tab) can read who is just outside the field.
    return { seeds: seeds, bid: bid, atLarge: challengers };
  }

  function buildField(format, method) {
    var regRec = projectedRecords(method);
    var ccgs = Number(format) === 12 ? ccgOutcomes(regRec, method, false) : null;
    return fieldFromRecords(format, method, regRec, ccgs);
  }

  // ---- bracket engine ----

  function play(a, b, homeSeed, method, stochastic) {
    var edge = SG.homeEdge(method);
    // a and b are { seed, team } wrapper objects; pass the inner team object
    var ra = getTeamMethodScore(a.team, method), rb = getTeamMethodScore(b.team, method);
    var spread = homeSeed === null ? ra - rb : (a.seed === homeSeed ? ra + edge - rb : ra - rb - edge);
    var p = SG.normCdf(spread / SG.SIGMA);
    var winner = (stochastic ? Math.random() : 0.5) < p ? a : b;
    return { a: a, b: b, home: homeSeed, p: p, spread: spread, winner: winner, neutral: homeSeed === null };
  }

  function S(seeds, n) { return { seed: n, team: seeds[n] }; }

  function runOnce(seeds, format, method, stochastic) {
    var semis, finals, champion, rounds;
    if (Number(format) === 12) {
      var r1 = [
        play(S(seeds, 8), S(seeds, 9), 8, method, stochastic),
        play(S(seeds, 5), S(seeds, 12), 5, method, stochastic),
        play(S(seeds, 7), S(seeds, 10), 7, method, stochastic),
        play(S(seeds, 6), S(seeds, 11), 6, method, stochastic)
      ];
      var qf = [
        play(S(seeds, 1), r1[0].winner, null, method, stochastic),
        play(S(seeds, 4), r1[1].winner, null, method, stochastic),
        play(S(seeds, 2), r1[2].winner, null, method, stochastic),
        play(S(seeds, 3), r1[3].winner, null, method, stochastic)
      ];
      semis = [play(qf[0].winner, qf[1].winner, null, method, stochastic), play(qf[2].winner, qf[3].winner, null, method, stochastic)];
      finals = [play(semis[0].winner, semis[1].winner, null, method, stochastic)];
      rounds = [
        { title: "First round (campus)", games: r1 },
        { title: "Quarterfinals (bowls)", games: qf },
        { title: "Semifinals", games: semis },
        { title: "Championship", games: finals }
      ];
      champion = finals[0].winner;
    } else {
      var rr = [
        play(S(seeds, 16), S(seeds, 17), 16, method, stochastic),
        play(S(seeds, 9), S(seeds, 24), 9, method, stochastic),
        play(S(seeds, 13), S(seeds, 20), 13, method, stochastic),
        play(S(seeds, 12), S(seeds, 21), 12, method, stochastic),
        play(S(seeds, 15), S(seeds, 18), 15, method, stochastic),
        play(S(seeds, 10), S(seeds, 23), 10, method, stochastic),
        play(S(seeds, 14), S(seeds, 19), 14, method, stochastic),
        play(S(seeds, 11), S(seeds, 22), 11, method, stochastic)
      ];
      var r2 = [
        play(S(seeds, 1), rr[0].winner, 1, method, stochastic),
        play(S(seeds, 8), rr[1].winner, 8, method, stochastic),
        play(S(seeds, 4), rr[2].winner, 4, method, stochastic),
        play(S(seeds, 5), rr[3].winner, 5, method, stochastic),
        play(S(seeds, 2), rr[4].winner, 2, method, stochastic),
        play(S(seeds, 7), rr[5].winner, 7, method, stochastic),
        play(S(seeds, 3), rr[6].winner, 3, method, stochastic),
        play(S(seeds, 6), rr[7].winner, 6, method, stochastic)
      ];
      var qf24 = [
        play(r2[0].winner, r2[1].winner, null, method, stochastic),
        play(r2[2].winner, r2[3].winner, null, method, stochastic),
        play(r2[4].winner, r2[5].winner, null, method, stochastic),
        play(r2[6].winner, r2[7].winner, null, method, stochastic)
      ];
      semis = [play(qf24[0].winner, qf24[1].winner, null, method, stochastic), play(qf24[2].winner, qf24[3].winner, null, method, stochastic)];
      finals = [play(semis[0].winner, semis[1].winner, null, method, stochastic)];
      rounds = [
        { title: "First round (campus)", games: rr },
        { title: "Second round (campus)", games: r2 },
        { title: "Quarterfinals (bowls)", games: qf24 },
        { title: "Semifinals", games: semis },
        { title: "Championship", games: finals }
      ];
      champion = finals[0].winner;
    }
    return {
      rounds: rounds, champion: champion,
      semifinalists: [semis[0].a.team, semis[0].b.team, semis[1].a.team, semis[1].b.team],
      finalists: [finals[0].a.team, finals[0].b.team]
    };
  }

  // ---- static (seeds-only) bracket ----

  function T(seeds, n) { return { seed: n, team: seeds[n] }; }
  function L(label) { return { label: label }; }
  function sg(a, b, homeSeed) { return { a: a, b: b, home: homeSeed, neutral: homeSeed === null }; }

  function staticBracket(seeds, format) {
    if (Number(format) === 12) {
      var r1 = [sg(T(seeds, 8), T(seeds, 9), 8), sg(T(seeds, 5), T(seeds, 12), 5), sg(T(seeds, 7), T(seeds, 10), 7), sg(T(seeds, 6), T(seeds, 11), 6)];
      var qf = [sg(T(seeds, 1), L("8/9"), null), sg(T(seeds, 4), L("5/12"), null), sg(T(seeds, 2), L("7/10"), null), sg(T(seeds, 3), L("6/11"), null)];
      var sf = [sg(L("Quarterfinal 1 winner"), L("Quarterfinal 2 winner"), null), sg(L("Quarterfinal 3 winner"), L("Quarterfinal 4 winner"), null)];
      var fin = [sg(L("Semifinal 1 winner"), L("Semifinal 2 winner"), null)];
      return [
        { title: "First round (campus)", games: r1 },
        { title: "Quarterfinals (bowls)", games: qf },
        { title: "Semifinals", games: sf },
        { title: "Championship", games: fin }
      ];
    }
    var rr = [
      sg(T(seeds, 16), T(seeds, 17), 16), sg(T(seeds, 9), T(seeds, 24), 9), sg(T(seeds, 13), T(seeds, 20), 13), sg(T(seeds, 12), T(seeds, 21), 12),
      sg(T(seeds, 15), T(seeds, 18), 15), sg(T(seeds, 10), T(seeds, 23), 10), sg(T(seeds, 14), T(seeds, 19), 14), sg(T(seeds, 11), T(seeds, 22), 11)
    ];
    var r2 = [
      sg(T(seeds, 1), L("16/17"), 1), sg(T(seeds, 8), L("9/24"), 8), sg(T(seeds, 4), L("13/20"), 4), sg(T(seeds, 5), L("12/21"), 5),
      sg(T(seeds, 2), L("15/18"), 2), sg(T(seeds, 7), L("10/23"), 7), sg(T(seeds, 3), L("14/19"), 3), sg(T(seeds, 6), L("11/22"), 6)
    ];
    var qf = [
      sg(L("1/16/17"), L("8/9/24"), null), sg(L("4/13/20"), L("5/12/21"), null), sg(L("2/15/18"), L("7/10/23"), null), sg(L("3/14/19"), L("6/11/22"), null)
    ];
    var sf = [sg(L("Quarterfinal 1 winner"), L("Quarterfinal 2 winner"), null), sg(L("Quarterfinal 3 winner"), L("Quarterfinal 4 winner"), null)];
    var fin = [sg(L("Semifinal 1 winner"), L("Semifinal 2 winner"), null)];
    return [
      { title: "First round (campus)", games: rr },
      { title: "Second round (campus)", games: r2 },
      { title: "Quarterfinals (bowls)", games: qf },
      { title: "Semifinals", games: sf },
      { title: "Championship", games: fin }
    ];
  }

  // ---- rendering ----

  function entrantRow(desc, pct, showResults, isWinner) {
    var seed = desc.seed !== undefined && desc.seed !== null ? "#" + desc.seed : "";
    var name = desc.team ? desc.team.team : (desc.label || "");
    var logo = desc.team ? SG.teamLogo(desc.team.team) : "";
    var cls = "game-team" + (showResults && isWinner ? " winner" : "");
    return '<div class="' + cls + '"><span class="seed">' + seed + "</span>" + logo + '<span class="name">' + SG.esc(name) + '</span><span class="score">' +
      (showResults && pct !== null && pct !== undefined ? (pct * 100).toFixed(0) + "%" : "") + "</span></div>";
  }

  function gameBox(game, showResults) {
    var winnerIsA = game.winner && game.a && game.winner.seed === game.a.seed;
    var site = game.neutral ? "neutral site" : ("at #" + game.home);
    return '<div class="game-box">' +
      entrantRow(game.a, game.p, showResults, winnerIsA) +
      entrantRow(game.b, game.p === undefined ? undefined : 1 - game.p, showResults, !winnerIsA) +
      '<div class="site-tag">' + SG.esc(site) + "</div></div>";
  }

  function renderBracket(rounds, showResults, champion) {
    var html = rounds.map(function (round) {
      return '<div class="bracket-col"><div class="bracket-col-title">' + SG.esc(round.title) + "</div>" +
        round.games.map(function (g) { return gameBox(g, showResults); }).join("") + "</div>";
    }).join("");
    if (showResults && champion && champion.team) {
      html += '<div class="bracket-col"><div class="bracket-col-title">Projected champion</div>' +
        '<div class="game-box champ-box">' + entrantRow({ seed: champion.seed, team: champion.team }, null, true, true) + "</div></div>";
    }
    document.getElementById("bracket").innerHTML = html;
  }

  // Sort key for a win-loss record: win percentage first, then more wins.
  function recSortVal(w, l) {
    var total = w + l;
    return total ? (w / total) * 1000 + w : -1;
  }

  function renderField(field) {
    var table = document.getElementById("fieldTable");
    var columns = [
      { key: "seed", label: "#", cls: "left" },
      { key: "team", label: "Team", cls: "left", type: "str",
        cell: function (r) { return SG.teamLogo(r.team) + SG.esc(r.team) + SG.apBadge(r.team); } },
      { key: "conf", label: "Conference", cls: "left", type: "str" },
      { key: "now", label: "Now", cls: "left", cell: function (r) { return SG.esc(r.now); }, value: function (r) { return r.nowV; } },
      { key: "proj", label: "Projected", cls: "left proj-col", cell: function (r) { return SG.esc(r.proj); }, value: function (r) { return r.projV; } },
      { key: "rating", label: view.method === "rating" ? "RATING" : SG.methodLabel(view.method), strong: true, cls: "rating-col" },
      { key: "bid", label: "Bid", cls: "left bid-col", type: "str" }
    ];
    var std = finalRecords(view.method, view.format);
    var rows = [];
    for (var i = 1; i < field.seeds.length; i++) {
      var t = field.seeds[i];
      var r = std[t.team];
      // Now: ESPN overall (conf)
      var nowW = SG.espnW(t), nowL = SG.espnL(t);
      var nowCW = SG.espnConfW(t), nowCL = SG.espnConfL(t);
      var now = SG.rec(nowW, nowL) + (nowCW > 0 || nowCL > 0 ? " (" + SG.rec(nowCW, nowCL) + ")" : "");
      // Projected: final overall (projected conf)
      var projCW = r && r.cw ? r.cw : 0, projCL = r && r.cl ? r.cl : 0;
      var projOW = r ? r.ow : 0, projOL = r ? r.ol : 0;
      var proj = SG.rec(projOW, projOL) + (projCW > 0 || projCL > 0 ? " (" + SG.rec(projCW, projCL) + ")" : "");
      // Helper to get rating value for display, handling FPI
      var ratingVal;
      if (view.method === "fpi") {
        var f = SG.fpiOf && SG.fpiOf(t.team);
        ratingVal = f ? f.score : (t.predictor || 0);
      } else {
        ratingVal = t[view.method] || 0;
      }
      rows.push({
        seed: i,
        team: t.team,
        conf: mergeConf(t.conference),
        now: now,
        nowV: recSortVal(nowW, nowL),
        proj: proj,
        projV: recSortVal(projOW, projOL),
        rating: ratingVal,
        bid: field.bid[t.team] || "At-large"
      });
    }
    SG.buildHead(table, columns, view.fieldSort, function (key) {
      SG.toggleSort(view.fieldSort, key, columns);
      renderField(field);
    });
    SG.fillBody(table, columns, SG.sortRows(rows, columns, view.fieldSort));
  }

  function ccgTeam(t, isWinner, method, showResults, pct) {
    return '<div class="ccg-team' + (showResults && isWinner ? " winner" : "") + '">' + SG.teamLogo(t.team) +
      SG.esc(t.team) + SG.apBadge(t.team) + '<span class="ccg-proj">' + SG.fmt(t[method]) +
      (showResults && pct !== null && pct !== undefined ? ' <span class="ccg-pct">' + (pct * 100).toFixed(0) + "%</span>" : "") +
      "</span></div>";
  }

  function renderCcg(matchups, showResults) {
    var box = document.getElementById("ccgBoard");
    if (!box) return;
    if (!matchups) {
      box.innerHTML = '<p class="note">The 24-team format drops conference championship games, so there are no title-game projections.</p>';
      return;
    }
    box.innerHTML = matchups.map(function (m) {
      var away = m.neutral ? m.a : m.b;
      var home = m.neutral ? m.b : m.a;
      var site = m.neutral ? "Neutral site" : ("at " + home.team);
      return '<div class="ccg-card">' +
        '<div class="ccg-conf">' + SG.esc(m.conf) + "</div>" +
        ccgTeam(away, m.winner === away, view.method, showResults, (away === m.a ? m.p : 1 - m.p)) +
        ccgTeam(home, m.winner === home, view.method, showResults, (home === m.a ? m.p : 1 - m.p)) +
        '<div class="ccg-site">' + SG.esc(site) + "</div></div>";
    }).join("");
  }

  function renderSim(sim) {
    var box = document.getElementById("simResults");
    if (!sim) { box.innerHTML = ""; return; }
    box.innerHTML =
      simBlock("Chance to make the field", sim.field, sim.n) +
      simBlock("Championship odds", sim.champ, sim.n) +
      '<p class="note">' + sim.n.toLocaleString() + " simulated seasons. Each run plays out the remaining regular-season games, decides the projected conference champions, rebuilds the field from those results, then plays the bracket. The bar is each team's share, scaled to the leading team.</p>";

    // Attach expand/collapse handlers for sim blocks
    SG.$$(".sim-more-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var block = document.getElementById(btn.getAttribute("data-target"));
        if (!block) return;
        var list = block.querySelector(".sim-list");
        var dataEl = block.querySelector(".sim-full-data");
        var expanded = btn.getAttribute("data-expanded") === "true";
        var LIMIT = 14;
        var n = sim.n;

        if (!expanded) {
          // Expand - show all remaining teams
          var moreData = JSON.parse(dataEl.textContent);
          var max = Math.max.apply(null, 
            Array.from(list.children).map(function (r) {
              var w = parseFloat(r.querySelector(".bar-fill").style.width) || 0;
              return w;
            })) || 1;
          list.innerHTML += moreData.map(function (r) {
            var pct = (r.c / n) * 100;
            return '<div class="row"><span>' + SG.esc(r.name) + '</span><span class="bar-track"><span class="bar-fill" style="width:' +
              ((r.c / max) * 100).toFixed(1) + '%"></span></span><span>' + pct.toFixed(1) + "%</span></div>";
          }).join("");
          btn.textContent = "Show top 14";
          btn.setAttribute("data-expanded", "true");
        } else {
          // Collapse - show only first LIMIT
          var rows = list.querySelectorAll(".row");
          for (var i = LIMIT; i < rows.length; i++) {
            rows[i].remove();
          }
          btn.textContent = "Show all teams";
          btn.setAttribute("data-expanded", "false");
        }
      });
    });
  }

  function simBlock(title, counts, n) {
    var LIMIT = 14;
    var all = Object.keys(counts).map(function (name) { return { name: name, c: counts[name] }; })
      .sort(function (a, b) { return b.c - a.c; });
    var max = Math.max.apply(null, all.map(function (r) { return r.c; })) || 1;

    // Store full list on the element for expand/collapse
    var blockId = "sim-" + title.replace(/[^a-z]/gi, "-").toLowerCase();

    function renderRows(list) {
      return list.map(function (r) {
        var pct = (r.c / n) * 100;
        return '<div class="row"><span>' + SG.esc(r.name) + '</span><span class="bar-track"><span class="bar-fill" style="width:' +
          ((r.c / max) * 100).toFixed(1) + '%"></span></span><span>' + pct.toFixed(1) + "%</span></div>";
      }).join("");
    }

    var initialRows = all.slice(0, LIMIT);
    var html = '<div class="sim-block" id="' + blockId + '"><h3>' + SG.esc(title) + '</h3><div class="sim-list">' +
      renderRows(initialRows) + "</div>";

    if (all.length > LIMIT) {
      html += '<div class="sim-more-wrap"><button type="button" class="sim-more-btn" data-target="' + blockId +
        '" data-expanded="false">Show all teams</button></div>';
      // Store full data for expansion
      html += '<script type="application/json" class="sim-full-data">' +
        JSON.stringify(all.slice(LIMIT)) + "</script>";
    } else if (all.length > 0) {
      html += '<p class="sim-more">Showing all ' + all.length + " teams.</p>";
    }

    html += "</div>";
    return html;
  }

  function render() {
    if (!SG.state.data) return;

    // Debug: log playoff projection details when ?debug=playoff
    if (SG.debug && SG.debug.playoff) {
      var regRec = projectedRecords(view.method);
      var ccgs = Number(view.format) === 12 ? ccgOutcomes(regRec, view.method, false) : null;
      var field = fieldFromRecords(view.format, view.method, regRec, ccgs);
      var std = finalRecords(view.method, view.format);
      var ap = SG.state.ap;
      var hasCfp = ap && ap.primary === "cfp" && ap.byTeam;
      console.group("[DEBUG] Playoff projection");
      console.log("Format:", view.format, "Method:", view.method);
      console.log("CFP rankings available:", hasCfp);
      console.log("Conference champions:", Object.keys(ccgs || {}).map(function (c) { return c + ": " + ccgs[c].winner.team; }));
      console.log("Field seeds:", field.seeds.slice(1).map(function (t, i) { return (i+1) + ". " + t.team + " (" + field.bid[t.team] + ")"; }));
      console.log("Base records (completed games):", regRec);
      console.log("Projected records (with CCG):", std);
      if (hasCfp) console.log("CFP ranks:", ap.byTeam);
      console.groupEnd();
    }

    var field = buildField(view.format, view.method);
    view.field = field;
    renderField(field);
    renderCcg(Number(view.format) === 12 ? ccgMatchups(view.method) : null, view.bracketMode === "results");
    renderBubble();

    if (view.bracketMode === "results") {
      var result = runOnce(field.seeds, view.format, view.method, false);
      renderBracket(result.rounds, true, result.champion);
    } else {
      renderBracket(staticBracket(field.seeds, view.format), false, null);
    }

    var is12 = Number(view.format) === 12;
    var standingsNote = SG.state.espn
      ? (is12
        ? "Conference champions come from projected final conference records (completed games use the real result, the rest are predicted), then the top two play a projected title game: neutral-site games get no home edge and campus games go to the higher seed. The projected winner is credited with a conference and overall win and the loser with a loss, so the projected records include the title game. Tiebreak for the top two: conference record, then overall record, then rating."
        : "The 24-team field drops conference title games, so each champion is simply the team with the best projected conference record. Completed games use the real result, the rest are predicted. Tiebreak: conference record, then overall record, then rating.")
      : "ESPN games are not loaded, so conference champions fall back to the highest-rated team in each conference.";
    document.getElementById("playoffNote").textContent =
      "Model projection from Sagarin " + SG.methodLabel(view.method) + " ratings. " + standingsNote + " " +
      (Number(view.format) === 12
        ? "12-team (2026 rules): the ACC, Big 12, Big Ten and SEC champions, the highest Group of 6 team, and the best remaining resumes to fill 12 (Notre Dame gets a bid when it ranks in the top 12); the field seeds 1-12 on the resume score, the top four get byes and seeds 5-8 host seeds 9-12."
        : "24-team (proposed 2027): 19 at-large, the four Power 4 regular-season champions, and the highest Group of 6 team; the field seeds 1-24 on the resume score, with seeds 1-8 earning a bye and a home game and seeds 9-16 hosting the first round.") +
      " The G6 spot, the at-large spots and the seeds all use a resume score: rating minus " +
      AT_LARGE_LOSS_PENALTY + " points per projected loss plus " + AT_LARGE_SOS_WEIGHT +
      " points for every point the schedule sits above the FBS average, plus " +
      AT_LARGE_CHAMPION_BONUS + " points for a team projected to win its conference, so a weak schedule cannot hide behind a record and a conference title counts for something. " +
      "The schedule weight and the champion bonus are fitted to the committee's picks and checked against a held-out season, so they move as more seasons are added. " +
      "The projected field table shows the selected rating for each team. " +
      "Note: the bracket is deterministic (predicted results); the bubble shows stochastic simulation shares (10,000 random runs). A team with a high bubble share may still miss the deterministic field.";
    renderSim(view.sim[view.format]);

    // Attach expand/collapse handlers for sim blocks
    SG.$$(".sim-more-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var block = document.getElementById(btn.getAttribute("data-target"));
        if (!block) return;
        var list = block.querySelector(".sim-list");
        var dataEl = block.querySelector(".sim-full-data");
        var expanded = btn.getAttribute("data-expanded") === "true";
        if (expanded) {
          // Collapse - show only first 14
          var max = Math.max.apply(null, 
            Array.from(list.children).map(function (r) {
              var w = parseFloat(r.querySelector(".bar-fill").style.width) || 0;
              return w;
            })) || 1;
          // Re-render initial 14
          var initialData = Array.from(list.children).slice(0, 14);
          // Actually simpler: re-render from stored data
          var fullData = JSON.parse(dataEl.textContent);
          var initialDataFull = JSON.parse(JSON.stringify(fullData)).slice(0, 14); // Not right approach
        } else {
          // Expand - show all
          var fullData = JSON.parse(dataEl.textContent);
          var allData = Array.from(list.children).map(function (r) { return r; }); // existing rows
          // We need to combine initial rows with remaining
          // Better approach: store initial data separately
        }
      });
    });
  }

  function renderBubble() {
    try {
    var box = document.getElementById("bubbleTable");
    if (!box) return;
    var fmt = Number(view.format || 12);
    var fmtMethodSim = (fmt === 12 ? SG.state.sim12Method : SG.state.sim24Method) || null;
    var sim = fmtMethodSim || (fmt === 12 ? SG.state.sim12 : SG.state.sim24) || null;
    if (!sim || !sim.field) {
      box.innerHTML = '<thead><tr><th class="left" style="vertical-align: middle;">#</th><th class="left" style="vertical-align: middle;">Team</th><th class="left" style="vertical-align: middle;">Conference</th><th class="left" style="vertical-align: middle;">Now</th><th class="left proj-col" style="vertical-align: middle;">Chance</th><th class="rating-col" style="color: var(--accent); vertical-align: middle;">' + SG.esc(view.method === "rating" ? "RATING" : SG.methodLabel(view.method)) + '</th><th class="left bid-col" style="vertical-align: middle;">Runs</th></tr></thead><tbody><tr><td colspan="7">No simulation data available. Click "Simulate 10,000 seasons" to see bubble chances.</td></tr></tbody>';
      return;
    }
    // Field teams = the CURRENT PROJECTED FIELD (12 or 24 teams from view.field.seeds)
    // NOT all teams in sim.field (which includes bubble teams with non-zero chances)
    var projectedFieldTeams = {};
    if (view.field && view.field.seeds) {
      for (var i = 1; i < view.field.seeds.length; i++) {
        projectedFieldTeams[view.field.seeds[i].team] = true;
      }
    }
    // All teams with simulation chances (from server-loaded sim data)
    var all = Object.keys(sim.field || {}).map(function(name) { return { name: name, c: sim.field[name], pct: sim.field[name] / (sim.n || 10000) }; });
    // Bubble = teams with chances that are NOT in the projected field
    var bubble = all.filter(function(r) { return !projectedFieldTeams[r.name]; })
      .sort(function(a, b) { return b.pct - a.pct || b.c - a.c; })
      .slice(0, 20);
    var methodLabel = view.method === "rating" ? "RATING" : SG.methodLabel(view.method);
    var header = '<thead><tr><th class="left" style="vertical-align: middle;">#</th><th class="left" style="vertical-align: middle;">Team</th><th class="left" style="vertical-align: middle;">Conference</th><th class="left" style="vertical-align: middle;">Now</th><th class="left proj-col" style="vertical-align: middle;">Chance</th><th class="rating-col" style="color: var(--accent); vertical-align: middle;">' + SG.esc(methodLabel) + '</th><th class="left bid-col" style="vertical-align: middle;">Runs</th></tr></thead>';
    // Helper to get rating value for a team, handling FPI fallback
    function getRatingForTeam(team, method) {
      if (!team) return "";
      if (method === "fpi") {
        var f = SG.fpiOf && SG.fpiOf(team.team);
        if (f) return f.score;
        return team.predictor || "";
      }
      return team[method] || team.rating || "";
    }

    var DEFAULT_SHOW = 5;
    var initial = bubble.slice(0, DEFAULT_SHOW);
    var remaining = bubble.slice(DEFAULT_SHOW);
    var rows = initial.map(function(r, idx) {
      var team = SG.state.espnIdToSag ? Object.values(SG.state.espnIdToSag).find(function(t){ return t.team === r.name; }) : null;
      var conf = team ? team.conference : "";
      var rating = getRatingForTeam(team, view.method);
      var nowW = team ? SG.espnW(team) : 0, nowL = team ? SG.espnL(team) : 0;
      var nowCW = team ? SG.espnConfW(team) : 0, nowCL = team ? SG.espnConfL(team) : 0;
      var now = SG.rec(nowW, nowL) + (nowCW > 0 || nowCL > 0 ? " (" + SG.rec(nowCW, nowCL) + ")" : "");
      return '<tr><td class="left">' + (idx + 1) + '</td><td class="left">' + SG.teamLogo(r.name) + SG.esc(r.name) + SG.apBadge(r.name) + '</td><td class="left">' + SG.esc(conf) + '</td><td class="left">' + SG.esc(now) + '</td><td class="left proj-col">' + (r.pct * 100).toFixed(1) + '%</td><td class="rating-col">' + SG.esc(String(rating)) + '</td><td class="left bid-col">' + r.c.toLocaleString() + '</td></tr>';
    }).join("");
    var moreHtml = '';
    if (remaining.length > 0) {
      moreHtml = '<tbody class="bubble-more" id="bubble-more-' + fmt + '" style="display:none;">' +
        remaining.map(function(r, idx) {
          var team = SG.state.espnIdToSag ? Object.values(SG.state.espnIdToSag).find(function(t){ return t.team === r.name; }) : null;
          var conf = team ? team.conference : "";
          var rating = getRatingForTeam(team, view.method);
          var nowW = team ? SG.espnW(team) : 0, nowL = team ? SG.espnL(team) : 0;
          var nowCW = team ? SG.espnConfW(team) : 0, nowCL = team ? SG.espnConfL(team) : 0;
          var now = SG.rec(nowW, nowL) + (nowCW > 0 || nowCL > 0 ? " (" + SG.rec(nowCW, nowCL) + ")" : "");
          return '<tr><td class="left">' + (idx + DEFAULT_SHOW + 1) + '</td><td class="left">' + SG.teamLogo(r.name) + SG.esc(r.name) + SG.apBadge(r.name) + '</td><td class="left">' + SG.esc(conf) + '</td><td class="left">' + SG.esc(now) + '</td><td class="left proj-col">' + (r.pct * 100).toFixed(1) + '%</td><td class="rating-col">' + SG.esc(String(rating)) + '</td><td class="left bid-col">' + r.c.toLocaleString() + '</td></tr>';
        }).join("") + '</tbody>' +
        '<div class="bubble-more-wrap"><button type="button" class="bubble-more-btn" data-target="bubble-more-' + fmt + '" data-expanded="false">Show more</button></div>';
    }
    box.innerHTML = header + '<tbody>' + rows + '</tbody>' + moreHtml;
    // Attach expand handler
    var btn = box.querySelector('.bubble-more-btn');
    if (btn) {
      btn.addEventListener('click', function() {
        var expanded = btn.getAttribute('data-expanded') === 'true';
        var moreBody = document.getElementById(btn.getAttribute('data-target'));
        if (moreBody) {
          moreBody.style.display = expanded ? 'none' : '';
          btn.textContent = expanded ? 'Show more' : 'Show fewer';
          btn.setAttribute('data-expanded', expanded ? 'false' : 'true');
        }
      });
    }
    } catch (e) { console.error("Bubble render error:", e); }
  }

  // ---- full-season simulation ----

  // Records from games that are already decided or not simulatable (completed
  // games use the real result; a rated team facing an unrated one is assumed to
  // win), plus the list of remaining games to play out each run.
  function simContext(method) {
    var confOf = {};
    SG.state.data.teams.forEach(function (t) { if (t.level === "A") confOf[t.team] = mergeConf(t.conference); });
    var base = {};
    var games = [];
    var edge = SG.homeEdge(method);
    ((SG.state.espn && SG.state.espn.games) || []).forEach(function (g) {
      var h = SG.state.espnIdToSag && SG.state.espnIdToSag[g.homeId];
      var a = SG.state.espnIdToSag && SG.state.espnIdToSag[g.awayId];
      if (g.completed && g.homeScore !== null && g.awayScore !== null) {
        applyResult(base, confOf, h, a, g.homeScore > g.awayScore);
      } else if (h && a) {
        var p = SG.normCdf((getTeamMethodScore(h, method) - getTeamMethodScore(a, method) + (g.neutral ? 0 : edge)) / SG.SIGMA);
        games.push({ h: h.team, a: a.team, p: p, conf: confOf[h.team] === confOf[a.team] && confOf[h.team] !== "I-A IND." });
      } else if (h) {
        applyResult(base, confOf, h, null, true);
      } else if (a) {
        applyResult(base, confOf, null, a, false);
      }
    });
    return { base: base, games: games };
  }

  function applyResult(rec, confOf, h, a, hWin) {
    var same = h && a && confOf[h.team] && confOf[h.team] === confOf[a.team] && confOf[h.team] !== "I-A IND.";
    if (h) { var rh = getRec(rec, h.team); rh.ow += hWin ? 1 : 0; rh.ol += hWin ? 0 : 1; if (same) { rh.cw += hWin ? 1 : 0; rh.cl += hWin ? 0 : 1; } }
    if (a) { var ra = getRec(rec, a.team); ra.ow += hWin ? 0 : 1; ra.ol += hWin ? 1 : 0; if (same) { ra.cw += hWin ? 0 : 1; ra.cl += hWin ? 1 : 0; } }
  }

  function computeSim() {
    var method = view.method, format = view.format;
    var is12 = Number(format) === 12;
    var ctx = simContext(method);
    var fieldCount = {}, champCount = {};

    // Keep the run data on every simulation so the Sim Deep Dive tab can reuse
    // this run instead of simulating the same format again.
    var debugRuns = [];

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
      var ccgs = is12 ? ccgOutcomes(regRec, method, true) : null;
      var f = fieldFromRecords(format, method, regRec, ccgs);
      for (var k = 1; k < f.seeds.length; k++) { var t = f.seeds[k]; if (t) fieldCount[t.team] = (fieldCount[t.team] || 0) + 1; }
      var r = runOnce(f.seeds, format, method, true);
      var c = r.champion.team.team;
      champCount[c] = (champCount[c] || 0) + 1;

      // Build field composition for this run. Records are kept only for the
      // teams in the field, which is all the deep dive reads and keeps 10,000
      // runs from holding a record for every FBS team.
      var fieldTeams = f.seeds.slice(1).map(function (t, idx) { return { seed: idx + 1, team: t.team, bid: f.bid[t.team] }; });
      var fieldRecords = {};
      for (var fi = 0; fi < fieldTeams.length; fi++) {
        var ft = fieldTeams[fi].team;
        fieldRecords[ft] = regRec[ft] || { cw: 0, cl: 0, ow: 0, ol: 0 };
      }
      var confChamps = ccgs ? Object.keys(ccgs).map(function (c) { return { conf: c, champ: ccgs[c].winner.team }; }) : [];
      debugRuns.push({ run: i, field: fieldTeams, champion: c, confChamps: confChamps, records: fieldRecords });
    }
    var result = { n: SIMS, field: fieldCount, champ: champCount, debugRuns: debugRuns };
    return result;
  }

  function simulate() {
    if (!SG.state.data || !view.field || view.simBusy) return;
    var btn = document.getElementById("simBtn");
    var label = btn ? btn.textContent : "";
    // Show a busy state first, then yield so the browser paints it before the
    // blocking loop runs.
    view.simBusy = true;
    if (btn) { btn.disabled = true; btn.textContent = "Simulating..."; }
    setTimeout(function () {
      try {
        view.sim[view.format] = computeSim();
        renderSim(view.sim[view.format]);
        render();
      } finally {
        view.simBusy = false;
        if (btn) { btn.disabled = false; btn.textContent = label; }
      }
    }, 40);
  }

  function init() {
    SG.$$("#playoffFormat .seg").forEach(function (seg) {
      seg.addEventListener("click", function () {
        view.format = seg.dataset.format;
        SG.$$("#playoffFormat .seg").forEach(function (s) { s.classList.toggle("active", s === seg); });
        view.sim[seg.dataset.format] = null;
        render();
      });
    });
    SG.$$("#bracketMode .seg").forEach(function (seg) {
      seg.addEventListener("click", function () {
        view.bracketMode = seg.dataset.mode;
        SG.$$("#bracketMode .seg").forEach(function (s) { s.classList.toggle("active", s === seg); });
        render();
      });
    });
    document.getElementById("playoffMethod").addEventListener("change", function (e) {
      view.method = e.target.value;
      view.sim[view.format] = null;
      // Load method-specific simulation files for bubble update
      function loadSim(url, fmt) {
        return fetch(url).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }).then(function (data) {
          if (fmt === 12) SG.state.sim12Method = data; else SG.state.sim24Method = data;
        });
      }
      Promise.all([
        loadSim("data/sim-12-" + view.method + ".json", 12),
        loadSim("data/sim-24-" + view.method + ".json", 24)
      ]).then(function () { render(); });
    });
    document.getElementById("simBtn").addEventListener("click", simulate);
    render();
  }

  SG.state.modules.playoff = {
    init: init,
    render: render,
    view: view,
    setSim: function (sim) { view.sim[view.format] = sim; },
    computeSim: computeSim,
    simContext: simContext,
    ccgOutcomes: ccgOutcomes,
    fieldFromRecords: fieldFromRecords,
    divisionStandings: divisionStandingsFunc,
    runOnce: runOnce,
};

  // Exposed so the TV tab can measure what a game does to the projected field.
  SG.playoffField = function (format, method) {
    if (!SG.state.data) return null;
    return buildField(format || view.format, method || view.method);
  };

  SG.mergeConf = mergeConf;

  // Exposed so the record predictor can project a whole conference at once.
  SG.projectedStandings = function (method) {
    var reg = projectedRecords(method);
    var ccgs = ccgOutcomes(reg, method, false);
    var fin = cloneRecords(reg);
    foldCcg(fin, ccgs);
    return { reg: reg, final: fin, ccgs: ccgs, order: conferenceOrder(method, reg) };
  };

  // Division standings for the TV watch-score (same-division CCG/division-race implications)
  // Division standings for the TV watch-score (same-division CCG/division-race implications)
  function divisionStandingsFunc(method) {
    method = method || view.method;
    var reg = projectedRecords(method);
    var divMap = (typeof window !== "undefined" && window.TeamDivisions) ? window.TeamDivisions : {};
    var out = {};
    // Group by conference, then division, computing cwp from projected records
    var confDiv = {};
    fbs().forEach(function (t) {
      var conf = mergeConf(t.conference);
      var div = divMap[t.team] || "None";
      if (!confDiv[conf]) confDiv[conf] = {};
      if (!confDiv[conf][div]) confDiv[conf][div] = [];
      confDiv[conf][div].push(t);
    });
    Object.keys(confDiv).forEach(function (conf) {
      var confDivObj = confDiv[conf];
      out[conf] = {};
      Object.keys(confDivObj).forEach(function (div) {
        if (div === "None") return;
        var teams = confDivObj[div];
        var standings = teams.map(function (t) {
          var r = reg[t.team] || { cw: 0, cl: 0, ow: 0, ol: 0 };
          var cwp = (r.cw + r.cl) ? r.cw / (r.cw + r.cl) : 0;
          return { team: t.team, cwp: cwp, cw: r.cw, cl: r.cl };
        }).sort(function (a, b) { return b.cwp - a.cwp || b.cw - a.cw; });
        var leader = standings[0] ? standings[0].team : null;
        var contenders = standings.slice(1, 3).map(function (s) { return s.team; });
        out[conf][div] = {
          leader: leader,
          contenders: contenders,
          teams: standings
        };
      });
    });
    return out;
  };
  SG.state.modules.playoff.divisionStandings = divisionStandingsFunc;


// Debug query function for simulation runs (exposed on SG.debug.simQuery)
SG.debug = SG.debug || {};
SG.debug.simQuery = function (filters) {
  if (!view.sim[view.format] || !view.sim[view.format].debugRuns) {
    console.warn("No simulation debug data available. Run a simulation first.");
    return [];
  }
  var runs = view.sim[view.format].debugRuns;
  var filtered = runs.filter(function (run) {
    if (!filters) return true;
    // Filter by team in field
    if (filters.teamInField) {
      var found = run.field.some(function (f) { return f.team === filters.teamInField; });
      if (!found) return false;
    }
    // Filter by team as champion
    if (filters.champion) {
      if (run.champion !== filters.champion) return false;
    }
    // Filter by conference champion (single, legacy)
    if (filters.confChamp) {
      var found = run.confChamps.some(function (c) { return c.conf === filters.confChamp && c.champ === filters.teamInField; });
      if (!found) return false;
    }
    // Filter by multiple conference champions: confChamps: [{team, conf}, ...]
    if (filters.confChamps) {
      var allMatch = filters.confChamps.every(function (req) {
        return run.confChamps.some(function (c) { return c.conf === req.conf && c.champ === req.team; });
      });
      if (!allMatch) return false;
    }
    // Filter by specific field composition (e.g., 1-loss JMU + 1-loss Pac12 + 1-loss American)
    if (filters.fieldHas) {
      var match = filters.fieldHas.every(function (req) {
        return run.field.some(function (f) { return f.team === req.team; });
      });
      if (!match) return false;
    }
    // Filter by team records. Records are stored only for the teams in the
    // field, so this matches their record on runs where they made the field.
    if (filters.teamRecord) {
      var team = filters.teamRecord.team;
      var rec = run.records[team];
      if (!rec) return false;
      if (filters.teamRecord.ow !== undefined && rec.ow !== filters.teamRecord.ow) return false;
      if (filters.teamRecord.ol !== undefined && rec.ol !== filters.teamRecord.ol) return false;
      if (filters.teamRecord.cw !== undefined && rec.cw !== filters.teamRecord.cw) return false;
      if (filters.teamRecord.cl !== undefined && rec.cl !== filters.teamRecord.cl) return false;
    }
    return true;
  });
  return filtered;
};

})();
