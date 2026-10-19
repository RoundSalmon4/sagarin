/* Playoff predictor: builds a projected CFP field from the ratings and draws
   either the current 12-team bracket or the proposed 24-team bracket. */
(function () {
  "use strict";
  var SG = window.SG;

  var P4 = ["SEC", "BIG TEN", "BIG 12", "ACC"];
  var G6 = ["AMERICAN", "CONF-USA", "MAC", "MOUNTAIN WEST", "SUN BELT", "PAC-12"];
  var SIMS = 2000;

  var view = { format: "12", method: "rating", seeds: null, field: null, sim: null };

  function mergeConf(c) {
    if (c === "SUN BELT EAST" || c === "SUN BELT WEST") return "SUN BELT";
    return c;
  }

  function fbs() {
    return SG.state.data.teams.filter(function (t) { return t.level === "A"; });
  }

  function champions(method) {
    var byConf = {};
    fbs().forEach(function (t) {
      var c = mergeConf(t.conference);
      (byConf[c] = byConf[c] || []).push(t);
    });
    var champs = {};
    Object.keys(byConf).forEach(function (c) {
      champs[c] = byConf[c].slice().sort(function (a, b) { return b[method] - a[method]; })[0];
    });
    return champs;
  }

  function buildField(format, method) {
    var teams = fbs();
    var champs = champions(method);
    var seeds = [null];
    var bid = {};

    if (Number(format) === 12) {
      var champList = Object.keys(champs)
        .filter(function (c) { return c !== "I-A IND."; })
        .map(function (c) { return { conf: c, team: champs[c] }; })
        .sort(function (a, b) { return b.team[method] - a.team[method]; });
      var qual = champList.slice(0, 5);
      var used = {};
      qual.forEach(function (x) { used[x.team.team] = true; bid[x.team.team] = "Conf champ (" + x.conf + ")"; });
      var atLarge = teams.filter(function (t) { return !used[t.team]; })
        .sort(function (a, b) { return b[method] - a[method]; }).slice(0, 7);
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
        .sort(function (a, b) { return b[method] - a[method]; }).slice(0, 19);
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
    var rounds;
    var semis, finals, champion;
    if (Number(format) === 12) {
      var r1 = [
        play(S(seeds, 5), S(seeds, 12), 5, method, stochastic),
        play(S(seeds, 6), S(seeds, 11), 6, method, stochastic),
        play(S(seeds, 7), S(seeds, 10), 7, method, stochastic),
        play(S(seeds, 8), S(seeds, 9), 8, method, stochastic)
      ];
      var qf = [
        play(S(seeds, 1), r1[3].winner, 1, method, stochastic),
        play(S(seeds, 4), r1[0].winner, 4, method, stochastic),
        play(S(seeds, 2), r1[2].winner, 2, method, stochastic),
        play(S(seeds, 3), r1[1].winner, 3, method, stochastic)
      ];
      semis = [
        play(qf[0].winner, qf[1].winner, null, method, stochastic),
        play(qf[2].winner, qf[3].winner, null, method, stochastic)
      ];
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
        play(S(seeds, 9), S(seeds, 24), 9, method, stochastic),
        play(S(seeds, 10), S(seeds, 23), 10, method, stochastic),
        play(S(seeds, 11), S(seeds, 22), 11, method, stochastic),
        play(S(seeds, 12), S(seeds, 21), 12, method, stochastic),
        play(S(seeds, 13), S(seeds, 20), 13, method, stochastic),
        play(S(seeds, 14), S(seeds, 19), 14, method, stochastic),
        play(S(seeds, 15), S(seeds, 18), 15, method, stochastic),
        play(S(seeds, 16), S(seeds, 17), 16, method, stochastic)
      ];
      var r2 = [
        play(S(seeds, 1), rr[7].winner, 1, method, stochastic),
        play(S(seeds, 8), rr[0].winner, 8, method, stochastic),
        play(S(seeds, 4), rr[4].winner, 4, method, stochastic),
        play(S(seeds, 5), rr[3].winner, 5, method, stochastic),
        play(S(seeds, 2), rr[6].winner, 2, method, stochastic),
        play(S(seeds, 7), rr[1].winner, 7, method, stochastic),
        play(S(seeds, 3), rr[5].winner, 3, method, stochastic),
        play(S(seeds, 6), rr[2].winner, 6, method, stochastic)
      ];
      var qf24 = [
        play(r2[0].winner, r2[1].winner, null, method, stochastic),
        play(r2[2].winner, r2[3].winner, null, method, stochastic),
        play(r2[4].winner, r2[5].winner, null, method, stochastic),
        play(r2[6].winner, r2[7].winner, null, method, stochastic)
      ];
      semis = [
        play(qf24[0].winner, qf24[1].winner, null, method, stochastic),
        play(qf24[2].winner, qf24[3].winner, null, method, stochastic)
      ];
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
      rounds: rounds,
      champion: champion,
      semifinalists: [semis[0].a.team, semis[0].b.team, semis[1].a.team, semis[1].b.team],
      finalists: [finals[0].a.team, finals[0].b.team]
    };
  }

  // ---- rendering ----

  function seedLabel(seedObj) {
    return {
      seed: seedObj.seed,
      team: seedObj.team ? seedObj.team.team : "",
      ok: !!seedObj.team
    };
  }

  function gameBox(game) {
    function row(seedObj, p, isWinner) {
      var s = seedLabel(seedObj);
      return '<div class="game-team' + (isWinner ? " winner" : "") + '">' +
        '<span class="seed">#' + s.seed + "</span>" +
        '<span class="name">' + SG.esc(s.team) + "</span>" +
        '<span class="score">' + (p === null ? "" : (p * 100).toFixed(0) + "%") + "</span></div>";
    }
    var winnerIsA = game.winner && game.a && game.winner.seed === game.a.seed;
    var pa = game.p;
    var pb = 1 - game.p;
    var site = game.neutral ? "neutral site" : ("at #" + game.home);
    return '<div class="game-box">' +
      row(game.a, pa, winnerIsA) +
      row(game.b, pb, !winnerIsA) +
      '<div class="site-tag">' + SG.esc(site) + "</div></div>";
  }

  function renderBracket(result) {
    var html = result.rounds.map(function (round) {
      var games = round.games.map(gameBox).join("");
      return '<div class="bracket-col"><div class="bracket-col-title">' + SG.esc(round.title) + "</div>" + games + "</div>";
    }).join("");
    var champ = result.champion.team ? result.champion.team.team : "";
    html += '<div class="bracket-col"><div class="bracket-col-title">Projected champion</div>' +
      '<div class="game-box champ-box"><div class="game-team winner"><span class="seed">#' + result.champion.seed + "</span><span class=\"name\">" + SG.esc(champ) + "</span><span class=\"score\"></span></div></div></div>";
    document.getElementById("bracket").innerHTML = html;
  }

  function renderField(field, method) {
    var table = document.getElementById("fieldTable");
    var columns = [
      { key: "seed", label: "#", cls: "left" },
      { key: "team", label: "Team", cls: "left", type: "str" },
      { key: "conf", label: "Conference", cls: "left", type: "str" },
      { key: "rating", label: "RATING", strong: true },
      { key: "w", label: "W" },
      { key: "l", label: "L" },
      { key: "bid", label: "Bid", cls: "left", type: "str" }
    ];
    var rows = [];
    for (var i = 1; i < field.seeds.length; i++) {
      var t = field.seeds[i];
      rows.push({
        seed: i,
        team: t.team,
        conf: mergeConf(t.conference),
        rating: t.rating,
        w: t.w,
        l: t.l,
        bid: field.bid[t.team] || "At-large"
      });
    }
    SG.buildHead(table, columns, { key: "seed", dir: 1 }, function () {});
    SG.fillBody(table, columns, rows);
  }

  function renderSim(sim) {
    var box = document.getElementById("simResults");
    if (!sim) { box.innerHTML = ""; return; }
    var rows = Object.keys(sim.champ).map(function (name) {
      return { name: name, champ: sim.champ[name], fin: sim.fin[name] || 0, semi: sim.semi[name] || 0 };
    }).sort(function (a, b) { return b.champ - a.champ || b.fin - a.fin; }).slice(0, 14);

    function block(title, key) {
      var max = Math.max.apply(null, rows.map(function (r) { return r[key]; })) || 1;
      return '<div class="sim-block"><h3>' + title + "</h3><div class=\"sim-list\">" +
        rows.map(function (r) {
          var pct = ((r[key] / sim.n) * 100).toFixed(1);
          return '<div class="row"><span>' + SG.esc(r.name) + '</span><span class="bar-track"><span class="bar-fill" style="width:' +
            ((r[key] / max) * 100).toFixed(1) + '%"></span></span><span>' + pct + "%</span></div>";
        }).join("") + "</div></div>";
    }
    box.innerHTML = "<p class=\"note\">" + sim.n + " simulated seasons. " +
      "Bars show each team's share of titles; percentages are title odds, with final and semifinal odds beside them.</p>" +
      block("Championship odds", "champ");
  }

  function compute() {
    if (!SG.state.data) return;
    var field = buildField(view.format, view.method);
    view.seeds = field.seeds;
    view.field = field;
    var result = runOnce(field.seeds, view.format, view.method, false);
    renderField(field, view.method);
    renderBracket(result);
    document.getElementById("playoffNote").textContent =
      "Model projection from Sagarin " + SG.methodLabel(view.method) + " ratings. Conference champions are the highest-rated team in each conference, an assumption this tool makes because it does not track conference standings. " +
      (view.format === "12"
        ? "12-team: five highest-rated conference champions plus seven at-large; top four champions seed 1-4 with byes; seeds 5-8 host seeds 9-12."
        : "24-team (proposed 2027): 19 at-large, the four Power 4 champions, and the highest-rated Group of 6 team; seeds 1-8 get a bye and a home game, seeds 9-16 host the first round.");
    renderSim(view.sim);
  }

  function simulate() {
    if (!SG.state.data) return;
    var method = view.method, format = view.format, seeds = view.seeds;
    var champ = {}, fin = {}, semi = {};
    for (var i = 0; i < SIMS; i++) {
      var r = runOnce(seeds, format, method, true);
      var c = r.champion.team.team;
      champ[c] = (champ[c] || 0) + 1;
      r.finalists.forEach(function (t) { if (t) fin[t.team] = (fin[t.team] || 0) + 1; });
      r.semifinalists.forEach(function (t) { if (t) semi[t.team] = (semi[t.team] || 0) + 1; });
    }
    view.sim = { champ: champ, fin: fin, semi: semi, n: SIMS };
    renderSim(view.sim);
  }

  function register() {
    SG.state.modules.playoff = { init: init, render: function () { compute(); } };
  }

  function init() {
    SG.$$("#playoffFormat .seg").forEach(function (seg) {
      seg.addEventListener("click", function () {
        view.format = seg.dataset.format;
        SG.$$("#playoffFormat .seg").forEach(function (s) { s.classList.toggle("active", s === seg); });
        view.sim = null;
        compute();
      });
    });
    document.getElementById("playoffMethod").addEventListener("change", function (e) {
      view.method = e.target.value;
      view.sim = null;
      compute();
    });
    document.getElementById("simBtn").addEventListener("click", simulate);
    compute();
  }

  register();
})();

