/* Sagarin ratings explorer: sortable teams, conference views, head to head. */
(function () {
  "use strict";

  var DATA_URL = "data/ratings.json";
  var POLL_MS = 10 * 60 * 1000;
  var SIGMA = 15.5;

  var state = {
    data: null,
    teamSort: { key: "rank", dir: 1 },
    confMetric: "rating",
    confSort: null,
    teamSearch: "",
    confFilter: ""
  };

  // ---------------------------------------------------------------- helpers

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }

  function esc(v) {
    return String(v)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function fmt(v, digits) {
    if (v === null || v === undefined || isNaN(v)) return "-";
    return Number(v).toFixed(digits === undefined ? 2 : digits);
  }

  function pct(w, l) {
    var n = w + l;
    return n ? w / n : 0;
  }

  function rec(w, l) {
    return w + "-" + l;
  }

  // Abramowitz and Stegun 7.1.26, plenty accurate for a win estimate.
  function erf(x) {
    var s = x < 0 ? -1 : 1;
    x = Math.abs(x);
    var t = 1 / (1 + 0.3275911 * x);
    var y =
      1 -
      ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
        t *
        Math.exp(-x * x);
    return s * y;
  }

  function normCdf(z) {
    return 0.5 * (1 + erf(z / Math.SQRT2));
  }

  // ---------------------------------------------------------------- tables

  var TEAM_COLUMNS = [
    { key: "rank", label: "#", cls: "left" },
    { key: "team", label: "Team", cls: "left", type: "str", cell: teamCell },
    { key: "conference", label: "Conference", cls: "left", type: "str" },
    { key: "w", label: "W" },
    { key: "l", label: "L" },
    { key: "pct", label: "Pct", value: function (t) { return pct(t.w, t.l); }, cell: function (t) { return pct(t.w, t.l).toFixed(3).replace(/^0/, ""); } },
    { key: "rating", label: "RATING", strong: true },
    { key: "predictor", label: "PREDICTOR" },
    { key: "goldenMean", label: "GOLDEN_MEAN" },
    { key: "recent", label: "RECENT" },
    { key: "strongRecent", label: "STRONG_RECENT" },
    { key: "sched", label: "Schedule" },
    { key: "schedRank", label: "Sched Rk" },
    { key: "vs10", label: "vs Top 10", type: "num", value: function (t) { return t.vs10w; }, cell: function (t) { return rec(t.vs10w, t.vs10l); } },
    { key: "vs30", label: "vs Top 30", type: "num", value: function (t) { return t.vs30w; }, cell: function (t) { return rec(t.vs30w, t.vs30l); } }
  ];

  var CONF_COLUMNS = [
    { key: "rank", label: "#", cls: "left", value: confRank },
    { key: "name", label: "Conference", cls: "left", type: "str" },
    { key: "level", label: "Div", cls: "left", type: "str" },
    { key: "teams", label: "Teams" },
    { key: "centralMean", label: "Central Mean" },
    { key: "simpleAvg", label: "Simple Avg" },
    { key: "win50", label: "WIN50%", strong: true },
    { key: "rating", label: "RATING", strong: true },
    { key: "predictor", label: "PREDICTOR" },
    { key: "goldenMean", label: "GOLDEN_MEAN" },
    { key: "recent", label: "RECENT" },
    { key: "strongRecent", label: "STRONG_RECENT" }
  ];

  function teamCell(t) {
    var badge =
      t.level === "AA"
        ? '<span class="level-badge aa">AA</span>'
        : '<span class="level-badge">A</span>';
    return '<span class="team-cell">' + esc(t.team) + "</span>" + badge;
  }

  function confRank(c) {
    return state.confMetric === "win50" ? c.win50Rank : c.rank;
  }

  function colValue(row, col) {
    if (col.value) return col.value(row);
    return row[col.key];
  }

  function buildHead(table, columns, sort) {
    var thead = table.tHead;
    thead.innerHTML = "";
    var tr = document.createElement("tr");
    columns.forEach(function (col) {
      var th = document.createElement("th");
      th.textContent = col.label;
      if (col.cls) th.className = col.cls;
      if (col.strong) th.style.color = "#1f6feb";
      if (sort && sort.key === col.key) {
        var a = document.createElement("span");
        a.className = "arrow";
        a.textContent = sort.dir > 0 ? "\u25B2" : "\u25BC";
        th.appendChild(a);
      }
      th.addEventListener("click", function () {
        onSort(table.id, col.key);
      });
      tr.appendChild(th);
    });
    thead.appendChild(tr);
  }

  function renderTable(table, rows, columns, sort) {
    buildHead(table, columns, sort);
    var tbody = table.tBodies[0];
    var html = "";
    rows.forEach(function (row) {
      html += "<tr>";
      columns.forEach(function (col) {
        var cls = col.cls ? ' class="' + col.cls + '"' : "";
        var val = col.cell ? col.cell(row) : esc(colValue(row, col));
        if (col.key === "rank" && !col.cell) val = fmt(colValue(row, col), 0);
        html += "<td" + cls + ">" + val + "</td>";
      });
      html += "</tr>";
    });
    tbody.innerHTML = html;
  }

  function onSort(tableId, key) {
    if (tableId === "teamsTable") {
      toggleSort(state.teamSort, key);
      renderTeams();
    } else {
      if (!state.confSort) state.confSort = { key: confRankKey(), dir: -1 };
      toggleSort(state.confSort, key);
      renderConferences();
    }
  }

  function toggleSort(sort, key) {
    if (sort.key === key) {
      sort.dir = -sort.dir;
    } else {
      sort.key = key;
      sort.dir = key === "team" || key === "name" || key === "conference" || key === "level" ? 1 : -1;
    }
  }

  function sortRows(rows, columns, sort) {
    var col = columns.filter(function (c) { return c.key === sort.key; })[0] || columns[0];
    var dir = sort.dir;
    var type = col.type || "num";
    return rows.slice().sort(function (a, b) {
      var va = colValue(a, col);
      var vb = colValue(b, col);
      if (type === "str") {
        return String(va).localeCompare(String(vb)) * dir;
      }
      va = va === null || va === undefined ? -Infinity : va;
      vb = vb === null || vb === undefined ? -Infinity : vb;
      if (va === vb) return (a.rank || 0) - (b.rank || 0);
      return (va - vb) * dir;
    });
  }

  // ---------------------------------------------------------------- teams

  function renderTeams() {
    var table = $("#teamsTable");
    var teams = state.data.teams;
    var q = state.teamSearch.trim().toLowerCase();

    var filtered = teams.filter(function (t) {
      if (state.confFilter && t.conference !== state.confFilter) return false;
      if (!q) return true;
      return (
        t.team.toLowerCase().indexOf(q) !== -1 ||
        t.conference.toLowerCase().indexOf(q) !== -1
      );
    });

    var sorted = sortRows(filtered, TEAM_COLUMNS, state.teamSort);
    renderTable(table, sorted, TEAM_COLUMNS, state.teamSort);
    $("#teamCount").textContent = filtered.length + " of " + teams.length + " teams";
  }

  // ---------------------------------------------------------------- conferences

  function confRankKey() {
    return state.confMetric === "win50" ? "win50" : "rating";
  }

  function renderConferences() {
    var table = $("#confTable");
    if (!state.confSort) {
      state.confSort = { key: confRankKey(), dir: -1 };
    }
    var rows = state.data.conferences;
    var sorted = sortRows(rows, CONF_COLUMNS, state.confSort);
    renderTable(table, sorted, CONF_COLUMNS, state.confSort);
  }

  // ---------------------------------------------------------------- matchup

  function fillTeamSelects() {
    var teams = state.data.teams
      .slice()
      .sort(function (a, b) { return a.team.localeCompare(b.team); });
    var a = $("#teamA");
    var b = $("#teamB");
    var html = teams
      .map(function (t) {
        return '<option value="' + esc(t.team) + '">' + esc(t.team) + " (" + fmt(t.rating) + ")</option>";
      })
      .join("");
    a.innerHTML = html;
    b.innerHTML = html;

    var ranked = state.data.teams.slice().sort(function (x, y) { return x.rank - y.rank; });
    if (ranked[0]) a.value = ranked[0].team;
    if (ranked[1]) b.value = ranked[1].team;
  }

  function teamByName(name) {
    return state.data.teams.filter(function (t) { return t.team === name; })[0];
  }

  function renderMatchup() {
    var a = teamByName($("#teamA").value);
    var b = teamByName($("#teamB").value);
    var method = $("#methodSelect").value;
    if (!a || !b) {
      $("#matchupResult").innerHTML = "";
      return;
    }

    var ra = a[method];
    var rb = b[method];
    var edge = state.data.meta.homeAdvantage[method];
    var diff = ra - rb;

    var scenarios = [
      { title: "Neutral site", spread: diff },
      { title: a.team + " at home", spread: diff + edge },
      { title: b.team + " at home", spread: diff - edge }
    ];

    var html = scenarios.map(function (s) {
      return card(s, a, b);
    }).join("");
    $("#matchupResult").innerHTML = html;

    $("#matchupNote").textContent =
      "Using " + methodLabel(method) + ". Home edge for this rating is " + fmt(edge) +
      " points, per the source page. Win chance uses a normal model with a standard deviation of " + SIGMA + " points.";
  }

  function card(s, a, b) {
    var favIsA = s.spread >= 0;
    var fav = favIsA ? a : b;
    var margin = Math.abs(s.spread);
    var probA = normCdf(s.spread / SIGMA);
    var probB = 1 - probA;
    return (
      '<div class="match-card">' +
      "<h3>" + esc(s.title) + "</h3>" +
      '<div class="fav">' + esc(fav.team) + " favored</div>" +
      '<div class="margin">' + (favIsA ? "+" : "-") + fmt(margin, 1) + "</div>" +
      '<div class="prob">Win chance: ' + esc(a.team) + " " + pctText(probA) + " / " + esc(b.team) + " " + pctText(probB) + "</div>" +
      "</div>"
    );
  }

  function pctText(p) {
    return (p * 100).toFixed(0) + "%";
  }

  function methodLabel(m) {
    return {
      rating: "overall RATING",
      predictor: "PREDICTOR",
      goldenMean: "GOLDEN_MEAN",
      recent: "RECENT",
      strongRecent: "STRONG_RECENT"
    }[m];
  }

  // ---------------------------------------------------------------- chrome

  function renderStatus(updated) {
    var m = state.data.meta;
    var when = new Date(state.data.fetched_at);
    var stamp = isNaN(when.getTime()) ? "" : when.toLocaleString();
    $("#dataStatus").textContent =
      (m.season ? m.season + " season, " : "") +
      "Week " + m.week +
      " (through " + m.through + ")" +
      (stamp ? ", data pulled " + stamp : "");
    $("#sourceLine").textContent = "Source: " + state.data.source + " (signature " + state.data.signature + ")";
    if (updated) {
      $("#dataStatus").textContent += " - updated";
    }
  }

  function renderAll() {
    renderTeams();
    renderConferences();
    renderMatchup();
    renderStatus(false);
  }

  function populateConfFilter() {
    var sel = $("#confFilter");
    var seen = {};
    state.data.conferences.forEach(function (c) {
      if (!seen[c.name]) {
        seen[c.name] = true;
        var o = document.createElement("option");
        o.value = c.name;
        o.textContent = c.name;
        sel.appendChild(o);
      }
    });
  }

  function switchTab(name) {
    document.querySelectorAll(".tab").forEach(function (t) {
      t.classList.toggle("active", t.dataset.tab === name);
    });
    document.querySelectorAll(".panel").forEach(function (p) {
      p.classList.toggle("hidden", p.id !== "tab-" + name);
    });
  }

  // ---------------------------------------------------------------- data

  function loadJson() {
    return fetch(DATA_URL, { cache: "no-store" }).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    });
  }

  function poll(manual) {
    var btn = $("#refreshBtn");
    if (manual) {
      btn.disabled = true;
      btn.textContent = "Checking...";
    }
    return loadJson()
      .then(function (json) {
        if (!state.data || json.signature !== state.data.signature) {
          var changed = !!state.data;
          state.data = json;
          state.confSort = null;
          if (!document.querySelector("#teamA option")) {
            fillTeamSelects();
          } else {
            var a = $("#teamA").value;
            var b = $("#teamB").value;
            fillTeamSelects();
            if (teamByName(a)) $("#teamA").value = a;
            if (teamByName(b)) $("#teamB").value = b;
          }
          renderAll();
          if (changed) renderStatus(true);
        } else if (manual) {
          $("#dataStatus").textContent += " - no changes";
        }
      })
      .catch(function (err) {
        $("#dataStatus").textContent =
          "Could not load ratings data (" + err.message + "). Serve the folder over HTTP.";
      })
      .then(function () {
        if (manual) {
          btn.disabled = false;
          btn.textContent = "Check for updates";
        }
      });
  }

  // ---------------------------------------------------------------- init

  function init() {
    loadJson()
      .then(function (json) {
        state.data = json;
        fillTeamSelects();
        populateConfFilter();
        renderAll();
        setInterval(function () { poll(false); }, POLL_MS);
        document.addEventListener("visibilitychange", function () {
          if (!document.hidden) poll(false);
        });
      })
      .catch(function (err) {
        $("#dataStatus").textContent =
          "Could not load ratings data (" + err.message + "). Serve the folder over HTTP.";
      });

    document.querySelectorAll(".tab").forEach(function (t) {
      t.addEventListener("click", function () { switchTab(t.dataset.tab); });
    });

    $("#refreshBtn").addEventListener("click", function () { poll(true); });

    $("#teamSearch").addEventListener("input", function (e) {
      state.teamSearch = e.target.value;
      renderTeams();
    });

    $("#confFilter").addEventListener("change", function (e) {
      state.confFilter = e.target.value;
      renderTeams();
    });

    document.querySelectorAll("#confMetric .seg").forEach(function (seg) {
      seg.addEventListener("click", function () {
        state.confMetric = seg.dataset.metric;
        state.confSort = { key: confRankKey(), dir: -1 };
        document.querySelectorAll("#confMetric .seg").forEach(function (s) {
          s.classList.toggle("active", s === seg);
        });
        renderConferences();
      });
    });

    $("#swapBtn").addEventListener("click", function () {
      var a = $("#teamA").value;
      $("#teamA").value = $("#teamB").value;
      $("#teamB").value = a;
      renderMatchup();
    });

    $("#teamA").addEventListener("change", renderMatchup);
    $("#teamB").addEventListener("change", renderMatchup);
    $("#methodSelect").addEventListener("change", renderMatchup);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
