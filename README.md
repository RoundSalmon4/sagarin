# CFS Explorer

Turns Jeff Sagarin's college football ratings page (cfsend.htm) into something you can
actually click around: sortable tables, conference rankings, a record predictor (team or
conference), a TV watch list, a CFP field builder, and a head to head tool.

Live at https://www.roundsalmon4.com/sagarin/ (the github.io URL redirects there).

## Features

- **Teams tab** - every rated team in one table. Click any column header to sort, search
  by team or conference, and filter by conference, division (FBS/FCS) or group
  (Power 4, Group of 6, FBS independents). Each team shows its logo and its AP Top 25
  rank, if it is ranked.
- **Conferences tab** - the conference ranking table with a toggle to rank by the overall
  **RATING** or by **WIN50%** and a filter for FBS or FCS conferences. Either way the whole
  table stays sortable.
- **Predictions tab** - Sagarin's Predictions_with_Totals_and_Moneylines, including the
  regular block, the experimental home/away block and the eigenvector block. Sortable and
  searchable, with conference and group filters that match either side of a game.
- **Record Predictor tab** - pick a team to project every remaining game (winner,
  margin, win chance) with the rating method you choose, plus a projected final record.
  Switch to the Conference view to see every team in a conference with current, projected
  conference and projected overall records, including the projected conference title game
  (played at a neutral site where the league does it there, otherwise at the higher seed
  and folded into records), with the projected champion and runner-up marked. Schedules
  come from a prefetched ESPN file, so the browser never calls ESPN directly.
- **TV Schedule tab** - the upcoming week's games with kickoff time, TV listing and site, defaulting
  to games involving an AP Top 25 team. Switch the scope to all games, a single conference or
  a team search, narrow by group (Power 4, Group of 6, independents), pick a time zone, and
  sort by kickoff or by watchability. A "Games to watch" board ranks the best matchups on
  projected closeness (market line when posted, otherwise the Sagarin margin), combined team
  rating, what the game could do to the projected playoff field, and a curated rivalry list,
  then labels each game from Background through Must watch. The board is split into the four
  usual kickoff windows (early afternoon, afternoon, evening, late night, judged in Eastern
  time), showing the best few per window so the picks are not all in one slot. The picks are
  the same either way, but with the sort set to kickoff they are listed in kickoff order
  rather than by watch score.
- **Playoff Predictor tab** - a projected CFP field built from the ratings. Conference
  champions come from projected final conference records (real results for games played,
  predicted winners for the rest); in the 12-team field the top two play a projected title
  game (neutral where the league plays it there, otherwise at the higher seed) and the
  result is folded into those two teams' records. The proposed 24-team field drops title
  games and uses the regular-season champion. Champions and seeding go on the rating alone;
  the at-large spots (seven in the 12-team field, 19 in the 24-team) are a resume call,
  ranked on the rating minus five points per projected loss so a one-loss team is not passed
  by a stronger team carrying more losses. Draws either the 12-team or the 24-team bracket,
  seeds only by default with an option to show predicted results, and lists the projected
  conference championship matchups under the field (with the winner and win odds in the
  predicted-results view). A full-season Monte Carlo plays out the remaining games and the
  projected title games 10,000 times, rebuilds the field from the simulated results, then
  runs the bracket, and reports each team's chance to make the field and to win it (top 14
  shown, with the count stated).
- **Head to Head tab** - choose an away team and a home team and a rating method. The page
  runs top to bottom as the rating method and team picks, the projection, the comparison
  and the standings. The projection gives the pick and the win chances with the home team
  at home and on a neutral field. The comparison table shows the record, the conference and
  all five ratings for both teams, with the rating method in use highlighted. Then the last
  five results plus the next game for each team, each with the opponent's logo, and a
  conference snapshot. The snapshot shows the overall and conference records and the
  selected team with the teams around it; the ellipsis opens the full conference, and
  independents show as a one-team list with a 0-0 conference record. A short note at the
  foot of the page explains the method, the home edge and where the numbers come from.
  Swap flips the two teams.
- Every table sorts on any column (click a header to toggle direction).
- Team and conference logos throughout the tables and the playoff bracket, hosted in the
  repo so the browser never hits a logo CDN.
