/* Schedule predictor: pull a team's schedule from the ESPN API and project each
   remaining game with the chosen Sagarin rating method. */
(function () {
  "use strict";
  var SG = window.SG;

  var LANG_CACHE = "sagarin-espn-teams";
  var TTL = 24 * 60 * 60 * 1000;

  var ALIAS = {
    "miami florida": "miami", "miami ohio": "miami oh", "fla international": "florida international",
    "central florida ucf": "ucf", "louisianamonroe ulm": "ul monroe", "louisiana lafayette": "louisiana",
    "miss valley state": "mississippi valley state", "se missouri state": "southeast missouri state",
    "army west point": "army", "connecticut": "uconn", "mississippi": "ole miss",
    "southern california": "usc", "appalachian state": "app state", "sam houston state": "sam houston",
    "monmouth nj": "monmouth", "albany ny": "ualbany", "tennessee martin": "ut martin",
    "sc state": "south carolina state", "cal poly slo": "cal poly", "mcneese state": "mcneese",
    "st thomas mn": "st thomas", "ark pine bluff": "arkansas pine bluff", "liu post": "long island university",
    "stonehill college": "stonehill", "grambling state": "grambling", "nc central": "north carolina central",
    "nc at": "north carolina at", "southern u": "southern", "nicholls state": "nicholls",
    "presbyterian college": "presbyterian"
  };

  function trimTeam(t) {
    return { id: t.id, displayName: t.displayName, location: t.location, name: t.name, abbreviation: t.abbreviation };
  }

  function getEspnTeams() {
    if (SG.state.espnTeams) return Promise.resolve(SG.state.espnTeams);
    try {
      var cached = JSON.parse(localStorage.getItem(LANG_CACHE) || "null");
      if (cached && cached.t && Date.now() - cached.t < TTL && cached.teams && cached.teams.length) {
        SG.state.espnTeams = cached.teams;
        return Promise.resolve(cached.teams);
      }
    } catch (e) {}
    return fetch(SG.ESPN_BASE + "/teams?limit=1000").then(function (r) {
      if (!r.ok) throw new Error("ESPN HTTP " + r.status);
      return r.json();
    }).then(function (j) {
      var teams = j.sports[0].leagues[0].teams.map(function (x) { return trimTeam(x.team); });
      SG.state.espnTeams = teams;
      try { localStorage.setItem(LANG_CACHE, JSON.stringify({ t: Date.now(), teams: teams })); } catch (e) {}
      return teams;
    });
  }

  function buildMapping() {
    return getEspnTeams().then(function (list) {
      var idx = {};
      list.forEach(function (t) {
        [t.location, t.name, t.displayName].forEach(function (v) {
          var k = SG.normalizeName(v || "");
          if (k && !idx[k]) idx[k] = t;
        });
      });
      var sagToEspn = {};
      var espnIdToSag = {};
      SG.state.data.teams.forEach(function (st) {
        var k = SG.normalizeName(st.team);
        var et = idx[k] || idx[ALIAS[k]];
        if (et) { sagToEspn[st.team] = et; espnIdToSag[et.id] = st; }
      });
      SG.state.sagToEspn = sagToEspn;
      SG.state.espnIdToSag = espnIdToSag;
    });
  }

  function ensureMapping() {
    if (SG.state.sagToEspn && SG.state.espnIdToSag) return Promise.resolve();
    return buildMapping();
  }

  function fillSelect() {
    var sel = document.getElementById("schedTeam");
    if (!sel || sel.dataset.filled === "1") return;
    var teams = SG.state.data.teams.slice().sort(function (a, b) { return a.rank - b.rank; });
    sel.innerHTML = teams.map(function (t) {
      return '<option value="' + SG.esc(t.team) + '">' + SG.esc(t.team) + " (" + SG.fmt(t.rating) + ")</option>";
    }).join("");
    sel.dataset.filled = "1";
  }

  function fmtDate(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  function load() {
    if (!SG.state.data) return;
    var note = document.getElementById("schedNote");
    var name = document.getElementById("schedTeam").value;
    var method = document.getElementById("schedMethod").value;
    var teamSag = SG.teamByName(name);
    var tbody = document.getElementById("schedTable").tBodies[0];

    note.textContent = "Loading schedule from ESPN...";
    document.getElementById("schedSummary").innerHTML = "";
    tbody.innerHTML = "";

    ensureMapping().then(function () {
      var et = SG.state.sagToEspn[name];
      if (!et) throw new Error("no ESPN team matched for " + name);
      return fetch(SG.ESPN_BASE + "/teams/" + et.id + "/schedule").then(function (r) {
        if (!r.ok) throw new Error("ESPN HTTP " + r.status);
        return r.json();
      });
    }).then(function (j) {
      render(name, method, teamSag, j.events || []);
    }).catch(function (err) {
      note.textContent = "Could not load the ESPN schedule (" + err.message + "). ESPN must be reachable from the browser.";
    });
  }

  function render(name, method, teamSag, events) {
    var edge = SG.homeEdge(method);
    var table = document.getElementById("schedTable");
    var columns = [
      { key: "date", label: "Date", cls: "left", type: "str" },
      { key: "opp", label: "Opponent", cls: "left", type: "str" },
      { key: "site", label: "Site", cls: "left", type: "str" },
      { key: "result", label: "Result", cls: "left", type: "str", cell: function (r) { return r.result; } },
      { key: "oppRating", label: "Opp RATING" },
      { key: "margin", label: "Proj margin" },
      { key: "winPct", label: "Win%", cell: function (r) { return r.winPct === null || r.winPct === undefined ? "" : (r.winPct * 100).toFixed(0) + "%"; } },
      { key: "pick", label: "Projected", cls: "left", type: "str", cell: function (r) { return r.pick; } }
    ];

    var rows = [];
    var remaining = 0, projWins = 0;

    events.forEach(function (ev) {
      var comp = (ev.competitions || [])[0];
      if (!comp) return;
      var competitors = comp.competitors || [];
      var self = competitors.filter(function (c) { return c.team && String(c.team.id) === String(SG.state.sagToEspn[name].id); })[0];
      var opp = competitors.filter(function (c) { return c !== self; })[0];
      if (!opp) return;
      var isHome = self.homeAway === "home";
      var neutral = !!comp.neutralSite;
      var completed = comp.status && comp.status.type && comp.status.type.completed;
      var oppSag = SG.state.espnIdToSag[opp.team.id];

      var row = {
        date: fmtDate(ev.date),
        opp: opp.team.displayName || opp.team.name,
        site: neutral ? "Neutral" : (isHome ? "vs" : "@"),
        result: "",
        oppRating: oppSag ? SG.fmt(oppSag[method]) : "nr",
        margin: "-",
        winPct: null,
        pick: ""
      };

      if (completed && opp.score && self.score) {
        var sw = Number(self.score.value), ow = Number(opp.score.value);
        var won = sw > ow;
        row.result = '<span class="' + (won ? "win" : "loss") + '">' + (won ? "W" : "L") + " " + sw + "-" + ow + "</span>";
      } else if (oppSag && teamSag) {
        var spread = teamSag[method] - oppSag[method] + (neutral ? 0 : (isHome ? edge : -edge));
        var wp = SG.normCdf(spread / SG.SIGMA);
        row.margin = (spread >= 0 ? "+" : "-") + SG.fmt(Math.abs(spread), 1);
        row.winPct = wp;
        row.pick = '<span class="' + (wp >= 0.5 ? "win" : "loss") + '">' + SG.esc(wp >= 0.5 ? name : row.opp) + "</span>";
        remaining++;
        if (wp >= 0.5) projWins++;
      } else {
        row.pick = '<span class="dim">no rating</span>';
      }

      rows.push(row);
    });

    SG.buildHead(table, columns, { key: "", dir: 1 }, function () {});
    SG.fillBody(table, columns, rows);

    SG.$("#schedNote").textContent =
      "Home edge for " + SG.methodLabel(method) + " is " + SG.fmt(edge) + " points. Projections use Sagarin ratings; opponents not rated by Sagarin show nr.";

    var rec = SG.rec(teamSag.w, teamSag.l);
    var projFinal = (teamSag.w + projWins) + "-" + (teamSag.l + (remaining - projWins));
    document.getElementById("schedSummary").innerHTML =
      chip("Team", name) +
      chip("Current record", rec) +
      chip("Games left", String(remaining)) +
      chip("Projected wins left", String(projWins)) +
      chip("Projected final", projFinal);
  }

  function chip(k, v) {
    return '<div class="chip"><span class="k">' + SG.esc(k) + '</span><span class="v">' + SG.esc(v) + "</span></div>";
  }

  function init() {
    fillSelect();
    document.getElementById("schedTeam").addEventListener("change", function () { load(); });
    document.getElementById("schedMethod").addEventListener("change", function () { load(); });
    document.getElementById("schedReload").addEventListener("click", function () { load(); });
    load();
  }

  SG.state.modules.schedule = { init: init, render: function () { fillSelect(); } };
})();
