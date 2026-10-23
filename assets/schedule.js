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

  function filteredTeams() {
    var q = (document.getElementById("schedSearch").value || "").trim().toLowerCase();
    var conf = document.getElementById("schedConf").value || "";
    return availableTeams().filter(function (t) {
      if (conf && t.conference !== conf) return false;
      if (q && t.team.toLowerCase().indexOf(q) === -1 && t.conference.toLowerCase().indexOf(q) === -1) return false;
      return true;
    }).sort(function (a, b) { return a.rank - b.rank; });
  }

  var activeIndex = -1;
  var schedSort = { key: "date", dir: 1 };
  var confSort = { key: "pos", dir: 1 };
  var schedMode = "team";

  function listEl() { return document.getElementById("schedTeamList"); }

  function openList() {
    var list = listEl();
    var input = document.getElementById("schedSearch");
    if (!list) return;
    list.classList.remove("hidden");
    if (input) input.setAttribute("aria-expanded", "true");
  }

  function closeList() {
    var list = listEl();
    var input = document.getElementById("schedSearch");
    if (!list) return;
    list.classList.add("hidden");
    if (input) input.setAttribute("aria-expanded", "false");
  }

  function renderList(show) {
    var list = listEl();
    if (!list || !SG.state.data) return;
    var teams = filteredTeams();
    if (!teams.length) {
      list.innerHTML = '<div class="combo-empty">No teams match</div>';
    } else {
      list.innerHTML = teams.map(function (t) {
        return '<div class="combo-item" role="option" data-name="' + SG.esc(t.team) + '">' +
          '<span class="ci-name">' + SG.esc(t.team) + '</span>' +
          '<span class="ci-meta">' + SG.esc(t.conference) + " " + SG.fmt(t.rating) + "</span></div>";
      }).join("");
    }
    activeIndex = -1;
    if (show) openList(); else closeList();
  }

  function pick(name) {
    document.getElementById("schedSearch").value = name;
    closeList();
    load();
  }

  function currentName() {
    if (!SG.state.data) return "";
    var v = (document.getElementById("schedSearch").value || "").trim().toLowerCase();
    if (!v) return "";
    var hit = SG.state.data.teams.filter(function (t) { return t.team.toLowerCase() === v; })[0];
    if (!hit) return "";
    var inList = filteredTeams().filter(function (t) { return t.team === hit.team; }).length;
    return inList ? hit.team : "";
  }

  function fmtDate(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  function load() {
    if (!SG.state.data) return;
    var note = document.getElementById("schedNote");
    var name = currentName();
    var method = document.getElementById("schedMethod").value;
    var tbody = document.getElementById("schedTable").tBodies[0];
    var teamSag = SG.teamByName(name);

    if (!name || !teamSag) {
      note.textContent = "Type a team name to project its remaining games.";
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
      { key: "date", label: "Date", cls: "left", type: "str", cell: function (r) { return SG.esc(r.date); }, value: function (r) { return r.dateRaw; } },
      { key: "site", label: "Site", cls: "left", type: "str", cell: function (r) { return SG.esc(r.site); } },
      { key: "opp", label: "Opponent", cls: "left", type: "str", cell: function (r) { return (r.oppName ? SG.teamLogo(r.oppName) : "") + SG.esc(r.opp) + (r.oppName ? SG.apBadge(r.oppName) : ""); }, value: function (r) { return r.oppName || r.opp; } },
      { key: "result", label: "Result", cls: "left", type: "str", cell: function (r) { return r.result; }, value: function (r) { return r.resultText; } },
      { key: "oppRating", label: "Opp RATING", cell: function (r) { return SG.esc(r.oppRating); }, value: function (r) { return r.oppRatingVal; } },
      { key: "margin", label: "Proj margin", cell: function (r) { return SG.esc(r.margin); }, value: function (r) { return r.marginVal; } },
      { key: "winPct", label: "Win%", cell: function (r) { return r.winPct === null || r.winPct === undefined ? "" : (r.winPct * 100).toFixed(0) + "%"; }, value: function (r) { return r.winPct === null || r.winPct === undefined ? -1 : r.winPct; } },
      { key: "pick", label: "Projected", cls: "left", type: "str", cell: function (r) { return r.pick; }, value: function (r) { return r.pickText; } }
    ];

    var rows = [];
    var remaining = 0;
    var projWins = 0;
    var projConfWins = 0;
    var projConfLosses = 0;
    var id = String(et.id);
    var confKey = {};
    SG.state.data.teams.forEach(function (t) { confKey[t.team] = SG.mergeConf ? SG.mergeConf(t.conference) : t.conference; });
    var myConf = confKey[name];

    games.forEach(function (g) {
      var isHome = String(g.homeId) === id;
      var oppId = isHome ? g.awayId : g.homeId;
      var oppTeam = SG.espnTeamById(oppId);
      var oppSag = SG.state.espnIdToSag[oppId];
      var neutral = !!g.neutral;
      var oppConf = oppSag ? confKey[oppSag.team] : null;
      var isConfGame = oppConf && oppConf === myConf && myConf !== "I-A IND.";

      var row = {
        date: fmtDate(g.date),
        dateRaw: g.date,
        site: neutral ? "Neutral" : (isHome ? "vs" : "@"),
        opp: oppTeam ? oppTeam.displayName : oppId,
        oppName: oppSag ? oppSag.team : "",
        result: "",
        resultText: "",
        oppRating: oppSag ? SG.fmt(oppSag[method]) : "nr",
        oppRatingVal: oppSag ? oppSag[method] : -Infinity,
        margin: ".",
        marginVal: -Infinity,
        winPct: null,
        pick: "",
        pickText: ""
      };

      if (g.completed && g.homeScore !== null && g.awayScore !== null) {
        var mine = isHome ? g.homeScore : g.awayScore;
        var theirs = isHome ? g.awayScore : g.homeScore;
        var won = mine > theirs;
        row.result = '<span class="' + (won ? "win" : "loss") + '">' + (won ? "W" : "L") + " " + mine + "-" + theirs + "</span>";
        row.resultText = (won ? "W " : "L ") + mine + "-" + theirs;
      } else if (oppSag && teamSag) {
        var spread = teamSag[method] - oppSag[method] + (neutral ? 0 : (isHome ? edge : -edge));
        var wp = SG.normCdf(spread / SG.SIGMA);
        row.margin = (spread >= 0 ? "+" : "-") + SG.fmt(Math.abs(spread), 1);
        row.marginVal = spread;
        row.winPct = wp;
        row.pickText = wp >= 0.5 ? name : (oppSag ? oppSag.team : row.opp);
        row.pick = '<span class="' + (wp >= 0.5 ? "win" : "loss") + '">' + SG.esc(row.pickText) + "</span>";
        remaining++;
        if (wp >= 0.5) projWins++;
        if (isConfGame) {
          if (wp >= 0.5) projConfWins++;
          else projConfLosses++;
        }
      } else {
        row.pick = '<span class="dim">no rating</span>';
      }

      rows.push(row);
    });

    var schedTable = document.getElementById("schedTable");
    SG.buildHead(schedTable, columns, schedSort, function (key) {
      SG.toggleSort(schedSort, key, columns);
      load();
    });
    SG.fillBody(schedTable, columns, SG.sortRows(rows, columns, schedSort));

    note.textContent =
      "Home edge for " + SG.methodLabel(method) + " is " + SG.fmt(edge) +
      " points. Schedule from ESPN, refreshed weekly. Opponents not rated by Sagarin show nr.";

    var rec = SG.recWithConf(teamSag);
    var projOverallW = SG.espnW(teamSag) + projWins;
    var projOverallL = SG.espnL(teamSag) + (remaining - projWins);
    var projConfW = SG.espnConfW(teamSag) + projConfWins;
    var projConfL = SG.espnConfL(teamSag) + projConfLosses;
    var projFinal = SG.rec(projOverallW, projOverallL);
    if (projConfW > 0 || projConfL > 0) {
      projFinal += " (" + SG.rec(projConfW, projConfL) + ")";
    }
    document.getElementById("schedSummary").innerHTML =
      chip("Team", name) +
      chip("Rating", SG.fmt(teamSag[method])) +
      chip("Current record", rec) +
      chip("Games left", String(remaining)) +
      chip("Projected wins left", String(projWins)) +
      chip("Projected final", projFinal);
  }

  function chip(k, v) {
    return '<div class="chip"><span class="k">' + SG.esc(k) + '</span><span class="v">' + SG.esc(v) + "</span></div>";
  }

  function fbsTeams() {
    return SG.state.data.teams.filter(function (t) { return t.level === "A"; });
  }

  function confName(c) {
    return SG.mergeConf ? SG.mergeConf(c) : c;
  }

  function fillConfPick() {
    var sel = document.getElementById("schedConfPick");
    if (!sel || !SG.state.data) return;
    var cur = sel.value;
    var have = {};
    fbsTeams().forEach(function (t) {
      var c = confName(t.conference);
      if (c && c !== "I-A IND.") have[c] = true;
    });
    var names = [];
    SG.state.data.conferences.forEach(function (c) {
      var m = confName(c.name);
      if (have[m] && names.indexOf(m) === -1) names.push(m);
    });
    Object.keys(have).forEach(function (c) { if (names.indexOf(c) === -1) names.push(c); });
    sel.innerHTML = names.map(function (n) {
      return '<option value="' + SG.esc(n) + '">' + SG.esc(n) + "</option>";
    }).join("");
    if (cur && names.indexOf(cur) !== -1) sel.value = cur;
  }

  function recVal(w, l) {
    var tot = w + l;
    return tot ? w / tot : -1;
  }

  function renderConference() {
    var note = document.getElementById("schedConfNote");
    var summary = document.getElementById("schedConfSummary");
    var table = document.getElementById("schedConfTable");
    var tbody = table.tBodies[0];
    if (!SG.state.data) return;
    var conf = document.getElementById("schedConfPick").value;
    var method = document.getElementById("schedMethod").value;
    if (!conf) {
      note.textContent = "Pick a conference.";
      summary.innerHTML = "";
      tbody.innerHTML = "";
      return;
    }
    if (!SG.projectedStandings) {
      note.textContent = "The projection engine is not available yet.";
      summary.innerHTML = "";
      tbody.innerHTML = "";
      return;
    }

    var st = SG.projectedStandings(method);
    var list = (st.order && st.order[conf]) || [];
    if (!list.length) {
      note.textContent = "No teams found for " + conf + ".";
      summary.innerHTML = "";
      tbody.innerHTML = "";
      return;
    }
    var ccg = st.ccgs && st.ccgs[conf];

    var columns = [
      { key: "pos", label: "#", cell: function (r) { return String(r.pos); }, value: function (r) { return r.pos; } },
      { key: "team", label: "Team", cls: "left", type: "str", cell: function (r) { return SG.teamLogo(r.team) + SG.esc(r.team) + SG.apBadge(r.team); }, value: function (r) { return r.team; } },
      { key: "rating", label: "Rating", cell: function (r) { return SG.esc(r.rating); }, value: function (r) { return r.ratingVal; } },
      { key: "current", label: "Current", cell: function (r) { return r.current; }, value: function (r) { return r.currentVal; } },
      { key: "overall", label: "Projected", cell: function (r) { return r.overall; }, value: function (r) { return r.overallVal; } },
      { key: "title", label: "Title game", cls: "left", type: "str", cell: function (r) { return r.title; }, value: function (r) { return r.titleText; } }
    ];

    var rows = list.map(function (t, i) {
      var fin = st.final[t.team] || { cw: 0, cl: 0, ow: 0, ol: 0 };
      var titleText = "", titleHtml = "";
      if (ccg && ccg.winner.team === t.team) { titleText = "Champion"; titleHtml = '<span class="win">Champion</span>'; }
      else if (ccg && ccg.loser.team === t.team) { titleText = "Runner-up"; titleHtml = '<span class="dim">Runner-up</span>'; }
      // Current: ESPN overall (conf)
      var curW = SG.espnW(t), curL = SG.espnL(t);
      var curCW = SG.espnConfW(t), curCL = SG.espnConfL(t);
      var current = SG.esc(SG.rec(curW, curL) + (curCW > 0 || curCL > 0 ? " (" + SG.rec(curCW, curCL) + ")" : ""));
      // Projected: final overall with projected conference record in parentheses
      var projCW = fin.cw, projCL = fin.cl;
      var projOW = fin.ow, projOL = fin.ol;
      var overall = SG.esc(SG.rec(projOW, projOL) + (projCW > 0 || projCL > 0 ? " (" + SG.rec(projCW, projCL) + ")" : ""));
      return {
        pos: i + 1,
        team: t.team,
        rating: SG.fmt(t[method]),
        ratingVal: t[method],
        current: current,
        currentVal: recVal(curW, curL),
        overall: overall,
        overallVal: recVal(projOW, projOL),
        title: titleHtml,
        titleText: titleText
      };
    });

    SG.buildHead(table, columns, confSort, function (key) {
      SG.toggleSort(confSort, key, columns);
      renderConference();
    });
    SG.fillBody(table, columns, SG.sortRows(rows, columns, confSort));

    note.textContent =
      "Projected with " + SG.methodLabel(method) + ". Played games use the real result and the rest are predicted. " +
      "The projected conference title game is folded into the projected conference and overall records. " +
      "Only FBS teams are shown because there is not enough data to project FCS conferences.";

    summary.innerHTML =
      chip("Conference", conf) +
      chip("Method", SG.methodLabel(method)) +
      (ccg ? chip("Projected champion", ccg.winner.team) + chip("Title game", ccg.matchup.b.team + " vs " + ccg.matchup.a.team) : "");
  }

  function setMode(m) {
    schedMode = m;
    var segs = document.querySelectorAll("#schedMode .seg");
    for (var i = 0; i < segs.length; i++) {
      segs[i].classList.toggle("active", segs[i].dataset.mode === m);
    }
    var teamView = document.getElementById("schedTeamView");
    var confView = document.getElementById("schedConfView");
    if (m === "conference") {
      teamView.classList.add("hidden");
      confView.classList.remove("hidden");
      renderConference();
    } else {
      confView.classList.add("hidden");
      teamView.classList.remove("hidden");
      if (currentName()) load();
    }
  }

  var searchTimer = null;

  function items() {
    var list = listEl();
    return list ? list.querySelectorAll(".combo-item") : [];
  }

  function setActive(i) {
    var arr = items();
    if (!arr.length) return;
    if (i < 0) i = arr.length - 1;
    if (i >= arr.length) i = 0;
    activeIndex = i;
    for (var k = 0; k < arr.length; k++) arr[k].classList.toggle("active", k === activeIndex);
    if (arr[activeIndex].scrollIntoView) arr[activeIndex].scrollIntoView({ block: "nearest" });
  }

  function onInput() {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(function () {
      renderList(true);
      if (currentName()) load();
    }, 120);
  }

  function onKeyDown(e) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (listEl().classList.contains("hidden")) renderList(true);
      setActive(activeIndex + 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive(activeIndex - 1);
    } else if (e.key === "Enter") {
      var arr = items();
      if (activeIndex >= 0 && arr[activeIndex]) { e.preventDefault(); pick(arr[activeIndex].dataset.name); }
      else if (currentName()) { closeList(); load(); }
    } else if (e.key === "Escape") {
      closeList();
    }
  }

  function onDocClick(e) {
    var combo = document.querySelector("#tab-schedule .combo");
    if (combo && !combo.contains(e.target)) closeList();
  }

  function init() {
    fillConfFilter();
    fillConfPick();
    renderList(false);
    var input = document.getElementById("schedSearch");
    var list = listEl();
    input.addEventListener("input", onInput);
    input.addEventListener("focus", function () { renderList(true); });
    input.addEventListener("keydown", onKeyDown);
    list.addEventListener("click", function (e) {
      var item = e.target.closest ? e.target.closest(".combo-item") : null;
      if (item) pick(item.dataset.name);
    });
    document.getElementById("schedConf").addEventListener("change", function () {
      renderList(!listEl().classList.contains("hidden"));
      if (currentName()) load();
    });
    document.getElementById("schedMode").addEventListener("click", function (e) {
      var b = e.target.closest ? e.target.closest(".seg") : null;
      if (b && b.dataset.mode) setMode(b.dataset.mode);
    });
    document.getElementById("schedConfPick").addEventListener("change", renderConference);
    document.getElementById("schedMethod").addEventListener("change", function () {
      if (schedMode === "conference") renderConference(); else load();
    });
    document.getElementById("schedReload").addEventListener("click", function () { if (currentName()) load(); });
    document.addEventListener("click", onDocClick);
    if (currentName()) load();
  }

  SG.state.modules.schedule = {
    init: init,
    render: function () {
      fillConfFilter();
      fillConfPick();
      renderList(false);
      if (schedMode === "conference") renderConference();
      else if (currentName()) load();
    }
  };
})();
