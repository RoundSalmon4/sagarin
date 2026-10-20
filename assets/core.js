/* Sagarin explorer core: shared state, helpers, theme, data loading, tabs and
   the teams, conferences and matchup views. Feature modules hang off window.SG. */
(function () {
  "use strict";

  var SG = {};
  window.SG = SG;

  SG.DATA_URL = "data/ratings.json";
  SG.ESPN_DATA_URL = "data/espn-games.json";
  SG.LOGOS_URL = "data/logos.json";
  SG.AP_URL = "data/ap-poll.json";
  SG.POLL_MS = 10 * 60 * 1000;
  SG.SIGMA = 15.5;
  SG.ESPN_BASE = "https://site.web.api.espn.com/apis/site/v2/sports/football/college-football";
  SG.ALIAS = window.TeamAlias || {};

  SG.state = {
    data: null,
    espn: null,
    logos: null,
    ap: null,
    sagToEspn: null,
    espnIdToSag: null,
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

  // -------------------------------------------------------------- logos + AP

  SG.logoId = function (name) {
    var et = SG.state.sagToEspn && SG.state.sagToEspn[name];
    return et ? String(et.id) : "";
  };

  // Inline logo for a team, with a light and a dark variant swapped by theme.
  // Returns "" when the team has no ESPN match or no logo on file.
  SG.teamLogo = function (name) {
    var id = SG.logoId(name);
    var logos = SG.state.logos;
    if (!id || !logos) return "";
    var hasLight = logos.light[id];
    var hasDark = logos.dark[id];
    if (hasLight && hasDark) {
      return '<span class="team-logo">' +
        '<img class="logo-light" src="assets/logos/' + id + '.png" alt="" loading="lazy">' +
        '<img class="logo-dark" src="assets/logos/' + id + '-dark.png" alt="" loading="lazy">' +
        "</span>";
    }
    if (hasLight) return '<span class="team-logo"><img src="assets/logos/' + id + '.png" alt="" loading="lazy"></span>';
    if (hasDark) return '<span class="team-logo"><img src="assets/logos/' + id + '-dark.png" alt="" loading="lazy"></span>';
    return "";
  };

  SG.apRank = function (name) {
    var ap = SG.state.ap;
    return ap && ap.byTeam && ap.byTeam[name] ? ap.byTeam[name] : null;
  };

  SG.apBadge = function (name) {
    var r = SG.apRank(name);
    return r ? '<span class="ap-badge" title="AP Top 25 rank">AP ' + r + "</span>" : "";
  };

  // Inline conference logo for a Sagarin conference name, light/dark by theme.
  SG.confLogo = function (name) {
    var logos = SG.state.logos;
    var c = logos && logos.conf && logos.conf[name];
    if (!c) return "";
    var base = "assets/conf-logos/" + c.id;
    if (c.light && c.dark) {
      return '<span class="team-logo">' +
        '<img class="logo-light" src="' + base + '.png" alt="" loading="lazy">' +
        '<img class="logo-dark" src="' + base + '-dark.png" alt="" loading="lazy">' +
        "</span>";
    }
    if (c.light) return '<span class="team-logo"><img src="' + base + '.png" alt="" loading="lazy"></span>';
    if (c.dark) return '<span class="team-logo"><img src="' + base + '-dark.png" alt="" loading="lazy"></span>';
    return "";
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
    rows.forEach(function (row, i) {
      html += "<tr>";
      columns.forEach(function (col) {
        var cls = col.cls ? ' class="' + col.cls + '"' : "";
        var val;
        if (col.index) {
          val = String(i + 1);
        } else if (col.cell) {
          val = col.cell(row);
        } else {
          val = SG.esc(SG.colValue(row, col));
        }
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
    { key: "rank", label: "#", cls: "left", index: true },
    { key: "team", label: "Team", cls: "left", type: "str", cell: teamCell },
    { key: "ap", label: "AP", cls: "left", type: "str", value: function (t) { return apSortKey(t.team); },
      cell: function (t) { var r = SG.apRank(t.team); return r ? '<span class="ap-rank">' + r + "</span>" : '<span class="dim">-</span>'; } },
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
    return '<span class="team-cell">' + SG.teamLogo(t.team) + '<span class="team-name">' + SG.esc(t.team) + "</span>" + badge + "</span>";
  }

  function apSortKey(name) {
    var r = SG.apRank(name);
    if (!r) return "\uffff";
    return (r < 10 ? "00" : r < 100 ? "0" : "") + r;
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
    { key: "rank", label: "#", cls: "left", index: true, value: confRank },
    { key: "name", label: "Conference", cls: "left", type: "str", cell: function (c) { return SG.confLogo(c.name) + SG.esc(c.name); } },
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
      { title: a.team + " at home", spread: diff + edge },
      { title: "Neutral site", spread: diff }
    ];
    document.getElementById("matchupResult").innerHTML = scenarios.map(function (s, i) {
      var favIsA = s.spread >= 0;
      var fav = favIsA ? a : b;
      var probA = SG.normCdf(s.spread / SG.SIGMA);
      var card = '<div class="match-card">' +
        "<h3>" + SG.esc(s.title) + "</h3>" +
        '<div class="fav">' + SG.esc(fav.team) + " favored</div>" +
        '<div class="margin">' + (favIsA ? "+" : "-") + SG.fmt(Math.abs(s.spread), 1) + "</div>" +
        '<div class="prob">Win chance: ' + SG.esc(a.team) + " " + pctText(probA) + " / " + SG.esc(b.team) + " " + pctText(1 - probA) + "</div>" +
        "</div>";
      return i === 1 ? '<div class="matchup-gap"></div>' + card : card;
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

  // -------------------------------------------------------------- ESPN mapping

  SG.buildMapping = function () {
    if (!SG.state.espn || !SG.state.data) return;
    var idx = {};
    SG.state.espn.teams.forEach(function (t) {
      [t.location, t.name, t.displayName].forEach(function (v) {
        var k = SG.normalizeName(v || "");
        if (k && !idx[k]) idx[k] = t;
      });
    });
    var sagToEspn = {};
    var espnIdToSag = {};
    SG.state.data.teams.forEach(function (st) {
      var k = SG.normalizeName(st.team);
      var et = idx[k] || idx[SG.ALIAS[k]];
      if (et) { sagToEspn[st.team] = et; espnIdToSag[et.id] = st; }
    });
    SG.state.sagToEspn = sagToEspn;
    SG.state.espnIdToSag = espnIdToSag;
  };

  SG.espnTeamById = function (id) {
    if (!SG.state.espn) return null;
    var a = SG.state.espn.teams;
    for (var i = 0; i < a.length; i++) if (String(a[i].id) === String(id)) return a[i];
    return null;
  };

  SG.gamesForTeam = function (name) {
    if (!SG.state.espn || !SG.state.sagToEspn) return [];
    var et = SG.state.sagToEspn[name];
    if (!et) return [];
    var id = String(et.id);
    return SG.state.espn.games
      .filter(function (g) { return String(g.homeId) === id || String(g.awayId) === id; })
      .sort(function (a, b) { return a.date < b.date ? -1 : 1; });
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

  function loadJson(url) {
    return fetch(url, { cache: "no-store" }).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    });
  }

  function loadAll() {
    return Promise.all([
      loadJson(SG.DATA_URL),
      loadJson(SG.ESPN_DATA_URL).catch(function () { return null; }),
      loadJson(SG.LOGOS_URL).catch(function () { return null; }),
      loadJson(SG.AP_URL).catch(function () { return null; })
    ]).then(function (res) {
      return { data: res[0], espn: res[1], logos: res[2], ap: res[3] };
    });
  }

  SG.prepareLogos = function (raw) {
    if (!raw) { SG.state.logos = null; return; }
    var light = {}, dark = {}, conf = {};
    (raw.light || []).forEach(function (id) { light[id] = true; });
    (raw.dark || []).forEach(function (id) { dark[id] = true; });
    (raw.conf || []).forEach(function (c) { conf[c.name] = { id: c.id, light: c.light, dark: c.dark }; });
    SG.state.logos = { light: light, dark: dark, conf: conf };
  };

  SG.poll = function (manual) {
    var btn = document.getElementById("refreshBtn");
    if (manual) { btn.disabled = true; btn.textContent = "Checking..."; }
    return loadAll().then(function (res) {
      var json = res.data;
      var ratingsChanged = !SG.state.data || json.signature !== SG.state.data.signature;
      var apChanged = (res.ap && res.ap.signature) !== SG.state.apSig;
      SG.state.espn = res.espn;
      SG.prepareLogos(res.logos);
      SG.state.ap = res.ap;
      SG.state.apSig = res.ap && res.ap.signature;
      if (ratingsChanged) {
        var changed = !!SG.state.data;
        SG.state.data = json;
        SG.state.confSort = null;
        SG.buildMapping();
        SG.populateConfFilter();
        SG.fillTeamSelects();
        SG.renderTeams();
        SG.renderConferences();
        SG.renderMatchup();
        SG.refreshModules();
        SG.renderStatus(changed);
      } else {
        SG.buildMapping();
        if (apChanged) { SG.renderTeams(); SG.refreshModules(); }
        if (manual) document.getElementById("dataStatus").textContent += " - no changes";
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

    loadAll().then(function (res) {
      SG.state.data = res.data;
      SG.state.espn = res.espn;
      SG.prepareLogos(res.logos);
      SG.state.ap = res.ap;
      SG.state.apSig = res.ap && res.ap.signature;
      SG.buildMapping();
      SG.populateConfFilter();
      SG.fillTeamSelects();
      SG.renderTeams();
      SG.renderConferences();
      SG.renderMatchup();
      SG.renderStatus(false);
      SG.refreshModules();
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
