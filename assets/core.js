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
  SG.BCS_URL = "data/bcs.json";
  SG.TV_URL = "data/tv-games.json";
  SG.RESUME_URL = "data/resume-weights.json";
  SG.SIM_URL = "data/sim-12.json";
  SG.POLL_MS = 10 * 60 * 1000;
  SG.SIGMA = 15.5;
  SG.ALIAS = window.TeamAlias || {};
SG.DIVISIONS = window.TeamDivisions || {};

  SG.state = {
    data: null,
    espn: null,
    logos: null,
    ap: null,
    bcs: null,
    bcsSig: null,
    tv: null,
    resume: null,
    sagToEspn: null,
    espnIdToSag: null,
    teamSort: { key: "rank", dir: 1 },
    confMetric: "rating",
    confSort: null,
    teamSearch: "",
    confFilter: "",
    teamDivision: "",
    teamGroup: "",
    confLevel: "",
    confExpanded: {},
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

  // Use ESPN-computed record when available (midweek updates), else fall back to Sagarin.
  function espnW(t) { return SG.state.espnRecord && SG.state.espnRecord[t.team] ? SG.state.espnRecord[t.team].w : t.w; }
  function espnL(t) { return SG.state.espnRecord && SG.state.espnRecord[t.team] ? SG.state.espnRecord[t.team].l : t.l; }
  SG.espnW = espnW;
  SG.espnL = espnL;

  // Conference record from ESPN intra-conference games.
  function espnConfW(t) { return SG.state.espnConfRecord && SG.state.espnConfRecord[t.team] ? SG.state.espnConfRecord[t.team].w : 0; }
  function espnConfL(t) { return SG.state.espnConfRecord && SG.state.espnConfRecord[t.team] ? SG.state.espnConfRecord[t.team].l : 0; }
  SG.espnConfW = espnConfW;
  SG.espnConfL = espnConfL;

  // Format record as "W-L (confW-confL)" when conference record exists, else "W-L".
  SG.recWithConf = function (t) {
    var w = SG.espnW(t), l = SG.espnL(t);
    var cw = SG.espnConfW(t), cl = SG.espnConfL(t);
    var base = SG.rec(w, l);
    return (cw > 0 || cl > 0) ? base + " (" + SG.rec(cw, cl) + ")" : base;
  };

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

  // -------------------------------------------------------------- categories

  SG.P4 = ["SEC", "BIG TEN", "BIG 12", "ACC"];
  SG.G6 = ["AMERICAN", "CONF-USA", "MAC", "MOUNTAIN WEST", "SUN BELT", "PAC-12"];

  SG.mergeConf = function (c) {
    if (c === "SUN BELT EAST" || c === "SUN BELT WEST") return "SUN BELT";
    return c;
  };

  // "P4", "G6", "IND" or "OTHER" for FBS teams, "FCS" for I-AA.
  SG.confGroup = function (t) {
    if (t.level !== "A") return "FCS";
    var c = SG.mergeConf(t.conference);
    if (SG.P4.indexOf(c) !== -1) return "P4";
    if (SG.G6.indexOf(c) !== -1) return "G6";
    if (c === "I-A IND.") return "IND";
    return "OTHER";
  };

  // -------------------------------------------------------------- logos + AP

  SG.logoId = function (name) {
    var et = SG.state.sagToEspn && SG.state.sagToEspn[name];
    return et ? String(et.id) : "";
  };

  // Inline logo for an ESPN team id, with a light and a dark variant swapped by
  // theme. Returns "" when there is no logo on file. Used for opponents that are
  // not in the ratings list, where there is no Sagarin name to look up.
  SG.logoById = function (id) {
    id = id === null || id === undefined ? "" : String(id);
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

  // Inline logo for a Sagarin team name.
  SG.teamLogo = function (name) {
    return SG.logoById(SG.logoId(name));
  };

  SG.rankLabel = function () {
    var ap = SG.state.ap;
    return (ap && ap.primaryLabel) || "AP";
  };

  SG.apRank = function (name) {
    var ap = SG.state.ap;
    return ap && ap.byTeam && ap.byTeam[name] ? ap.byTeam[name] : null;
  };

  // BCS-style record for a team: score, rank and the three components.
  SG.bcsOf = function (name) {
    var bcs = SG.state.bcs;
    return bcs && bcs.teams && bcs.teams[name] ? bcs.teams[name] : null;
  };

  SG.apBadge = function (name) {
    var r = SG.apRank(name);
    return r ? '<span class="ap-badge" title="' + SG.esc(SG.rankLabel()) + ' rank">' +
      SG.esc(SG.rankLabel()) + " " + r + "</span>" : "";
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

  // -------------------------------------------------------------- theme

  SG.applyTheme = function (theme) {
    document.documentElement.setAttribute("data-theme", theme);
    var btn = SG.$("#themeBtn");
    if (btn) {
      var label = theme === "dark" ? "Switch to light mode" : "Switch to dark mode";
      btn.setAttribute("aria-pressed", theme === "dark" ? "true" : "false");
      btn.setAttribute("aria-label", label);
      btn.title = label;
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
    { key: "w", label: "W", value: function (t) { return SG.espnW(t); } },
    { key: "l", label: "L", value: function (t) { return SG.espnL(t); } },
    { key: "pct", label: "Pct", value: function (t) { return SG.pct(SG.espnW(t), SG.espnL(t)); }, cell: function (t) { return SG.pct(SG.espnW(t), SG.espnL(t)).toFixed(3).replace(/^0/, ""); } },
    { key: "rating", label: "RATING", strong: true },
    { key: "predictor", label: "PREDICTOR" },
    { key: "goldenMean", label: "GOLDEN_MEAN" },
    { key: "recent", label: "RECENT" },
    { key: "strongRecent", label: "STRONG_RECENT" },
    { key: "bcs", label: "BCS", type: "num", value: function (t) { var b = SG.bcsOf(t.team); return b ? b.score : -1; },
      cell: function (t) {
        var b = SG.bcsOf(t.team);
        return b ? SG.fmt(b.score, 3) + ' <span class="dim">(' + b.rank + ")</span>" : '<span class="dim">-</span>';
      } },
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

  // Keep the poll wording in step with whichever poll drives the site. The AP
  // label becomes CFP once the committee rankings are posted.
  SG.syncRankLabels = function () {
    var label = SG.rankLabel();
    TEAM_COLUMNS.forEach(function (c) { if (c.key === "ap") c.label = label; });
    var scope = document.querySelector('.seg[data-scope="ap"]');
    if (scope) scope.textContent = label === "CFP" ? "CFP teams" : label + " Top 25";
  };

  SG.renderTeams = function () {
    if (!SG.state.data) return;
    var table = document.getElementById("teamsTable");
    var teams = SG.state.data.teams;
    var q = SG.state.teamSearch.trim().toLowerCase();
    var filtered = teams.filter(function (t) {
      if (SG.state.confFilter && t.conference !== SG.state.confFilter) return false;
      if (SG.state.teamDivision && t.level !== SG.state.teamDivision) return false;
      if (SG.state.teamGroup && SG.confGroup(t) !== SG.state.teamGroup) return false;
      if (!q) return true;
      return t.team.toLowerCase().indexOf(q) !== -1 || t.conference.toLowerCase().indexOf(q) !== -1;
    });
    // The BCS column only belongs once the CFP rankings are the poll in use.
    var cols = SG.rankLabel() === "CFP"
      ? TEAM_COLUMNS
      : TEAM_COLUMNS.filter(function (c) { return c.key !== "bcs"; });
    var sorted = SG.sortRows(filtered, cols, SG.state.teamSort);
    SG.buildHead(table, cols, SG.state.teamSort, function (key) {
      SG.toggleSort(SG.state.teamSort, key, cols);
      SG.renderTeams();
    });
    SG.fillBody(table, cols, sorted);
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
    var rows = SG.state.data.conferences.filter(function (c) {
      return !SG.state.confLevel || c.level === SG.state.confLevel;
    });
    var sorted = SG.sortRows(rows, CONF_COLUMNS, SG.state.confSort);
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
    if (ranked[1]) a.value = ranked[1].team;
    if (ranked[0]) b.value = ranked[0].team;
  };

  SG.renderMatchup = function () {
    if (!SG.state.data) return;
    var away = SG.teamByName(document.getElementById("teamA").value);
    var home = SG.teamByName(document.getElementById("teamB").value);
    var method = document.getElementById("methodSelect").value;
    if (!away || !home) return;
    var edge = SG.homeEdge(method);
    var diff = home[method] - away[method];

    // The two ways the same numbers can be read: with the home team at home,
    // and on a neutral field.
    var scenarios = [
      { site: "Home site", spread: diff + edge },
      { site: "Neutral site", spread: diff }
    ];

    // Comparison table: the two teams side by side, one row per metric.
    var table = document.getElementById("matchupTable");
    if (table) {
      var st = seasonStats();
      var rankField = {
        rating: "rank",
        predictor: "predictorRank",
        goldenMean: "goldenMeanRank",
        recent: "recentRank",
        strongRecent: "strongRecentRank"
      };
      function statCell(t, key) {
        var s = st[t.team];
        if (!s || s[key] === null || s[key] === undefined) return '<span class="dim">-</span>';
        return SG.fmt(s[key], 1) + ' <span class="dim">(' + (s[key + "Rank"] || "-") + ")</span>";
      }
      var rows = [
        { label: "Record", cell: function (t) { return SG.esc(SG.recWithConf(t)); } },
        { label: "Conference", cell: function (t) { return SG.esc(confOf(t)); } },
        { label: SG.methodLabel(method), lead: true, cell: function (t) {
          return SG.fmt(t[method]) + ' <span class="dim">(' + (t[rankField[method]] || "-") + ")</span>";
        } },
        { label: "Schedule", cell: function (t) {
          return SG.fmt(t.sched) + ' <span class="dim">(' + (t.schedRank || "-") + ")</span>";
        } },
        { label: "Total offense", cell: function (t) { return statCell(t, "oy"); } },
        { label: "Total defense", cell: function (t) { return statCell(t, "dy"); } },
        { label: "PPG", cell: function (t) { return statCell(t, "ppg"); } }
      ];
      // The BCS row joins the table once the CFP rankings are the poll in use.
      if (SG.rankLabel() === "CFP") {
        rows.splice(3, 0, { label: "BCS", cell: function (t) {
          var b = SG.bcsOf(t.team);
          return b ? SG.fmt(b.score, 3) + ' <span class="dim">(' + b.rank + ")</span>" : '<span class="dim">-</span>';
        } });
      }
      var html = '<table class="h2h-cmp"><thead><tr><th></th>' +
        '<th class="h2h-cmp-away">' + teamHead(away, "Away") + "</th>" +
        '<th class="h2h-cmp-home">' + teamHead(home, "Home") + "</th></tr></thead><tbody>";
      rows.forEach(function (r) {
        html += "<tr" + (r.lead ? ' class="h2h-lead"' : "") + "><th>" + SG.esc(r.label) + "</th><td>" +
          r.cell(away) + "</td><td>" + r.cell(home) + "</td></tr>";
      });
      html += "</tbody></table>";
      table.innerHTML = html;
    }

    // Projection: the pick and the win chances for both sites.
    var proj = document.getElementById("matchupResult");
    if (proj) {
      var html = '<div class="h2h-proj-cards">';
      scenarios.forEach(function (s) {
        var homeFav = s.spread >= 0;
        var fav = homeFav ? home : away;
        var probHome = SG.normCdf(s.spread / SG.SIGMA);
        var siteLabel = s.site;
        if (s.site === "Home site") {
          siteLabel = "Home Site - " + home.team;
        }
        html += '<div class="h2h-proj-card">' +
          '<div class="h2h-proj-site">' + SG.esc(siteLabel) + "</div>" +
          '<div class="h2h-proj-fav">' + SG.teamLogo(fav.team) + SG.esc(fav.team) + "</div>" +
          '<div class="h2h-proj-margin">by ' + SG.fmt(Math.abs(s.spread), 1) +
          '<span class="h2h-proj-label">points</span></div>' +
          '<div class="h2h-proj-bar">' +
          '<span class="' + (homeFav ? "" : "fav") + '" style="width:' + ((1 - probHome) * 100).toFixed(1) + '%"></span>' +
          '<span class="' + (homeFav ? "fav" : "") + '" style="width:' + (probHome * 100).toFixed(1) + '%"></span></div>' +
          '<div class="h2h-proj-probs"><span>' + SG.esc(away.team) + " " + pctText(1 - probHome) + "</span>" +
          "<span>" + SG.esc(home.team) + " " + pctText(probHome) + "</span></div>" +
          "</div>";
      });
      html += "</div>";
      proj.innerHTML = html;
    }

    var pollsBox = document.getElementById("matchupPolls");
    if (pollsBox) pollsBox.innerHTML = pollTables();

    var methodNote = document.getElementById("matchupMethod");
    if (methodNote) {
      methodNote.textContent =
        "Method: " + SG.methodLabel(method) + ". The home edge for this rating is " + SG.fmt(edge) +
        " points, taken from the source page. Win chances come from a normal model with a standard deviation of " +
        SG.SIGMA + " points, so a bigger rating gap means a bigger spread of win chances.";
    }

    var confBox = document.getElementById("matchupConf");
    if (confBox) confBox.innerHTML = confStandings(away, home);

    var comp = document.getElementById("matchupCompare");
    if (comp) comp.innerHTML = recentPanel(away) + recentPanel(home);

    var bcsNote = SG.rankLabel() === "CFP"
      ? "BCS is a BCS-style score for this season: the AP poll stands in for the retired Harris poll, the Coaches " +
        "poll is unchanged, and the computer part drops each team's highest and lowest of the six computer rankings " +
        "and keeps the middle four. "
      : "";
    document.getElementById("matchupNote").textContent =
      "Conference standings and the last five come from the ESPN schedule data. Played games use the real result, " +
      "so the conference records and the last five are the actual results so far this season. The overall record " +
      "is the one printed on the Sagarin page. Standings show the selected team with the teams around it; click the " +
      "ellipsis to open the full conference. Total offense and total defense are yards per game from the ESPN " +
      "statistics, points per game is scoring, and the number in brackets is the national rank of every rated team. " +
      bcsNote + "The " + SG.methodLabel(method) + " rating is the column used above.";
  };

  // Conference name for a team, with the Sun Belt east and west halves merged.
  function confOf(t) {
    return SG.mergeConf ? SG.mergeConf(t.conference) : t.conference;
  }

  // Current conference standings from the completed games in the ESPN file.
  // Teams are ordered by conference win percentage, then by rating.
  function standingsByConf() {
    var confKey = {};
    SG.state.data.teams.forEach(function (t) {
      confKey[t.team] = confOf(t);
    });
    var rec = {};
    function ensure(n) { return rec[n] || (rec[n] = { w: 0, l: 0 }); }
    var games = (SG.state.espn && SG.state.espn.games) || [];
    games.forEach(function (g) {
      if (!g.completed || g.homeScore === null || g.awayScore === null) return;
      var h = SG.state.espnIdToSag && SG.state.espnIdToSag[g.homeId];
      var a = SG.state.espnIdToSag && SG.state.espnIdToSag[g.awayId];
      if (!h || !a) return;
      if (confKey[h.team] !== confKey[a.team]) return;
      if (g.homeScore > g.awayScore) { ensure(h.team).w += 1; ensure(a.team).l += 1; }
      else { ensure(a.team).w += 1; ensure(h.team).l += 1; }
    });
    var byConf = {};
    SG.state.data.teams.forEach(function (t) {
      var c = confKey[t.team];
      if (!c) return;
      var r = rec[t.team] || { w: 0, l: 0 };
      var g = r.w + r.l;
      (byConf[c] = byConf[c] || []).push({
        team: t.team,
        w: r.w,
        l: r.l,
        ow: t.w,
        ol: t.l,
        pct: g ? r.w / g : 0,
        rating: t.rating
      });
    });
    Object.keys(byConf).forEach(function (c) {
      byConf[c].sort(function (x, y) {
        if (y.pct !== x.pct) return y.pct - x.pct;
        return y.rating - x.rating;
      });
    });
    return byConf;
  }

  // Conference standings snapshot for both teams, side by side. Each team's
  // row is highlighted. Teams in the same conference share one table. The
  // selected team is shown with a few teams either side of it rather than the
  // whole conference, so the table reads as "where are they" at a glance.
  function confStandings(away, home) {
    if (!SG.state.espn) return '<p class="note">Conference standings need the ESPN schedule data, which is not loaded.</p>';
    var byConf = standingsByConf();
    var awayConf = confOf(away);
    var homeConf = confOf(home);

    function expandRow(conf, cls, label) {
      return '<tr class="h2h-gap"><td colspan="4"><button type="button" class="' + cls +
        '" data-conf="' + SG.esc(conf) + '">' + SG.esc(label) + "</button></td></tr>";
    }

    function table(conf, title, marks) {
      var list = byConf[conf] || [];
      if (!list.length) {
        return '<div class="h2h-conf"><div class="h2h-conf-title">' + SG.esc(title) +
          '</div><p class="note">No teams in this group.</p></div>';
      }
      var independent = conf === "I-A IND.";
      var expanded = !independent && !!SG.state.confExpanded[conf];
      var pos = {};
      list.forEach(function (r, i) { pos[r.team] = i; });
      var rows;
      if (independent || expanded) {
        rows = list.map(function (r, i) { return i; });
      } else {
        var visible = {};
        marks.forEach(function (m) {
          var i = pos[m.team];
          if (i === undefined) return;
          for (var k = i - 2; k <= i + 2; k++) if (k >= 0 && k < list.length) visible[k] = true;
        });
        rows = Object.keys(visible).map(Number).sort(function (a, b) { return a - b; });
      }
      var shownLine = independent ? "" :
        (expanded ? " \u00b7 " + list.length + " teams" : " \u00b7 showing " + rows.length + " of " + list.length);
      var html = '<div class="h2h-conf"><div class="h2h-conf-title">' + SG.esc(title) + SG.esc(shownLine) + '</div>' +
        '<table class="h2h-table"><thead><tr><th>#</th><th class="left">Team</th><th>Overall</th><th>Conf</th></tr></thead><tbody>';
      var windowed = !independent && !expanded;
      var prev = null;
      rows.forEach(function (i) {
        if (windowed && prev === null && i > 0) html += expandRow(conf, "h2h-expand", "\u2026");
        if (windowed && prev !== null && i - prev > 1) html += expandRow(conf, "h2h-expand", "\u2026");
        prev = i;
        var r = list[i];
        var mark = null;
        marks.forEach(function (m) { if (m.team === r.team) mark = m.role; });
        html += '<tr' + (mark ? ' class="h2h-me"' : "") + '><td class="num">' + (i + 1) + '</td><td class="left">' +
          SG.teamLogo(r.team) + SG.esc(r.team) + SG.apBadge(r.team) +
          (mark ? ' <span class="h2h-tag">' + SG.esc(mark) + "</span>" : "") +
          '</td><td class="num">' + SG.esc(SG.rec(r.ow, r.ol)) +
          '</td><td class="num">' + SG.esc(SG.rec(r.w, r.l)) + "</td></tr>";
      });
      if (windowed && rows.length && rows[rows.length - 1] < list.length - 1) {
        html += expandRow(conf, "h2h-expand", "\u2026");
      }
      if (expanded) html += expandRow(conf, "h2h-collapse", "Show fewer");
      html += "</tbody></table></div>";
      return html;
    }

    if (awayConf === homeConf) {
      return '<div class="h2h-conf-grid single">' + table(awayConf, awayConf + " (both teams)", [
        { team: away.team, role: "Away" },
        { team: home.team, role: "Home" }
      ]) + "</div>";
    }
    return '<div class="h2h-conf-grid">' +
      table(awayConf, awayConf + " (away)", [{ team: away.team, role: "Away" }]) +
      table(homeConf, homeConf + " (home)", [{ team: home.team, role: "Home" }]) +
      "</div>";
  }

  // Last 5 results and the next scheduled game for one team, from the ESPN
  // schedule data. Opponent logos come from the ESPN id when the opponent is
  // not rated by Sagarin, so every line still carries a mark.
  function recentPanel(t) {
    var games = (SG.gamesForTeam && SG.state.sagToEspn && SG.state.sagToEspn[t.team])
      ? SG.gamesForTeam(t.team) : [];
    var done = [];
    var next = null;
    var myEt = SG.state.sagToEspn && SG.state.sagToEspn[t.team];
    var myId = myEt ? String(myEt.id) : "";
    games.forEach(function (g) {
      var isHome = String(g.homeId) === myId;
      var oppId = isHome ? g.awayId : g.homeId;
      var opp = SG.espnTeamById ? SG.espnTeamById(oppId) : null;
      var oppName = opp ? opp.location || opp.displayName : "";
      var oppSag = SG.state.espnIdToSag ? SG.state.espnIdToSag[oppId] : null;
      var logo = oppSag ? SG.teamLogo(oppSag.team) : SG.logoById(oppId);
      if (g.completed && g.homeScore !== null && g.awayScore !== null) {
        var mine = isHome ? g.homeScore : g.awayScore;
        var theirs = isHome ? g.awayScore : g.homeScore;
        done.push({
          w: mine > theirs,
          score: mine + "-" + theirs,
          opp: oppName,
          logo: logo,
          site: isHome ? "" : "@ ",
          date: g.date
        });
      } else if (!next) {
        next = { opp: oppName, logo: logo, site: isHome ? "" : "@ ", date: g.date, neutral: g.neutral };
      }
    });
    var last = done.slice(-5).reverse();
    var html = '<div class="h2h-last"><div class="h2h-last-title">' + SG.teamLogo(t.team) +
      SG.esc(t.team) + " last 5</div>";
    if (!last.length) {
      html += '<p class="note">No completed games on file.</p>';
    } else {
      html += '<div class="h2h-last-list">';
      last.forEach(function (x) {
        html += '<div class="h2h-last-item"><span class="h2h-last-res ' + (x.w ? "win" : "loss") + '">' +
          (x.w ? "W" : "L") + " " + SG.esc(x.score) + '</span><span class="h2h-last-opp">' +
          x.logo + SG.esc(x.site + x.opp) + "</span></div>";
      });
      html += "</div>";
    }
    if (next) {
      html += '<div class="h2h-next"><span class="h2h-next-label">Next</span>' +
        '<span class="h2h-last-opp">' + next.logo + SG.esc(next.site + next.opp) +
        (next.neutral ? " (neutral)" : "") + "</span></div>";
    }
    html += "</div>";
    return html;
  }

  // Season numbers for the comparison table, from the ESPN statistics file:
  // total offense and total defense are yards per game, points per game is
  // scoring. The ranks are across every rated team that has the number.
  function seasonStats() {
    var out = {};
    if (!SG.state.data) return out;
    var espnStats = (SG.state.espn && SG.state.espn.stats) || {};
    SG.state.data.teams.forEach(function (t) {
      var et = SG.state.sagToEspn && SG.state.sagToEspn[t.team];
      var es = et ? espnStats[String(et.id)] : null;
      out[t.team] = {
        oy: es ? es.oy : null,
        dy: es && es.dy !== undefined ? es.dy : null,
        ppg: es ? es.pp : null
      };
    });
    function rank(key, high) {
      var list = [];
      Object.keys(out).forEach(function (name) {
        var v = out[name][key];
        if (v === null || v === undefined) return;
        list.push({ team: name, v: v });
      });
      list.sort(function (x, y) { return high ? y.v - x.v : x.v - y.v; });
      list.forEach(function (r, i) { out[r.team][key + "Rank"] = i + 1; });
    }
    rank("oy", true);
    rank("dy", false);
    rank("ppg", true);
    return out;
  }

  // Header cell for the comparison table: role, logo, name and rank badge.
  function teamHead(t, role) {
    return '<div class="h2h-head-role">' + SG.esc(role) + "</div>" +
      '<div class="h2h-head-name">' + SG.teamLogo(t.team) + SG.esc(t.team) + SG.apBadge(t.team) + "</div>";
  }

  // Poll tables beside the projection: the committee rankings once the CFP
  // site posts them, otherwise the AP poll, plus the coaches poll.
  function pollDate(poll) {
    if (!poll || !poll.date) return "";
    var d = new Date(poll.date);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  function pollTable(poll, title) {
    if (!poll || !poll.ranks || !poll.ranks.length) return "";
    var date = pollDate(poll);
    var html = '<div class="h2h-conf h2h-poll"><div class="h2h-conf-title">' + SG.esc(title) +
      (date ? ' <span class="dim">' + SG.esc(date) + "</span>" : "") + "</div>" +
      '<table class="h2h-table"><thead><tr><th>#</th><th class="left">Team</th>' +
      "<th>Overall</th><th>Conf</th></tr></thead><tbody>";
    poll.ranks.forEach(function (r) {
      var t = r.sagarin ? SG.teamByName(r.sagarin) : null;
      var logo = r.sagarin ? SG.teamLogo(r.sagarin) : SG.logoById(r.id);
      // Use the record from the poll itself (snapshot at poll time).
      // AP/Coaches include records. CFP does not, so fall back to Sagarin (weekly snapshot aligned with CFP releases).
      var w = (r.w !== null && r.w !== undefined) ? r.w : (t ? t.w : null);
      var l = (r.l !== null && r.l !== undefined) ? r.l : (t ? t.l : null);
      var rec = (w !== null && l !== null) ? SG.rec(w, l) : '<span class="dim">-</span>';
      html += '<tr><td class="num">' + r.rank + '</td><td class="left">' + logo +
        SG.esc(r.sagarin || r.espn) + "</td><td>" + (t ? SG.esc(rec) : '<span class="dim">-</span>') +
        "</td><td>" + (t ? SG.esc(confOf(t)) : '<span class="dim">-</span>') + "</td></tr>";
    });
    html += "</tbody></table></div>";
    return html;
  }

  function pollTables() {
    var ap = SG.state.ap;
    if (!ap) return "";
    var polls = ap.polls || { ap: ap };
    var out = "";
    if (polls.cfp) out += pollTable(polls.cfp, "CFP Rankings");
    else if (polls.ap) out += pollTable(polls.ap, "AP Top 25");
    if (polls.usa) out += pollTable(polls.usa, "Coaches Poll");
    return out;
  }

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

    // Compute W-L from ESPN completed games for each team.
    // This keeps the displayed record current midweek while Sagarin ratings stay weekly.
    var rec = {};
    function ensure(n) { return rec[n] || (rec[n] = { w: 0, l: 0 }); }
    var games = SG.state.espn.games || [];
    games.forEach(function (g) {
      if (!g.completed || g.homeScore === null || g.awayScore === null) return;
      var h = espnIdToSag[g.homeId];
      var a = espnIdToSag[g.awayId];
      if (!h || !a) return;
      if (g.homeScore > g.awayScore) { ensure(h.team).w += 1; ensure(a.team).l += 1; }
      else { ensure(a.team).w += 1; ensure(h.team).l += 1; }
    });
    SG.state.espnRecord = rec;

    // Compute conference W-L from ESPN completed games (intra-conference only).
    var confRec = {};
    function ensureConf(n) { return confRec[n] || (confRec[n] = { w: 0, l: 0 }); }
    var confKey = {};
    SG.state.data.teams.forEach(function (t) { confKey[t.team] = confOf(t); });
    games.forEach(function (g) {
      if (!g.completed || g.homeScore === null || g.awayScore === null) return;
      var h = espnIdToSag[g.homeId];
      var a = espnIdToSag[g.awayId];
      if (!h || !a) return;
      if (confKey[h.team] !== confKey[a.team]) return;
      if (g.homeScore > g.awayScore) { ensureConf(h.team).w += 1; ensureConf(a.team).l += 1; }
      else { ensureConf(a.team).w += 1; ensureConf(h.team).l += 1; }
    });
    SG.state.espnConfRecord = confRec;
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
      loadJson(SG.AP_URL).catch(function () { return null; }),
      loadJson(SG.BCS_URL).catch(function () { return null; }),
      loadJson(SG.TV_URL).catch(function () { return null; }),
      loadJson(SG.RESUME_URL).catch(function () { return null; }),
      loadJson(SG.SIM_URL).catch(function () { return null; })
    ]).then(function (res) {
      return { data: res[0], espn: res[1], logos: res[2], ap: res[3], bcs: res[4], tv: res[5], resume: res[6], sim: res[7] };
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
      var bcsChanged = (res.bcs && res.bcs.signature) !== SG.state.bcsSig;
      var tvChanged = (res.tv && res.tv.signature) !== SG.state.tvSig;
      SG.state.espn = res.espn;
      SG.prepareLogos(res.logos);
      SG.state.ap = res.ap;
      SG.state.apSig = res.ap && res.ap.signature;
      SG.state.bcs = res.bcs;
      SG.state.bcsSig = res.bcs && res.bcs.signature;
      SG.syncRankLabels();
      SG.state.tv = res.tv;
      SG.state.tvSig = res.tv && res.tv.signature;
      var resumeChanged = JSON.stringify(res.resume) !== JSON.stringify(SG.state.resume);
      SG.state.resume = res.resume || null;
      SG.state.sim = res.sim || null;
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
        if (apChanged || bcsChanged) { SG.renderTeams(); SG.renderMatchup(); }
        if (apChanged || bcsChanged || tvChanged || resumeChanged) SG.refreshModules();
        if (manual) {
          SG.renderStatus(false);
          document.getElementById("dataStatus").textContent += " - no changes";
        }
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

    // Debug mode: ?debug=playoff logs playoff projection details to console
    var params = new URLSearchParams(window.location.search);
    if (params.get("debug") === "playoff") {
      SG.debug = SG.debug || {};
      SG.debug.playoff = true;
      console.log("[DEBUG] Playoff projection debug mode enabled");
    }
        if (params.get("debug") === "sim") {
      SG.debug = SG.debug || {};
      SG.debug.sim = true;
      console.log("[DEBUG] Simulation debug mode enabled - full run data will be stored");
    }

    loadAll().then(function (res) {
      SG.state.data = res.data;
      SG.state.espn = res.espn;
      SG.prepareLogos(res.logos);
      SG.state.ap = res.ap;
      SG.state.apSig = res.ap && res.ap.signature;
      SG.state.bcs = res.bcs;
      SG.state.bcsSig = res.bcs && res.bcs.signature;
      SG.syncRankLabels();
      SG.state.tv = res.tv;
      SG.state.tvSig = res.tv && res.tv.signature;
      SG.state.resume = res.resume || null;
      SG.state.sim = res.sim || null;
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

    document.getElementById("teamSearch").addEventListener("input", function (e) {
      SG.state.teamSearch = e.target.value;
      SG.renderTeams();
    });
    document.getElementById("confFilter").addEventListener("change", function (e) {
      SG.state.confFilter = e.target.value;
      SG.renderTeams();
    });
    document.getElementById("teamDivision").addEventListener("change", function (e) {
      SG.state.teamDivision = e.target.value;
      SG.renderTeams();
    });
    document.getElementById("teamGroup").addEventListener("change", function (e) {
      SG.state.teamGroup = e.target.value;
      SG.renderTeams();
    });
    document.getElementById("confLevel").addEventListener("change", function (e) {
      SG.state.confLevel = e.target.value;
      SG.renderConferences();
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

    var confBox = document.getElementById("matchupConf");
    if (confBox) {
      confBox.addEventListener("click", function (e) {
        var btn = e.target.closest ? e.target.closest(".h2h-expand, .h2h-collapse") : null;
        if (!btn) return;
        var conf = btn.getAttribute("data-conf") || "";
        SG.state.confExpanded[conf] = btn.classList.contains("h2h-expand");
        SG.renderMatchup();
      });
    }
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
