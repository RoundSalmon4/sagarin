/* Sagarin explorer core: shared state, helpers, theme, data loading, tabs and
   the teams, conferences and matchup views. Feature modules hang off window.SG. */
(function () {
  "use strict";

  var SG = {};
  window.SG = SG;

  SG.DATA_URL = "data/ratings.json";
  SG.POLL_MS = 10 * 60 * 1000;
  SG.SIGMA = 15.5;
  SG.ESPN_BASE = "https://site.web.api.espn.com/apis/site/v2/sports/football/college-football";

  SG.state = {
    data: null,
    teamSort: { key: "rank", dir: 1 },
    confMetric: "rating",
    confSort: null,
    teamSearch: "",
    confFilter: "",
    modules: {}
  };

  // -------------------------------------------------------------- helpers

  SG.$ = function (sel, root) { return (root || document).querySelector(sel); };
  SG.$$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  SG.esc = function (v) {
    return String(v)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  };

  SG.fmt = function (v, digits) {
    if (v === null || v === undefined || isNaN(v)) return "-";
    return Number(v).toFixed(digits === undefined ? 2 : digits);
  };

  SG.pct = function (w, l) { var n = w + l; return n ? w / n : 0; };
  SG.rec = function (w, l) { return w + "-" + l; };

  SG.erf = function (x) {
    var s = x < 0 ? -1 : 1;
    x = Math.abs(x);
    var t = 1 / (1 + 0.3275911 * x);
    var y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
    return s * y;
  };
  SG.normCdf = function (z) { return 0.5 * (1 + SG.erf(z / Math.SQRT2)); };

  SG.normalizeName = function (s) {
    return String(s)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[.'&]/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  };

  SG.teamByName = function (name) {
    if (!SG.state.data) return null;
    var teams = SG.state.data.teams;
    for (var i = 0; i < teams.length; i++) if (teams[i].team === name) return teams[i];
    return null;
  };

  SG.methodLabel = function (m) {
    return {
      rating: "overall RATING",
      predictor: "PREDICTOR",
      goldenMean: "GOLDEN_MEAN",
      recent: "RECENT",
      strongRecent: "STRONG_RECENT"
    }[m];
  };

  SG.homeEdge = function (method) {
    var h = SG.state.data && SG.state.data.meta.homeAdvantage;
    return h ? h[method] : 0;
  };

  // -------------------------------------------------------------- table engine

  SG.colValue = function (row, col) {
    if (col.value) return col.value(row);
    return row[col.key];
  };

  SG.toggleSort = function (sort, key, columns) {
    var col = columns.filter(function (c) { return c.key === key; })[0] || {};
    if (sort.key === key) {
      sort.dir = -sort.dir;
    } else {
      sort.key = key;
      sort.dir = (col.type === "str") ? 1 : -1;
    }
  };

  SG.sortRows = function (rows, columns, sort) {
    var col = columns.filter(function (c) { return c.key === sort.key; })[0] || columns[0];
    var dir = sort.dir;
    var type = col.type || "num";
    return rows.slice().sort(function (a, b) {
      var va = SG.colValue(a, col);
      var vb = SG.colValue(b, col);
      if (type === "str") return String(va).localeCompare(String(vb)) * dir;
      va = (va === null || va === undefined) ? -Infinity : va;
      vb = (vb === null || vb === undefined) ? -Infinity : vb;
      if (va === vb) return 0;
      return (va - vb) * dir;
    });
  };

  SG.buildHead = function (table, columns, sort, onSort) {
    var thead = table.tHead;
    thead.innerHTML = "";
    var tr = document.createElement("tr");
    columns.forEach(function (col) {
      var th = document.createElement("th");
      th.textContent = col.label;
      if (col.cls) th.className = col.cls;
      if (col.strong) th.style.color = "var(--accent)";
      if (sort && sort.key === col.key) {
        var a = document.createElement("span");
        a.className = "arrow";
        a.textContent = sort.dir > 0 ? "\u25B2" : "\u25BC";
        th.appendChild(a);
      }
      th.addEventListener("click", function () { onSort(col.key); });
      tr.appendChild(th);
    });
    thead.appendChild(tr);
  };

  SG.fillBody = function (table, columns, rows) {
    var tbody = table.tBodies[0];
    var html = "";
    rows.forEach(function (row) {
      html += "<tr>";
      columns.forEach(function (col) {
        var cls = col.cls ? ' class="' + col.cls + '"' : "";
        var val = col.cell ? col.cell(row) : SG.esc(SG.colValue(row, col));
        html += "<td" + cls + ">" + val + "</td>";
      });
      html += "</tr>";
    });
    tbody.innerHTML = html;
  };

  SG.renderDataTable = function (tableId, columns, rows, sort) {
    SG.fillBody(document.getElementById(tableId), columns, rows);
  };

  // -------------------------------------------------------------- theme

  SG.applyTheme = function (theme) {
    document.documentElement.setAttribute("data-theme", theme);
    var btn = SG.$("#themeBtn");
    if (btn) {
      btn.textContent = theme === "dark" ? "Light mode" : "Dark mode";
      btn.setAttribute("aria-pressed", theme === "dark" ? "true" : "false");
    }
  };

  SG.initTheme = function () {
    var saved = null;
    try { saved = localStorage.getItem("sagarin-theme"); } catch (e) { saved = null; }
    if (!saved) {
      saved = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    SG.applyTheme(saved);
    var btn = SG.$("#themeBtn");
    if (btn) {
      btn.addEventListener("click", function () {
        var next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
        SG.applyTheme(next);
        try { localStorage.setItem("sagarin-theme", next); } catch (e) {}
      });
    }
  };

  // -------------------------------------------------------------- teams

  var TEAM_COLUMNS = [
    { key: "rank", label: "#", cls: "left" },
    { key: "team", label: "Team", cls: "left", type: "str", cell: teamCell },
    { key: "conference", label: "Conference", cls: "left", type: "str" },
    { key: "w", label: "W" },
    { key: "l", label: "L" },
    { key: "pct", label: "Pct", value: function (t) { return SG.pct(t.w, t.l); }, cell: function (t) { return SG.pct(t.w, t.l).toFixed(3).replace(/^0/, ""); } },
    { key: "rating", label: "RATING", strong: true },
    { key: "predictor", label: "PREDICTOR" },
    { key: "goldenMean", label: "GOLDEN_MEAN" },
    { key: "recent", label: "RECENT" },
    { key: "strongRecent", label: "STRONG_RECENT" },
    { key: "sched", label: "Schedule" },
    { key: "schedRank", label: "Sched Rk" },
    { key: "vs10", label: "vs Top 10", type: "num", value: function (t) { return t.vs10w; }, cell: function (t) { return SG.rec(t.vs10w, t.vs10l); } },
    { key: "vs30", label: "vs Top 30", type: "num", value: function (t) { return t.vs30w; }, cell: function (t) { return SG.rec(t.vs30w, t.vs30l); } }
  ];

  function teamCell(t) {
    var badge = t.level === "AA" ? '<span class="level-badge aa">AA</span>' : '<span class="level-badge">A</span>';
    return '<span class="team-cell">' + SG.esc(t.team) + "</span>" + badge;
  }

  SG.renderTeams = function () {
    if (!SG.state.data) return;
    var table = document.getElementById("teamsTable");
    var teams = SG.state.data.teams;
    var q = SG.state.teamSearch.trim().toLowerCase();
    var filtered = teams.filter(function (t) {
      if (SG.state.confFilter && t.conference !== SG.state.confFilter) return false;
      if (!q) return true;
      return t.team.toLowerCase().indexOf(q) !== -1 || t.conference.toLowerCase().indexOf(q) !== -1;
    });
    var sorted = SG.sortRows(filtered, TEAM_COLUMNS, SG.state.teamSort);
    SG.buildHead(table, TEAM_COLUMNS, SG.state.teamSort, function (key) {
      SG.toggleSort(SG.state.teamSort, key, TEAM_COLUMNS);
      SG.renderTeams();
    });
    SG.fillBody(table, TEAM_COLUMNS, sorted);
    document.getElementById("teamCount").textContent = filtered.length + " of " + teams.length + " teams";
  };

  // -------------------------------------------------------------- conferences

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

  function confRank(c) { return SG.state.confMetric === "win50" ? c.win50Rank : c.rank; }
  function confRankKey() { return SG.state.confMetric === "win50" ? "win50" : "rating"; }

  SG.renderConferences = function () {
    if (!SG.state.data) return;
    var table = document.getElementById("confTable");
    if (!SG.state.confSort) SG.state.confSort = { key: confRankKey(), dir: -1 };
    var sorted = SG.sortRows(SG.state.data.conferences, CONF_COLUMNS, SG.state.confSort);
    SG.buildHead(table, CONF_COLUMNS, SG.state.confSort, function (key) {
      SG.toggleSort(SG.state.confSort, key, CONF_COLUMNS);
      SG.renderConferences();
    });
    SG.fillBody(table, CONF_COLUMNS, sorted);
  };

  // -------------------------------------------------------------- matchup

  SG.fillTeamSelects = function () {
    if (!SG.state.data) return;
    var teams = SG.state.data.teams.slice().sort(function (a, b) { return a.team.localeCompare(b.team); });
    var html = teams.map(function (t) {
      return '<option value="' + SG.esc(t.team) + '">' + SG.esc(t.team) + " (" + SG.fmt(t.rating) + ")</option>";
    }).join("");
    var a = document.getElementById("teamA");
    var b = document.getElementById("teamB");
    if (!a || !b) return;
    a.innerHTML = html;
    b.innerHTML = html;
    var ranked = SG.state.data.teams.slice().sort(function (x, y) { return x.rank - y.rank; });
    if (ranked[0]) a.value = ranked[0].team;
    if (ranked[1]) b.value = ranked[1].team;
  };

  SG.renderMatchup = function () {
    if (!SG.state.data) return;
    var a = SG.teamByName(document.getElementById("teamA").value);
    var b = SG.teamByName(document.getElementById("teamB").value);
    var method = document.getElementById("methodSelect").value;
    if (!a || !b) return;
    var ra = a[method];
    var rb = b[method];
    var edge = SG.homeEdge(method);
    var diff = ra - rb;
    var scenarios = [
      { title: "Neutral site", spread: diff },
      { title: a.team + " at home", spread: diff + edge },
      { title: b.team + " at home", spread: diff - edge }
    ];
    document.getElementById("matchupResult").innerHTML = scenarios.map(function (s) {
      var favIsA = s.spread >= 0;
      var fav = favIsA ? a : b;
      var probA = SG.normCdf(s.spread / SG.SIGMA);
      return '<div class="match-card">' +
        "<h3>" + SG.esc(s.title) + "</h3>" +
        '<div class="fav">' + SG.esc(fav.team) + " favored</div>" +
        '<div class="margin">' + (favIsA ? "+" : "-") + SG.fmt(Math.abs(s.spread), 1) + "</div>" +
        '<div class="prob">Win chance: ' + SG.esc(a.team) + " " + pctText(probA) + " / " + SG.esc(b.team) + " " + pctText(1 - probA) + "</div>" +
        "</div>";
    }).join("");
    document.getElementById("matchupNote").textContent =
      "Using " + SG.methodLabel(method) + ". Home edge for this rating is " + SG.fmt(edge) +
      " points, per the source page. Win chance uses a normal model with a standard deviation of " + SG.SIGMA + " points.";
  };

  function pctText(p) { return (p * 100).toFixed(0) + "%"; }

  // -------------------------------------------------------------- tabs + modules

  SG.ensureModule = function (name) {
    var mod = SG.state.modules[name];
    if (!mod || !SG.state.data) return;
    if (!mod._inited) {
      if (mod.init) mod.init();
      mod._inited = true;
    } else if (mod.render) {
      mod.render();
    }
  };

  SG.refreshModules = function () {
    Object.keys(SG.state.modules).forEach(function (name) {
      var mod = SG.state.modules[name];
      if (mod._inited && mod.render) mod.render();
    });
  };

  SG.switchTab = function (name) {
    SG.$$(".tab").forEach(function (t) { t.classList.toggle("active", t.dataset.tab === name); });
    SG.$$(".panel").forEach(function (p) { p.classList.toggle("hidden", p.id !== "tab-" + name); });
    SG.ensureModule(name);
  };

  // -------------------------------------------------------------- status + data

  SG.renderStatus = function (updated) {
    if (!SG.state.data) return;
    var m = SG.state.data.meta;
    var when = new Date(SG.state.data.fetched_at);
    var stamp = isNaN(when.getTime()) ? "" : when.toLocaleString();
    document.getElementById("dataStatus").textContent =
      (m.season ? m.season + " season, " : "") + "Week " + m.week + " (through " + m.through + ")" +
      (stamp ? ", data pulled " + stamp : "") + (updated ? " - updated" : "");
    document.getElementById("sourceLine").textContent =
      "Source: " + SG.state.data.source + " (signature " + SG.state.data.signature + ")";
  };

  function loadJson() {
    return fetch(SG.DATA_URL, { cache: "no-store" }).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    });
  }

  SG.poll = function (manual) {
    var btn = document.getElementById("refreshBtn");
    if (manual) { btn.disabled = true; btn.textContent = "Checking..."; }
    return loadJson().then(function (json) {
      if (!SG.state.data || json.signature !== SG.state.data.signature) {
        var changed = !!SG.state.data;
        SG.state.data = json;
        SG.state.confSort = null;
        SG.state.teams = json.teams;
        SG.populateConfFilter();
        SG.fillTeamSelects();
        SG.renderTeams();
        SG.renderConferences();
        SG.renderMatchup();
        SG.refreshModules();
        SG.renderStatus(changed);
      } else if (manual) {
        document.getElementById("dataStatus").textContent += " - no changes";
      }
    }).catch(function (err) {
      document.getElementById("dataStatus").textContent =
        "Could not load ratings data (" + err.message + "). Serve the folder over HTTP.";
    }).then(function () {
      if (manual) { btn.disabled = false; btn.textContent = "Check for updates"; }
    });
  };

  SG.populateConfFilter = function () {
    if (!SG.state.data) return;
    var sel = document.getElementById("confFilter");
    if (!sel) return;
    sel.innerHTML = '<option value="">All conferences</option>';
    var seen = {};
    SG.state.data.conferences.forEach(function (c) {
      if (!seen[c.name]) {
        seen[c.name] = true;
        var o = document.createElement("option");
        o.value = c.name;
        o.textContent = c.name;
        sel.appendChild(o);
      }
    });
  };

  // -------------------------------------------------------------- init

  function init() {
    SG.initTheme();

    loadJson().then(function (json) {
      SG.state.data = json;
      SG.populateConfFilter();
      SG.fillTeamSelects();
      SG.renderTeams();
      SG.renderConferences();
      SG.renderMatchup();
      SG.renderStatus(false);
      setInterval(function () { SG.poll(false); }, SG.POLL_MS);
      document.addEventListener("visibilitychange", function () { if (!document.hidden) SG.poll(false); });
    }).catch(function (err) {
      document.getElementById("dataStatus").textContent =
        "Could not load ratings data (" + err.message + "). Serve the folder over HTTP.";
    });

    SG.$$(".tab").forEach(function (t) {
      t.addEventListener("click", function () { SG.switchTab(t.dataset.tab); });
    });

    document.getElementById("refreshBtn").addEventListener("click", function () { SG.poll(true); });

    document.getElementById("teamSearch").addEventListener("input", function (e) {
      SG.state.teamSearch = e.target.value;
      SG.renderTeams();
    });
    document.getElementById("confFilter").addEventListener("change", function (e) {
      SG.state.confFilter = e.target.value;
      SG.renderTeams();
    });

    SG.$$("#confMetric .seg").forEach(function (seg) {
      seg.addEventListener("click", function () {
        SG.state.confMetric = seg.dataset.metric;
        SG.state.confSort = { key: confRankKey(), dir: -1 };
        SG.$$("#confMetric .seg").forEach(function (s) { s.classList.toggle("active", s === seg); });
        SG.renderConferences();
      });
    });

    document.getElementById("swapBtn").addEventListener("click", function () {
      var a = document.getElementById("teamA").value;
      document.getElementById("teamA").value = document.getElementById("teamB").value;
      document.getElementById("teamB").value = a;
      SG.renderMatchup();
    });
    document.getElementById("teamA").addEventListener("change", SG.renderMatchup);
    document.getElementById("teamB").addEventListener("change", SG.renderMatchup);
    document.getElementById("methodSelect").addEventListener("change", SG.renderMatchup);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
