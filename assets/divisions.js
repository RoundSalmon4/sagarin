/*
 * FBS team division assignments.
 * Keys are exact Sagarin team names (see normalizeName in core.js).
 * Values are division names within the conference.
 * Only conferences with divisions are listed.
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
    // SEC
    "Alabama": "West",
    "Auburn": "West",
    "Arkansas": "West",
    "LSU": "West",
    "Mississippi": "West",
    "Mississippi State": "West",
    "Texas A&M": "West",
    "Florida": "East",
    "Georgia": "East",
    "Kentucky": "East",
    "Missouri": "East",
    "South Carolina": "East",
    "Tennessee": "East",
    "Vanderbilt": "East",
    "Oklahoma": "West",
    "Texas": "West",

    // Big Ten
    "Illinois": "West",
    "Iowa": "West",
    "Minnesota": "West",
    "Nebraska": "West",
    "Northwestern": "West",
    "Purdue": "West",
    "Wisconsin": "West",
    "Indiana": "East",
    "Maryland": "East",
    "Michigan": "East",
    "Michigan State": "East",
    "Ohio State": "East",
    "Penn State": "East",
    "Rutgers": "East",

    // ACC
    "Boston College": "Atlantic",
    "Clemson": "Atlantic",
    "Duke": "Atlantic",
    "Florida State": "Atlantic",
    "Louisville": "Atlantic",
    "NC State": "Atlantic",
    "North Carolina": "Coastal",
    "Pittsburgh": "Coastal",
    "Syracuse": "Atlantic",
    "Virginia": "Coastal",
    "Virginia Tech": "Coastal",
    "Wake Forest": "Atlantic",
    "Georgia Tech": "Coastal",
    "Miami-Florida": "Coastal",

    // Big 12
    "Arizona": "None",
    "Arizona State": "None",
    "Baylor": "None",
    "BYU": "None",
    "Cincinnati": "None",
    "Colorado": "None",
    "Houston": "None",
    "Iowa State": "None",
    "Kansas": "None",
    "Kansas State": "None",
    "Oklahoma State": "None",
    "TCU": "None",
    "Texas Tech": "None",
    "UCF": "None",
    "Utah": "None",
    "West Virginia": "None",

    // SEC additions
    "Missouri": "East",
    "Texas A&M": "West",

    // Big 12 divisions (no divisions currently)
  };
});