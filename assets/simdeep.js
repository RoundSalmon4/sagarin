/* Simulation Deep Dive (beta): analyze Monte Carlo simulation results with filters. */
(function () {
  "use strict";

  var SG = window.SG;
  var view = { sim: null };
  var filterRowCount = 0;

  // Build team -> conference map for sync logic
  var teamToConf = {};
  function buildTeamToConf() {
    if (!SG.state.data) return;
    teamToConf = {};
    SG.state.data.teams.forEach(function (t) {
      if (t.level === "A") teamToConf[t.team] = t.conference;
    });
  }

  function init() {
    if (!SG.state.data) return;
    buildTeamToConf();

    document.getElementById("simdeepAddFilter").addEventListener("click", addFilterRow);
    document.getElementById("simdeepRunSim").addEventListener("click", runSimulationThenFilter);

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

    // Check if playoff already has sim data
    if (SG.state.modules && SG.state.modules.playoff && SG.state.modules.playoff.view.sim && SG.state.modules.playoff.view.sim.debugRuns) {
      view.sim = SG.state.modules.playoff.view.sim;
      onSimDataReady();
    }
  }

  function onSimDataReady() {
    document.getElementById("simdeepNote").textContent = "Simulation data ready. Add filters to explore results (not to create events) and click Run deep dive.";
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
        '<label class="inline-label">' +
          '<input type="checkbox" class="simdeep-param-check" data-param="team" checked aria-label="Include team filter"> Team' +
          '<div class="combo">' +
            '<input type="text" class="simdeep-team-search" placeholder="Type a team name" autocomplete="off" aria-label="Team" role="combobox" aria-expanded="false">' +
            '<div class="combo-list hidden" role="listbox"></div>' +
          '</div>' +
        '</label>' +
        '<label class="inline-label">' +
          '<input type="checkbox" class="simdeep-param-check" data-param="confChamp" checked aria-label="Include conf champ filter"> Conf champ' +
          '<select class="simdeep-conf-champ" aria-label="Conference champion">' +
            '<option value="">Any</option>' +
          '</select>' +
        '</label>' +
        '<label class="inline-label">' +
          '<input type="checkbox" class="simdeep-param-check" data-param="overall" checked aria-label="Include overall record filter"> Overall' +
          '<input type="number" class="simdeep-ow" min="0" max="15" placeholder="W" style="width: 3rem;" aria-label="Wins">' +
          '<input type="number" class="simdeep-ol" min="0" max="15" placeholder="L" style="width: 3rem;" aria-label="Losses">' +
          '<span class="simdeep-record-range overall" style="display:none;"></span>' +
        '</label>' +
        '<label class="inline-label">' +
          '<input type="checkbox" class="simdeep-param-check" data-param="conf" checked aria-label="Include conf record filter"> Conf' +
          '<input type="number" class="simdeep-cw" min="0" max="15" placeholder="W" style="width: 3rem;" aria-label="Conf Wins">' +
          '<input type="number" class="simdeep-cl" min="0" max="15" placeholder="L" style="width: 3rem;" aria-label="Conf Losses">' +
          '<span class="simdeep-record-range conf" style="display:none;"></span>' +
        '</label>' +
      '</div>';

    container.appendChild(row);

    // Set up combo box for team search (like schedule tab)
    var combo = row.querySelector(".combo");
    var searchInput = combo.querySelector(".simdeep-team-search");
    var listEl = combo.querySelector(".combo-list");
    var activeIndex = -1;

    function currentTeam() {
      return searchInput.value.trim();
    }

    function closeList() {
      listEl.classList.add("hidden");
      searchInput.setAttribute("aria-expanded", "false");
      activeIndex = -1;
    }

    function renderList(open) {
      var query = currentTeam().toLowerCase();
      var teams = SG.state.data.teams.filter(function (t) {
        return t.level === "A" && (t.team.toLowerCase().indexOf(query) !== -1 || t.conference.toLowerCase().indexOf(query) !== -1);
      });
      var confFilter = row.querySelector(".simdeep-conf-champ").value;
      if (confFilter) {
        teams = teams.filter(function (t) { return t.conference === confFilter; });
      }
      if (!teams.length) {
        listEl.innerHTML = '<div class="combo-empty">No teams match</div>';
      } else {
        listEl.innerHTML = teams.map(function (t) {
          return '<div class="combo-item" role="option" data-name="' + t.team + '">' +
            SG.teamLogo(t.team) + '<span class="ci-name">' + SG.esc(t.team) + '</span>' +
            '<span class="ci-meta">' + SG.esc(t.conference) + '</span>' +
          '</div>';
        }).join("");
      }
      activeIndex = -1;
      if (open) listEl.classList.remove("hidden"); else listEl.classList.add("hidden");
      searchInput.setAttribute("aria-expanded", open ? "true" : "false");
    }

    function setActive(i) {
      var arr = listEl.querySelectorAll(".combo-item");
      if (!arr.length) return;
      if (i < 0) i = arr.length - 1;
      if (i >= arr.length) i = 0;
      for (var k = 0; k < arr.length; k++) arr[k].classList.toggle("active", k === i);
      if (arr[i] && arr[i].scrollIntoView) arr[i].scrollIntoView({ block: "nearest" });
    }

    function pick(name) {
      searchInput.value = name;
      searchInput.dispatchEvent(new Event("change", { bubbles: true }));
      closeList();
    }

    searchInput.addEventListener("input", function () {
      clearTimeout(window.simdeepTimer);
      window.simdeepTimer = setTimeout(function () { renderList(true); }, 120);
    });
    searchInput.addEventListener("focus", function () { renderList(true); });
    searchInput.addEventListener("keydown", function (e) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (listEl.classList.contains("hidden")) renderList(true);
        setActive(activeIndex + 1);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive(activeIndex - 1);
      } else if (e.key === "Enter") {
        var arr = listEl.querySelectorAll(".combo-item");
        if (activeIndex >= 0 && arr[activeIndex]) {
          e.preventDefault();
          pick(arr[activeIndex].dataset.name);
        }
      } else if (e.key === "Escape") {
        closeList();
      }
    });
    searchInput.addEventListener("change", function () {
      var teamName = searchInput.value;
      var confChampSelect = row.querySelector(".simdeep-conf-champ");
      if (teamName && teamToConf[teamName]) {
        confChampSelect.value = teamToConf[teamName];
      }
      updateRecordRanges(row, teamName);
    });

    listEl.addEventListener("click", function (e) {
      var item = e.target.closest ? e.target.closest(".combo-item") : null;
      if (item) pick(item.dataset.name);
    });
    document.addEventListener("click", function (e) {
      if (!combo.contains(e.target)) closeList();
    });

    // Conf champ change -> clear team search if team not in that conf
    var confChampSelect = row.querySelector(".simdeep-conf-champ");
    confChampSelect.addEventListener("change", function () {
      var confName = this.value;
      var searchInput = row.querySelector(".simdeep-team-search");
      if (searchInput.value && teamToConf[searchInput.value] && teamToConf[searchInput.value] !== confName) {
        // Team doesn't belong to selected conf - clear team
        searchInput.value = "";
        updateRecordRanges(row, "");
      }
    });

    // Populate conf champ select
    populateConfChampSelect(row.querySelector(".simdeep-conf-champ"));

    container.appendChild(row);
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

  function updateRecordRanges(row, teamName) {
    var overallEl = row.querySelector(".simdeep-record-range.overall");
    var confEl = row.querySelector(".simdeep-record-range.conf");

    if (!teamName || !view.sim || !view.sim.debugRuns) {
      overallEl.style.display = "none";
      confEl.style.display = "none";
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

    if (found) {
      overallEl.textContent = " (range: " + owMin + "-" + owMax + " W, " + olMin + "-" + olMax + " L)";
      overallEl.style.display = "inline";
      confEl.textContent = " (range: " + cwMin + "-" + cwMax + " W, " + clMin + "-" + clMax + " L)";
      confEl.style.display = "inline";
      var owInput = row.querySelector(".simdeep-ow");
      var olInput = row.querySelector(".simdeep-ol");
      var cwInput = row.querySelector(".simdeep-cw");
      var clInput = row.querySelector(".simdeep-cl");
      if (owInput) { owInput.min = owMin; owInput.max = owMax; }
      if (olInput) { olInput.min = olMin; olInput.max = olMax; }
      if (cwInput) { cwInput.min = cwMin; cwInput.max = cwMax; }
      if (clInput) { clInput.min = clMin; clInput.max = clMax; }
    } else {
      overallEl.style.display = "none";
      confEl.style.display = "none";
      var owInput = row.querySelector(".simdeep-ow");
      var olInput = row.querySelector(".simdeep-ol");
      var cwInput = row.querySelector(".simdeep-cw");
      var clInput = row.querySelector(".simdeep-cl");
      if (owInput) { owInput.min = 0; owInput.max = 15; }
      if (olInput) { olInput.min = 0; olInput.max = 15; }
      if (cwInput) { cwInput.min = 0; cwInput.max = 15; }
      if (clInput) { clInput.min = 0; clInput.max = 15; }
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
    var btn = document.getElementById("simdeepRunSim");
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

    var playoffModule = SG.state.modules.playoff;
    var playoffView = playoffModule.view;
    if (!playoffModule || !playoffView) {
      note.textContent = "Playoff module not available.";
      btn.disabled = false;
      btn.textContent = "Run simulation";
      loading.classList.add("hidden");
      return;
    }

    btn.disabled = true;
    btn.textContent = "Simulating...";
    loading.classList.remove("hidden");
    note.textContent = "Running 10,000 simulations...";

    var prevDebug = (SG.debug && SG.debug.sim) ? SG.debug.sim : false;
    SG.debug = SG.debug || {};
    SG.debug.sim = true;

    setTimeout(function () {
      try {
        var simResult = playoffModule.computeSim();
        SG.debug.sim = prevDebug;
        playoffView.sim = simResult;
        view.sim = simResult;
        playoffModule.render();
        onSimDataReady();
        applyFilters();
      } catch (e) {
        SG.debug.sim = prevDebug;
        console.error("Simulation failed:", e);
        note.textContent = "Simulation failed. See console for details.";
      } finally {
        btn.disabled = false;
        btn.textContent = "Run simulation";
        loading.classList.add("hidden");
      }
    }, 40);
  }

  // ---- Filter application ----

  function applyFilters() {
    var playoffView = SG.state.modules.playoff ? SG.state.modules.playoff.view : null;
    if ((!view.sim || !view.sim.debugRuns) && (!playoffView || !playoffView.sim || !playoffView.sim.debugRuns)) {
      document.getElementById("simdeepNote").textContent = "No simulation data. Click Run simulation first.";
      return;
    }

    // Use playoff's sim if local doesn't have it
    if (!view.sim || !view.sim.debugRuns) {
      view.sim = playoffView.sim;
      onSimDataReady();
    }

    var rows = document.querySelectorAll(".simdeep-filter-row");
    var allFilters = [];
    var hasValidFilter = false;

    rows.forEach(function (row) {
      var teamCheck = row.querySelector('.simdeep-param-check[data-param="team"]');
      var confChampCheck = row.querySelector('.simdeep-param-check[data-param="confChamp"]');
      var overallCheck = row.querySelector('.simdeep-param-check[data-param="overall"]');
      var confCheck = row.querySelector('.simdeep-param-check[data-param="conf"]');

      var team = (teamCheck && teamCheck.checked) ? row.querySelector(".simdeep-team-search").value.trim() || null : null;
      var confChamp = (confChampCheck && confChampCheck.checked) ? row.querySelector(".simdeep-conf-champ").value || null : null;
      var ow = (overallCheck && overallCheck.checked) ? parseInt(row.querySelector(".simdeep-ow").value) || null : null;
      var ol = (overallCheck && overallCheck.checked) ? parseInt(row.querySelector(".simdeep-ol").value) || null : null;
      var cw = (confCheck && confCheck.checked) ? parseInt(row.querySelector(".simdeep-cw").value) || null : null;
      var cl = (confCheck && confCheck.checked) ? parseInt(row.querySelector(".simdeep-cl").value) || null : null;

      // Skip empty rows
      if (!team && !confChamp && ow === null && ol === null && cw === null && cl === null) return;

      // Conflict check: team must belong to selected conf champ
      if (team && confChamp && teamToConf[team] !== confChamp) {
        document.getElementById("simdeepNote").textContent = "Filter " + row.querySelector(".simdeep-row-label").textContent + ": " + team + " is not in " + confChamp;
        return;
      }

      allFilters.push({ team: team, confChamp: confChamp, ow: ow, ol: ol, cw: cw, cl: cl });
      hasValidFilter = true;
    });

    if (!hasValidFilter) {
      document.getElementById("simdeepNote").textContent = "Add at least one filter criterion (team, conf champ, or record).";
      document.getElementById("simdeepResults").innerHTML = "";
      return;
    }

    var runs = view.sim.debugRuns;
    var filtered = runs.filter(function (run) {
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
    if (filter.team && (filter.ow !== null || filter.ol !== null || filter.cw !== null || filter.cl !== null)) {
      var rec = run.records[filter.team];
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

  var SIMS = 10000;

  SG.state.modules.simdeep = { init: init, render: function () { if (!SG.state.data) return; if (view.sim && view.sim.debugRuns) onSimDataReady(); } };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();