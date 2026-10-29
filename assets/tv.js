/* TV schedule: upcoming games with kickoff time and TV listing, plus a
   "games to watch" ranking built from the Sagarin ratings, the AP poll and the
   betting line. Reads the prefetched data/tv-games.json. */
(function () {
  "use strict";
  var SG = window.SG;

  var scope = SG.rankLabel() === "CFP" ? "cfp" : "ap";        // all | ap | conf | team (switches to cfp when CFP is active)
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

  // Field and bubble come from the predictor simulation. Field membership
  // follows the playoff format: the highest simulated team in each P4
  // conference, the top G6 team, then the highest-probability remaining teams
  // to fill 12 spots. Bubble teams are the remaining teams at 5% or better,
  // plus the three G6 teams with the most simulated field probability.
  // Without a simulation file, fall back to the deterministic projection.
  function context() {
    var ctx = { field: {}, bubble: {}, divisionStandings: {}, prob: {} };
    if (!SG.state.data) return ctx;

    var byTeam = {};
    SG.state.data.teams.forEach(function (t) { byTeam[t.team] = t; });

    var sim = SG.state.sim12;
    if (sim && sim.field && sim.n) {
      Object.keys(sim.field).forEach(function (name) {
        if (byTeam[name]) ctx.prob[name] = sim.field[name] / sim.n;
      });

      function add(name) {
        if (name && byTeam[name] && !ctx.field[name]) ctx.field[name] = true;
      }
      function bestIn(pred) {
        var best = null, bestCount = -1;
        Object.keys(ctx.prob).forEach(function (name) {
          if (!pred(byTeam[name])) return;
          if (sim.field[name] > bestCount) { best = name; bestCount = sim.field[name]; }
        });
        return best;
      }

      // Auto bids: the top simulated team in each P4 conference and the top G6 team.
      SG.P4.forEach(function (conf) {
        add(bestIn(function (t) { return SG.mergeConf(t.conference) === conf; }));
      });
      add(bestIn(function (t) { return SG.G6.indexOf(SG.mergeConf(t.conference)) !== -1; }));

      // At-large spots: highest simulated field probability remaining.
      var rest = Object.keys(ctx.prob).sort(function (x, y) { return ctx.prob[y] - ctx.prob[x]; });
      for (var i = 0; i < rest.length && Object.keys(ctx.field).length < 12; i++) add(rest[i]);

      // Bubble: outside the field, 5% or better, plus the three best G6 teams.
      Object.keys(ctx.prob).forEach(function (name) {
        var p = ctx.prob[name];
        if (!ctx.field[name] && p >= 0.05 && p <= 0.5) ctx.bubble[name] = true;
      });
      var g6Bubble = Object.keys(ctx.prob).filter(function (name) {
        return !ctx.field[name] && !ctx.bubble[name] &&
          SG.G6.indexOf(SG.mergeConf(byTeam[name].conference)) !== -1;
      }).sort(function (x, y) { return ctx.prob[y] - ctx.prob[x]; }).slice(0, 3);
      g6Bubble.forEach(function (name) { ctx.bubble[name] = true; });
    } else if (SG.playoffField) {
      var f = SG.playoffField(12, METHOD);
      ((f && f.seeds) || []).forEach(function (t) { if (t) ctx.field[t.team] = true; });
      var ranked = (f && f.atLarge) || [];
      var n = 0;
      for (var j = 0; j < ranked.length && n < 20; j++) {
        if (!ctx.field[ranked[j].team]) { ctx.bubble[ranked[j].team] = true; n++; }
      }
    }

    // Add division standings from playoff module
    if (SG.state.modules && SG.state.modules.playoff && SG.state.modules.playoff.divisionStandings) {
      ctx.divisionStandings = SG.state.modules.playoff.divisionStandings(METHOD);
    }

    return ctx;
  }

  function tier(v) {
    return v >= 75 ? "Must watch" : v >= 55 ? "Worth watching" : v >= 35 ? "On the radar" : "Background";
  }

  // 0-100 watch score. Weights and shapes are set from published work rather
  // than taste:
  //   - closeness 0.35. The market line is the sharpest single predictor of the
  //     margin (Simple ACR 2022: closing line Brier .1871 vs Sagarin .1940), so
  //     when a line is posted we use it as-is, and when we only have Sagarin we
  //     shrink the signal toward a coin flip because it is the noisier estimate.
  //   - playoff stakes 0.25, from the projected field and the bubble.
  //   - conference championship implications 0.10. Games whose result changes
  //     who plays in the conference title game (division winners in the Sun
  //     Belt, top two everywhere else).
  //   - team quality 0.15, combined Sagarin rating.
  //   - rivalry 0.10. Rivalry nudges outcomes only slightly (favorites win about
  //     3.6 points less often, Cox et al. 2026) and the market mostly prices it.
  // For non-CCG-implication games, weights renormalize to 100% (divide by 0.85).
  function score(g, ctx) {
    try {
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
    var inFieldA = inA, inFieldB = inB;
    var stakes = 0;

    // --- Playoff stakes ---
    // Field and bubble status already include the playoff format (auto bids
    // plus at-large spots) from the predictor simulation.
    if (inFieldA && inFieldB) {
      if (!bubA && !bubB) {
        stakes = 0.3; // Both locks - minimal field impact
      } else if (bubA && bubB) {
        stakes = 0.55; // Both bubble - winner likely gets in
      } else {
        stakes = 0.75; // One lock, one bubble
      }
    } else if ((inFieldA && bubB) || (inFieldB && bubA)) {
      stakes = 0.75;
    } else if (bubA && bubB) {
      stakes = 0.55;
    } else if (inFieldA || inFieldB) {
      stakes = 0.4;
    } else if (bubA || bubB) {
      stakes = 0.25;
    } else {
      stakes = 0.05;
    }

    // Top-4 seed bonus: if either team has non-trivial top-4 chance and game affects seeding
    if (a && b && inFieldA && inFieldB && !bubA && !bubB) {
      // Both locks - check top-4 implications from sim data (only if sim has run)
      var sim = (SG.state.modules && SG.state.modules.playoff && SG.state.modules.playoff.view && SG.state.modules.playoff.view.sim) ? SG.state.modules.playoff.view.sim : null;
      if (sim && sim.debugRuns) {
        var teamA = na, teamB = nb;
        var top4A = 0, top4B = 0;
        sim.debugRuns.forEach(function(run) {
          var entryA = run.field.find(function(f) { return f.team === na; });
          var entryB = run.field.find(function(f) { return f.team === nb; });
          if (entryA && entryA.seed <= 4) top4A++;
          if (entryB && entryB.seed <= 4) top4B++;
        });
        top4A = top4A / sim.n;
        top4B = top4B / sim.n;
        if ((top4A > 0.1 || top4B > 0.1)) {
          // Non-trivial top-4 chance - game could affect top-4 seeding
          stakes = Math.min(1, stakes + 0.3);
        }
      }
    }
    // Top-4 seed bonus applied above; stakes set accordingly

    // Conference championship implications: does the result change who plays
    // in the conference title game? Uses merged conference names so the two
    // Sun Belt divisions are treated as one conference.
    var ccgImplications = 0;
    if (a && b) {
      var confA = SG.mergeConf(a.conference);
      var confB = SG.mergeConf(b.conference);
      if (confA === confB) ccgImplications = ccgImpact(g, na, nb, confA, ctx);
    }

    var rival = isRivalry(na, nb) ? 1 : 0;

    // Weights: CCG-implication games get the CCG component; others renormalize
    var hasCCG = ccgImplications > 0;
    var value;
    if (hasCCG) {
      // Closeness + Stakes + Quality + Rivalry + CCG = 35+25+15+10+10 = 100
      value = Math.round(100 * (0.35 * closeness + 0.25 * stakes + 0.15 * quality + 0.10 * rival + 0.10 * ccgImplications));
    } else {
      // No CCG implications: renormalize 35+25+15+10 = 85 -> divide by 0.85
      value = Math.round(100 * (0.35 * closeness + 0.25 * stakes + 0.15 * quality + 0.10 * rival) / 0.85);
    }

    var apA = a ? SG.apRank(na) : null;
    var apB = b ? SG.apRank(nb) : null;
    var reason;
    if (ccgImplications > 0 && rival) reason = "Rivalry, CCG implications";
    else if (ccgImplications > 0) reason = "CCG implications";
    else if (inFieldA && inFieldB && rival) reason = "Rivalry, playoff stakes";
    else if (inFieldA && inFieldB) reason = "Playoff clash";
    else if (rival) reason = "Rivalry";
    else if ((inA || inB) && closeness > 0.5) reason = "Elimination watch";
    else if (bubA && bubB) reason = "Bubble watch";
    else if (closeness > 0.6) reason = "Toss-up";
    else if (a && b && SG.apRank(na) && SG.apRank(nb)) reason = "Ranked matchup";
    else if (quality > 0.8) reason = "Quality teams";
    else reason = "";
    return { value: value, reason: reason, tier: tier(value) };
    } catch (e) {
      console.error("Score calculation error:", e);
      return { value: 0, reason: "Error", tier: tier(0) };
    }
  }

  function inScope(g) {
    var a = sag(g.awayId), b = sag(g.homeId);
    if (group && (a ? SG.confGroup(a) : "") !== group && (b ? SG.confGroup(b) : "") !== group) return false;
    if (scope === "all") return true;
    if (scope === "ap" || scope === "cfp") return !!(a && SG.apRank(a.team)) || !!(b && SG.apRank(b.team));
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

  // ============ CCG implications ============
  // The watch score only cares whether a result changes who plays in the
  // conference title game. Build the projected participants from the projected
  // records once with each team winning, then compare the two sets. Division
  // winners meet in the Sun Belt; other conferences send their top two.

  function conferenceRecords(conf, ctx) {
    var out = {};
    var groups = ctx.divisionStandings && ctx.divisionStandings[conf];
    if (!groups) return out;
    Object.keys(groups).forEach(function (div) {
      groups[div].teams.forEach(function (t) {
        out[t.team] = {
          team: t.team, cw: t.cw, cl: t.cl, ow: t.ow, ol: t.ol,
          rating: t.rating, predictor: t.predictor,
          goldenMean: t.goldenMean, recent: t.recent, strongRecent: t.strongRecent
        };
      });
    });
    return out;
  }

  function ccgScore(rec) {
    var cwp = (rec.cw + rec.cl) ? rec.cw / (rec.cw + rec.cl) : 0;
    var owp = (rec.ow + rec.ol) ? rec.ow / (rec.ow + rec.ol) : 0;
    var rating = rec[METHOD] || rec.rating || 0;
    return cwp * 1e6 + owp * 1e3 + rating;
  }

  function topTeams(list, count) {
    return list.slice().sort(function (x, y) { return ccgScore(y) - ccgScore(x); }).slice(0, count);
  }

  function ccgParticipants(conf, recs, ctx) {
    var groups = ctx.divisionStandings && ctx.divisionStandings[conf];
    if (!groups) return [];
    var keys = Object.keys(groups);
    if (keys.length >= 2) {
      return keys.map(function (div) {
        var list = groups[div].teams.map(function (t) { return recs[t.team] || t; });
        var top = topTeams(list, 1)[0];
        return top ? top.team : null;
      }).filter(Boolean);
    }
    var all = [];
    keys.forEach(function (div) {
      groups[div].teams.forEach(function (t) { all.push(recs[t.team] || t); });
    });
    return topTeams(all, 2).map(function (t) { return t.team; });
  }

  // Share of the projected title-game field that changes when this game
  // happens. 0 means the result does not affect the participants.
  function ccgImpact(g, na, nb, conf, ctx) {
    var base = conferenceRecords(conf, ctx);
    if (!base[na] || !base[nb]) return 0;
    var a = sag(g.awayId), b = sag(g.homeId);
    if (!a || !b) return 0;

    // Projected records already include this game. Remove its projected result
    // first so both forced outcomes start from the same pre-game baseline.
    var edge = SG.homeEdge(METHOD);
    var homeWins = (b[METHOD] - a[METHOD] + (g.neutral ? 0 : edge)) >= 0;
    var projWinner = homeWins ? nb : na;
    var projLoser = homeWins ? na : nb;
    if (base[projWinner]) { base[projWinner].cw -= 1; base[projWinner].ow -= 1; }
    if (base[projLoser]) { base[projLoser].cl -= 1; base[projLoser].ol -= 1; }

    function variant(winner, loser) {
      var rec = {};
      Object.keys(base).forEach(function (name) {
        var r = base[name];
        rec[name] = {
          team: name, cw: r.cw, cl: r.cl, ow: r.ow, ol: r.ol,
          rating: r.rating, predictor: r.predictor,
          goldenMean: r.goldenMean, recent: r.recent, strongRecent: r.strongRecent
        };
      });
      if (rec[winner]) { rec[winner].cw += 1; rec[winner].ow += 1; }
      if (rec[loser]) { rec[loser].cl += 1; rec[loser].ol += 1; }
      return ccgParticipants(conf, rec, ctx);
    }

    var aWin = variant(na, nb);
    var bWin = variant(nb, na);
    var total = Math.max(aWin.length, bWin.length, 1);
    var same = 0;
    aWin.forEach(function (name) { if (bWin.indexOf(name) !== -1) same++; });
    return (total - same) / total;
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
    { key: "tv", label: "TV", cls: "left tv-col", type: "str", cell: function (g) { return g.tv ? SG.esc(g.tv) : '<span class="dim">TBD</span>'; } },
    { key: "away", label: "Away", cls: "left", type: "str", value: function (g) { return teamName(g.awayId, g.awayName); }, cell: function (g) { return teamCell(g.awayId, g.awayName); } },
    { key: "home", label: "Home", cls: "left", type: "str", value: function (g) { return teamName(g.homeId, g.homeName); }, cell: function (g) { return teamCell(g.homeId, g.homeName); } },
    { key: "site", label: "Site", cls: "left", type: "str", value: function (g) { return g.city || g.venue || ""; }, cell: function (g) {
      var s = g.city || g.venue || "";
      if (!s) return '<span class="dim">-</span>';
      return (g.neutral ? '<span class="dim">N </span>' : "") + SG.esc(s);
    } },
    { key: "line", label: "Line", cls: "left", type: "str", cell: function (g) { return g.details || (g.spread !== null && g.spread !== undefined ? SG.esc(String(g.spread)) : '<span class="dim">-</span>'); } },
    { key: "watchReason", label: "Vibe", cls: "left", type: "str", value: function (g) { return score(g, curCtx).reason || ""; }, cell: function (g) { var s = score(g, curCtx); return s.reason ? '<span class="watch-tag">' + SG.esc(s.reason) + "</span>" : '<span class="dim">-</span>'; } },
    { key: "watch", label: "Watch", cls: "watch-col", value: function (g) { return score(g, curCtx).value; }, cell: function (g) { var s = score(g, curCtx); return '<span class="watch-score">' + s.value + "</span>"; } }
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

    var html = "";

    // 1. Non-Saturday games section (all non-Saturday games)
    var nonSaturdayGames = [];
    ["Friday", "Thursday", "Wednesday", "Tuesday", "Monday", "Sunday", "Unknown"].forEach(function (day) {
      if (byDay[day] && byDay[day].length) {
        nonSaturdayGames.push.apply(nonSaturdayGames, byDay[day]);
      }
    });

    if (nonSaturdayGames.length) {
      var arr = nonSaturdayGames.slice().sort(function (a, b) {
        return score(b, curCtx).value - score(a, curCtx).value;
      });
      // Minimum score threshold of 35
      arr = arr.filter(function (g) { return score(g, curCtx).value >= 35; });
      arr = arr.slice(0, PER_WINDOW);
      if (watchSort) {
        arr.sort(function (a, b) {
          if (a.date !== b.date) return a.date < b.date ? -1 : 1;
          return score(b, curCtx).value - score(a, curCtx).value;
        });
      }
      html += '<div class="watch-window"><h4 class="watch-window-title">Non-Saturday games</h4><div class="watch-grid">';
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

    // 2. Saturday games grouped by kickoff windows
    var saturdayGames = byDay["Saturday"] || [];
    if (saturdayGames.length) {
      var byWin = {};
      saturdayGames.forEach(function (g) {
        var w = windowOf(g.date);
        (byWin[w] = byWin[w] || []).push(g);
      });
      WINDOWS.forEach(function (w) {
        var all = byWin[w.key] || [];
        if (!all.length) return;
        var arr = all.slice().sort(function (a, b) {
          return score(b, curCtx).value - score(a, curCtx).value;
        });
        // Minimum score threshold of 35
        arr = arr.filter(function (g) { return score(g, curCtx).value >= 35; });
        arr = arr.slice(0, PER_WINDOW);
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
    }

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
    document.getElementById("tvNote").textContent = "Upcoming ESPN games. Sort by watchability or kickoff, filter by group, conference or team, pick a time zone. Games to watch picks the best games per window. Watch score = close game + team rating + playoff impact + conference title impact + rivalry.";
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
