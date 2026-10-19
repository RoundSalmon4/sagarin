/*
 * Sagarin team name to ESPN team name aliases.
 * Keys are normalized Sagarin names (see normalizeName), values are normalized
 * ESPN location/name strings. Shared by the site and by scripts/fetch-espn.js.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.TeamAlias = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  return {
    "miami florida": "miami",
    "miami ohio": "miami oh",
    "fla international": "florida international",
    "central florida ucf": "ucf",
    "louisianamonroe ulm": "ul monroe",
    "louisiana lafayette": "louisiana",
    "miss valley state": "mississippi valley state",
    "se missouri state": "southeast missouri state",
    "army west point": "army",
    "connecticut": "uconn",
    "mississippi": "ole miss",
    "southern california": "usc",
    "appalachian state": "app state",
    "sam houston state": "sam houston",
    "monmouth nj": "monmouth",
    "albany ny": "ualbany",
    "tennessee martin": "ut martin",
    "sc state": "south carolina state",
    "cal poly slo": "cal poly",
    "mcneese state": "mcneese",
    "st thomas mn": "st thomas",
    "ark pine bluff": "arkansas pine bluff",
    "liu post": "long island university",
    "stonehill college": "stonehill",
    "grambling state": "grambling",
    "nc central": "north carolina central",
    "nc at": "north carolina at",
    "southern u": "southern",
    "nicholls state": "nicholls",
    "presbyterian college": "presbyterian"
  };
});
