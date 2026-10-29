/*
 * FBS team division assignments for 2026 season.
 * Keys are exact Sagarin team names (see normalizeName in core.js).
 * Values are division names within the conference.
 *
 * 2026 status (verified against ESPN's 2026 standings and Sagarin cfsend.htm):
 * - Sun Belt: East/West (the only FBS conference with divisions)
 * - SEC, MAC, Mountain West: no divisions
 * - Big Ten, ACC, Big 12, Pac-12, American, Conference USA: no divisions
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.TeamDivisions = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  return {
    // Sun Belt - East/West
    "Appalachian State": "East",
    "Coastal Carolina": "East",
    "Georgia Southern": "East",
    "Georgia State": "East",
    "James Madison": "East",
    "Marshall": "East",
    "Old Dominion": "East",

    "Arkansas State": "West",
    "Louisiana Tech": "West",
    "Louisiana-Lafayette": "West",
    "LouisianaMonroe(ULM)": "West",
    "South Alabama": "West",
    "Southern Miss": "West",
    "Troy": "West"
  };
});
