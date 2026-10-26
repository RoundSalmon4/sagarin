/* Predictions_with_Totals_and_Moneylines: the regular block, the experimental
   home/away block, and the eigenvector block. */
(function () {
  "use strict";
  var SG = window.SG;

  var sortState = { regular: { key: "num", dir: 1 }, experimental: { key: "num", dir: 1 }, eigenvector: { key: "num", dir: 1 } };
  var currentSet = "regular";
  var search = "";
  var conf = "";
  var group = "";

  function favCell(p) {
    var isHome = !p.neutral && p.home && p.home === p.favorite;
    return (isHome ? '<span class="home-mark" title="home">@</span>' : "") + SG.teamLogo(p.favorite) + SG.esc(p.favorite) + SG.apBadge(p.favorite);
  }
  function dogCell(p) {
    var isHome = !p.neutral && p.home && p.home === p.underdog;
    return (isHome ? '<span class="home-mark" title="home">@</span>' : "") + SG.teamLogo(p.underdog) + SG.esc(p.underdog) + SG.apBadge(p.underdog);
  }
  function siteCell(p) { return SG.esc(p.neutral ? "Neutral" : (p.home || "")); }

  var MARGIN_COLUMNS = [
    { key: "rating", label: "Rating" },
    { key: "pred", label: "Pred" },
    { key: "golden", label: "Golden" },
    { key: "recent", label: "Recent" },
    { key: "strong", label: "Strong" }
  ];

  var REGULAR_COLUMNS = [
    { key: "num", label: "#", cls: "left", index: true },
    { key: "favorite", label: "Favorite", cls: "left", type: "str", cell: favCell },
    { key: "underdog", label: "Underdog", cls: "left", type: "str", cell: dogCell },
    { key: "site", label: "Site", cls: "left", type: "str", value: function (p) { return p.neutral ? "Neutral" : (p.home || ""); }, cell: siteCell }
  ].concat(MARGIN_COLUMNS, [
    { key: "money", label: "MONEY" },
    { key: "winPct", label: "WIN%" },
    { key: "homeScore", label: "home" },
    { key: "awayScore", label: "away" },
    { key: "total", label: "TOTAL" },
    { key: "hMargin", label: "HMARG" },
    { key: "altWinPct", label: "WIN% (adj)" },
    { key: "altMoney", label: "MONEY (adj)" }
  ]);

  var EIGEN_COLUMNS = [
    { key: "num", label: "#", cls: "left", index: true },
    { key: "favorite", label: "Favorite", cls: "left", type: "str", cell: favCell },
    { key: "underdog", label: "Underdog", cls: "left", type: "str", cell: dogCell },
    { key: "site", label: "Site", cls: "left", type: "str", value: function (p) { return p.home || ""; }, cell: siteCell },
    { key: "spread", label: "Spread" },
    { key: "odds", label: "Odds" },
    { key: "pct", label: "Pct%" }
  ];

  var NOTES = {
    regular: "Predicted margins from each Sagarin rating. @ = home team. Columns: favorite, underdog, site, rating margins, MONEY (moneyline), projected scores (home/away), TOTAL, home margin, adjusted win% and moneyline.",
    experimental: "Same predictions adjusted for home/away tendencies.",
    eigenvector: "Separate rating from team-vs-team matrix. Columns: spread, odds (moneyline to 100), model confidence (Pct%)."
  };

  function register() {
    SG.state.modules.predictions = { init: init, render: render };
  }

  function currentRows() {
    if (!SG.state.data || !SG.state.data.predictions) return [];
    return SG.state.data.predictions[currentSet] || [];
  }

  // The predictions name their teams the same way the ratings table does, so
  // the ratings list gives us the conference and the group for each side.
  function teamMap() {
    var m = {};
    (SG.state.data ? SG.state.data.teams : []).forEach(function (t) { m[t.team] = t; });
    return m;
  }

  // Conferences that actually show up in the current block, so the picker
  // never offers a conference with no games in it.
  function fillConf() {
    var sel = document.getElementById("predConf");
    if (!sel || !SG.state.data) return;
    var cur = sel.value;
    var map = teamMap();
    var seen = {};
    currentRows().forEach(function (p) {
      [map[p.favorite], map[p.underdog]].forEach(function (t) {
        if (t && t.conference) seen[t.conference] = true;
      });
    });
    sel.innerHTML = '<option value="">All conferences</option>';
    SG.state.data.conferences.forEach(function (c) {
      if (!seen[c.name]) return;
      var o = document.createElement("option");
      o.value = c.name;
      o.textContent = c.name;
      sel.appendChild(o);
    });
    sel.value = cur || "";
  }

  // A game shows up when either side matches the filter, the same way the TV
  // tab treats its group and conference filters.
  function inScope(p, map) {
    var a = map[p.favorite];
    var b = map[p.underdog];
    if (conf && (!a || a.conference !== conf) && (!b || b.conference !== conf)) return false;
    if (group) {
      var ga = a ? SG.confGroup(a) : "";
      var gb = b ? SG.confGroup(b) : "";
      if (ga !== group && gb !== group) return false;
    }
    return true;
  }

  function render() {
    if (!SG.state.data || !SG.state.data.predictions) return;
    var table = document.getElementById("predTable");
    var columns = currentSet === "eigenvector" ? EIGEN_COLUMNS : REGULAR_COLUMNS;
    var all = currentRows();
    fillConf();
    var map = teamMap();
    var rows = all.filter(function (p) {
      if (!inScope(p, map)) return false;
      var q = search.trim().toLowerCase();
      if (!q) return true;
      return p.favorite.toLowerCase().indexOf(q) !== -1 || p.underdog.toLowerCase().indexOf(q) !== -1;
    });
    var sort = sortState[currentSet];
    var sorted = SG.sortRows(rows, columns, sort);
    SG.buildHead(table, columns, sort, function (key) {
      SG.toggleSort(sort, key, columns);
      render();
    });
    SG.fillBody(table, columns, sorted);
    document.getElementById("predCount").textContent =
      rows.length === all.length ? rows.length + " games" : rows.length + " of " + all.length + " games";
    document.getElementById("predNote").textContent = NOTES[currentSet];
  }

  function init() {
    SG.$$("#predSet .seg").forEach(function (seg) {
      seg.addEventListener("click", function () {
        currentSet = seg.dataset.set;
        SG.$$("#predSet .seg").forEach(function (s) { s.classList.toggle("active", s === seg); });
        fillConf();
        render();
      });
    });
    var box = document.getElementById("predSearch");
    box.addEventListener("input", function (e) { search = e.target.value; render(); });
    document.getElementById("predConf").addEventListener("change", function (e) { conf = e.target.value; render(); });
    document.getElementById("predGroup").addEventListener("change", function (e) { group = e.target.value; render(); });
    fillConf();
    render();
  }

  register();
})();

