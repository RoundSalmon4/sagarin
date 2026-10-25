/*
 * Curated rivalries, keyed by exact Sagarin team names. Not exhaustive, but it
 * covers the games most neutral fans circle on the calendar. Shared with the TV
 * tab's games-to-watch score.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.Rivalries = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  // Use a Set to ensure uniqueness
  const pairs = new Set();
  function add(a, b) {
    const key = [a, b].sort().join("|");
    if (!pairs.has(key)) pairs.add(key);
  }

  // Big Ten
  add("Ohio State", "Michigan");
  add("Michigan", "Michigan State");
  add("Michigan", "Notre Dame");
  add("Michigan State", "Notre Dame");
  add("Penn State", "Ohio State");
  add("Penn State", "Michigan");
  add("Penn State", "Pittsburgh");
  add("Illinois", "Northwestern");
  add("Indiana", "Purdue");
  add("Purdue", "Northwestern");
  add("Iowa", "Iowa State");
  add("Iowa", "Minnesota");
  add("Iowa", "Wisconsin");
  add("Minnesota", "Wisconsin");
  add("Wisconsin", "Nebraska");
  add("Nebraska", "Iowa");
  add("Iowa", "Iowa State");
  add("Iowa", "Minnesota");
  add("Iowa", "Wisconsin");
  add("Minnesota", "Wisconsin");
  add("Wisconsin", "Nebraska");
  add("Illinois", "Northwestern");
  add("Indiana", "Purdue");
  add("Purdue", "Northwestern");

  // SEC
  add("Alabama", "Auburn");
  add("Alabama", "Tennessee");
  add("Alabama", "LSU");
  add("Auburn", "Georgia");
  add("Georgia", "Florida");
  add("Georgia", "Georgia Tech");
  add("Georgia", "South Carolina");
  add("Georgia", "Clemson");
  add("Florida", "Florida State");
  add("Florida", "Miami-Florida");
  add("Florida", "Tennessee");
  add("Florida State", "Miami-Florida");
  add("Florida State", "Clemson");
  add("Clemson", "South Carolina");
  add("Clemson", "Georgia Tech");
  add("LSU", "Mississippi");
  add("LSU", "Arkansas");
  add("LSU", "Texas A&M");
  add("LSU", "Tulane");
  add("Mississippi", "Mississippi State");
  add("Mississippi", "Memphis");
  add("Mississippi State", "Southern Miss");
  add("Arkansas", "Texas");
  add("Arkansas", "Missouri");
  add("Texas", "Oklahoma");
  add("Texas", "Texas A&M");
  add("Texas A&M", "Arkansas");
  add("Oklahoma", "Oklahoma State");
  add("Oklahoma", "Nebraska");
  add("Texas Tech", "Baylor");
  add("Tennessee", "Kentucky");
  add("LSU", "Florida");
  add("Auburn", "Florida");
  add("Auburn", "South Carolina");
  add("Georgia", "Auburn");
  add("Missouri", "South Carolina");
  add("Tennessee", "Vanderbilt");
  add("Kentucky", "Tennessee");
  add("Auburn", "South Carolina");

  // Big Ten continued
  add("Nebraska", "Iowa");
  add("Iowa", "Iowa State");
  add("Iowa", "Minnesota");
  add("Iowa", "Wisconsin");
  add("Minnesota", "Wisconsin");
  add("Wisconsin", "Nebraska");
  add("Illinois", "Northwestern");
  add("Indiana", "Purdue");
  add("Purdue", "Northwestern");

  // Notre Dame
  add("Notre Dame", "Southern California");
  add("Notre Dame", "Stanford");
  add("Southern California", "UCLA");
  add("Southern California", "Stanford");
  add("UCLA", "California");
  add("California", "Stanford");
  add("Washington", "Washington State");
  add("Washington", "Oregon");
  add("Oregon", "Oregon State");
  add("Oregon", "Washington State");

  // Pac-12 / Mountain West / Big 12
  add("Boise State", "Fresno State");
  add("Boise State", "Nevada");
  add("BYU", "Utah");
  add("BYU", "Utah State");
  add("Utah", "Utah State");
  add("Colorado", "Colorado State");
  add("Colorado", "Nebraska");
  add("Kansas", "Kansas State");
  add("Kansas", "Missouri");
  add("Kansas State", "Missouri");
  add("Baylor", "TCU");
  add("TCU", "SMU");
  add("SMU", "Houston");
  add("SMU", "Rice");
  add("Houston", "Rice");
  add("Houston", "Tulsa");
  add("UTSA", "North Texas");
  add("UTSA", "Texas State");
  add("North Texas", "SMU");
  add("North Texas", "UTSA");
  add("UAB", "Memphis");
  add("UAB", "Southern Miss");
  add("UTSA", "North Texas");
  add("North Texas", "UTSA");
  add("Iowa State", "Kansas State");
  add("UAB", "Memphis");
  add("UAB", "Southern Miss");

  // Service academies
  add("Army West Point", "Navy");
  add("Army West Point", "Air Force");
  add("Navy", "Air Force");
  add("Pittsburgh", "West Virginia");
  add("West Virginia", "Virginia Tech");
  add("Virginia", "Virginia Tech");
  add("North Carolina", "Virginia");
  add("Duke", "North Carolina");
  add("NC State", "North Carolina");
  add("NC State", "Wake Forest");
  add("Duke", "Wake Forest");
  add("Louisville", "Kentucky");
  add("Louisville", "Cincinnati");
  add("Kentucky", "Tennessee");
  add("Tennessee", "Vanderbilt");
  add("Cincinnati", "Miami-Ohio");
  add("Cincinnati", "West Virginia");
  add("Central Florida(UCF)", "South Florida");
  add("UAB", "Memphis");
  add("UAB", "Southern Miss");
  add("UTSA", "North Texas");
  add("North Texas", "UTSA");
  add("Iowa State", "Kansas State");
  add("UAB", "Memphis");
  add("UAB", "Southern Miss");
  add("Coastal Carolina", "Georgia Southern");
  add("Georgia State", "Appalachian State");
  add("Coastal Carolina", "Appalachian State");
  add("Coastal Carolina", "Georgia Southern");
  add("Coastal Carolina", "Georgia State");
  add("Georgia State", "Appalachian State");
  add("Coastal Carolina", "Georgia Southern");
  add("Coastal Carolina", "Appalachian State");
  add("Coastal Carolina", "Georgia Southern");
  add("Coastal Carolina", "Georgia State");
  add("Georgia State", "Appalachian State");
  add("James Madison", "Appalachian State");
  add("Coastal Carolina", "Appalachian State");
  add("Coastal Carolina", "Georgia Southern");
  add("Coastal Carolina", "Georgia State");
  add("Georgia State", "Appalachian State");

  // Service academies
  add("Army West Point", "Navy");
  add("Army West Point", "Air Force");
  add("Navy", "Air Force");
  add("Pittsburgh", "West Virginia");
  add("West Virginia", "Virginia Tech");
  add("Virginia", "Virginia Tech");
  add("North Carolina", "Virginia");
  add("Duke", "North Carolina");
  add("NC State", "North Carolina");
  add("NC State", "Wake Forest");
  add("Duke", "Wake Forest");
  add("Louisville", "Kentucky");
  add("Louisville", "Cincinnati");
  add("Kentucky", "Tennessee");
  add("Tennessee", "Vanderbilt");
  add("Cincinnati", "Miami-Ohio");
  add("Cincinnati", "West Virginia");
  add("Central Florida(UCF)", "South Florida");

  // Pac-12 / Mountain West
  add("Fresno State", "San Jose State");
  add("Fresno State", "San Diego State");
  add("San Jose State", "San Diego State");
  add("Nevada", "UNLV");
  add("New Mexico", "New Mexico State");
  add("UTEP", "New Mexico State");
  add("UTEP", "UTSA");
  add("Texas State", "UTSA");
  add("Wyoming", "Colorado State");
  add("Air Force", "Colorado State");
  add("Air Force", "Wyoming");

  // Sun Belt
  add("Troy", "South Alabama");
  add("Southern Miss", "Louisiana Tech");
  add("Louisiana-Lafayette", "LouisianaMonroe(ULM)");
  add("Louisiana-Lafayette", "Louisiana Tech");
  add("Marshall", "Ohio");
  add("Ohio", "Miami-Ohio");
  add("Bowling Green", "Toledo");
  add("Western Michigan", "Central Michigan");
  add("Western Michigan", "Eastern Michigan");
  add("Kent State", "Akron");
  add("Appalachian State", "Georgia Southern");
  add("Georgia State", "Georgia Southern");
  add("Georgia State", "Appalachian State");
  add("Coastal Carolina", "Appalachian State");
  add("Coastal Carolina", "Georgia Southern");
  add("Coastal Carolina", "Georgia State");
  add("Georgia State", "Appalachian State");
  add("James Madison", "Appalachian State");
  add("Coastal Carolina", "Appalachian State");
  add("Coastal Carolina", "Georgia Southern");
  add("Coastal Carolina", "Georgia State");
  add("Georgia State", "Appalachian State");

  // FCS / Other
  add("Harvard", "Yale");
  add("North Dakota State", "South Dakota State");
  add("Montana", "Montana State");
  add("Grambling", "Southern");

  // Convert Set back to array of arrays
  return Array.from(pairs).map(k => k.split("|"));
});