- Light and dark themes, remembered per browser.

## How the data updates

cfsend.htm is served over plain http and does not allow cross origin requests, so a
browser cannot fetch it directly from an https site. Instead a scheduled GitHub Action
(`.github/workflows/update-data.yml`) runs `scripts/fetch-sagarin.js` on a Sunday cron, a
few hours after Sagarin posts the new week, with a Monday run as a safety net. The script
pulls the page, parses it with the same parser the site uses, and commits
`data/ratings.json`. It only changes the file when the parsed ratings actually differ, so
a run with nothing new produces no commit.

The same Action runs `scripts/fetch-espn.js`, which pulls the ESPN team list and every FBS
team's schedule and writes `data/espn-games.json`. The site reads that file for the
schedule predictor and for conference standings, so no user browser ever has to call ESPN
(which is what caused the earlier "Failed to fetch"). Like the ratings file, it keeps its
`fetched_at` unless the games actually changed.

The same Action also runs `scripts/fetch-logos.js`, which downloads each team's logo from
the ESPN CDN into `assets/logos/` and each conference's logo into `assets/conf-logos/` (a
light and a dark version of each), then writes a small `data/logos.json` manifest. Logos
rarely change, so the script only downloads the ones it does not already have.

Finally the Action runs `scripts/fetch-tv.js`, which pulls the upcoming week (plus a buffer
week) of the ESPN scoreboard (FBS and FCS) into `data/tv-games.json` for the TV Schedule
tab: kickoff time, TV listing and the betting line for each game.

## Ratings history

Each week's parsed snapshot is also saved to `data/history/<season>/week-<n>.json` by
`scripts/archive-ratings.js`, which the Sunday refresh runs right after the fetch. Each file
holds the meta line, the home edge and a trimmed team table (rating, predictor, golden mean,
recent, strong recent, W-L, conference), which is enough to chart movement over a season
without keeping the full file every week. Re-running it is a no-op when the week is already
saved, so the Monday safety run leaves the tree clean.

Weeks that were never archived live can be recovered from the Wayback Machine with
`scripts/fetch-sagarin-history.js`. It lists the captures of cfsend.htm for a season, parses
the ones it understands and writes the same weekly files (skipping any already present). Run
it from the "Backfill ratings history" Action, or by hand:

```
node scripts/fetch-sagarin-history.js --season 2026
node scripts/fetch-sagarin-history.js --season 2026 --dry-run
```

The parser targets the current cfsend.htm layout. Wayback captures that use that same
layout parse cleanly; seasons with an older column layout come back as zero teams and are
skipped (the backfill logs each one) until they get their own parser.

The AP Top 25 is a separate, more frequent thing. `scripts/fetch-ap.js` reads ESPN's
rankings endpoint and writes `data/ap-poll.json`, and it runs from its own Action
(`.github/workflows/update-ap.yml`). The AP poll is released Sunday afternoons at 2 p.m.
Eastern during the season (the preseason and final polls are the exceptions), so that
Action runs Sunday at 20:00 UTC, which covers both EDT and EST, with a Monday safety run.

Timing note: the live file returned `Last-Modified: Sun, 18 Oct 2026 14:21:24 GMT` (and a
matching Apache ETag), and Sagarin has posted on Sundays for years. The Action runs at
17:00 UTC on Sunday to sit after that.

The page loads the data files and polls them every ten minutes. When a signature changes
it rebuilds in place, so a tab left open picks up new numbers on its own. There is also a
"Check for updates" button.

## Sources and attribution

This is an unaffiliated, unofficial viewer. Everything on the page traces back to one of
these sources:

- **Jeff Sagarin's college football ratings** - sagarin.com/sports/cfsend.htm. The ratings,
  the win/loss records and the printed home edge all come from that page. The ratings are
  Jeff Sagarin's work, shown here for personal, non-commercial reading.
- **The ESPN API** (site.web.api.espn.com) - team and game schedules, the scoreboard
  (kickoff time, TV listing, betting line, venue) and the rankings endpoint. ESPN's data
  belongs to ESPN. It is prefetched by the Action, so a visitor's browser never calls ESPN.
