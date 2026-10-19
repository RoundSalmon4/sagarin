/* Schedule predictor: read a team's season schedule from the prefetched ESPN
   data file and project each remaining game with the chosen Sagarin method. */
(function () {
  "use strict";
  var SG = window.SG;

  function availableTeams() {
    var haveMapping = SG.state.espn && SG.state.sagToEspn;
    return SG.state.data.teams.filter(function (t) {
      if (haveMapping && !(SG.state.sagToEspn[t.team] && SG.gamesForTeam(t.team).length > 0)) return false;
      return true;
    });
  }

  function fillConfFilter() {
    var sel = document.getElementById("schedConf");
    if (!sel || !SG.state.data) return;
    var cur = sel.value;
    sel.innerHTML = '<option value="">All conferences</option>';
    var seen = {};
    SG.state.data.conferences.forEach(function (c) {
      if (seen[c.name]) return;
      seen[c.name] = true;
      var o = document.createElement("option");
      o.value = c.name;
      o.textContent = c.name;
      sel.appendChild(o);
    });
    sel.value = cur || "";
  }

  function fillSelect() {
    var sel = document.getElementById("schedTeam");
    if (!sel || !SG.state.data) return;
    var prev = sel.value;
    var q = (document.getElementById("schedSearch").value || "").trim().toLowerCase();
    var conf = document.getElementById("schedConf").value || "";
    var teams = availableTeams().filter(function (t) {
      if (conf && t.conference !== conf) return false;
      if (q && t.team.toLowerCase().indexOf(q) === -1 && t.conference.toLowerCase().indexOf(q) === -1) return false;
      return true;
    }).sort(function (a, b) { return a.rank - b.rank; });
    sel.innerHTML = teams.length
      ? teams.map(function (t) {
          return '<option value="' + SG.esc(t.team) + '">' + SG.esc(t.team) + " (" + SG.fmt(t.rating) + ")</option>";
        }).join("")
      : '<option value="">No teams match</option>';
    if (prev && teams.filter(function (t) { return t.team === prev; }).length) sel.value = prev;
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
    var tbody = document.getElementById("schedTable").tBodies[0];
    var teamSag = SG.teamByName(name);

    if (!name || !teamSag) {
      note.textContent = "Pick a team to project its remaining games.";
      tbody.innerHTML = "";
      document.getElementById("schedSummary").innerHTML = "";
      return;
    }

    if (!SG.state.espn) {
      note.textContent = "ESPN schedule data is not available yet. It is refreshed by the Action each week.";
      tbody.innerHTML = "";
      document.getElementById("schedSummary").innerHTML = "";
      return;
    }

    var et = SG.state.sagToEspn && SG.state.sagToEspn[name];
    var games = SG.gamesForTeam(name);
    if (!et || !games.length) {
      note.textContent = "No ESPN schedule found for " + name + ".";
      tbody.innerHTML = "";
      document.getElementById("schedSummary").innerHTML = "";
      return;
    }

    var edge = SG.homeEdge(method);
    var columns = [
      { key: "date", label: "Date", cls: "left", type: "str" },
      { key: "site", label: "Site", cls: "left", type: "str" },
      { key: "opp", label: "Opponent", cls: "left", type: "str" },
      { key: "result", label: "Result", cls: "left", type: "str", cell: function (r) { return r.result; } },
      { key: "oppRating", label: "Opp RATING" },
      { key: "margin", label: "Proj margin" },
      { key: "winPct", label: "Win%", cell: function (r) { return r.winPct === null || r.winPct === undefined ? "" : (r.winPct * 100).toFixed(0) + "%"; } },
      { key: "pick", label: "Projected", cls: "left", type: "str", cell: function (r) { return r.pick; } }
    ];

    var rows = [];
    var remaining = 0;
    var projWins = 0;
    var id = String(et.id);

    games.forEach(function (g) {
      var isHome = String(g.homeId) === id;
      var oppId = isHome ? g.awayId : g.homeId;
      var oppTeam = SG.espnTeamById(oppId);
      var oppSag = SG.state.espnIdToSag[oppId];
      var neutral = !!g.neutral;

      var row = {
        date: fmtDate(g.date),
        site: neutral ? "Neutral" : (isHome ? "vs" : "@"),
        opp: oppTeam ? oppTeam.displayName : oppId,
        result: "",
        oppRating: oppSag ? SG.fmt(oppSag[method]) : "nr",
        margin: ".",
        winPct: null,
        pick: ""
      };

      if (g.completed && g.homeScore !== null && g.awayScore !== null) {
        var mine = isHome ? g.homeScore : g.awayScore;
        var theirs = isHome ? g.awayScore : g.homeScore;
        var won = mine > theirs;
        row.result = '<span class="' + (won ? "win" : "loss") + '">' + (won ? "W" : "L") + " " + mine + "-" + theirs + "</span>";
      } else if (oppSag && teamSag) {
        var spread = teamSag[method] - oppSag[method] + (neutral ? 0 : (isHome ? edge : -edge));
        var wp = SG.normCdf(spread / SG.SIGMA);
        row.margin = (spread >= 0 ? "+" : "-") + SG.fmt(Math.abs(spread), 1);
        row.winPct = wp;
        row.pick = '<span class="' + (wp >= 0.5 ? "win" : "loss") + '">' + SG.esc(wp >= 0.5 ? name : (oppSag ? oppSag.team : row.opp)) + "</span>";
        remaining++;
        if (wp >= 0.5) projWins++;
      } else {
        row.pick = '<span class="dim">no rating</span>';
      }

      rows.push(row);
    });

    SG.buildHead(document.getElementById("schedTable"), columns, { key: "", dir: 1 }, function () {});
    SG.fillBody(document.getElementById("schedTable"), columns, rows);

    note.textContent =
      "Home edge for " + SG.methodLabel(method) + " is " + SG.fmt(edge) +
      " points. Schedule from ESPN, refreshed weekly. Opponents not rated by Sagarin show nr.";

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

  var searchTimer = null;

  function refreshAndLoad() {
    fillSelect();
    load();
  }

  function onSearch() {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(refreshAndLoad, 120);
  }

  function init() {
    fillConfFilter();
    fillSelect();
    document.getElementById("schedSearch").addEventListener("input", onSearch);
    document.getElementById("schedConf").addEventListener("change", refreshAndLoad);
    document.getElementById("schedTeam").addEventListener("change", function () { load(); });
    document.getElementById("schedMethod").addEventListener("change", function () { load(); });
    document.getElementById("schedReload").addEventListener("click", function () { load(); });
    load();
  }

  SG.state.modules.schedule = { init: init, render: function () { fillConfFilter(); fillSelect(); load(); } };
})();
