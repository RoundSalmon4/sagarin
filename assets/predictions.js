/* Predictions_with_Totals_and_Moneylines: the regular block, the experimental
   home/away block, and the eigenvector block. */
(function () {
  "use strict";
  var SG = window.SG;

  var sortState = { regular: { key: "num", dir: 1 }, experimental: { key: "num", dir: 1 }, eigenvector: { key: "num", dir: 1 } };
  var currentSet = "regular";
  var search = "";

  function favCell(p) {
    var isHome = p.home && p.home === p.favorite;
    return (isHome ? '<span class="home-mark" title="home">@</span>' : "") + SG.teamLogo(p.favorite) + SG.esc(p.favorite) + SG.apBadge(p.favorite);
  }
  function dogCell(p) {
    var isHome = p.home && p.home === p.underdog;
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
    { key: "site", label: "Site", cls: "left", type: "str", value: function (p) { return p.neutral ? "Neutral" : (p.home || ""); }, cell: siteCell },
    { key: "underdog", label: "Underdog", cls: "left", type: "str", cell: dogCell }
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
    { key: "site", label: "Site", cls: "left", type: "str", value: function (p) { return p.home || ""; }, cell: siteCell },
    { key: "spread", label: "Spread" },
    { key: "odds", label: "Odds" },
    { key: "pct", label: "Pct%" },
    { key: "underdog", label: "Underdog", cls: "left", type: "str", cell: dogCell }
  ];

  var NOTES = {
    regular: "Sagarin's Predictions_with_Totals_and_Moneylines. The five margin columns are the predicted favorite margin from each rating method. An @ marks the home team. MONEY is the moneyline to 100, home/away are projected scores, TOTAL is the projected total, HMARG is the home margin, and the last pair are the home/away adjusted win% and moneyline.",
    experimental: "EXPERIMENTAL predictions: the regular numbers adjusted for each team's tendencies at home and away. Same columns as the regular block.",
    eigenvector: "EIGENVECTOR analysis: a separate rating built from a team-vs-team matrix. Spread is the projected margin, Odds the moneyline to 100, Pct% the model confidence."
  };

  function register() {
    SG.state.modules.predictions = { init: init, render: render };
  }

  function currentRows() {
    if (!SG.state.data || !SG.state.data.predictions) return [];
    return SG.state.data.predictions[currentSet] || [];
  }

  function render() {
    if (!SG.state.data || !SG.state.data.predictions) return;
    var table = document.getElementById("predTable");
    var columns = currentSet === "eigenvector" ? EIGEN_COLUMNS : REGULAR_COLUMNS;
    var rows = currentRows();
    var q = search.trim().toLowerCase();
    if (q) {
      rows = rows.filter(function (p) {
        return p.favorite.toLowerCase().indexOf(q) !== -1 || p.underdog.toLowerCase().indexOf(q) !== -1;
      });
    }
    var sort = sortState[currentSet];
    var sorted = SG.sortRows(rows, columns, sort);
    SG.buildHead(table, columns, sort, function (key) {
      SG.toggleSort(sort, key, columns);
      render();
    });
    SG.fillBody(table, columns, sorted);
    document.getElementById("predCount").textContent = rows.length + " games";
    document.getElementById("predNote").textContent = NOTES[currentSet];
  }

  function init() {
    SG.$$("#predSet .seg").forEach(function (seg) {
      seg.addEventListener("click", function () {
        currentSet = seg.dataset.set;
        SG.$$("#predSet .seg").forEach(function (s) { s.classList.toggle("active", s === seg); });
        render();
      });
    });
    var box = document.getElementById("predSearch");
    box.addEventListener("input", function (e) { search = e.target.value; render(); });
    render();
  }

  register();
})();

