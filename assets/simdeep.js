/* Simulation Deep Dive: analyze Monte Carlo simulation results with filters. */
(function () {
  "use strict";

  var SG = window.SG;
  var view = { sim: null, simRuns: null };
  var filterRowCount = 0;

  function init() {
    if (!SG.state.data) return;

    document.getElementById("simdeepAddFilter").addEventListener("click", addFilterRow);
    addFilterRow(); // start with one row

    // Listen for simulation completion on playoff tab
    if (window.SG && SG.state.modules && SG.state.modules.playoff) {
      var originalRender = SG.state.modules.playoff.render;
      SG.state.modules.playoff.render = function () {
        originalRender.call(this);
        if (view.sim && view.sim.debugRuns) {
          onSimDataReady();
        }
      };
    }
  }

  function onSimDataReady() {
    document.getElementById("simdeepNote").textContent = "Simulation data ready. Add filters and click Run deep dive.";
  }

  function addFilterRow() {
    filterRowCount++;
    var rowId = "filterRow-" + filterRowCount;
    var container = document.getElementById("simdeepFilterRows");

    var row = document.createElement("div");
    row.className = "simdeep-filter-row";
    row.id = rowId;
    row.innerHTML =
      '<div class="simdeep-row-header">' +
        '<span class="simdeep-row-label">Filter ' + filterRowCount + '</span>' +
        '<button type="button" class="simdeep-remove-row" data-row="' + rowId + '" title="Remove filter" aria-label="Remove filter">\u2715</button>' +
      '</div>' +
      '<div class="simdeep-row-fields">' +
        '<label class="inline-label">Team' +
          '<select class="simdeep-team" aria-label="Team">' +
            '<option value="">Any team</option>' +
          '</select>' +
        '</label>' +
        '<label class="inline-label">Conf champ' +
          '<select class="simdeep-conf-champ" aria-label="Conference champion">' +
            '<option value="">Any</option>' +
          '</select>' +
        '</label>' +
        '<label class="inline-label">Bid type' +
          '<select class="simdeep-bid-type" aria-label="Bid type">' +
            '<option value="">Any</option>' +
            '<option value="P4 champ">P4 champ</option>' +
            '<option value="G6 bid">G6 bid</option>' +
            '<option value="At-large">At-large</option>' +
          '</select>' +
        '</label>' +
        '<label class="inline-label">Overall' +
          '<input type="number" class="simdeep-ow" min="0" max="15" placeholder="W" style="width: 3rem;" aria-label="Wins">' +
          '<input type="number" class="simdeep-ol" min="0" max="15" placeholder="L" style="width: 3rem;" aria-label="Losses">' +
          '<span class="simdeep-record-range overall" style="display:none;"></span>' +
        '</label>' +
        '<label class="inline-label">Conf' +
          '<input type="number" class="simdeep-cw" min="0" max="15" placeholder="W" style="width: 3rem;" aria-label="Conf Wins">' +
          '<input type="number" class="simdeep-cl" min="0" max="15" placeholder="L" style="width: 3rem;" aria-label="Conf Losses">' +
          '<span class="simdeep-record-range conf" style="display:none;"></span>' +
        '</label>' +
      '</div>';

    container.appendChild(row);

    // Wire up remove button
    row.querySelector(".simdeep-remove-row").addEventListener("click", function () {
      if (container.querySelectorAll(".simdeep-filter-row").length <= 1) return; // keep at least one
      row.remove();
      updateRowLabels();
    });

    // Wire up team change to update record ranges
    var teamSelect = row.querySelector(".simdeep-team");
    teamSelect.addEventListener("change", function () {
      updateRecordRanges(row, this.value);
    });

    // Populate selects
    populateTeamSelect(teamSelect);
    populateConfChampSelect(row.querySelector(".simdeep-conf-champ"));
    populateBidTypeSelect(row.querySelector(".simdeep-bid-type"));

    // Show/hide min/max when team selected
    if (teamSelect.value) {
      updateRecordRanges(row, teamSelect.value);
    }
  }

  function updateRowLabels() {
    var rows = document.querySelectorAll(".simdeep-filter-row");
    rows.forEach(function (row, idx) {
      row.querySelector(".simdeep-row-label").textContent = "Filter " + (idx + 1);
      row.id = "filterRow-" + (idx + 1);
      row.querySelector(".simdeep-remove-row").setAttribute("data-row", row.id);
    });
    filterRowCount = rows.length;
  }

  function populateTeamSelect(select) {
    var teams = SG.state.data.teams.filter(function (t) { return t.level === "A"; });
    var current = select.value;
    select.innerHTML = '<option value="">Any team</option>';
    teams.forEach(function (t) {
      var opt = document.createElement("option");
      opt.value = t.team;
      opt.textContent = t.team;
      select.appendChild(opt);
    });
    select.value = current;
  }

  function populateConfChampSelect(select) {
    var conferences = SG.state.data.conferences
      .filter(function (c) { return c.level === "A"; })
      .map(function (c) { return c.name; })
      .sort();
    var current = select.value;
    select.innerHTML = '<option value="">Any</option>';
    conferences.forEach(function (c) {
      var opt = document.createElement("option");
      opt.value = c;
      opt.textContent = c;
      select.appendChild(opt);
    });
    select.value = current;
  }

  function populateBidTypeSelect(select) {
    var current = select.value;
    select.innerHTML =
      '<option value="">Any</option>' +
      '<option value="P4 champ">P4 champ</option>' +
      '<option value="G6 bid">G6 bid</option>' +
      '<option value="At-large">At-large</option>';
    select.value = current;
  }

  function updateRecordRanges(row, teamName) {
    if (!teamName || !view.sim || !view.sim.debugRuns) {
      row.querySelector(".simdeep-record-range.overall").style.display = "none";
      row.querySelector(".simdeep-record-range.conf").style.display = "none";
      return;
    }

    var runs = view.sim.debugRuns;
    var owMin = 99, owMax = -1, olMin = 99, olMax = -1;
    var cwMin = 99, cwMax = -1, clMin = 99, clMax = -1;
    var found = false;

    runs.forEach(function (run) {
      var rec = run.records[teamName];
      if (!rec) return;
      found = true;
      if (rec.ow < owMin) owMin = rec.ow;
      if (rec.ow > owMax) owMax = rec.ow;
      if (rec.ol < olMin) olMin = rec.ol;
      if (rec.ol > olMax) olMax = rec.ol;
      if (rec.cw < cwMin) cwMin = rec.cw;
      if (rec.cw > cwMax) cwMax = rec.cw;
      if (rec.cl < clMin) clMin = rec.cl;
      if (rec.cl > clMax) clMax = rec.cl;
    });

    var overallEl = row.querySelector(".simdeep-record-range.overall");
    var confEl = row.querySelector(".simdeep-record-range.conf");

    if (found) {
      overallEl.textContent = " (range: " + owMin + "-" + owMax + " W, " + olMin + "-" + olMax + " L)";
      overallEl.style.display = "inline";
      confEl.textContent = " (range: " + cwMin + "-" + cwMax + " W, " + clMin + "-" + clMax + " L)";
      confEl.style.display = "inline";
    } else {
      overallEl.style.display = "none";
      confEl.style.display = "none";
    }
  }

  // ---- Simulation ----

  function runDeepDive() {
    if (!view.sim || !view.sim.debugRuns) {
      runSimulationThenFilter();
      return;
    }
    applyFilters();
  }

  function runSimulationThenFilter() {
    var btn = document.getElementById("simdeepRun");
    var note = document.getElementById("simdeepNote");
    var loading = document.getElementById("simdeepLoading");

    if (!SG.state.modules || !SG.state.modules.playoff) {
      note.textContent = "Playoff module not loaded.";
      return;
    }

    btn.disabled = true;
    btn.textContent = "Simulating...";
    loading.classList.remove("hidden");
    note.textContent = "Running 10,000 simulations...";

    // Use the playoff module's computeSim directly but with debug capture
    var playoffModule = SG.state.modules.playoff;
    if (!playoffModule) {
      note.textContent = "Playoff module not available.";
      btn.disabled = false;
      btn.textContent = "Run deep dive";
      loading.classList.add("hidden");
      return;
    }

    // We need to trigger a fresh simulation with debug capture
    // The playoff module stores view.sim after computeSim
    // We'll call the internal computeSim with debug enabled
    var originalComputeSim = playoffModule.computeSim;
    playoffModule.computeSim = function () {
      return computeSimWithDebug();
    };

    setTimeout(function () {
      try {
        var simResult = playoffModule.computeSim();
        playoffModule.renderSim(simResult);
        view.sim = simResult;
        onSimDataReady();
        applyFilters();
      } finally {
        playoffModule.computeSim = originalComputeSim;
        btn.disabled = false;
        btn.textContent = "Run deep dive";
        loading.classList.add("hidden");
      }
    }, 40);
  }

  function computeSimWithDebug() {
    var method = SG.state.modules.playoff.view.method;
    var format = SG.state.modules.playoff.view.format;
    var is12 = Number(format) === 12;

    var ctx = simContext(method);
    var fieldCount = {}, champCount = {};
    var debugRuns = [];

    for (var i = 0; i < SIMS; i++) {
      var regRec = cloneRecords(ctx.base);
      for (var j = 0; j < ctx.games.length; j++) {
        var g = ctx.games[j];
        var hw = Math.random() < g.p;
        var rh = getRec(regRec, g.h), ra = getRec(regRec, g.a);
        rh.ow += hw ? 1 : 0; rh.ol += hw ? 0 : 1;
        ra.ow += hw ? 0 : 1; ra.ol += hw ? 1 : 0;
        if (g.conf) { rh.cw += hw ? 1 : 0; rh.cl += hw ? 0 : 1; ra.cw += hw ? 0 : 1; ra.cl += hw ? 1 : 0; }
      }
      var ccgs = is12 ? ccgOutcomes(regRec, method, true) : null;
      var f = fieldFromRecords(format, method, regRec, ccgs);
      for (var k = 1; k < f.seeds.length; k++) { var t = f.seeds[k]; if (t) fieldCount[t.team] = (fieldCount[t.team] || 0) + 1; }
      var r = runOnce(f.seeds, format, method, true);
      var c = r.champion.team.team;
      champCount[c] = (champCount[c] || 0) + 1;

      // Build field composition for this run
      var fieldTeams = f.seeds.slice(1).map(function (t, idx) { return { seed: idx + 1, team: t.team, bid: f.bid[t.team] }; });
      var confChamps = ccgs ? Object.keys(ccgs).map(function (c) { return { conf: c, champ: ccgs[c].winner.team }; }) : [];
      debugRuns.push({ run: i, field: fieldTeams, champion: c, confChamps: confChamps, records: regRec });
    }

    return { n: SIMS, field: fieldCount, champ: champCount, debugRuns: debugRuns };
  }

  // ---- Filter application ----

  function applyFilters() {
    if (!view.sim || !view.sim.debugRuns) {
      document.getElementById("simdeepNote").textContent = "No simulation data. Click Run deep dive first.";
      return;
    }

    var rows = document.querySelectorAll(".simdeep-filter-row");
    var allFilters = [];

    rows.forEach(function (row) {
      var filter = {
        team: row.querySelector(".simdeep-team").value || null,
        confChamp: row.querySelector(".simdeep-conf-champ").value || null,
        bidType: row.querySelector(".simdeep-bid-type").value || null,
        ow: parseInt(row.querySelector(".simdeep-ow").value) || null,
        ol: parseInt(row.querySelector(".simdeep-ol").value) || null,
        cw: parseInt(row.querySelector(".simdeep-cw").value) || null,
        cl: parseInt(row.querySelector(".simdeep-cl").value) || null,
      };
      // Only include filter if it has any criteria
      if (filter.team || filter.confChamp || filter.bidType ||
          filter.ow !== null || filter.ol !== null || filter.cw !== null || filter.cl !== null) {
        allFilters.push(filter);
      }
    });

    if (allFilters.length === 0) {
      document.getElementById("simdeepNote").textContent = "Add at least one filter criterion.";
      document.getElementById("simdeepResults").innerHTML = "";
      return;
    }

    var runs = view.sim.debugRuns;
    var filtered = runs.filter(function (run) {
      // Each filter row is OR (any row matches)
      return allFilters.some(function (filter) {
        return matchesFilter(run, filter);
      });
    });

    renderResults(filtered, view.sim.n);
  }

  function matchesFilter(run, filter) {
    if (filter.team) {
      var teamInField = run.field.some(function (f) { return f.team === filter.team; });
      if (!teamInField) return false;
    }
    if (filter.confChamp) {
      var isChamp = run.confChamps.some(function (c) { return c.conf === filter.confChamp; });
      if (!isChamp) return false;
    }
    if (filter.bidType && filter.team) {
      var bid = run.field.find(function (f) { return f.team === filter.team; });
      if (!bid || bid.bid.indexOf(filter.bidType) === -1) return false;
    }
    if (filter.ow !== null || filter.ol !== null || filter.cw !== null || filter.cl !== null) {
      var team = filter.team;
      if (!team) return false; // record filters require a team
      var rec = run.records[team];
      if (!rec) return false;
      if (filter.ow !== null && rec.ow !== filter.ow) return false;
      if (filter.ol !== null && rec.ol !== filter.ol) return false;
      if (filter.cw !== null && rec.cw !== filter.cw) return false;
      if (filter.cl !== null && rec.cl !== filter.cl) return false;
    }
    return true;
  }

  function renderResults(runs, totalSims) {
    var container = document.getElementById("simdeepResults");
    var note = document.getElementById("simdeepNote");
    var loading = document.getElementById("simdeepLoading");

    loading.classList.add("hidden");

    if (!runs.length) {
      container.innerHTML = '<div class="simdeep-empty">No runs match the filters.</div>';
      note.textContent = "0 of " + totalSims.toLocaleString() + " runs match the filters.";
      return;
    }

    note.textContent = runs.length + " of " + totalSims.toLocaleString() + " runs match the filters (" + (runs.length / totalSims * 100).toFixed(2) + "%).";

    var html = runs.map(function (run, idx) {
      var fieldHtml = run.field.slice(0, 12).map(function (f, i) {
        var bidClass = "";
        if (f.bid.indexOf("P4 champ") !== -1) bidClass = "bid-p4";
        else if (f.bid.indexOf("G6 bid") !== -1) bidClass = "bid-g6";
        else bidClass = "bid-atlarge";
        return '<div class="simdeep-field-team"><span class="simdeep-seed">' + (i + 1) + '</span><span class="simdeep-team-name">' + f.team + '</span><span class="simdeep-bid ' + bidClass + '">' + f.bid + '</span></div>';
      }).join("");

      var championHtml = run.champion ? '<div class="simdeep-champion">Champion: <strong>' + run.champion + '</strong></div>' : '';

      var confChampsHtml = run.confChamps.map(function (c) {
        return '<span class="simdeep-conf-champ">' + c.conf + ': ' + c.champ + '</span>';
      }).join(" ");

      return '<div class="simdeep-card">' +
        '<div class="simdeep-card-header">' +
          '<div class="simdeep-team"><span class="simdeep-seed">Run #' + (run.run + 1) + '</span></div>' +
          '<button type="button" class="simdeep-expand" data-run="' + run.run + '">Show details</button>' +
        '</div>' +
        '<div class="simdeep-stats">' +
          '<div class="simdeep-stat"><span class="simdeep-stat-label">Teams in field</span><span class="simdeep-stat-value">' + run.field.length + '</span></div>' +
          '<div class="simdeep-stat"><span class="simdeep-stat-label">Champion</span><span class="simdeep-stat-value">' + (run.champion || "—") + '</span></div>' +
        '</div>' +
        '<div class="simdeep-field">' + fieldHtml + '</div>' +
        championHtml +
        '<div class="simdeep-conf-champs">' + confChampsHtml + '</div>' +
        '<button type="button" class="simdeep-expand" data-run="' + run.run + '">Show details</button>' +
        '<div class="simdeep-details" id="simdeep-details-' + run.run + '">' +
          buildDetailsHtml(run) +
        '</div>' +
      '</div>';
    }).join("");

    container.innerHTML = html;

    container.querySelectorAll(".simdeep-expand").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var runIdx = btn.getAttribute("data-run");
        var details = document.getElementById("simdeep-details-" + runIdx);
        if (details) {
          details.classList.toggle("open");
          btn.textContent = details.classList.contains("open") ? "Hide details" : "Show details";
        }
      });
    });
  }

  function buildDetailsHtml(run) {
    var rec = run.records;
    var teamNames = Object.keys(rec).sort();

    var rows = teamNames.map(function (team) {
      var r = rec[team];
      var ow = r.ow || 0, ol = r.ol || 0, cw = r.cw || 0, cl = r.cl || 0;
      var bid = run.field.find(function (f) { return f.team === team; });
      return '<div class="simdeep-detail-row">' +
        '<span class="simdeep-detail-label">' + team + '</span>' +
        '<span class="simdeep-detail-value">' + ow + '-' + ol + ' (' + cw + '-' + cl + ')' + (bid ? ' [' + bid.bid + ']' : '') + '</span>' +
      '</div>';
    }).join("");

    return '<div class="simdeep-detail-header">Full records for this run</div>' + rows;
  }

  // Need to import functions from playoff module
  var SIMS = 10000;
  function getRec(rec, team) { return rec[team] || (rec[team] = { cw: 0, cl: 0, ow: 0, ol: 0 }); }
  function cloneRecords(rec) { var out = {}; Object.keys(rec).forEach(function (k) { out[k] = { cw: rec[k].cw, cl: rec[k].cl, ow: rec[k].ow, ol: rec[k].ol }; }); return out; }
  function simContext(method) { return SG.state.modules.playoff.simContext(method); }
  function ccgOutcomes(regRec, method, stochastic) { return SG.state.modules.playoff.ccgOutcomes(regRec, method, stochastic); }
  function fieldFromRecords(format, method, regRec, ccgs) { return SG.state.modules.playoff.fieldFromRecords(format, method, regRec, ccgs); }
  function runOnce(seeds, format, method, stochastic) { return SG.state.modules.playoff.runOnce(seeds, format, method, stochastic); }

  // Expose for tab switching
  SG.state.modules.simdeep = { init: init, render: function () { if (!SG.state.data) return; if (view.sim && view.sim.debugRuns) onSimDataReady(); } };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();