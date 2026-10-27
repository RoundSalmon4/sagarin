/*
 * FBS team division assignments for 2026 season.
 * Keys are exact Sagarin team names (see normalizeName in core.js).
 * Values are division names within the conference.
 * Only conferences with divisions in 2026 are listed.
 * 
 * 2026 Status:
 * - SEC: East/West (active)
 * - MAC: East/West (active)
 * - Mountain West: Mountain/West (active)
 * - Sun Belt: East/West (active)
 * - Big Ten: No divisions (eliminated 2024)
 * - ACC: No divisions (eliminated 2023)
 * - Big 12: No divisions (eliminated 2023)
 * - American, C-USA, etc.: No divisions
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
    // SEC - East/West (active)
    "Alabama": "West",
    "Auburn": "West",
    "Arkansas": "West",
    "LSU": "West",
    "Mississippi": "West",
    "Mississippi State": "West",
    "Texas A&M": "West",
    "Oklahoma": "West",
    "Texas": "West",
    "Florida": "East",
    "Georgia": "East",
    "Kentucky": "East",
    "Missouri": "East",
    "South Carolina": "East",
    "Tennessee": "East",
    "Vanderbilt": "East",

    // MAC - East/West (active)
    "Akron": "East",
    "Bowling Green": "East",
    "Buffalo": "East",
    "Kent State": "East",
    "Miami-Ohio": "East",
    "Ohio": "East",
    "Central Michigan": "West",
    "Eastern Michigan": "East",
    "Northern Illinois": "West",
    "Toledo": "West",
    "Western Michigan": "West",
    "Ball State": "West",

    // Mountain West - Mountain/West (2026)
    "Air Force": "Mountain",
    "New Mexico": "Mountain",
    "Wyoming": "Mountain",
    "Hawaii": "West",
    "Nevada": "West",
    "UNLV": "West",
    "North Dakota State": "West",
    "San Jose State": "West",
    "UTEP": "West",
    "Northern Illinois": "West",

    // Sun Belt - East/West (active)
    "Appalachian State": "East",
    "Coastal Carolina": "East",
    "Georgia Southern": "East",
    "Georgia State": "East",
    "James Madison": "East",
    "Marshall": "East",
    "Old Dominion": "East",
    "Arkansas State": "West",
    "Louisiana": "West",
    "Louisiana-Monroe": "West",
    "South Alabama": "West",
    "Southern Miss": "West",
    "Texas State": "West",
    "Troy": "West",

    // MAC teams already listed above

    // Note: These conferences have NO divisions in 2026:
    // Big Ten (eliminated 2024)
    // ACC (eliminated 2023)
    // Big 12 (eliminated 2023)
    // American Athletic, Conference USA, etc.: No divisions
  };
});