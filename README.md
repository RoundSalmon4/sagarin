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
- **Matchup tab** - pick two teams and a rating method. Shows who is favored and by how
  many points on a neutral field, with either team at home.

## How the data updates

cfsend.htm is served over plain http and does not allow cross origin requests, so a
browser cannot fetch it directly from an https site. Instead a scheduled GitHub Action
(`.github/workflows/update-data.yml`) runs `scripts/fetch-sagarin.js` on a daily cron. The
script pulls the page, parses it with the same parser the site uses, and commits
`data/ratings.json`. It only changes the file when the parsed ratings actually differ, so
quiet days produce no commit.

The page loads `data/ratings.json` and polls it every ten minutes. When the signature on
the file changes it rebuilds the tables in place, so a tab left open picks up new numbers
on its own. There is also a "Check for updates" button.

## Layout

```
index.html              the page
assets/parser.js        shared parser, works in node and the browser
assets/app.js           sorting, tabs, matchup math
assets/styles.css       styling
data/ratings.json       parsed snapshot, rebuilt by the Action
scripts/fetch-sagarin.js  fetch + parse + write
.github/workflows/      daily refresh
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
- This is an unaffiliated viewer. Ratings are Jeff Sagarin's.
