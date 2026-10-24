/* TV schedule: upcoming games with kickoff time and TV listing, plus a
   "games to watch" ranking built from the Sagarin ratings, the AP poll and the
   betting line. Reads the prefetched data/tv-games.json. */
(function () {
  "use strict";
  var SG = window.SG;

  var scope = "ap";        // all | ap | conf | team
  var group = "";          // "" | P4 | G6 | IND
  var conf = "";
  var search = "";
  var sort = { key: "watch", dir: -1 };
  var tz = "";             // "" = browser local, else ET | CT | MT | PT

  var TZ = { ET: "America/New_York", CT: "America/Chicago", MT: "America/Denver", PT: "America/Los_Angeles" };

  // Kickoff windows are defined as static periods in the selected time zone
  // (or the browser's local time zone if none is selected). Games move
  // dynamically into which block they belong to when the time zone changes.
  var WINDOWS = [
    { key: "early", label: "Early afternoon", start: 11, end: 15 },
    { key: "afternoon", label: "Afternoon", start: 15, end: 19 },
    { key: "evening", label: "Evening", start: 19, end: 22 },
    { key: "late", label: "Late night", start: 22, end: 28 }
  ];

  var METHOD = "predictor";
  var curCtx = null;

  function games() {
    return (SG.state.tv && SG.state.tv.games) || [];
  }

  function sag(id) {
    return SG.state.espnIdToSag && SG.state.espnIdToSag[id];
  }

  function teamName(id, fallback) {
    var st = sag(id);
    return st ? st.team : (fallback || "");
  }

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  var RIVALRY = (function () {
    var set = {};
    (window.Rivalries || []).forEach(function (p) {
      set[[SG.normalizeName(p[0]), SG.normalizeName(p[1])].sort().join("|")] = true;
    });
    return set;
  })();

  function isRivalry(a, b) {
    if (!a || !b) return false;
    return !!RIVALRY[[SG.normalizeName(a), SG.normalizeName(b)].sort().join("|")];
  }

  // Teams in the projected 12-team field, plus the next ten in line for an
  // at-large bid (bubble), using the same resume ranking the field uses so the
  // two stay consistent. Recomputed once per render so scoring stays cheap.
  function context() {
    var ctx = { field: {}, bubble: {} };
    if (!SG.state.data) return ctx;
    var ranked = null;
    if (SG.playoffField) {
      var f = SG.playoffField(12, METHOD);
      ((f && f.seeds) || []).forEach(function (t) { if (t) ctx.field[t.team] = true; });
      if (f && f.atLarge) ranked = f.atLarge;
    }
    if (!ranked) {
      ranked = SG.state.data.teams.filter(function (t) { return t.level === "A"; })
        .sort(function (x, y) { return y[METHOD] - x[METHOD]; });
    }
    var n = 0;
    for (var i = 0; i < ranked.length && n < 10; i++) {
      if (!ctx.field[ranked[i].team]) { ctx.bubble[ranked[i].team] = true; n++; }
    }
    return ctx;
  }

  function tier(v) {
    return v >= 75 ? "Must watch" : v >= 55 ? "Worth watching" : v >= 35 ? "On the radar" : "Background";
  }

  // 0-100 watch score. Weights and shapes are set from published work rather
  // than taste:
  //   - closeness 0.40. The market line is the sharpest single predictor of the
  //     margin (Simple ACR 2022: closing line Brier .1871 vs Sagarin .1940), so
  //     when a line is posted we use it as-is, and when we only have Sagarin we
  //     shrink the signal toward a coin flip because it is the noisier estimate.
  //   - playoff stakes 0.30, from the projected field and the bubble.
  //   - team quality 0.22, combined Sagarin rating.
  //   - rivalry 0.08. Rivalry nudges outcomes only slightly (favorites win about
  //     3.6 points less often, Cox et al. 2026) and the market mostly prices it.
  function score(g, ctx) {
    var a = sag(g.awayId);
    var b = sag(g.homeId);
    var na = a ? a.team : (g.awayName || "");
    var nb = b ? b.team : (g.homeName || "");
    var edge = SG.homeEdge(METHOD);

    var fromMarket = g.spread !== null && g.spread !== undefined;
    var margin;
    if (fromMarket) {
      margin = Math.abs(g.spread);
    } else if (a && b) {
      margin = Math.abs((b[METHOD] + (g.neutral ? 0 : edge)) - a[METHOD]);
    } else {
      margin = null;
    }
    var closeness;
    if (margin === null) {
      closeness = 0.35;
    } else {
      closeness = 1 / (1 + Math.pow(margin / 10, 2));
      if (!fromMarket) closeness = 0.5 + (closeness - 0.5) * 0.8;
    }

    var avg = (a && b) ? (a[METHOD] + b[METHOD]) / 2 : null;
    var quality = avg === null ? 0.3 : clamp((avg - 55) / 40, 0, 1);

    var inA = !!ctx.field[na], inB = !!ctx.field[nb];
    var bubA = !!ctx.bubble[na], bubB = !!ctx.bubble[nb];
    var stakes;
    if (inA && inB) stakes = 0.9;
    else if ((inA && bubB) || (inB && bubA)) stakes = 0.75;
    else if (bubA && bubB) stakes = 0.55;
    else if (inA || inB) stakes = 0.4;
    else if (bubA || bubB) stakes = 0.25;
    else stakes = 0.05;
    if (a && b && SG.mergeConf(a.conference) === SG.mergeConf(b.conference) && stakes > 0.3) {
      stakes = Math.min(1, stakes + 0.1);
    }

    var rival = isRivalry(na, nb) ? 1 : 0;

    var value = Math.round(100 * (0.40 * closeness + 0.22 * quality + 0.30 * stakes + 0.08 * rival));

    var apA = a ? SG.apRank(na) : null;
    var apB = b ? SG.apRank(nb) : null;
    var reason;
    if (inA && inB && rival) reason = "Rivalry, playoff stakes";
    else if (inA && inB) reason = "Playoff clash";
    else if (rival) reason = "Rivalry";
    else if ((inA || inB) && closeness > 0.5) reason = "Elimination watch";
    else if (bubA && bubB) reason = "Bubble watch";
    else if (closeness > 0.6) reason = "Toss-up";
    else if (apA && apB) reason = "Ranked matchup";
    else if (quality > 0.8) reason = "Quality teams";
    else reason = "";
    return { value: value, reason: reason, tier: tier(value) };
  }

  function inScope(g) {
    var a = sag(g.awayId), b = sag(g.homeId);
    if (group && (a ? SG.confGroup(a) : "") !== group && (b ? SG.confGroup(b) : "") !== group) return false;
    if (scope === "all") return true;
    if (scope === "ap") return !!(a && SG.apRank(a.team)) || !!(b && SG.apRank(b.team));
    if (scope === "conf") {
      if (!conf) return true;
      return (a && SG.mergeConf(a.conference) === conf) || (b && SG.mergeConf(b.conference) === conf);
    }
    if (scope === "team") {
      if (!search) return true;
      var q = search.toLowerCase();
      return teamName(g.awayId, g.awayName).toLowerCase().indexOf(q) !== -1 ||
        teamName(g.homeId, g.homeName).toLowerCase().indexOf(q) !== -1;
    }
    return true;
  }

  // The earliest week that still has games left to play. The data file carries a
  // couple of weeks so this keeps working as one week rolls into the next.
  function upcomingWeek() {
    var ws = games().filter(function (g) { return !g.completed && g.week !== null && g.week !== undefined; })
      .map(function (g) { return g.week; });
    return ws.length ? Math.min.apply(null, ws) : null;
  }

  function filtered() {
    var wk = upcomingWeek();
    return games().filter(function (g) {
      if (g.completed) return false;
      if (wk !== null && g.week !== wk) return false;
      return inScope(g);
    });
  }

  function fmtWhen(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    var opts = { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" };
    if (tz) opts.timeZone = TZ[tz];
    return d.toLocaleString(undefined, opts);
  }

  function etHour(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return 12;
    var s = d.toLocaleString("en-US", { timeZone: "America/New_York", hour: "2-digit", hour12: false });
    return parseInt(s, 10) % 24;
  }

  function localHourInTz(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return etHour(iso);
    var tzid = tz ? TZ[tz] : undefined;
    var parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tzid,
      hour: "2-digit",
      hour12: false
    }).formatToParts(d);
    for (var i = 0; i < parts.length; i++) {
      if (parts[i].type === "hour") {
        return parseInt(parts[i].value, 10) % 24;
      }
    }
    return etHour(iso);
  }

  function windowOf(iso) {
    var h = localHourInTz(iso);
    if (h >= 22 || h < 4) return "late";
    if (h < 15) return "early";
    if (h < 19) return "afternoon";
    return "evening";
  }

  function teamCell(id, fallback) {
    var name = teamName(id, fallback);
    return SG.teamLogo(name) + SG.esc(name) + SG.apBadge(name);
  }

  function watchCell(g) {
    var s = score(g, curCtx);
    return (s.reason ? '<span class="watch-tag">' + SG.esc(s.reason) + "</span> " : "") +
      '<span class="watch-score">' + s.value + "</span>";
  }

  var COLUMNS = [
    { key: "week", label: "Wk", cls: "left" },
    { key: "date", label: "Kickoff", cls: "left", type: "str", cell: function (g) { return SG.esc(fmtWhen(g.date)); } },
    { key: "tv", label: "TV", cls: "left", type: "str", cell: function (g) { return g.tv ? SG.esc(g.tv) : '<span class="dim">TBD</span>'; } },
    { key: "away", label: "Away", cls: "left", type: "str", value: function (g) { return teamName(g.awayId, g.awayName); }, cell: function (g) { return teamCell(g.awayId, g.awayName); } },
    { key: "home", label: "Home", cls: "left", type: "str", value: function (g) { return teamName(g.homeId, g.homeName); }, cell: function (g) { return teamCell(g.homeId, g.homeName); } },
    { key: "site", label: "Site", cls: "left", type: "str", value: function (g) { return g.city || g.venue || ""; }, cell: function (g) {
      var s = g.city || g.venue || "";
      if (!s) return '<span class="dim">-</span>';
      return (g.neutral ? '<span class="dim">N </span>' : "") + SG.esc(s);
    } },
    { key: "line", label: "Line", cls: "left", type: "str", cell: function (g) { return g.details || (g.spread !== null && g.spread !== undefined ? SG.esc(String(g.spread)) : '<span class="dim">-</span>'); } },
    { key: "watch", label: "Watch", value: function (g) { return score(g, curCtx).value; }, cell: watchCell }
  ];

  function localTime(iso) {
    var d = iso instanceof Date ? iso : new Date(iso);
    if (isNaN(d.getTime())) return "";
    var opts = { hour: "numeric", minute: "2-digit" };
    if (tz) opts.timeZone = TZ[tz];
    return d.toLocaleString(undefined, opts);
  }

  function windowRange(w, refIso) {
    return localTime(tzWallInstant(refIso, w.start)) + " - " + localTime(tzWallInstant(refIso, w.end));
  }

  function tzWallInstant(refIso, hour) {
    var ref = refIso instanceof Date ? refIso : new Date(refIso);
    var tzid = tz ? TZ[tz] : undefined;
    var p = {};
    new Intl.DateTimeFormat("en-US", {
      timeZone: tzid, year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hour12: false
    }).formatToParts(ref).forEach(function (x) { p[x.type] = x.value; });
    var y = +p.year, mo = +p.month, d = +p.day, mi = +p.minute;
    var dayOff = Math.floor(hour / 24), h = ((hour % 24) + 24) % 24;
    if (tzid) {
      var wallMs = Date.UTC(y, mo - 1, d + dayOff, h, 0, 0);
      var gp = {};
      new Intl.DateTimeFormat("en-US", {
        timeZone: tzid, year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", hour12: false
      }).formatToParts(new Date(wallMs)).forEach(function (x) { gp[x.type] = x.value; });
      return new Date(wallMs + (wallMs - Date.UTC(+gp.year, +gp.month - 1, +gp.day, (+gp.hour) % 24, +gp.minute, 0)));
    }
    var wall = new Date(y, mo - 1, d + dayOff, h, 0, 0);
    wall.setSeconds(0, 0);
    return wall;
  }

  // Show the best few games in each kickoff window so the picks are spread
  // across the day instead of piling into one slot.
  var PER_WINDOW = 3;

  function getDayOfWeek(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    var tzid = tz ? TZ[tz] : undefined;
    var parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tzid,
      weekday: "long"
    }).formatToParts(d);
    for (var i = 0; i < parts.length; i++) {
      if (parts[i].type === "weekday") return parts[i].value;
    }
    return "";
  }

  function renderWatch(list) {
    var box = document.getElementById("tvWatch");
    if (!box) return;
    if (!list.length) { box.innerHTML = '<p class="note">No upcoming games match the filters.</p>'; return; }
    var watchSort = document.getElementById("tvSort") && document.getElementById("tvSort").value === "kickoff";

    // Group by day of week
    var byDay = {};
    list.forEach(function (g) {
      var day = getDayOfWeek(g.date) || "Unknown";
      (byDay[day] = byDay[day] || []).push(g);
    });

    var dayOrder = ["Saturday", "Friday", "Thursday", "Wednesday", "Tuesday", "Monday", "Sunday", "Unknown"];
    var html = "";

    dayOrder.forEach(function (day) {
      var games = byDay[day];
      if (!games || !games.length) return;

      if (day === "Saturday") {
        // Saturday: group by kickoff windows as before
        var byWin = {};
        games.forEach(function (g) {
          var w = windowOf(g.date);
          (byWin[w] = byWin[w] || []).push(g);
        });
        WINDOWS.forEach(function (w) {
          var all = byWin[w.key] || [];
          if (!all.length) return;
          var arr = all.slice().sort(function (a, b) {
            return score(b, curCtx).value - score(a, curCtx).value;
          }).slice(0, PER_WINDOW);
          if (watchSort) {
            arr.sort(function (a, b) {
              if (a.date !== b.date) return a.date < b.date ? -1 : 1;
              return score(b, curCtx).value - score(a, curCtx).value;
            });
          }
          var ref = all.slice().sort(function (a, b) { return a.date < b.date ? -1 : 1; })[0].date;
          html += '<div class="watch-window"><h4 class="watch-window-title">' + SG.esc(w.label) +
            ' <span class="dim">' + SG.esc(windowRange(w, ref)) + "</span></h4><div class=\"watch-grid\">";
          html += arr.map(function (g) {
            var s = score(g, curCtx);
            var away = teamName(g.awayId, g.awayName);
            var home = teamName(g.homeId, g.homeName);
            return '<div class="watch-card">' +
              '<div class="watch-head"><span class="watch-score">' + s.value + "</span>" +
              '<span class="watch-tier">' + SG.esc(s.tier) + "</span>" +
              (s.reason ? '<span class="watch-tag">' + SG.esc(s.reason) + "</span>" : "") + "</div>" +
              '<div class="watch-match">' + SG.teamLogo(away) + SG.esc(away) + SG.apBadge(away) +
              ' <span class="dim">' + (g.neutral ? "vs" : "at") + '</span> ' + SG.teamLogo(home) + SG.esc(home) + SG.apBadge(home) + "</div>" +
              '<div class="watch-meta">' + SG.esc(fmtWhen(g.date)) + (g.tv ? " - " + SG.esc(g.tv) : "") +
              (g.details ? " - " + SG.esc(g.details) : "") + "</div></div>";
          }).join("");
          html += "</div></div>";
        });
      } else {
        // Non-Saturday days: show all games sorted by watch score (or kickoff if watchSort)
        var arr = games.slice().sort(function (a, b) {
          return score(b, curCtx).value - score(a, curCtx).value;
        });
        if (watchSort) {
          arr.sort(function (a, b) {
            if (a.date !== b.date) return a.date < b.date ? -1 : 1;
            return score(b, curCtx).value - score(a, curCtx).value;
          });
        }
        html += '<div class="watch-window"><h4 class="watch-window-title">' + SG.esc(day) + ' games</h4><div class="watch-grid">';
        html += arr.map(function (g) {
          var s = score(g, curCtx);
          var away = teamName(g.awayId, g.awayName);
          var home = teamName(g.homeId, g.homeName);
          return '<div class="watch-card">' +
            '<div class="watch-head"><span class="watch-score">' + s.value + "</span>" +
            '<span class="watch-tier">' + SG.esc(s.tier) + "</span>" +
            (s.reason ? '<span class="watch-tag">' + SG.esc(s.reason) + "</span>" : "") + "</div>" +
            '<div class="watch-match">' + SG.teamLogo(away) + SG.esc(away) + SG.apBadge(away) +
            ' <span class="dim">' + (g.neutral ? "vs" : "at") + '</span> ' + SG.teamLogo(home) + SG.esc(home) + SG.apBadge(home) + "</div>" +
            '<div class="watch-meta">' + SG.esc(fmtWhen(g.date)) + (g.tv ? " - " + SG.esc(g.tv) : "") +
            (g.details ? " - " + SG.esc(g.details) : "") + "</div></div>";
        }).join("");
        html += "</div></div>";
      }
    });

    box.innerHTML = html;
  }

  function render() {
    if (!SG.state.data) return;
    var table = document.getElementById("tvTable");
    if (!table) return;
    if (!SG.state.tv) {
      document.getElementById("tvCount").textContent = "";
      document.getElementById("tvNote").textContent = "TV data is not loaded yet. It is refreshed by the Action each week.";
      document.getElementById("tvWatch").innerHTML = "";
      table.tBodies[0].innerHTML = "";
      return;
    }
    var list = filtered();
    curCtx = context();
    var sorted = SG.sortRows(list, COLUMNS, sort);
    SG.buildHead(table, COLUMNS, sort, function (key) {
      SG.toggleSort(sort, key, COLUMNS);
      render();
    });
    SG.fillBody(table, COLUMNS, sorted);
    document.getElementById("tvCount").textContent = list.length + " games";
    document.getElementById("tvNote").textContent =
      "Upcoming week's games from ESPN. Sort by watchability or kickoff, narrow by group, conference or team, " +
      "and pick a time zone. Games to watch shows the best few in each kickoff window so the picks do not all " +
      "land in one slot. Watch score blends how close the game projects (market line when posted), combined " +
      "team rating, what the game could do to the projected playoff field, and whether it is a rivalry.";
    renderWatch(list);
  }

  function fillConf() {
    var sel = document.getElementById("tvConf");
    if (!sel || !SG.state.data) return;
    var cur = sel.value;
    sel.innerHTML = '<option value="">All conferences</option>';
    var seen = {};
    SG.state.data.conferences.forEach(function (c) {
      var n = SG.mergeConf(c.name);
      if (seen[n]) return;
      seen[n] = true;
      var o = document.createElement("option");
      o.value = n;
      o.textContent = n;
      sel.appendChild(o);
    });
    sel.value = cur || "";
  }

  function syncScope() {
    document.getElementById("tvConf").classList.toggle("hidden", scope !== "conf");
    document.getElementById("tvSearch").classList.toggle("hidden", scope !== "team");
  }

  function init() {
    fillConf();
    syncScope();
    SG.$$("#tvScope .seg").forEach(function (seg) {
      seg.addEventListener("click", function () {
        scope = seg.dataset.scope;
        SG.$$("#tvScope .seg").forEach(function (s) { s.classList.toggle("active", s === seg); });
        syncScope();
        render();
      });
    });
    document.getElementById("tvConf").addEventListener("change", function (e) { conf = e.target.value; render(); });
    document.getElementById("tvGroup").addEventListener("change", function (e) { group = e.target.value; render(); });
    document.getElementById("tvSearch").addEventListener("input", function (e) { search = e.target.value.trim(); render(); });
    document.getElementById("tvSort").addEventListener("change", function (e) {
      sort = e.target.value === "kickoff" ? { key: "date", dir: 1 } : { key: "watch", dir: -1 };
      render();
    });
    document.getElementById("tvTz").addEventListener("change", function (e) { tz = e.target.value; render(); });
    render();
  }

  SG.state.modules.tv = {
    init: init,
    render: function () { fillConf(); render(); }
  };
})();
