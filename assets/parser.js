/*
 * Sagarin college football page parser.
 *
 * The cfsend.htm page is a fixed-width report wrapped in <pre> blocks. We strip
 * the tags, walk the text line by line and pull out three things:
 *   1. the team rating table (one line per team)
 *   2. the conference ranking table
 *   3. the home-advantage line, which carries one edge per rating column
 *
 * Works in the browser (window.Sagarin) and under node (module.exports).
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.Sagarin = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var TITLE_RE =
    /(\d{4})\s+COLLEGE FOOTBALL through results of\s+(.+?)\s+-\s+WEEK\s+(\d+)/i;
  var HOME_RE =
    /HOME ADVANTAGE=\[\s*(-?\d+\.\d+)\]\s*\[\s*(-?\d+\.\d+)\]\s*\[\s*(-?\d+\.\d+)\]\s*\[\s*(-?\d+\.\d+)\]\s*\[\s*(-?\d+\.\d+)\]/;

  //   1  Ohio State   A  =  95.23  6  1  72.47( 28)  1 1 | 2 1 | 93.97 1 | ...
  var TEAM_RE = new RegExp(
    "^\\s*(\\d{1,3})\\s+(.+?)\\s+(A|AA|__)\\s*=\\s*(-?\\d+\\.\\d+)" +
      "\\s+(\\d+)\\s+(\\d+)\\s+(-?\\d+\\.\\d+)\\(\\s*(\\d+)\\)" +
      "\\s+(\\d+)\\s+(\\d+)\\s*\\|\\s*(\\d+)\\s+(\\d+)\\s*\\|" +
      "\\s*(-?\\d+\\.\\d+)\\s+(\\d+)\\s*\\|" +
      "\\s*(-?\\d+\\.\\d+)\\s+(\\d+)\\s*\\|" +
      "\\s*(-?\\d+\\.\\d+)\\s+(\\d+)\\s*\\|" +
      "\\s*(-?\\d+\\.\\d+)\\s+(\\d+)\\s+(.+?)\\s*\\((A|AA|__)\\)\\s*$"
  );

  //   1  @ Delaware  6.55 6.06 7.77 5.09 3.43  Missouri State  204 67% 31.80 25.21 57.00 6.59 67% 204
  // five predicted margins (rating, pred, golden, recent, strong), moneyline, win%,
  // home/away/total scores, then the home-margin block.
  var PRED_RE = new RegExp(
    "^\\s*(\\d{1,3})\\s+(?:(@|n)\\s+)?(.+?)\\s+" +
      "(-?\\d+\\.\\d+)\\s+(-?\\d+\\.\\d+)\\s+(-?\\d+\\.\\d+)\\s+(-?\\d+\\.\\d+)\\s+(-?\\d+\\.\\d+)\\s+" +
      "(?:(@|n)\\s+)?(.+?)\\s+" +
      "(-?\\d+)\\s+(\\d+)%\\s+" +
      "(-?\\d+\\.\\d+)\\s+(-?\\d+\\.\\d+)\\s+(-?\\d+\\.\\d+)\\s+(-?\\d+\\.\\d+)\\s+(\\d+)%\\s+(-?\\d+)\\s*$"
  );

  // Eigenvector block: numbered, favorite, spread, odds, pct, underdog
  var EIGEN_RE = new RegExp(
    "^\\s*(\\d{1,3})\\s+(?:(@|n)\\s+)?(.+?)\\s+" +
      "(-?\\d+\\.\\d+)\\s+(-?\\d+)\\s+(\\d+)%\\s+(?:(@|n)\\s+)?(.+?)\\s*$"
  );

  //   1  SEC  (A) = 84.33  83.98 ( 1)  16  84.14 ( 1)  83.9839(6.2270) ...
  var CONF_RE = new RegExp(
    "^\\s*(\\d{1,3})\\s+(.+?)\\s*\\((A|AA|__)\\)\\s*=\\s*(-?\\d+\\.\\d+)" +
      "\\s+(-?\\d+\\.\\d+)\\s*\\(\\s*(\\d+)\\)\\s+(\\d+)" +
      "\\s+(-?\\d+\\.\\d+)\\s*\\(\\s*(\\d+)\\)" +
      "\\s+(-?\\d+\\.\\d+)\\(\\s*(-?[\\d.]+)\\)" +
      "\\s+(-?\\d+\\.\\d+)\\(\\s*(-?[\\d.]+)\\)" +
      "\\s+(-?\\d+\\.\\d+)\\(\\s*(-?[\\d.]+)\\)" +
      "\\s+(-?\\d+\\.\\d+)\\(\\s*(-?[\\d.]+)\\)" +
      "\\s+(-?\\d+\\.\\d+)\\(\\s*(-?[\\d.]+)\\)\\s*$"
  );

  function stripTags(html) {
    return String(html).replace(/<[^>]*>/g, "");
  }

  function decodeEntities(s) {
    return s
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&#0*39;/g, "'")
      .replace(/&apos;/gi, "'")
      .replace(/&quot;/gi, '"');
  }

  // FNV-1a, 32 bit. Short, stable, and byte-identical in node and the browser.
  function hash(str) {
    var h = 0x811c9dc5;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
    }
    return ("00000000" + h.toString(16)).slice(-8);
  }

  function num(x) {
    return x === undefined || x === null ? null : parseFloat(x);
  }

  function parseInt10(x) {
    return parseInt(x, 10);
  }

  function parseTeam(line) {
    var m = TEAM_RE.exec(line);
    if (!m) return null;
    var name = m[2].trim();
    var level = m[3];
    if (level === "__" || /UNRATED/i.test(name)) return null;
    return {
      rank: parseInt10(m[1]),
      team: name,
      level: level,
      rating: num(m[4]),
      w: parseInt10(m[5]),
      l: parseInt10(m[6]),
      sched: num(m[7]),
      schedRank: parseInt10(m[8]),
      vs10w: parseInt10(m[9]),
      vs10l: parseInt10(m[10]),
      vs30w: parseInt10(m[11]),
      vs30l: parseInt10(m[12]),
      predictor: num(m[13]),
      predictorRank: parseInt10(m[14]),
      goldenMean: num(m[15]),
      goldenMeanRank: parseInt10(m[16]),
      recent: num(m[17]),
      recentRank: parseInt10(m[18]),
      strongRecent: num(m[19]),
      strongRecentRank: parseInt10(m[20]),
      conference: m[21].trim(),
      confLevel: m[22]
    };
  }

  function parseConference(line) {
    var m = CONF_RE.exec(line);
    if (!m) return null;
    var name = m[2].trim();
    if (name === "___UNRATED___" || name === "OVERALL") return null;
    return {
      rank: parseInt10(m[1]),
      name: name,
      level: m[3],
      centralMean: num(m[4]),
      simpleAvg: num(m[5]),
      simpleRank: parseInt10(m[6]),
      teams: parseInt10(m[7]),
      win50: num(m[8]),
      win50Rank: parseInt10(m[9]),
      rating: num(m[10]),
      ratingSd: num(m[11]),
      predictor: num(m[12]),
      predictorSd: num(m[13]),
      goldenMean: num(m[14]),
      goldenMeanSd: num(m[15]),
      recent: num(m[16]),
      recentSd: num(m[17]),
      strongRecent: num(m[18]),
      strongRecentSd: num(m[19])
    };
  }

  function parsePrediction(line) {
    var m = PRED_RE.exec(line);
    if (!m) return null;
    var favHome = m[2];
    var dogHome = m[9];
    var favorite = m[3].trim();
    var underdog = m[10].trim();
    if (!favorite || !underdog) return null;
    return {
      num: parseInt10(m[1]),
      favorite: favorite,
      underdog: underdog,
      home: favHome ? favorite : dogHome ? underdog : null,
      neutral: favHome === "n" || dogHome === "n",
      rating: num(m[4]),
      pred: num(m[5]),
      golden: num(m[6]),
      recent: num(m[7]),
      strong: num(m[8]),
      money: num(m[11]),
      winPct: num(m[12]),
      homeScore: num(m[13]),
      awayScore: num(m[14]),
      total: num(m[15]),
      hMargin: num(m[16]),
      altWinPct: num(m[17]),
      altMoney: num(m[18])
    };
  }

  function parseEigen(line) {
    var m = EIGEN_RE.exec(line);
    if (!m) return null;
    var favHome = m[2];
    var dogHome = m[7];
    var favorite = m[3].trim();
    var underdog = m[8].trim();
    if (!favorite || !underdog) return null;
    return {
      num: parseInt10(m[1]),
      favorite: favorite,
      underdog: underdog,
      home: favHome ? favorite : dogHome ? underdog : null,
      spread: num(m[4]),
      odds: num(m[5]),
      pct: num(m[6])
    };
  }

  function sign(teams) {
    var parts = [];
    for (var i = 0; i < teams.length; i++) {
      var t = teams[i];
      parts.push(
        t.team +
          ":" +
          t.rating +
          ":" +
          t.predictor +
          ":" +
          t.goldenMean +
          ":" +
          t.recent +
          ":" +
          t.strongRecent
      );
    }
    return hash(parts.join("|"));
  }

  function parse(rawHtml) {
    var text = decodeEntities(stripTags(rawHtml));
    var lines = text.split(/\r?\n/);

    var teams = [];
    var seen = Object.create(null);
    var conferences = [];
    var seenConf = Object.create(null);
    var home = null;
    var title = null;
    var section = null;
    var predictions = { regular: [], experimental: [], eigenvector: [] };

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];

      if (line.indexOf("EIGENVECTOR") !== -1) {
        section = "eigenvector";
      } else if (line.indexOf("EXPERIMENTAL NUMBERS") !== -1) {
        section = "experimental";
      } else if (section === null && /FAVORITE\s+Rating\s+Pred/i.test(line)) {
        section = "regular";
      }

      if (!title) {
        var tm = TITLE_RE.exec(line);
        if (tm) {
          title = {
            season: parseInt10(tm[1]),
            through: tm[2].trim(),
            week: parseInt10(tm[3])
          };
        }
      }

      if (!home && line.indexOf("HOME ADVANTAGE=") !== -1) {
        var hm = HOME_RE.exec(line);
        if (hm) {
          home = {
            rating: num(hm[1]),
            predictor: num(hm[2]),
            goldenMean: num(hm[3]),
            recent: num(hm[4]),
            strongRecent: num(hm[5])
          };
        }
      }

      if (section === "eigenvector") {
        var e = parseEigen(line);
        if (e) {
          predictions.eigenvector.push(e);
          continue;
        }
      } else if (section === "regular" || section === "experimental") {
        var p = parsePrediction(line);
        if (p) {
          predictions[section].push(p);
          continue;
        }
      }

      if (line.indexOf("=") !== -1 && line.indexOf("(") !== -1) {
        var c = parseConference(line);
        if (c) {
          if (!seenConf[c.name]) {
            seenConf[c.name] = true;
            conferences.push(c);
          }
          continue;
        }
      }

      var t = parseTeam(line);
      if (t && !seen[t.team]) {
        seen[t.team] = true;
        teams.push(t);
      }
    }

    conferences.sort(function (a, b) {
      return a.rank - b.rank;
    });

    return {
      meta: {
        season: title ? title.season : null,
        through: title ? title.through : null,
        week: title ? title.week : null,
        teamCount: teams.length,
        conferenceCount: conferences.length,
        homeAdvantage: home
      },
      signature: sign(teams),
      teams: teams,
      conferences: conferences,
      predictions: predictions
    };
  }

  return {
    parse: parse,
    hash: hash,
    parseTeam: parseTeam,
    parseConference: parseConference,
    parsePrediction: parsePrediction,
    parseEigen: parseEigen
  };
});