- **The Associated Press Top 25** - read from ESPN's rankings endpoint. The poll itself is
  the Associated Press's.
- **The ESPN logo CDN** (a.espncdn.com) - team and conference logos. Those marks belong to
  the schools and conferences and are used here only to identify the teams.
- **The Internet Archive Wayback Machine** - used to backfill older weekly snapshots.

None of this is a redistribution of Sagarin, ESPN or AP content for its own sake; it is a
reading tool over numbers that are already public. The team-name aliases and the rivalry
list are hand-built for this project. If you own any of the material above and want a
change, open an issue.

## Layout

```
index.html                the page
assets/parser.js          shared Sagarin parser, works in node and the browser
assets/team-alias.js      Sagarin to ESPN team name aliases, shared with the scripts
assets/rivalries.js       curated rivalry pairs for the games-to-watch score
assets/core.js            state, theme, table engine, teams/conferences/matchup
assets/predictions.js     Predictions_with_Totals_and_Moneylines views
assets/schedule.js        schedule predictor, reads the ESPN data file
assets/tv.js              TV schedule and games-to-watch ranking
assets/playoff.js         CFP field, 12/24 brackets, simulation
assets/styles.css         styling, light and dark themes
assets/logos/             team logos downloaded from the ESPN CDN
assets/conf-logos/        conference logos downloaded from the ESPN CDN
data/ratings.json         parsed Sagarin snapshot
data/espn-games.json      prefetched ESPN teams and games
data/logos.json           manifest of which logos are on file
data/ap-poll.json         AP Top 25 snapshot
data/tv-games.json        upcoming games with TV and lines
data/history/             weekly archived snapshots, one file per season week
scripts/fetch-sagarin.js  fetch + parse cfsend.htm
scripts/fetch-espn.js     fetch ESPN teams + schedules
scripts/fetch-logos.js    download team logos
scripts/fetch-ap.js       fetch the AP Top 25
scripts/fetch-tv.js       fetch the upcoming TV schedule
scripts/archive-ratings.js    save the current week into data/history
scripts/fetch-sagarin-history.js  backfill weeks from the Wayback Machine
scripts/history-util.js   shared shape for the archived weeks
.github/workflows/        Sunday refresh, AP poll refresh, manual history backfill
```

## Running locally

The page fetches its data files, so open it through a local server rather than the file
system:

```
python -m http.server 8000
```

Then visit http://localhost:8000/

To refresh the data by hand:

```
node scripts/fetch-sagarin.js
node scripts/fetch-espn.js
node scripts/fetch-logos.js
node scripts/fetch-ap.js
node scripts/fetch-tv.js
node scripts/archive-ratings.js
```

`fetch-sagarin.js` takes `--source URL` and `--out PATH`; `fetch-espn.js` takes `--out`
and `--concurrency`; `fetch-logos.js` takes `--force` and `--concurrency`; `fetch-ap.js`
takes `--out`; `fetch-tv.js` takes `--out` and `--weeks`; `archive-ratings.js` takes
`--ratings`; `fetch-sagarin-history.js` takes `--season` and `--dry-run`.

## Notes

- The home edge used for the matchup view is read straight off the source page. Sagarin
  prints a separate edge for each rating column and the site uses the matching one.
- Win percentages are an estimate from a normal model with a standard deviation of 15.5
  points. The point spread is the part that comes from the source.
- ESPN schedules are prefetched by the Action into `data/espn-games.json`; the browser
  never calls ESPN. Sagarin names are matched to ESPN teams with `assets/team-alias.js`;
  265 of the 266 rated teams have a schedule (UTRGV is not in ESPN's list).
- Logos come from the ESPN CDN and are committed under `assets/logos/`; the AP Top 25
  comes from ESPN's rankings endpoint. Both are refreshed by the Actions, not the browser.
- Playoff conference champions come from projected final conference records (real results
  for games played, predicted winners for the rest; tiebreak: overall record, then rating).
  Seeding follows the CFP fact sheet for 12 teams and the ESPN-reported plan for 24 teams.
  This is a ratings model, not the committee.
- This is an unaffiliated viewer. Ratings are Jeff Sagarin's.
