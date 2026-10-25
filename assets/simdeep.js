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

  function updateFilterRowStates() {
    var format = document.getElementById("simdeepFormat") ? document.getElementById("simdeepFormat").value : "12";
    var disableConf = format === "24";
    document.querySelectorAll(".simdeep-param-btn[data-param='confChamp']").forEach(function (btn) {
      btn.disabled = disableConf;
      btn.style.opacity = disableConf ? "0.3" : "1";
      btn.title = disableConf ? "Conference champions are not used in the 24-team format" : btn.title;
    });
    document.querySelectorAll(".simdeep-conf-champ").forEach(function (sel) {
      sel.disabled = disableConf;
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
      updateFilterRowStates();
    });
    document.getElementById("simdeepLimit").addEventListener("change", function () {
      if (view.sim && view.sim.debugRuns) applyFilters();
    });
    document.getElementById("simdeepLogic").addEventListener("change", function () {
      if (view.sim && view.sim.debugRuns) applyFilters();
    });

    // Remove filter row (event delegation)
    document.getElementById("simdeepFilterRows").addEventListener("click", function (e) {
      var btn = e.target.closest(".simdeep-remove-row");
      if (!btn) return;
      var row = btn.closest(".simdeep-filter-row");
      if (!row) return;
      var rows = document.querySelectorAll(".simdeep-filter-row");
      if (rows.length === 1) {
        // Only one row: clear all its inputs instead of removing
        row.querySelectorAll(".simdeep-param-btn.active").forEach(function (btn) {
          btn.classList.remove("active");
          var group = btn.closest(".simdeep-param-group");
          if (group) group.classList.remove("active");
        });
        row.querySelectorAll(".simdeep-team-search, .simdeep-champion-search").forEach(function (i) { i.value = ""; });
        row.querySelectorAll(".simdeep-conf-champ").forEach(function (s) { s.value = ""; });
        row.querySelectorAll(".simdeep-op-ow, .simdeep-op-ol, .simdeep-op-cw, .simdeep-op-cl").forEach(function (s) { s.value = "="; });
        row.querySelectorAll(".simdeep-ow, .simdeep-ol, .simdeep-cw, .simdeep-cl").forEach(function (i) { i.value = ""; });
        // Restore conf champ dropdown options
        row.querySelectorAll(".simdeep-conf-champ option").forEach(function (o) { o.style.display = ""; });
        if (view.sim && view.sim.debugRuns) applyFilters();
      } else {
        row.remove();
        updateRowLabels();
        if (view.sim && view.sim.debugRuns) applyFilters();
      }
    });

    updateFilterRowStates();

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
        '<div class="simdeep-param-group" data-param="team">' +
          '<div class="simdeep-param-header">' +
            '<button type="button" class="simdeep-param-btn" data-param="team" aria-label="Team filter" title="Filter by a specific team">Team</button>' +
          '</div>' +
          '<div class="simdeep-param-body">' +
            '<div class="combo">' +
              '<input type="text" class="simdeep-team-search" placeholder="Type a team name" autocomplete="off" aria-label="Team" role="combobox" aria-expanded="false" title="Search for a team to filter by">' +
              '<div class="combo-list hidden" role="listbox"></div>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="simdeep-param-group" data-param="confChamp">' +
          '<div class="simdeep-param-header">' +
            '<button type="button" class="simdeep-param-btn" data-param="confChamp" aria-label="Conf champ filter" title="Filter by conference champion">Conf champ</button>' +
          '</div>' +
          '<div class="simdeep-param-body">' +
            '<select class="simdeep-conf-champ" aria-label="Conference champion" title="Choose a conference; if Team is also selected, that team must be the conference champion">' +
              '<option value="">Any</option>' +
            '</select>' +
          '</div>' +
        '</div>' +
        '<div class="simdeep-param-group" data-param="overall">' +
          '<div class="simdeep-param-header">' +
            '<button type="button" class="simdeep-param-btn" data-param="overall" aria-label="Overall record filter" title="Filter by overall win/loss record">Overall</button>' +
          '</div>' +
          '<div class="simdeep-param-body">' +
            '<div class="simdeep-record-row">' +
              '<span class="simdeep-record-label">W</span>' +
              '<select class="simdeep-op-ow" aria-label="Overall wins operator" title="Choose comparison operator: =, >, <, >=, <="><option value="=" selected>=</option><option value=">">></option><option value="<"><</option><option value=">=">>=</option><option value="<="><=</option></select>' +
              '<input type="number" class="simdeep-ow" min="0" max="15" placeholder="W" aria-label="Wins">' +
            '</div>' +
            '<div class="simdeep-record-row">' +
              '<span class="simdeep-record-label">L</span>' +
              '<select class="simdeep-op-ol" aria-label="Overall losses operator" title="Choose comparison operator: =, >, <, >=, <="><option value="=" selected>=</option><option value=">">></option><option value="<"><</option><option value=">=">>=</option><option value="<="><=</option></select>' +
              '<input type="number" class="simdeep-ol" min="0" max="15" placeholder="L" aria-label="Losses">' +
            '</div>' +
            '<span class="simdeep-record-range overall"></span>' +
          '</div>' +
        '</div>' +
        '<div class="simdeep-param-group" data-param="conf">' +
          '<div class="simdeep-param-header">' +
            '<button type="button" class="simdeep-param-btn" data-param="conf" aria-label="Conf record filter" title="Filter by conference win/loss record">Conf</button>' +
          '</div>' +
          '<div class="simdeep-param-body">' +
            '<div class="simdeep-record-row">' +
              '<span class="simdeep-record-label">W</span>' +
              '<select class="simdeep-op-cw" aria-label="Conf wins operator" title="Choose comparison operator: =, >, <, >=, <="><option value="=" selected>=</option><option value=">">></option><option value="<"><</option><option value=">=">>=</option><option value="<="><=</option></select>' +
              '<input type="number" class="simdeep-cw" min="0" max="15" placeholder="W" aria-label="Conf Wins">' +
            '</div>' +
            '<div class="simdeep-record-row">' +
              '<span class="simdeep-record-label">L</span>' +
              '<select class="simdeep-op-cl" aria-label="Conf losses operator" title="Choose comparison operator: =, >, <, >=, <="><option value="=" selected>=</option><option value=">">></option><option value="<"><</option><option value=">=">>=</option><option value="<="><=</option></select>' +
              '<input type="number" class="simdeep-cl" min="0" max="15" placeholder="L" aria-label="Conf Losses">' +
            '</div>' +
            '<span class="simdeep-record-range conf"></span>' +
          '</div>' +
        '</div>' +
        '<div class="simdeep-param-group" data-param="champion">' +
          '<div class="simdeep-param-header">' +
            '<button type="button" class="simdeep-param-btn" data-param="champion" aria-label="Champion filter" title="Only match runs where this team is champion">Champion</button>' +
          '</div>' +
          '<div class="simdeep-param-body">' +
            '<input type="text" class="simdeep-champion-search" placeholder="Team name" autocomplete="off" aria-label="Champion team">' +
          '</div>' +
        '</div>' +
        '<div class="simdeep-param-group" data-param="seed">' +
          '<div class="simdeep-param-header">' +
            '<button type="button" class="simdeep-param-btn" data-param="seed" aria-label="Seed range filter" title="Filter by seed range">Seed</button>' +
          '</div>' +
          '<div class="simdeep-param-body">' +
            '<select class="simdeep-seed-range" aria-label="Seed range" title="Filter by seed range">' +
              '<option value="">Any</option>' +
              '<option value="1-4">1-4 (Top 4 / Bye)</option>' +
              '<option value="5-8">5-8</option>' +
              '<option value="9-12">9-12</option>' +
              '<option value="13-16">13-16</option>' +
              '<option value="17-24">17-24</option>' +
            '</select>' +
          '</div>' +
        '</div>' +
        '<div class="simdeep-param-group" data-param="bidType">' +
          '<div class="simdeep-param-header">' +
            '<button type="button" class="simdeep-param-btn" data-param="bidType" aria-label="Bid type filter" title="Filter by bid type">Bid type</button>' +
          '</div>' +
          '<div class="simdeep-param-body">' +
            '<select class="simdeep-bid-type" aria-label="Bid type" title="Filter by bid type">' +
              '<option value="">Any</option>' +
              '<option value="p4">P4 champion</option>' +
              '<option value="g6">G6 bid</option>' +
              '<option value="atlarge">At-large</option>' +
            '</select>' +
          '</div>' +
        '</div>' +
        '<div class="simdeep-param-group" data-param="roundReached">' +
          '<div class="simdeep-param-header">' +
            '<button type="button" class="simdeep-param-btn" data-param="roundReached" aria-label="Round reached filter" title="Filter by furthest round reached">Round</button>' +
          '</div>' +
          '<div class="simdeep-param-body">' +
            '<select class="simdeep-round-reached" aria-label="Round reached" title="Filter by furthest round reached">' +
              '<option value="">Any</option>' +
              '<option value="champion">Champion</option>' +
              '<option value="runnerup">Runner-up</option>' +
              '<option value="final4">Final 4</option>' +
              '<option value="elite8">Elite 8</option>' +
              '<option value="round16">Round of 16/32</option>' +
              '<option value="madefield">Made field</option>' +
            '</select>' +
          '</div>' +
        '</div>' +
      '</div>';

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
      var confChampGroup = row.querySelector('.simdeep-param-group[data-param="confChamp"]');
      var confChampActive = confChampGroup && confChampGroup.classList.contains("active");
      var confFilter = confChampActive ? row.querySelector(".simdeep-conf-champ").value : "";
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
      var confChampGroup = row.querySelector('.simdeep-param-group[data-param="confChamp"]');
      var confChampActive = confChampGroup && confChampGroup.classList.contains("active");

      if (teamName && teamToConf[teamName]) {
        // Only set confChamp dropdown value when confChamp param is active
        if (confChampActive) {
          confChampSelect.value = teamToConf[teamName];
          var confName = teamToConf[teamName];
          var opts = confChampSelect.querySelectorAll("option");
          opts.forEach(function (o) { o.style.display = (o.value === "" || o.value === confName) ? "" : "none"; });
        }
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
    var inputs = row.querySelectorAll("input[type='number'], input[type='text'], select");
    inputs.forEach(function (el) {
      el.addEventListener("change", tryApply);
      if (el.tagName === "INPUT" && el.type === "text") {
        el.addEventListener("blur", tryApply);
      }
    });
    var btns = row.querySelectorAll(".simdeep-param-btn");
    btns.forEach(function (btn) {
      btn.addEventListener("click", function () {
        var wasActive = btn.classList.contains("active");
        btn.classList.toggle("active");
        var group = btn.closest(".simdeep-param-group");
        if (group) group.classList.toggle("active", btn.classList.contains("active"));
        if (!wasActive && btn.classList.contains("active")) {
          // Just turned on - will apply on next change
        } else if (wasActive && !btn.classList.contains("active")) {
          // Just turned off - reset this parameter's inputs
          resetParamGroup(group);
        }
        tryApply();
      });
    });

    function resetParamGroup(group) {
      if (!group) return;
      var param = group.getAttribute("data-param");
      if (param === "team") {
        var search = group.querySelector(".simdeep-team-search");
        if (search) { search.value = ""; search.dispatchEvent(new Event("change", { bubbles: true })); }
      } else if (param === "confChamp") {
        var sel = group.querySelector(".simdeep-conf-champ");
        if (sel) { sel.value = ""; sel.dispatchEvent(new Event("change", { bubbles: true })); }
      } else if (param === "overall") {
        group.querySelectorAll(".simdeep-op-ow, .simdeep-op-ol").forEach(function(s) { s.value = "="; });
        group.querySelectorAll(".simdeep-ow, .simdeep-ol").forEach(function(i) { i.value = ""; });
      } else if (param === "conf") {
        group.querySelectorAll(".simdeep-op-cw, .simdeep-op-cl").forEach(function(s) { s.value = "="; });
        group.querySelectorAll(".simdeep-cw, .simdeep-cl").forEach(function(i) { i.value = ""; });
      } else if (param === "champion") {
        var search = group.querySelector(".simdeep-champion-search");
        if (search) { search.value = ""; }
      } else if (param === "seed") {
        var sel = group.querySelector(".simdeep-seed-range");
        if (sel) { sel.value = ""; }
      } else if (param === "bidType") {
        var sel = group.querySelector(".simdeep-bid-type");
        if (sel) { sel.value = ""; }
      } else if (param === "roundReached") {
        var sel = group.querySelector(".simdeep-round-reached");
        if (sel) { sel.value = ""; }
      }
    }

    // Conf champ change -> clear team search if team not in that conf
    var confChampSelect = row.querySelector(".simdeep-conf-champ");
    confChampSelect.addEventListener("change", function () {
      var confName = this.value;
      var searchInput = row.querySelector(".simdeep-team-search");
      var teamGroup = row.querySelector('.simdeep-param-group[data-param="team"]');
      var teamActive = teamGroup && teamGroup.classList.contains("active");

      // Only clear team if team param is active and team doesn't belong to selected conf
      if (teamActive && searchInput.value && teamToConf[searchInput.value] && teamToConf[searchInput.value] !== confName) {
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
        note.textContent = "Simulation failed: " + (e && e.message ? e.message : String(e)) + ". Please check data and try again.";
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

    rows.forEach(function (row) {
      var teamBtn = row.querySelector('.simdeep-param-btn[data-param="team"]');
      var confChampBtn = row.querySelector('.simdeep-param-btn[data-param="confChamp"]');
      var overallBtn = row.querySelector('.simdeep-param-btn[data-param="overall"]');
      var confBtn = row.querySelector('.simdeep-param-btn[data-param="conf"]');
      var championBtn = row.querySelector('.simdeep-param-btn[data-param="champion"]');
      var seedBtn = row.querySelector('.simdeep-param-btn[data-param="seed"]');
      var bidTypeBtn = row.querySelector('.simdeep-param-btn[data-param="bidType"]');
      var roundReachedBtn = row.querySelector('.simdeep-param-btn[data-param="roundReached"]');

      var team = (teamBtn && teamBtn.classList.contains('active')) ? row.querySelector(".simdeep-team-search").value.trim() || null : null;
      var confChamp = (confChampBtn && confChampBtn.classList.contains('active')) ? row.querySelector(".simdeep-conf-champ").value || null : null;
      var champion = (championBtn && championBtn.classList.contains('active')) ? (row.querySelector(".simdeep-champion-search").value.trim() || null) : null;
      var seed = (seedBtn && seedBtn.classList.contains('active')) ? row.querySelector(".simdeep-seed-range").value || null : null;
      var bidType = (bidTypeBtn && bidTypeBtn.classList.contains('active')) ? row.querySelector(".simdeep-bid-type").value || null : null;
      var roundReached = (roundReachedBtn && roundReachedBtn.classList.contains('active')) ? row.querySelector(".simdeep-round-reached").value || null : null;
      var owOp = (overallBtn && overallBtn.classList.contains('active')) ? (row.querySelector(".simdeep-op-ow").value || "=") : "=";
      var olOp = (overallBtn && overallBtn.classList.contains('active')) ? (row.querySelector(".simdeep-op-ol").value || "=") : "=";
      var cwOp = (confBtn && confBtn.classList.contains('active')) ? (row.querySelector(".simdeep-op-cw").value || "=") : "=";
      var clOp = (confBtn && confBtn.classList.contains('active')) ? (row.querySelector(".simdeep-op-cl").value || "=") : "=";
      var ow = (overallBtn && overallBtn.classList.contains('active')) ? parseInt(row.querySelector(".simdeep-ow").value) || null : null;
      var ol = (overallBtn && overallBtn.classList.contains('active')) ? parseInt(row.querySelector(".simdeep-ol").value) || null : null;
      var cw = (confBtn && confBtn.classList.contains('active')) ? parseInt(row.querySelector(".simdeep-cw").value) || null : null;
      var cl = (confBtn && confBtn.classList.contains('active')) ? parseInt(row.querySelector(".simdeep-cl").value) || null : null;

      // Skip empty rows (no active params with values)
      if (!team && !confChamp && ow === null && ol === null && cw === null && cl === null && !champion && !seed && !bidType && !roundReached) return;

      // Conflict check: team must belong to selected conf champ
      if (team && confChamp && teamToConf[team] !== confChamp) {
        document.getElementById("simdeepNote").textContent = "Filter " + row.querySelector(".simdeep-row-label").textContent + ": " + team + " is not in " + confChamp;
        return;
      }

      allFilters.push({ team: team, confChamp: confChamp, ow: ow, ol: ol, cw: cw, cl: cl, owOp: owOp, olOp: olOp, cwOp: cwOp, clOp: clOp, champion: champion, seed: seed, bidType: bidType, roundReached: roundReached });
    });

    var runs = view.sim.debugRuns;

    // Check if team filter has any matches in field across all runs
    var teamFilters = allFilters.filter(function(f) { return f.team; });
    if (teamFilters.length > 0) {
      teamFilters.forEach(function(tf) {
        var teamInAnyField = runs.some(function(run) {
          return run.field.some(function(f) { return f.team === tf.team; });
        });
        if (!teamInAnyField) {
          document.getElementById("simdeepNote").textContent = tf.team + " does not make the playoff field in any simulation run. Try a different team or remove the team filter.";
          document.getElementById("simdeepResults").innerHTML = "";
          return;
        }
      });
    }

    // Filter runs: AND/OR between rows based on selector
    var logicEl = document.getElementById("simdeepLogic");
    var useAnd = logicEl ? logicEl.value === "and" : true;
    var filtered = runs.filter(function (run) {
      if (useAnd) {
        return allFilters.every(function (filter) {
          return matchesFilter(run, filter);
        });
      } else {
        return allFilters.some(function (filter) {
          return matchesFilter(run, filter);
        });
      }
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
    // Seed range filter
    if (filter.seed) {
      var seedParts = filter.seed.split("-");
      var minSeed = parseInt(seedParts[0], 10);
      var maxSeed = parseInt(seedParts[1], 10);
      var targetTeam = filter.team || filter.champion;
      if (targetTeam) {
        var teamEntry = run.field.find(function (f) { return f.team === targetTeam; });
        if (!teamEntry || teamEntry.seed < minSeed || teamEntry.seed > maxSeed) return false;
      } else {
        // No specific team: require at least one team in field matches seed range
        var hasSeedMatch = run.field.some(function (f) { return f.seed >= minSeed && f.seed <= maxSeed; });
        if (!hasSeedMatch) return false;
      }
    }
    // Bid type filter
    if (filter.bidType) {
      var targetTeam = filter.team || filter.champion;
      if (targetTeam) {
        var teamEntry = run.field.find(function (f) { return f.team === targetTeam; });
        if (!teamEntry || !bidTypeMatch(teamEntry.bid, filter.bidType)) return false;
      } else {
        var hasBidMatch = run.field.some(function (f) { return bidTypeMatch(f.bid, filter.bidType); });
        if (!hasBidMatch) return false;
      }
    }
    // Round reached filter
    if (filter.roundReached) {
      var targetTeam = filter.team || filter.champion;
      if (targetTeam) {
        var reached = roundReachedForTeam(run, targetTeam);
        if (!roundReachedMatch(reached, filter.roundReached)) return false;
      } else {
        var hasRoundMatch = run.field.some(function (f) { return roundReachedMatch(roundReachedForTeam(run, f.team), filter.roundReached); });
        if (!hasRoundMatch) return false;
      }
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

  function bidTypeMatch(bid, type) {
    if (!bid) return false;
    if (type === "p4") return bid.indexOf("P4 champ") !== -1;
    if (type === "g6") return bid.indexOf("G6 bid") !== -1;
    if (type === "atlarge") return bid.indexOf("P4 champ") === -1 && bid.indexOf("G6 bid") === -1;
    return false;
  }

  function roundReachedForTeam(run, team) {
    // Determine furthest round reached based on field position and champion
    var entry = run.field.find(function (f) { return f.team === team; });
    if (!entry) return "missed";
    if (run.champion === team) return "champion";
    // For 12-team: seeds 1-4 get bye to quarters (round of 8), seeds 5-12 play round of 12
    // For 24-team: more complex
    var format = (SG.state.modules.playoff && SG.state.modules.playoff.view) ? SG.state.modules.playoff.view.format : "12";
    var seed = entry.seed || 99;
    if (format === "12") {
      if (seed <= 4) return "elite8";  // quarters
      if (seed <= 12) return "round16"; // first round
    } else {
      if (seed <= 8) return "elite8";
      if (seed <= 24) return "round16";
    }
    return "madefield";
  }

  function roundReachedMatch(reached, target) {
    if (target === "champion") return reached === "champion";
    if (target === "runnerup") return reached === "champion"; // can't determine runner-up easily
    if (target === "final4") return ["champion", "runnerup", "final4", "elite8"].indexOf(reached) !== -1;
    if (target === "elite8") return ["champion", "runnerup", "final4", "elite8"].indexOf(reached) !== -1;
    if (target === "round16") return ["champion", "runnerup", "final4", "elite8", "round16"].indexOf(reached) !== -1;
    if (target === "madefield") return reached !== "missed";
    return false;
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

    // Normalize runs to prevent missing properties
    runs.forEach(function(run) {
      if (!run) return;
      if (!run.field) run.field = [];
      if (!run.confChamps) run.confChamps = [];
      if (!run.records) run.records = {};
      if (!run.champion) run.champion = "";
    });

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

    // Render top groups (limit from selector, default 100)
    var limitEl = document.getElementById("simdeepLimit");
    var LIMIT = limitEl ? parseInt(limitEl.value) : 100;
    var shown = groupArr.slice(0, LIMIT);
    var hasMore = groupArr.length > LIMIT;

    var totalMatchingRuns = runs.length;
    var totalUniqueOutcomes = groupArr.length;
    var avgOccurrences = totalMatchingRuns / totalUniqueOutcomes;
    note.innerHTML = "Showing " + shown.length + " of " + totalUniqueOutcomes + " unique outcomes (" + totalMatchingRuns.toLocaleString() + " of " + totalSims.toLocaleString() + " total runs match filters, " + (totalMatchingRuns / totalSims * 100).toFixed(2) + "%). Each outcome occurred an average of " + avgOccurrences.toFixed(1) + " times." +
      '<br><span class="simdeep-note">This uses the same 10,000 Monte Carlo simulations from the Playoff Predictor tab. The Predictor shows a single deterministic projection; this Deep Dive reveals the full distribution of outcomes from those simulations.</span>';

    var html = shown.map(function (group, idx) {
      var run = group.run;
      var fieldHtml = run.field.slice(0, 12).map(function (f, i) {
        var bidClass = "";
        if (f.bid.indexOf("P4 champ") !== -1) bidClass = "bid-p4";
        else if (f.bid.indexOf("G6 bid") !== -1) bidClass = "bid-g6";
        else bidClass = "bid-atlarge";
        return '<div class="simdeep-field-team"><span class="simdeep-seed">' + (i + 1) + '</span><span class="simdeep-team-name simdeep-team-link" data-team="' + f.team + '">' + SG.esc(f.team) + '</span><span class="simdeep-bid ' + bidClass + '">' + f.bid + '</span></div>';
      }).join("");

      var championHtml = run.champion ? '<div class="simdeep-champion">Champion: <strong>' + run.champion + '</strong></div>' : '';
      var confChampsHtml = run.confChamps.map(function (c) {
        return '<span class="simdeep-conf-champ">' + c.conf + ': ' + c.champ + '</span>';
      }).join(" ");

      return '<div class="simdeep-card">' +
        '<div class="simdeep-card-header">' +
          '<div class="simdeep-card-title">Outcome #' + (idx + 1) + ' &mdash; ' + group.count + ' runs (' + group.pct + '%)</div>' +
          '<button type="button" class="simdeep-expand" data-run="' + run.run + '">Show details</button>' +
        '</div>' +
        '<div class="simdeep-stats">' +
          '<div class="simdeep-stat"><span class="simdeep-stat-label">Field size</span><span class="simdeep-stat-value">' + (run.field ? run.field.length : 0) + '</span></div>' +
          '<div class="simdeep-stat"><span class="simdeep-stat-label">Champion</span><span class="simdeep-stat-value">' + (run.champion || "—") + '</span></div>' +
        '</div>' +
        '<div class="simdeep-field">' + fieldHtml + '</div>' +
        (championHtml ? '<div class="simdeep-conf-champs">' + championHtml + '</div>' : '') +
        (confChampsHtml ? '<div class="simdeep-conf-champs">' + confChampsHtml + '</div>' : '') +
        '<button type="button" class="simdeep-expand" data-run="' + run.run + '">Show details</button>' +
        '<div class="simdeep-details" id="simdeep-details-' + run.run + '" data-run="' + run.run + '"></div>' +
      '</div>';
    }).join("");

    if (hasMore) {
      html += '<div class="simdeep-more-wrap"><button type="button" id="simdeepLoadMore" class="simdeep-load-more">Show more results</button></div>';
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

    // Team distribution click handler - event delegation (capture phase)
    container.addEventListener("click", function (e) {
      var link = e.target.closest(".simdeep-team-link");
      if (link) {
        e.preventDefault();
        e.stopPropagation();
        var teamName = link.getAttribute("data-team");
        if (teamName) showTeamDistribution(teamName, runs, totalSims);
      }
    }, true);

    var loadMoreBtn = document.getElementById("simdeepLoadMore");
    if (loadMoreBtn) {
      loadMoreBtn.addEventListener("click", function () {
        var currentLimit = shown.length;
        var nextGroups = groupArr.slice(currentLimit, currentLimit + 100);
        if (!nextGroups.length) return;
        var frag = document.createDocumentFragment();
        nextGroups.forEach(function (group, idx) {
          var run = group.run;
          var absoluteIdx = currentLimit + idx;
          var fieldHtml = run.field.slice(0, 12).map(function (f, i) {
            var bidClass = "";
            if (f.bid.indexOf("P4 champ") !== -1) bidClass = "bid-p4";
            else if (f.bid.indexOf("G6 bid") !== -1) bidClass = "bid-g6";
            else bidClass = "bid-atlarge";
            return '<div class="simdeep-field-team"><span class="simdeep-seed">' + (i + 1) + '</span><span class="simdeep-team-name simdeep-team-link" data-team="' + f.team + '">' + SG.esc(f.team) + '</span><span class="simdeep-bid ' + bidClass + '">' + f.bid + '</span></div>';
          }).join("");
          var championHtml = run.champion ? '<div class="simdeep-champion">Champion: <strong>' + run.champion + '</strong></div>' : '';
          var confChampsHtml = run.confChamps.map(function (c) {
            return '<span class="simdeep-conf-champ">' + c.conf + ': ' + c.champ + '</span>';
          }).join(" ");
          var card = document.createElement("div");
          card.className = "simdeep-card";
          card.innerHTML = '<div class="simdeep-card-header">' +
            '<div class="simdeep-card-title">Outcome #' + (absoluteIdx + 1) + ' &mdash; ' + group.count + ' runs (' + group.pct + '%)</div>' +
            '<button type="button" class="simdeep-expand" data-run="' + run.run + '">Show details</button>' +
            '</div>' +
            '<div class="simdeep-stats">' +
              '<div class="simdeep-stat"><span class="simdeep-stat-label">Field size</span><span class="simdeep-stat-value">' + (run.field ? run.field.length : 0) + '</span></div>' +
              '<div class="simdeep-stat"><span class="simdeep-stat-label">Champion</span><span class="simdeep-stat-value">' + (run.champion || "—") + '</span></div>' +
            '</div>' +
            '<div class="simdeep-field">' + fieldHtml + '</div>' +
            (championHtml ? '<div class="simdeep-conf-champs">' + championHtml + '</div>' : '') +
            (confChampsHtml ? '<div class="simdeep-conf-champs">' + confChampsHtml + '</div>' : '') +
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
    var fieldTeams = run.field || [];

    var rows = fieldTeams.map(function (f) {
      var rec = run.records[f.team] || { ow: 0, ol: 0, cw: 0, cl: 0 };
      var ow = rec.ow || 0, ol = rec.ol || 0, cw = rec.cw || 0, cl = rec.cl || 0;
      return '<div class="simdeep-detail-row">' +
        '<span class="simdeep-detail-label">' + f.team + '</span>' +
        '<span class="simdeep-detail-value">' + ow + '-' + ol + ' (' + cw + '-' + cl + ') [' + f.bid + ']</span>' +
      '</div>';
    }).join("");

    return '<div class="simdeep-detail-header">Field teams for this outcome</div>' + rows;
  }

  // Team distribution modal
  function showTeamDistribution(teamName, runs, totalSims) {
    // Calculate distributions
    var dist = calculateTeamDistribution(teamName, runs);

    var modal = document.getElementById("simdeepTeamModal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "simdeepTeamModal";
      modal.className = "simdeep-modal";
      document.body.appendChild(modal);
      // Close on overlay click
      modal.addEventListener("click", function (e) {
        if (e.target === modal) closeTeamModal();
      });
      // Close on Escape
      document.addEventListener("keydown", function (e) {
        if (e.key === "Escape") closeTeamModal();
      });
    }

    modal.innerHTML = buildTeamDistributionHtml(teamName, dist, runs.length, totalSims);
    modal.classList.add("open");
    document.body.style.overflow = "hidden";

    // Close button handler
    modal.querySelector("[data-action='close-team-modal']").addEventListener("click", closeTeamModal);
  }

  function closeTeamModal() {
    var modal = document.getElementById("simdeepTeamModal");
    if (modal) {
      modal.classList.remove("open");
      document.body.style.overflow = "";
    }
  }

  function calculateTeamDistribution(teamName, runs) {
    var seedCounts = {};
    var roundCounts = { champion: 0, runnerup: 0, final4: 0, elite8: 0, round16: 0, madefield: 0, missed: 0 };
    var bidCounts = { p4: 0, g6: 0, atlarge: 0, none: 0 };
    var championCount = 0;
    var totalRuns = runs.length;
    var sumSeed = 0;
    var seedAppearances = 0;

    runs.forEach(function (run) {
      var entry = run.field.find(function (f) { return f.team === teamName; });
      if (entry) {
        seedAppearances++;
        sumSeed += entry.seed || 0;
        var seed = entry.seed;
        seedCounts[seed] = (seedCounts[seed] || 0) + 1;

        var bid = entry.bid || "";
        if (bid.indexOf("P4 champ") !== -1) bidCounts.p4++;
        else if (bid.indexOf("G6 bid") !== -1) bidCounts.g6++;
        else if (bid) bidCounts.atlarge++;
        else bidCounts.none++;

        if (run.champion === teamName) {
          championCount++;
          roundCounts.champion++;
        } else {
          var reached = roundReachedForTeam(run, teamName);
          roundCounts[reached] = (roundCounts[reached] || 0) + 1;
        }
      } else {
        roundCounts.missed++;
      }
    });

    return {
      teamName: teamName,
      totalRuns: totalRuns,
      fieldPct: totalRuns > 0 ? (seedAppearances / totalRuns * 100).toFixed(1) : 0,
      avgSeed: seedAppearances > 0 ? (sumSeed / seedAppearances).toFixed(1) : "—",
      championPct: totalRuns > 0 ? (championCount / totalRuns * 100).toFixed(2) : 0,
      championCount: championCount,
      seedCounts: seedCounts,
      roundCounts: roundCounts,
      bidCounts: bidCounts,
      seedAppearances: seedAppearances
    };
  }

  function buildTeamDistributionHtml(teamName, dist, matchingRuns, totalSims) {
    var seedHtml = "";
    for (var s = 1; s <= 24; s++) {
      var count = dist.seedCounts[s] || 0;
      var pct = dist.seedAppearances > 0 ? (count / dist.seedAppearances * 100).toFixed(1) : 0;
      var barWidth = dist.seedAppearances > 0 ? (count / dist.seedAppearances * 100) : 0;
      if (count > 0) {
        seedHtml += '<div class="simdeep-dist-row">' +
          '<span class="simdeep-dist-label">Seed ' + s + '</span>' +
          '<div class="simdeep-dist-bar-wrap">' +
            '<div class="simdeep-dist-bar" style="width:' + barWidth + '%"></div>' +
            '<span class="simdeep-dist-value">' + count + ' (' + pct + '%)</span>' +
          '</div>' +
        '</div>';
      }
    }

    var roundOrder = [
      { key: "champion", label: "Champion" },
      { key: "runnerup", label: "Runner-up" },
      { key: "final4", label: "Final 4" },
      { key: "elite8", label: "Elite 8" },
      { key: "round16", label: "Round of 16/32" },
      { key: "madefield", label: "Made field only" },
      { key: "missed", label: "Missed field" }
    ];

    var roundHtml = roundOrder.map(function (r) {
      var count = dist.roundCounts[r.key] || 0;
      var pct = dist.totalRuns > 0 ? (count / dist.totalRuns * 100).toFixed(1) : 0;
      var barWidth = dist.totalRuns > 0 ? (count / dist.totalRuns * 100) : 0;
      return '<div class="simdeep-dist-row">' +
        '<span class="simdeep-dist-label">' + r.label + '</span>' +
        '<div class="simdeep-dist-bar-wrap">' +
          '<div class="simdeep-dist-bar" style="width:' + barWidth + '%"></div>' +
          '<span class="simdeep-dist-value">' + count + ' (' + pct + '%)</span>' +
        '</div>' +
      '</div>';
    }).join("");

    var bidHtml = [
      { key: "p4", label: "P4 Champion" },
      { key: "g6", label: "G6 Bid" },
      { key: "atlarge", label: "At-large" },
      { key: "none", label: "No bid" }
    ].map(function (b) {
      var count = dist.bidCounts[b.key] || 0;
      var pct = dist.seedAppearances > 0 ? (count / dist.seedAppearances * 100).toFixed(1) : 0;
      var barWidth = dist.seedAppearances > 0 ? (count / dist.seedAppearances * 100) : 0;
      return '<div class="simdeep-dist-row">' +
        '<span class="simdeep-dist-label">' + b.label + '</span>' +
        '<div class="simdeep-dist-bar-wrap">' +
          '<div class="simdeep-dist-bar" style="width:' + barWidth + '%"></div>' +
          '<span class="simdeep-dist-value">' + count + ' (' + pct + '%)</span>' +
        '</div>' +
      '</div>';
    }).join("");

    return '<div class="simdeep-modal-content">' +
      '<div class="simdeep-modal-header">' +
        '<h3>' + SG.esc(teamName) + ' &mdash; Outcome Distribution</h3>' +
        '<button type="button" class="simdeep-modal-close" data-action="close-team-modal" aria-label="Close">&times;</button>' +
      '</div>' +
      '<div class="simdeep-modal-body">' +
        '<div class="simdeep-dist-summary">' +
          '<div class="simdeep-stat"><span class="simdeep-stat-label">Field rate</span><span class="simdeep-stat-value">' + dist.fieldPct + '%</span></div>' +
          '<div class="simdeep-stat"><span class="simdeep-stat-label">Avg seed</span><span class="simdeep-stat-value">' + dist.avgSeed + '</span></div>' +
          '<div class="simdeep-stat"><span class="simdeep-stat-label">Champion</span><span class="simdeep-stat-value">' + dist.championPct + '% (' + dist.championCount + ')</span></div>' +
          '<div class="simdeep-stat"><span class="simdeep-stat-label">Runs analyzed</span><span class="simdeep-stat-value">' + matchingRuns.toLocaleString() + ' / ' + totalSims.toLocaleString() + '</span></div>' +
        '</div>' +
        '<div class="simdeep-dist-section">' +
          '<h4>Seed Distribution</h4>' +
          '<div class="simdeep-dist-grid">' + seedHtml + '</div>' +
        '</div>' +
        '<div class="simdeep-dist-section">' +
          '<h4>Round Reached</h4>' +
          '<div class="simdeep-dist-grid">' + roundHtml + '</div>' +
        '</div>' +
        '<div class="simdeep-dist-section">' +
          '<h4>Bid Type</h4>' +
          '<div class="simdeep-dist-grid">' + bidHtml + '</div>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  var SIMS = 10000;

  SG.state.modules.simdeep = { init: init, render: function () { if (!SG.state.data) return; if (view.sim && view.sim.debugRuns) onSimDataReady(); } };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
