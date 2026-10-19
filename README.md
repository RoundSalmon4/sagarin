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
- **Schedule Predictor tab** - pick a team, pull its schedule from the ESPN API, and
  project every remaining game (winner, margin, win chance) with the rating method you
  choose, plus a projected final record.
- **Playoff Predictor tab** - a projected CFP field built from the ratings, drawn as
  either the current 12-team bracket or the proposed 24-team bracket, with a Monte Carlo
  run for championship odds.
- **Matchup tab** - pick two teams and a rating method. Shows who is favored and by how
  many points on a neutral field, with either team at home.
- Light and dark themes, remembered per browser.

## How the data updates

cfsend.htm is served over plain http and does not allow cross origin requests, so a
browser cannot fetch it directly from an https site. Instead a scheduled GitHub Action
(`.github/workflows/update-data.yml`) runs `scripts/fetch-sagarin.js` on a Sunday cron, a
few hours after Sagarin posts the new week, with a Monday run as a safety net. The script
pulls the page, parses it with the same parser the site uses, and commits
`data/ratings.json`. It only changes the file when the parsed ratings actually differ, so
a run with nothing new produces no commit.

Timing note: the live file returned `Last-Modified: Sun, 18 Oct 2026 14:21:24 GMT` (and a
matching Apache ETag), and Sagarin has posted on Sundays for years. The Action runs at
17:00 UTC on Sunday to sit after that.

The page loads `data/ratings.json` and polls it every ten minutes. When the signature on
the file changes it rebuilds the tables in place, so a tab left open picks up new numbers
on its own. There is also a "Check for updates" button.

## Layout

```
index.html                the page
assets/parser.js          shared parser, works in node and the browser
assets/core.js            state, theme, table engine, teams/conferences/matchup
assets/predictions.js     Predictions_with_Totals_and_Moneylines views
assets/schedule.js        ESPN schedule predictor
assets/playoff.js         CFP field, 12/24 brackets, simulation
assets/styles.css         styling, light and dark themes
data/ratings.json         parsed snapshot, rebuilt by the Action
scripts/fetch-sagarin.js  fetch + parse + write
.github/workflows/        Sunday refresh
```

## Running locally

The page fetches `data/ratings.json`, so open it through a local server rather than the
file system:

```
python -m http.server 8000
```

Then visit http://localhost:8000/

To refresh the snapshot by hand:

```
node scripts/fetch-sagarin.js
```

Optional flags: `--source URL` and `--out PATH`.

## Notes

- The home edge used for the matchup view is read straight off the source page. Sagarin
  prints a separate edge for each rating column and the site uses the matching one.
- Win percentages are an estimate from a normal model with a standard deviation of 15.5
  points. The point spread is the part that comes from the source.
- The Schedule Predictor reads schedules from `site.web.api.espn.com`, which allows cross
  origin requests, so the browser calls it directly. Sagarin names are matched to ESPN
  teams with a small alias table; a handful of FCS teams are not in ESPN's team list and
  show no schedule.
- Playoff projections assume each conference champion is its highest-rated team, since the
  site does not track conference standings. Seeding rules follow the CFP fact sheet for 12
  teams and the ESPN-reported plan for 24 teams. This is a ratings model, not the
  selection committee.
- This is an unaffiliated viewer. Ratings are Jeff Sagarin's.
