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
  // At-large spots are a resume call, not a pure power call: conference champions
  // are ranked on rating alone, but the at-large pool is ranked on rating with a
  // five-point penalty per projected loss, so an undefeated or one-loss team is
  // not passed by a stronger team carrying extra losses. Same idea as the
  // published resume ratings, which dock points for every loss.
  var AT_LARGE_LOSS_PENALTY = 5;

  var view = { format: "12", method: "predictor", bracketMode: "seeds", field: null, sim: null, fieldSort: { key: "seed", dir: 1 } };

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
        hWin = (h[method] - a[method] + (g.neutral ? 0 : edge)) >= 0;
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

  function champScore(team, std, method) {
    var r = std[team.team] || { cw: 0, cl: 0, ow: 0, ol: 0 };
    var cwp = (r.cw + r.cl) ? r.cw / (r.cw + r.cl) : 0;
    var owp = (r.ow + r.ol) ? r.ow / (r.ow + r.ol) : 0;
    return cwp * 1e6 + owp * 1e3 + (team[method] || 0);
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
    var spread = top[method] - second[method] + edge;
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

    // At-large resume score: selected rating minus a penalty for each projected
    // loss. Champions and seeding still use the raw rating.
    function atLargeScore(t) {
      var r = std[t.team];
      return t[method] - AT_LARGE_LOSS_PENALTY * (r ? r.ol : 0);
    }

    if (is12) {
      var champList = Object.keys(champs)
        .map(function (c) { return { conf: c, team: champs[c] }; })
        .sort(function (a, b) { return b.team[method] - a.team[method]; });
      var qual = champList.slice(0, 5);
      var used = {};
      qual.forEach(function (x) { used[x.team.team] = true; bid[x.team.team] = "Conf champ (" + x.conf + ")"; });
      var challengers = teams.filter(function (t) { return !used[t.team]; })
        .sort(function (a, b) { return (atLargeScore(b) - atLargeScore(a)) || (b[method] - a[method]); });
      var atLarge = challengers.slice(0, 7);
      atLarge.forEach(function (t) { bid[t.team] = "At-large"; });
      var top4 = qual.slice(0, 4).map(function (x) { return x.team; });
      var rest = [qual[4].team].concat(atLarge).sort(function (a, b) { return b[method] - a[method]; });
      top4.forEach(function (t) { seeds.push(t); });
      rest.forEach(function (t) { seeds.push(t); });
    } else {
      var p4 = P4.map(function (c) { return champs[c]; }).filter(Boolean);
      p4.forEach(function (t) { bid[t.team] = "P4 champ (" + mergeConf(t.conference) + ")"; });
      var g6pool = teams.filter(function (t) { return G6.indexOf(mergeConf(t.conference)) !== -1; })
        .sort(function (a, b) { return b[method] - a[method]; });
      var g6 = g6pool[0];
      if (g6) bid[g6.team] = "G6 bid (" + mergeConf(g6.conference) + ")";
      var auto = p4.concat(g6 ? [g6] : []);
      var autoNames = {};
      auto.forEach(function (t) { autoNames[t.team] = true; });
      var challengers = teams.filter(function (t) { return !autoNames[t.team]; })
        .sort(function (a, b) { return (atLargeScore(b) - atLargeScore(a)) || (b[method] - a[method]); });
      var atLarge24 = challengers.slice(0, 19);
      atLarge24.forEach(function (t) { bid[t.team] = "At-large"; });
      auto.concat(atLarge24)
        .sort(function (a, b) { return b[method] - a[method]; })
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
    var ra = a.team[method], rb = b.team[method];
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
      { key: "cw", label: "Conf (proj)", cls: "left", cell: function (r) { return SG.esc(r.cw); }, value: function (r) { return r.cwV; } },
      { key: "proj", label: "Proj", cls: "left", cell: function (r) { return SG.esc(r.proj); }, value: function (r) { return r.projV; } },
      { key: "rating", label: view.method === "rating" ? "RATING" : SG.methodLabel(view.method), strong: true },
      { key: "now", label: "Now", cls: "left", cell: function (r) { return SG.esc(r.now); }, value: function (r) { return r.nowV; } },
      { key: "bid", label: "Bid", cls: "left", type: "str" }
    ];
    var std = finalRecords(view.method, view.format);
    var rows = [];
    for (var i = 1; i < field.seeds.length; i++) {
      var t = field.seeds[i];
      var r = std[t.team];
      rows.push({
        seed: i,
        team: t.team,
        conf: mergeConf(t.conference),
        cw: r && (r.cw + r.cl) ? r.cw + "-" + r.cl : "-",
        cwV: r && (r.cw + r.cl) ? recSortVal(r.cw, r.cl) : -1,
        proj: r ? r.ow + "-" + r.ol : "-",
        projV: r ? recSortVal(r.ow, r.ol) : -1,
        rating: t[view.method],
        now: t.w + "-" + t.l,
        nowV: recSortVal(t.w, t.l),
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
      var site = m.neutral ? "Neutral site" : ("at " + m.a.team);
      return '<div class="ccg-card">' +
        '<div class="ccg-conf">' + SG.esc(m.conf) + "</div>" +
        ccgTeam(m.a, m.winner === m.a, view.method, showResults, m.p) +
        ccgTeam(m.b, m.winner === m.b, view.method, showResults, 1 - m.p) +
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
  }

  function simBlock(title, counts, n) {
    var rows = Object.keys(counts).map(function (name) { return { name: name, c: counts[name] }; })
      .sort(function (a, b) { return b.c - a.c; }).slice(0, 14);
    var max = Math.max.apply(null, rows.map(function (r) { return r.c; })) || 1;
    return '<div class="sim-block"><h3>' + SG.esc(title) + '</h3><div class="sim-list">' +
      rows.map(function (r) {
        var pct = (r.c / n) * 100;
        return '<div class="row"><span>' + SG.esc(r.name) + '</span><span class="bar-track"><span class="bar-fill" style="width:' +
          ((r.c / max) * 100).toFixed(1) + '%"></span></span><span>' + pct.toFixed(1) + "%</span></div>";
      }).join("") + "</div></div>";
  }

  function render() {
    if (!SG.state.data) return;
    var field = buildField(view.format, view.method);
    view.field = field;
    renderField(field);
    renderCcg(Number(view.format) === 12 ? ccgMatchups(view.method) : null, view.bracketMode === "results");

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
        ? "12-team: five highest-rated conference champions plus seven at-large; top four champions seed 1-4 with byes; seeds 5-8 host seeds 9-12."
        : "24-team (proposed 2027): 19 at-large, the four Power 4 champions, and the highest-rated Group of 6 team; seeds 1-8 get a bye and a home game, seeds 9-16 host the first round.") +
      " Champions are seeded on rating, but the at-large spots are a resume call: they are ranked on rating with a " +
      AT_LARGE_LOSS_PENALTY + "-point penalty per projected loss, so an undefeated or one-loss team is not passed by " +
      "a stronger team carrying more losses. The projected field table shows the selected rating for each team.";
    renderSim(view.sim);
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
        var p = SG.normCdf((h[method] - a[method] + (g.neutral ? 0 : edge)) / SG.SIGMA);
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

  function simulate() {
    if (!SG.state.data || !view.field) return;
    var method = view.method, format = view.format;
    var is12 = Number(format) === 12;
    var ctx = simContext(method);
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
      var ccgs = is12 ? ccgOutcomes(regRec, method, true) : null;
      var f = fieldFromRecords(format, method, regRec, ccgs);
      for (var k = 1; k < f.seeds.length; k++) { var t = f.seeds[k]; if (t) fieldCount[t.team] = (fieldCount[t.team] || 0) + 1; }
      var r = runOnce(f.seeds, format, method, true);
      var c = r.champion.team.team;
      champCount[c] = (champCount[c] || 0) + 1;
    }
    view.sim = { n: SIMS, field: fieldCount, champ: champCount };
    renderSim(view.sim);
  }

  function init() {
    SG.$$("#playoffFormat .seg").forEach(function (seg) {
      seg.addEventListener("click", function () {
        view.format = seg.dataset.format;
        SG.$$("#playoffFormat .seg").forEach(function (s) { s.classList.toggle("active", s === seg); });
        view.sim = null;
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
      view.sim = null;
      render();
    });
    document.getElementById("simBtn").addEventListener("click", simulate);
    render();
  }

  SG.state.modules.playoff = { init: init, render: render };

  // Exposed so the TV tab can measure what a game does to the projected field.
  SG.playoffField = function (format, method) {
    if (!SG.state.data) return null;
    return buildField(format || view.format, method || view.method);
  };
})();
