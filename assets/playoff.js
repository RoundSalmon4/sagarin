/* Playoff predictor: projected CFP field. Conference champions come from real
   conference standings built from the prefetched ESPN games. Draws either the
   current 12-team bracket or the proposed 24-team bracket, seeds only by
   default with an option to show predicted results. */
(function () {
  "use strict";
  var SG = window.SG;

  var P4 = ["SEC", "BIG TEN", "BIG 12", "ACC"];
  var G6 = ["AMERICAN", "CONF-USA", "MAC", "MOUNTAIN WEST", "SUN BELT", "PAC-12"];
  var SIMS = 2000;
  // At-large spots are a resume call, not a pure power call: conference champions
  // are ranked on rating alone, but the at-large pool is ranked on rating with a
  // five-point penalty per projected loss, so an undefeated or one-loss team is
  // not passed by a stronger team carrying extra losses. Same idea as the
  // published resume ratings, which dock points for every loss.
  var AT_LARGE_LOSS_PENALTY = 5;

  var view = { format: "12", method: "predictor", bracketMode: "seeds", field: null, sim: null };

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

  // Projected records with the projected conference title games folded in. The
  // two title-game participants are still chosen from regular-season records,
  // but from there the projected winner gets a conference and overall win and
  // the loser gets a loss, so the field table and the at-large resume reflect a
  // full season. The 24-team field has no title games, so it is unchanged.
  function finalRecords(method, format) {
    var std = projectedRecords(method);
    if (Number(format) !== 12) return std;
    var order = conferenceOrder(method, std);
    Object.keys(order).forEach(function (c) {
      if (c === "I-A IND.") return;
      var list = order[c];
      if (!list[0] || !list[1]) return;
      var m = ccgResult(c, list[0], list[1], method);
      recordGame(std, m.winner.team, true);
      recordGame(std, m.winner === m.a ? m.b.team : m.a.team, false);
    });
    return std;
  }

  function recordGame(std, team, win) {
    var r = std[team];
    if (!r) return;
    if (win) { r.cw += 1; r.ow += 1; } else { r.cl += 1; r.ol += 1; }
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

  function champions(method, withCcg) {
    var order = conferenceOrder(method);
    var champs = {};
    Object.keys(order).forEach(function (c) {
      if (c === "I-A IND.") return;
      var list = order[c];
      if (!list[0]) return;
      champs[c] = (withCcg && list[1]) ? ccgResult(c, list[0], list[1], method).winner : list[0];
    });
    return champs;
  }

  function buildField(format, method) {
    var teams = fbs();
    // The 12-team CFP keeps conference title games; the proposed 24-team field
    // drops them, so its champions are the regular-season winners.
    var champs = champions(method, Number(format) === 12);
    var std = finalRecords(method, format);
    var seeds = [null];
    var bid = {};

    // At-large resume score: selected rating minus a penalty for each projected
    // loss. Champions and seeding still use the raw rating.
    function atLargeScore(t) {
      var r = std[t.team];
      return t[method] - AT_LARGE_LOSS_PENALTY * (r ? r.ol : 0);
    }

    if (Number(format) === 12) {
      var champList = Object.keys(champs)
        .map(function (c) { return { conf: c, team: champs[c] }; })
        .sort(function (a, b) { return b.team[method] - a.team[method]; });
      var qual = champList.slice(0, 5);
      var used = {};
      qual.forEach(function (x) { used[x.team.team] = true; bid[x.team.team] = "Conf champ (" + x.conf + ")"; });
      var atLarge = teams.filter(function (t) { return !used[t.team]; })
        .sort(function (a, b) { return (atLargeScore(b) - atLargeScore(a)) || (b[method] - a[method]); }).slice(0, 7);
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
      var atLarge24 = teams.filter(function (t) { return !autoNames[t.team]; })
        .sort(function (a, b) { return (atLargeScore(b) - atLargeScore(a)) || (b[method] - a[method]); }).slice(0, 19);
      atLarge24.forEach(function (t) { bid[t.team] = "At-large"; });
      auto.concat(atLarge24)
        .sort(function (a, b) { return b[method] - a[method]; })
        .forEach(function (t) { seeds.push(t); });
    }
    return { seeds: seeds, bid: bid };
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

  function renderField(field) {
    var table = document.getElementById("fieldTable");
    var columns = [
      { key: "seed", label: "#", cls: "left" },
      { key: "team", label: "Team", cls: "left", type: "str",
        cell: function (r) { return SG.teamLogo(r.team) + SG.esc(r.team) + SG.apBadge(r.team); } },
      { key: "conf", label: "Conference", cls: "left", type: "str" },
      { key: "cw", label: "Conf (proj)", cls: "left", type: "str" },
      { key: "proj", label: "Proj", cls: "left", type: "str" },
      { key: "rating", label: view.method === "rating" ? "RATING" : SG.methodLabel(view.method), strong: true },
      { key: "now", label: "Now", cls: "left", type: "str" },
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
        proj: r ? r.ow + "-" + r.ol : "-",
        rating: t[view.method],
        now: t.w + "-" + t.l,
        bid: field.bid[t.team] || "At-large"
      });
    }
    SG.buildHead(table, columns, { key: "seed", dir: 1 }, function () {});
    SG.fillBody(table, columns, rows);
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
    var rows = Object.keys(sim.champ).map(function (name) {
      return { name: name, champ: sim.champ[name] };
    }).sort(function (a, b) { return b.champ - a.champ; }).slice(0, 14);
    var max = Math.max.apply(null, rows.map(function (r) { return r.champ; })) || 1;
    box.innerHTML = '<div class="sim-block"><h3>Championship odds</h3><div class="sim-list">' +
      rows.map(function (r) {
        var pct = (r.champ / sim.n) * 100;
        return '<div class="row"><span>' + SG.esc(r.name) + '</span><span class="bar-track"><span class="bar-fill" style="width:' +
          ((r.champ / max) * 100).toFixed(1) + '%"></span></span><span>' + pct.toFixed(1) + "%</span></div>";
      }).join("") + "</div></div><p class=\"note\">" + sim.n + " simulated seasons from the projected field.</p>";
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

  function simulate() {
    if (!SG.state.data || !view.field) return;
    var method = view.method, format = view.format, seeds = view.field.seeds;
    var champ = {};
    for (var i = 0; i < SIMS; i++) {
      var r = runOnce(seeds, format, method, true);
      var c = r.champion.team.team;
      champ[c] = (champ[c] || 0) + 1;
    }
    view.sim = { champ: champ, n: SIMS };
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
