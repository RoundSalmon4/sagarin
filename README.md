# Sagarin ratings explorer

Turns Jeff Sagarin's college football ratings page (cfsend.htm) into something you can
actually click around: sortable columns, conference rankings, and a head to head tool.

Intended live site once Pages is switched on for `main` / root:
https://roundsalmon4.github.io/sagarin/

## Features

- **Teams tab** - every rated team in one table. Click any column header to sort, search
  by team or conference, and filter to a single conference.
- **Conferences tab** - the conference ranking table with a toggle to rank by the overall
  **RATING** or by **WIN50%**. Either way the whole table stays sortable.
- **Predictions tab** - Sagarin's Predictions_with_Totals_and_Moneylines, including the
  regular block, the experimental home/away block and the eigenvector block. Sortable and
  searchable.
- **Schedule Predictor tab** - pick a team and project every remaining game (winner,
  margin, win chance) with the rating method you choose, plus a projected final record.
  Schedules come from a prefetched ESPN file, so the browser never calls ESPN directly.
- **Playoff Predictor tab** - a projected CFP field built from the ratings. Conference
  champions come from real conference standings built from the ESPN results file. Draws
  either the current 12-team bracket or the proposed 24-team bracket, seeds only by
  default with an option to show predicted results, plus a Monte Carlo run for
  championship odds.
- **Matchup tab** - choose a home team and an away team and a rating method. Shows who is
  favored and by how many points on a neutral field, with either team at home.
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

Timing note: the live file returned `Last-Modified: Sun, 18 Oct 2026 14:21:24 GMT` (and a
matching Apache ETag), and Sagarin has posted on Sundays for years. The Action runs at
17:00 UTC on Sunday to sit after that.

The page loads both data files and polls them every ten minutes. When a signature changes
it rebuilds in place, so a tab left open picks up new numbers on its own. There is also a
"Check for updates" button.

## Layout

```
index.html                the page
assets/parser.js          shared Sagarin parser, works in node and the browser
assets/team-alias.js      Sagarin to ESPN team name aliases, shared with the scripts
assets/core.js            state, theme, table engine, teams/conferences/matchup
assets/predictions.js     Predictions_with_Totals_and_Moneylines views
assets/schedule.js        schedule predictor, reads the ESPN data file
assets/playoff.js         CFP field, 12/24 brackets, simulation
assets/styles.css         styling, light and dark themes
data/ratings.json         parsed Sagarin snapshot
data/espn-games.json      prefetched ESPN teams and games
scripts/fetch-sagarin.js  fetch + parse cfsend.htm
scripts/fetch-espn.js     fetch ESPN teams + schedules
.github/workflows/        Sunday refresh
```

## Running locally

The page fetches the two data files, so open it through a local server rather than the
file system:

```
python -m http.server 8000
```

Then visit http://localhost:8000/

To refresh the data by hand:

```
node scripts/fetch-sagarin.js
node scripts/fetch-espn.js
```

`fetch-sagarin.js` takes `--source URL` and `--out PATH`; `fetch-espn.js` takes `--out`
and `--concurrency`.

## Notes

- The home edge used for the matchup view is read straight off the source page. Sagarin
  prints a separate edge for each rating column and the site uses the matching one.
- Win percentages are an estimate from a normal model with a standard deviation of 15.5
  points. The point spread is the part that comes from the source.
- ESPN schedules are prefetched by the Action into `data/espn-games.json`; the browser
  never calls ESPN. Sagarin names are matched to ESPN teams with `assets/team-alias.js`;
  265 of the 266 rated teams have a schedule (UTRGV is not in ESPN's list).
- Playoff conference champions come from real conference records in the ESPN results
  (tiebreak: overall record, then rating). Seeding follows the CFP fact sheet for 12 teams
  and the ESPN-reported plan for 24 teams. This is a ratings model, not the committee.
- This is an unaffiliated viewer. Ratings are Jeff Sagarin's.
