/* Simulation Deep Dive: analyze Monte Carlo simulation results with filters. */
(function () {
  "use strict";

  var SG = window.SG;
  var view = { sim: null, simRuns: null };

  function init() {
    if (!SG.state.data) return;

    populateTeamSelect();
    populateConfChampSelect();

    document.getElementById("simdeepRun").addEventListener("click", runDeepDive);
  }

  function render() {
    if (!SG.state.data) return;
    populateTeamSelect();
    populateConfChampSelect();
    // Re-run if we have filters and simulation data
    if (view.sim && view.sim.debugRuns) {
      runDeepDive();
    }
  }

  function populateTeamSelect() {
    var sel = document.getElementById("simdeepTeam");
    if (!sel) return;
    var teams = SG.state.data.teams.filter(function (t) { return t.level === "A"; });
    teams.forEach(function (t) {
      var opt = document.createElement("option");
      opt.value = t.team;
      opt.textContent = t.team;
      sel.appendChild(opt);
    });
  }

  function populateConfChampSelect() {
    var sel = document.getElementById("simdeepConfChamp");
    if (!sel) return;
    var conferences = SG.state.data.conferences
      .filter(function (c) { return c.level === "A"; })
      .map(function (c) { return c.name; })
      .sort();
    conferences.forEach(function (c) {
      var opt = document.createElement("option");
      opt.value = c;
      opt.textContent = c;
      sel.appendChild(opt);
    });
  }

  function runDeepDive() {
    var sim = view.sim;
    if (!sim || !sim.debugRuns) {
      document.getElementById("simdeepNote").textContent = "No simulation data available. Run a simulation on the Playoff Predictor tab first (with ?debug=sim).";
      return;
    }

    var filters = {
      team: document.getElementById("simdeepTeam").value || null,
      confChamp: document.getElementById("simdeepConfChamp").value || null,
      bidType: document.getElementById("simdeepBidType").value || null,
      ow: parseInt(document.getElementById("simdeepOw").value) || null,
      ol: parseInt(document.getElementById("simdeepOl").value) || null,
      cw: parseInt(document.getElementById("simdeepCw").value) || null,
      cl: parseInt(document.getElementById("simdeepCl").value) || null,
    };

    var runs = sim.debugRuns;
    var filtered = runs.filter(function (run) {
      if (filters.team) {
        var teamInField = run.field.some(function (f) { return f.team === filters.team; });
        if (!teamInField) return false;
      }
      if (filters.confChamp) {
        var isChamp = run.confChamps.some(function (c) { return c.conf === filters.confChamp; });
        if (!isChamp) return false;
      }
      if (filters.bidType && filters.team) {
        var bid = run.field.find(function (f) { return f.team === filters.team; });
        if (!bid || bid.bid.indexOf(filters.bidType) === -1) return false;
      }
      if (filters.ow !== null || filters.ol !== null || filters.cw !== null || filters.cl !== null) {
        var team = filters.team;
        if (!team) return false;
        var rec = run.records[team];
        if (!rec) return false;
        if (filters.ow !== null && rec.ow !== filters.ow) return false;
        if (filters.ol !== null && rec.ol !== filters.ol) return false;
        if (filters.cw !== null && rec.cw !== filters.cw) return false;
        if (filters.cl !== null && rec.cl !== filters.cl) return false;
      }
      return true;
    });

    renderResults(filtered, sim.n);
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
      // Build field teams with bid info
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
          '<button type="button" class="simdeep-expand" data-run="' + run.run + '">Details</button>' +
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

    // Attach expand handlers
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

  // Expose for tab switching
  SG.state.modules.simdeep = { init: init, render: render };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();