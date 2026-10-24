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
      if (t.level === "A") teamToConf[t.team] = (SG.mergeConf ? SG.mergeConf(t.conference) : t.conference);
    });
  }

  function init() {
    if (!SG.state.data) return;
    buildTeamToConf();

    document.getElementById("simdeepAddFilter").addEventListener("click", addFilterRow);
    document.getElementById("simdeepRunSim").addEventListener("click", runSimulationThenFilter);
    document.getElementById("simdeepFormat").addEventListener("change", function () {
      if (SG.state.modules && SG.state.modules.playoff && SG.state.modules.playoff.view) {
        SG.state.modules.playoff.view.format = this.value;
      }
    });

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
          '<input type="checkbox" class="simdeep-param-check" data-param="team" aria-label="Include team filter" title="Filter by a specific team in the playoff projection"> Team' +
          '<div class="combo">' +
            '<input type="text" class="simdeep-team-search" placeholder="Type a team name" autocomplete="off" aria-label="Team" role="combobox" aria-expanded="false" title="Search for a team to filter by">' +
            '<div class="combo-list hidden" role="listbox"></div>' +
          '</div>' +
        '</label>' +
        '<label class="inline-label">' +
          '<input type="checkbox" class="simdeep-param-check" data-param="confChamp" aria-label="Include conf champ filter" title="Filter by conference champion (select conference; if team is also set, requires that team to be the champ)"> Conf champ' +
          '<select class="simdeep-conf-champ" aria-label="Conference champion" title="Choose a conference; if Team is also selected, that team must be the conference champion">' +
            '<option value="">Any</option>' +
          '</select>' +
        '</label>' +
        '<label class="inline-label">' +
          '<input type="checkbox" class="simdeep-param-check" data-param="overall" aria-label="Include overall record filter" title="Filter by overall win/loss record (use operators for greater/less than)"> Overall' +
          '<select class="simdeep-op-ow" aria-label="Overall wins operator" title="Choose comparison operator: =, >, <, >=, <="><option value="=" selected>=</option><option value=">">></option><option value="<"><</option><option value=">=">>=</option><option value="<="><=</option></select>' +
          '<input type="number" class="simdeep-ow" min="0" max="15" placeholder="W" style="width: 3rem;" aria-label="Wins">' +
          '<select class="simdeep-op-ol" aria-label="Overall losses operator" title="Choose comparison operator: =, >, <, >=, <="><option value="=" selected>=</option><option value=">">></option><option value="<"><</option><option value=">=">>=</option><option value="<="><=</option></select>' +
          '<input type="number" class="simdeep-ol" min="0" max="15" placeholder="L" style="width: 3rem;" aria-label="Losses" title="Overall losses filter (use operator for comparisons)"> <span class="simdeep-record-range overall" style="font-size:0.75rem;color:var(--muted);display:inline-block;margin-left:0.3rem;"></span>' +
        '</label>' +
        '<label class="inline-label">' +
          '<input type="checkbox" class="simdeep-param-check" data-param="conf" aria-label="Include conf record filter" title="Filter by conference win/loss record (use operators for greater/less than)"> Conf' +
          '<select class="simdeep-op-cw" aria-label="Conf wins operator" title="Choose comparison operator: =, >, <, >=, <="><option value="=" selected>=</option><option value=">">></option><option value="<"><</option><option value=">=">>=</option><option value="<="><=</option></select>' +
          '<input type="number" class="simdeep-cw" min="0" max="15" placeholder="W" style="width: 3rem;" aria-label="Conf Wins">' +
          '<select class="simdeep-op-cl" aria-label="Conf losses operator" title="Choose comparison operator: =, >, <, >=, <="><option value="=" selected>=</option><option value=">">></option><option value="<"><</option><option value=">=">>=</option><option value="<="><=</option></select>' +
          '<input type="number" class="simdeep-cl" min="0" max="15" placeholder="L" style="width: 3rem;" aria-label="Conf Losses" title="Conference losses filter (use operator for comparisons)"> <span class="simdeep-record-range conf" style="font-size:0.75rem;color:var(--muted);display:inline-block;margin-left:0.3rem;"></span>' +
        '</label>' +
        '<label class="inline-label">' +
          '<input type="checkbox" class="simdeep-param-check" data-param="inField" aria-label="Team must be in projected field" title="Only count runs where this team appears in the playoff field"> In field' +
        '</label>' +
        '<label class="inline-label">' +
          '<input type="checkbox" class="simdeep-param-check" data-param="champion" aria-label="Filter by champion team" title="Only match runs where this team wins the championship"> Champion' +
          '<input type="text" class="simdeep-champion-search" placeholder="Team name" autocomplete="off" aria-label="Champion team" style="width: 8rem;">' +
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
        // Restrict conf champ dropdown to this team’s conference
        var confName = teamToConf[teamName];
        var opts = confChampSelect.querySelectorAll("option");
        opts.forEach(function (o) { o.style.display = (o.value === "" || o.value === confName) ? "" : "none"; });
      } else {
        // Restore all conf options when team cleared
        var opts = confChampSelect.querySelectorAll("option");
        opts.forEach(function (o) { o.style.display = ""; });
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

    // Auto-apply when any filter value changes (if sim ready)
    function tryApply() {
      if (view.sim && view.sim.debugRuns) applyFilters();
    }
    var inputs = row.querySelectorAll("input[type='number'], input[type='text'], input[type='checkbox'], select");
    inputs.forEach(function (el) {
      el.addEventListener("change", tryApply);
      if (el.tagName === "INPUT" && el.type === "text") {
        el.addEventListener("blur", tryApply);
      }
    });

    // Conf champ change -> clear team search if team not in that conf
    var confChampSelect = row.querySelector(".simdeep-conf-champ");
    confChampSelect.addEventListener("change", function () {
      var confName = this.value;
      var searchInput = row.querySelector(".simdeep-team-search");
      if (searchInput.value && teamToConf[searchInput.value] && teamToConf[searchInput.value] !== confName) {
        // Team doesn't belong to selected conf - clear team
        searchInput.value = "";
        searchInput.dispatchEvent(new Event("change", { bubbles: true }));
        updateRecordRanges(row, "");
      }
      // If conf cleared, restore all conf options; if set, restrict to match team if any
      var opts = confChampSelect.querySelectorAll("option");
      if (!confName) {
        opts.forEach(function (o) { o.style.display = ""; });
      } else if (searchInput.value && teamToConf[searchInput.value]) {
        // Already handled by team change; just ensure consistency
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
      .map(function (c) { return (SG.mergeConf ? SG.mergeConf(c.name) : c.name); })
      .filter(function (c, idx, arr) { return arr.indexOf(c) === idx; })
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

  function computeDataRanges(teamName) {
    var method = (SG.state.modules.playoff && SG.state.modules.playoff.view) ? SG.state.modules.playoff.view.method : "predictor";
    var ctx = null;
    try { ctx = SG.state.modules.playoff.simContext(method); } catch (e) {}
    var base = (ctx && ctx.base) ? ctx.base : {};
    var games = (ctx && ctx.games) ? ctx.games : [];
    // Count remaining games per team
    var remW = {}, remL = {}, remCW = {}, remCL = {};
    games.forEach(function (g) {
      var h = g.h, a = g.a, conf = g.conf;
      if (h) { remW[h] = (remW[h] || 0) + 1; remL[h] = (remL[h] || 0) + 1; }
      if (a) { remW[a] = (remW[a] || 0) + 1; remL[a] = (remL[a] || 0) + 1; }
      if (conf) {
        if (h) { remCW[h] = (remCW[h] || 0) + 1; remCL[h] = (remCL[h] || 0) + 1; }
        if (a) { remCW[a] = (remCW[a] || 0) + 1; remCL[a] = (remCL[a] || 0) + 1; }
      }
    });
    function range(name) {
      var rec = base[name] || { ow: 0, ol: 0, cw: 0, cl: 0 };
      return {
        owMin: rec.ow, owMax: rec.ow + (remW[name] || 0),
        olMin: rec.ol, olMax: rec.ol + (remL[name] || 0),
        cwMin: rec.cw, cwMax: rec.cw + (remCW[name] || 0),
        clMin: rec.cl, clMax: rec.cl + (remCL[name] || 0)
      };
    }
    if (teamName) {
      var r = range(teamName);
      return { owMin: r.owMin, owMax: r.owMax, olMin: r.olMin, olMax: r.olMax, cwMin: r.cwMin, cwMax: r.cwMax, clMin: r.clMin, clMax: r.clMax };
    }
    // No team: compute from all FBS data using current records as base
    var all = SG.state.data && SG.state.data.teams ? SG.state.data.teams.filter(function(t){ return t.level === "A"; }) : [];
    var owMin = 99, owMax = -1, olMin = 99, olMax = -1, cwMin = 99, cwMax = -1, clMin = 99, clMax = -1;
    all.forEach(function (t) {
      var r = range(t.team);
      if (r.owMin < owMin) owMin = r.owMin;
      if (r.owMax > owMax) owMax = r.owMax;
      if (r.olMin < olMin) olMin = r.olMin;
      if (r.olMax > olMax) olMax = r.olMax;
      if (r.cwMin < cwMin) cwMin = r.cwMin;
      if (r.cwMax > cwMax) cwMax = r.cwMax;
      if (r.clMin < clMin) clMin = r.clMin;
      if (r.clMax > clMax) clMax = r.clMax;
    });
    if (owMax < 0) { owMin = 0; owMax = 15; olMin = 0; olMax = 15; cwMin = 0; cwMax = 15; clMin = 0; clMax = 15; }
    return { owMin: owMin, owMax: owMax, olMin: olMin, olMax: olMax, cwMin: cwMin, cwMax: cwMax, clMin: clMin, clMax: clMax };
  }

  function updateRecordRanges(row, teamName) {
    var overallEl = row.querySelector(".simdeep-record-range.overall");
    var confEl = row.querySelector(".simdeep-record-range.conf");

    // Compute possible ranges from site data for any team (before sim)
    var dataRanges = computeDataRanges(teamName);
    overallEl.textContent = " (possible: " + dataRanges.owMin + "-" + dataRanges.owMax + " W, " + dataRanges.olMin + "-" + dataRanges.olMax + " L)";
    confEl.textContent = " (possible: " + dataRanges.cwMin + "-" + dataRanges.cwMax + " W, " + dataRanges.clMin + "-" + dataRanges.clMax + " L)";

    var owMin = 0, owMax = 15, olMin = 0, olMax = 15, cwMin = 0, cwMax = 15, clMin = 0, clMax = 15;
    if (teamName && view.sim && view.sim.debugRuns) {
      var runs = view.sim.debugRuns;
      owMin = 99; owMax = -1; olMin = 99; olMax = -1;
      var cwMinS = 99, cwMaxS = -1, clMinS = 99, clMaxS = -1;
      var found = false;
      runs.forEach(function (run) {
        var rec = run.records[teamName];
        if (!rec) return;
        found = true;
        if (rec.ow < owMin) owMin = rec.ow;
        if (rec.ow > owMax) owMax = rec.ow;
        if (rec.ol < olMin) olMin = rec.ol;
        if (rec.ol > olMax) olMax = rec.ol;
        if (rec.cw < cwMinS) cwMinS = rec.cw;
        if (rec.cw > cwMaxS) cwMaxS = rec.cw;
        if (rec.cl < clMinS) clMinS = rec.cl;
        if (rec.cl > clMaxS) clMaxS = rec.cl;
      });
      if (found) {
        overallEl.textContent = " (sim range: " + owMin + "-" + owMax + " W, " + olMin + "-" + olMax + " L)";
        confEl.textContent = " (sim range: " + cwMinS + "-" + cwMaxS + " W, " + clMinS + "-" + clMaxS + " L)";
        owMin = Math.max(0, owMin); owMax = Math.min(15, owMax);
        olMin = Math.max(0, olMin); olMax = Math.min(15, olMax);
        cwMin = Math.max(0, cwMinS); cwMax = Math.min(15, cwMaxS);
        clMin = Math.max(0, clMinS); clMax = Math.min(15, clMaxS);
      }
    } else {
      // Use data-based possible ranges
      var dr = computeDataRanges(teamName);
      owMin = dr.owMin; owMax = dr.owMax;
      olMin = dr.olMin; olMax = dr.olMax;
      cwMin = dr.cwMin; cwMax = dr.cwMax;
      clMin = dr.clMin; clMax = dr.clMax;
    }
    var owInput = row.querySelector(".simdeep-ow");
    var olInput = row.querySelector(".simdeep-ol");
    var cwInput = row.querySelector(".simdeep-cw");
    var clInput = row.querySelector(".simdeep-cl");
    if (owInput) { owInput.min = Math.max(0, owMin); owInput.max = Math.min(15, owMax); }
    if (olInput) { olInput.min = Math.max(0, olMin); olInput.max = Math.min(15, olMax); }
    if (cwInput) { cwInput.min = Math.max(0, cwMin); cwInput.max = Math.min(15, cwMax); }
    if (clInput) { clInput.min = Math.max(0, clMin); clInput.max = Math.min(15, clMax); }
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
    // Always allow re-run; do not exit early
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

    var formatSelect = document.getElementById("simdeepFormat");
    if (formatSelect && playoffView) {
      playoffView.format = formatSelect.value;
    }

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
        note.textContent = "Simulation failed. The data may be incomplete or the simulator encountered an unexpected state. Try checking for updates or running again.";
      } finally {
        btn.disabled = false;
        btn.textContent = "Run / Re-run simulation";
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
      var inFieldCheck = row.querySelector('.simdeep-param-check[data-param="inField"]');
      var championCheck = row.querySelector('.simdeep-param-check[data-param="champion"]');

      var team = (teamCheck && teamCheck.checked) ? row.querySelector(".simdeep-team-search").value.trim() || null : null;
      var confChamp = (confChampCheck && confChampCheck.checked) ? row.querySelector(".simdeep-conf-champ").value || null : null;
      var inField = (inFieldCheck && inFieldCheck.checked) ? true : false;
      var champion = (championCheck && championCheck.checked) ? (row.querySelector(".simdeep-champion-search").value.trim() || null) : null;
      var owOp = (overallCheck && overallCheck.checked) ? (row.querySelector(".simdeep-op-ow").value || "=") : "=";
      var olOp = (overallCheck && overallCheck.checked) ? (row.querySelector(".simdeep-op-ol").value || "=") : "=";
      var cwOp = (confCheck && confCheck.checked) ? (row.querySelector(".simdeep-op-cw").value || "=") : "=";
      var clOp = (confCheck && confCheck.checked) ? (row.querySelector(".simdeep-op-cl").value || "=") : "=";
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

      allFilters.push({ team: team, confChamp: confChamp, ow: ow, ol: ol, cw: cw, cl: cl, owOp: owOp, olOp: olOp, cwOp: cwOp, clOp: clOp, inField: inField, champion: champion });
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
      if (filter.team) {
        // Team specified: require that team is champion of this conference
        var isChamp = run.confChamps.some(function (c) { return c.conf === filter.confChamp && c.champ === filter.team; });
        if (!isChamp) return false;
      } else {
        var hasConf = run.confChamps.some(function (c) { return c.conf === filter.confChamp; });
        if (!hasConf) return false;
      }
    }
    if (filter.champion) {
      if (run.champion !== filter.champion) return false;
    }
    if (filter.inField) {
      var found = run.field.some(function (f) { return f.team === (filter.team || filter.champion); });
      if (!found) return false;
    }
    if (filter.team && (filter.ow !== null || filter.ol !== null || filter.cw !== null || filter.cl !== null)) {
      var rec = run.records[filter.team];
      if (!rec) return false;
      if (filter.ow !== null && !compareOp(rec.ow, filter.ow, filter.owOp || "=")) return false;
      if (filter.ol !== null && !compareOp(rec.ol, filter.ol, filter.olOp || "=")) return false;
      if (filter.cw !== null && !compareOp(rec.cw, filter.cw, filter.cwOp || "=")) return false;
      if (filter.cl !== null && !compareOp(rec.cl, filter.cl, filter.clOp || "=")) return false;
    }
    return true;
  }

  function compareOp(a, b, op) {
    switch (op) {
      case ">": return a > b;
      case "<": return a < b;
      case ">=": return a >= b;
      case "<=": return a <= b;
      case "=": default: return a === b;
    }
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

    note.textContent = shown.length + " of " + groupArr.length + " unique outcomes (" + runs.length + " of " + totalSims.toLocaleString() + " runs) (" + (runs.length / totalSims * 100).toFixed(2) + "%).";

    // Aggregate identical results and sort by frequency
    var groups = {};
    runs.forEach(function (run) {
      var key = (run.champion || "") + "|" + run.confChamps.map(function (c) { return c.conf + ":" + c.champ; }).sort().join(";") + "|" + run.field.slice(0, 12).map(function (f) { return f.team + ":" + f.bid; }).join(";");
      if (!groups[key]) groups[key] = { count: 0, run: run, pct: 0 };
      groups[key].count++;
    });
    var groupArr = Object.values(groups);
    groupArr.sort(function (a, b) { return b.count - a.count; });
    groupArr.forEach(function (g) { g.pct = (g.count / totalSims * 100).toFixed(2); });

    // Render top groups (up to 100 cards, now representing grouped outcomes)
    var LIMIT = 100;
    var shown = groupArr.slice(0, LIMIT);
    var hasMore = groupArr.length > LIMIT;

    var html = shown.map(function (group, idx) {
      var run = group.run;
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
          '<div class="simdeep-team"><span class="simdeep-seed">Run #' + (run.run + 1) + '</span> <span style="font-size:0.8rem;color:var(--accent);font-weight:600;">' + group.count + 'x (' + group.pct + '%)</span></div>' +
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
        '<div class="simdeep-details" id="simdeep-details-' + run.run + '" data-run="' + run.run + '"></div>' +
      '</div>';
    }).join("");

    if (hasMore) {
      html += '<div class="simdeep-more">Showing first 100 of ' + groupArr.length + ' unique outcomes.</div>';
    }

    container.innerHTML = html;

    container.querySelectorAll(".simdeep-expand").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var runIdx = btn.getAttribute("data-run");
        var details = document.getElementById("simdeep-details-" + runIdx);
        if (!details) return;
        if (details.innerHTML.trim() === "") {
          var run = runs.find(function (r) { return r.run == runIdx; });
          if (run) details.innerHTML = buildDetailsHtml(run);
        }
        details.classList.toggle("open");
        btn.textContent = details.classList.contains("open") ? "Hide details" : "Show details";
      });
    });

    var loadMoreBtn = document.getElementById("simdeepLoadMore");
    if (loadMoreBtn) {
      loadMoreBtn.addEventListener("click", function () {
        var currentLimit = shownRuns.length;
        var nextRuns = runs.slice(currentLimit, currentLimit + 100);
        if (!nextRuns.length) return;
        var frag = document.createDocumentFragment();
        nextRuns.forEach(function (run) {
          var card = document.createElement("div");
          card.className = "simdeep-card";
          card.innerHTML = '<div class="simdeep-card-header"><div class="simdeep-team"><span class="simdeep-seed">Run #' + (run.run + 1) + '</span></div><button type="button" class="simdeep-expand" data-run="' + run.run + '">Show details</button></div>' +
            '<div class="simdeep-stats"><div class="simdeep-stat"><span class="simdeep-stat-label">Teams in field</span><span class="simdeep-stat-value">' + run.field.length + '</span></div><div class="simdeep-stat"><span class="simdeep-stat-label">Champion</span><span class="simdeep-stat-value">' + (run.champion || "—") + '</span></div></div>' +
            '<div class="simdeep-field">' + run.field.slice(0, 12).map(function (f, i) {
              var bidClass = f.bid.indexOf("P4 champ") !== -1 ? "bid-p4" : (f.bid.indexOf("G6 bid") !== -1 ? "bid-g6" : "bid-atlarge");
              return '<div class="simdeep-field-team"><span class="simdeep-seed">' + (i + 1) + '</span><span class="simdeep-team-name">' + f.team + '</span><span class="simdeep-bid ' + bidClass + '">' + f.bid + '</span></div>';
            }).join("") + '</div>' +
            (run.champion ? '<div class="simdeep-champion">Champion: <strong>' + run.champion + '</strong></div>' : '') +
            '<div class="simdeep-conf-champs">' + run.confChamps.map(function (c) { return '<span class="simdeep-conf-champ">' + c.conf + ': ' + c.champ + '</span>'; }).join(" ") + '</div>' +
            '<button type="button" class="simdeep-expand" data-run="' + run.run + '">Show details</button>' +
            '<div class="simdeep-details" id="simdeep-details-' + run.run + '" data-run="' + run.run + '"></div>';
          frag.appendChild(card);
        });
        container.insertBefore(frag, loadMoreBtn.parentElement);
        loadMoreBtn.parentElement.remove();
        container.querySelectorAll(".simdeep-expand").forEach(function (btn) {
          btn.addEventListener("click", function () {
            var runIdx = btn.getAttribute("data-run");
            var details = document.getElementById("simdeep-details-" + runIdx);
            if (!details) return;
            if (details.innerHTML.trim() === "") {
              var run = runs.find(function (r) { return r.run == runIdx; });
              if (run) details.innerHTML = buildDetailsHtml(run);
            }
            details.classList.toggle("open");
            btn.textContent = details.classList.contains("open") ? "Hide details" : "Show details";
          });
        });
      });
    }
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
