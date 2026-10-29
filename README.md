# CFS Explorer - College Football Ratings

Turns Jeff Sagarin's college football ratings page (cfsend.htm) into something you can
actually click around: sortable tables, conference rankings, a record predictor (team or
conference), a TV watch list, a CFP field builder, a head to head tool, and a BCS-style
rating.

Live at https://www.roundsalmon4.com/sagarin/ (the github.io URL redirects there).

## Features

- **Teams tab** - every rated team in one table. Click any column header to sort, search
  by team or conference, and filter by conference, division (FBS/FCS) or group
  (Power 4, Group of 6, FBS independents). Each team shows its logo and its ranking, if it
  is ranked: AP until the CFP rankings start, then CFP. A BCS column carries the BCS-style
  score and rank once the CFP rankings are posted.
- **Conferences tab** - the conference ranking table with a toggle to rank by the overall
  **RATING** or by **WIN50%** and a filter for FBS or FCS conferences. Either way the whole
  table stays sortable.
- **Predictions tab** - Sagarin's Predictions_with_Totals_and_Moneylines, including the
  regular block, the experimental home/away block and the eigenvector block. Sortable and
  searchable, with conference and group filters that match either side of a game.
- **Record Predictor tab** - pick a team to project every remaining game (winner,
  margin, win chance) with the rating method you choose (Sagarin RATING, PREDICTOR,
  GOLDEN_MEAN, RECENT, STRONG_RECENT, or ESPN FPI), plus a projected final record.
  Switch to the Conference view to see every team in a conference with current, projected
  conference and projected overall records, including the projected conference title game
  (played at a neutral site where the league does it there, otherwise at the higher seed
  and folded into records), with the projected champion and runner-up marked. Schedules
  come from a prefetched ESPN file, so the browser never calls ESPN directly. When ESPN
  FPI is selected, teams are re-ranked by FPI score (highest to lowest) rather than
  trusting ESPN's published ranks, and FPI-specific resume weights are applied in the
  conference view. No predictor fallback is used; teams without FPI data show N/A.
- **TV Schedule tab** - the upcoming week's games with kickoff time, TV listing and site, defaulting
  to games involving a ranked team. Switch the scope to all games, a single conference or
  a team search, narrow by group (Power 4, Group of 6, independents), pick a time zone, and
  sort by kickoff or by watchability. A "Games to watch" board ranks the best matchups on
  projected closeness (market line when posted, otherwise the Sagarin margin), combined team
  rating, what the game could do to the projected playoff field, and a curated rivalry list,
  then labels each game from Background through Must watch. The board is split into five
  sections: **Non-Saturday games** (all Friday/Thursday/Wednesday/Tuesday/Monday/Sunday games
  combined), then the four usual Saturday kickoff windows (early afternoon, afternoon, evening,
  late night, judged in the selected time zone, local by default). Each section shows the
  best few games per window so the picks are not all in one slot. Games below a 35 watch
  score are not shown; each section shows at most 3 games.

  Watch score formula: **35% closeness** (market line when posted, otherwise Sagarin margin),
  **25% playoff stakes**, **15% team quality**, **10% rivalry**, **10% conference championship
  implications** (CCG game, division clincher, elimination game, or cross-division CCG matchup),
  and **5% division race** (same-division matchups with division title implications). Non-CCG,
  non-division games renormalize weights (divide by 0.85).
- **Playoff Predictor tab** - a projected CFP field built from the ratings. Conference
  champions come from projected final conference records (real results for games played,
  predicted winners for the rest); in the 12-team field the top two play a projected title
  game (neutral where the league plays it there, otherwise at the higher seed) and the
  result is folded into those two teams' records. The 12-team field follows the 2026 rules:
  the ACC, Big 12, Big Ten and SEC champions, the highest Group of 6 team, Notre Dame when it
  ranks in the top 12, and the best remaining resumes to fill 12, seeded 1-12 on the resume
  score (top four get byes, seeds 5-8 host the first round). The 24-team field drops title
  games and takes the four Power 4 regular-season champions, the highest Group of 6 team and
  19 at-large, seeded 1-24 on the resume score (seeds 1-8 get byes, seeds 9-16 host the first
  round). The G6 spot, the at-large spots and the seeds are all a resume call: the rating
  minus five points per projected loss, plus a schedule bonus so a weak schedule cannot hide
  behind a record, plus a bonus for winning the conference. The schedule weight and the
  champion bonus are fit to the committee's own picks (see below).
  Draws either the 12-team or the 24-team bracket,
  seeds only by default with an option to show predicted results, and lists the projected
  conference championship matchups under the field (with the winner and win odds in the
  predicted-results view). A full-season Monte Carlo plays out the remaining games and the
  projected title games 10,000 times, rebuilds the field from the simulated results, then
  runs the bracket, and reports each team's chance to make the field and to win it (top 14
  shown, with the count stated).

  **Simulation data is shared with the Sim Deep Dive tab**: running a simulation in either
  tab makes the results available in the other tab for the same format (12-team or 24-team).
  Running the simulation in either tab stores the run in a shared per-format object, so you
  never need to re-run the same format on the other tab.

- **Sim Deep Dive tab** - analyze the Monte Carlo simulation results with filters. Each filter
  row represents an AND condition; rows combine with AND/OR logic. Filters include team,
  conference champion, overall/conf record, in field, champion, and the new division/CCG
  race parameters. Results are grouped by unique outcome and sorted by frequency. Team names
  in outcome cards link to a distribution modal showing seed distribution, round reached,
  and bid type distributions across all runs. Clicking a seed/round/bid in the modal applies
  that filter to the main view.

- **Head to Head tab** - choose an away team and a home team and a rating method (Sagarin
  RATING, PREDICTOR, GOLDEN_MEAN, RECENT, STRONG_RECENT, or ESPN FPI). The page puts the
  projection and the comparison in a left column and the polls in a right column, with the
  last five and the standings under the comparison on the left. The projection gives the pick
  and the win chances with the home team at home and on a neutral field. The comparison
  table puts the two teams side by side and shows the record, the conference, the chosen
  rating with its national rank, the BCS-style score with its rank, SCHEDL with its rank,
  total offense (yards per game), total defense (yards allowed per game) and points per
  game, the last three also with national ranks. The right column shows the AP poll and the
  Coaches Poll in the same table style as the standings, with the AP table switching to the
  CFP rankings once the committee posts them. Then a last five panel for each team, with the
  opponent's logo and the next game, and a conference snapshot. The snapshot shows the
  overall and conference records and the selected team with the teams around it; the
  ellipsis opens the full conference, and independents show as a one-team list with a 0-0
  conference record. A short note at the foot of the page explains the method, the home edge
  and where the numbers come from. Swap flips the two teams. When ESPN FPI is selected,
  the comparison table shows each team's FPI rank (derived from re-ranked FPI scores).
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

The same Action runs `scripts/fetch-espn.js`, which pulls the ESPN team list, every FBS
team's schedule and the season statistics for each rated team (total offense and defense,
points per game), and writes `data/espn-games.json`. The site reads that file for the
schedule predictor, the conference standings and the head to head numbers, so no user
browser ever has to call ESPN (which is what caused the earlier "Failed to fetch"). Like
the ratings file, it keeps its `fetched_at` unless the games or the stats actually changed.

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

The parser handles the current cfsend.htm layout and the older one Sagarin used from about
2015 through 2023, which prints three rating columns instead of four and drops the trailing
level tag on the conference name. Seasons older than that still come back as zero teams and
are skipped (the backfill logs each one).

## Resume weights

The playoff predictor does not rank on the raw rating. It ranks on a resume score: the
rating, minus a penalty for each projected loss, plus a bonus for every point the schedule
sits above the FBS average, plus a bonus for winning the conference. The loss penalty is
held at five points and the other two weights are fitted. The penalty is not fitted. It
was set by hand before the schedule term existed and it stays at five because the selection
comes out best there: with the weight fitted the same way, five ties for the best top 25
pick of any penalty on the grid and ties for the best top 12 pick, while a penalty of seven
scores higher on rank correlation and picks fewer of the committee's teams.
`scripts/calibrate-resume.js` scores the resume order against the selection committee's
final top 25 for every archived season and keeps the schedule weight and the champion
bonus that fit best averaged over all of them, then writes `data/resume-weights.json`,
which the site reads at load.

The champion bonus is there because the committee counts a conference title as its own
criterion, and the resume score had no way to say so. Without it a non-Power conference
champion was discounted twice, once by the rating, which already knows the team beat
nobody of note, and again by the schedule term, and it landed below the field. The
committee's own non-Power picks, Boise State and James Madison, sat at ranks 14 and 17 in
the resume order without the bonus.

The inputs are committed so the fit reproduces without the network: `data/cfp-finals.json`
(each season's final top 25, from the CFP site's rankings API) and `data/sagarin-finals.json`
(the Sagarin snapshot around the conference championships, from the Wayback Machine).
Passing `--refresh` pulls both again first. With the loss penalty held at 5, over 2014-2025
the fit picks a 0.40 schedule weight and a 3.5 champion bonus, which lifts the average
rank correlation with the committee from 0.884 to 0.914. It also reports a leave-one-out
score, refitting the weights on every season but one and scoring the held-out season,
which is the honest read on a season the fit has not seen (currently 0.912 against 0.914
in-sample). Re-run it after a season ends so the weights track the committee. Run it from
the "Calibrate resume weights" Action (manual trigger), or by hand.

The fit optimizes the picks rather than the correlation. The rank correlation measures the
order of the committee's own top 25, so it cannot tell a good pick from a good order, and
a champion bonus lifts it for free, which is why fitting on it sends the schedule weight
the wrong way. The number that matters is how many of the committee's teams the resume
order takes: rank every team in the season by the resume score, take the top 25 and the
top 12, and count how many the committee picked. Over 2014-2025 that is 22.08 of the
committee's top 25 and 11 of the top 12, and the leave-one-out fit gives 22.08 and 10.83.
Read the selection counts, not the correlation, when you want to know how many of the
committee's teams the predictor would have taken.

### The committee's field

The CFP site publishes the committee's final ranking and this repo keeps it in
`data/cfp-finals.json`, but the committee's selection is not always the same list as its
published ranking. In 2025 the ranking had Notre Dame and BYU in the top 12 while the
field had Tulane and James Madison. The predictor builds a field, so the field is what it
should be judged against, and `data/cfp-fields.json` holds it: every season, with the
seed, the conference and how each team qualified.

`scripts/fetch-cfp-fields.js` pulls that from the Wikipedia bracket templates and the
season articles, checks it against the NCAA bracket and the CFP site's ranking, and writes
the file only when something changed. It fills in any season that is missing, so running
it after a season adds that season's field. The bid types come from the College Football
Playoff article's table of selections by year, which covers every season, and the file also
keeps the teams the committee recorded as conference champions, picked or not.

The calibration reports the field next to the ranking: 3.8 of the committee's four over the
ten four-team seasons, and 10.5 of 12 over the twelve-team seasons. It also prints where the
teams the committee took from outside the Power four land in the resume order, because that
is where the misses were, and which non-Power team the resume order leads with. Over 2024
and 2025 the committee took Boise State, Tulane and James Madison, and without the champion
bonus the resume order put all three outside its top 12, at ranks 14, 27 and 17. With it
Boise State and James Madison come back inside, and over the twelve seasons five of the
seven non-Power teams the committee took now sit in the resume top 12 against four before.

Telling a non-Power team from a Power one needs each team's conference, and it has to be
the conference the team was in that season rather than the one it is in now, because there
has been a lot of realignment. The page gives it for the seasons from 2018 on. The older
pages leave the conference out of the team row but group the teams by conference at the
end, so the parser reads the membership from there. The conference names carry the division
in some seasons ("SEC-WEST", "MWC-MOUNTAIN", "PAC-12(NORTH)"), so the parser maps them onto
the names the site uses.

The refresh adds the newest completed season and, when the CFP final ranking for the current
season is not posted yet, exits without touching the inputs:

```
node scripts/calibrate-resume.js
node scripts/calibrate-resume.js --refresh
```

The polls are a separate, more frequent thing. `scripts/fetch-ap.js` reads ESPN's rankings
endpoint for the AP Top 25 and the AFCA Coaches Poll, and the College Football Playoff site
for the committee rankings once they start. It writes `data/ap-poll.json` with all three.
The CFP poll drives the site from the moment it appears (the AP badge, column, sort and TV
scope all switch to CFP); before that the AP poll does. It runs from its own Action
(`.github/workflows/update-ap.yml`). The AP and Coaches polls come out Sunday afternoons at
2 p.m. Eastern during the season, so the Action runs Sunday at 19:00 UTC, which covers both
EDT and EST, with a Monday safety run. The CFP rankings start on Tuesday nights in November,
so a Wednesday morning run picks those up.

The same Action then runs `scripts/fetch-bcs.js`, which builds a BCS-style score for the
season into `data/bcs.json`. The old BCS averaged the Harris poll, the Coaches poll and six
computer rankings. Harris is gone, so the AP poll takes its place. Each poll becomes a 0-1
value (a team's points over the most it could get, 25 for every voter), each computer gives
25 points for a first place down to 1 for 25th, a team a computer leaves out scores nothing,
and the formula throws out each team's highest and lowest computer score and keeps the
middle four over 100.

The six computers are Sagarin, Colley, Billingsley, Anderson & Hester, Massey and Wolfe.
Sagarin, Colley, Billingsley, Anderson & Hester and Wolfe are read straight from their
pages (Wolfe moved to wolferatings.com). Massey sits behind Cloudflare, so that one page is
rendered through Firecrawl, which needs a `FIRECRAWL_API_KEY` secret on the repo. The score
only shows on the site once the CFP rankings are posted. Sagarin's part is his overall
RATING; the BCS used his Elo Chess column, which the page no longer prints. The score is
only a what-if, not an official ranking.

Timing note: the live file returned `Last-Modified: Sun, 18 Oct 2026 14:21:24 GMT` (and a
matching Apache ETag), and Sagarin has posted on Sundays for years. The Action runs at
09:00 UTC on Sunday to sit after that.

The page loads the data files and polls them every ten minutes. When a signature changes
it rebuilds in place, so a tab left open picks up new numbers on its own.

## Sources and attribution

This is an **unaffiliated, unofficial viewer**. Everything on the page traces back to one of
these sources:

- **Jeff Sagarin's college football ratings** - sagarin.com/sports/cfsend.htm. The ratings,
  the win/loss records and the printed home edge all come from that page. The ratings are
  Jeff Sagarin's work, shown here for personal, non-commercial reading.
- **The ESPN API** (site.web.api.espn.com) - team and game schedules, the scoreboard
  (kickoff time, TV listing, betting line, venue) and the rankings endpoint. ESPN's data
  belongs to ESPN. It is prefetched by the GitHub Action, so a visitor's browser never calls ESPN.
- **The Associated Press Top 25 and the AFCA Coaches Poll** - read from ESPN's rankings
  endpoint. The AP poll is the Associated Press's and the coaches poll is the AFCA's.
- **The College Football Playoff rankings** - read from the CFP site's rankings API. The
  committee rankings are the College Football Playoff's.
- **The College Football Playoff field** - the committee's actual selection, with the seed
  and how each team qualified, read from the Wikipedia bracket templates, the season
  articles and the College Football Playoff article's table of selections by year, and
  checked against the NCAA bracket. It is kept apart from the rankings because the two are
  not always the same list.
- **The playoff formats** - the 12-team rules follow NCAA.com's explanation of the 2026
  format, and the proposed 24-team plan follows ESPN's reporting. Those rules belong to their
  authors.
- **The BCS computer rankings** - Colley Matrix (colleyrankings.com), Billingsley
  (cfrc.com), Anderson & Hester (andersonsports.com), Massey (masseyratings.com) and Wolfe
  (wolferatings.com), each read for its current top 25 and used with Sagarin for the
  BCS-style score. Those rankings belong to their authors.
- **Firecrawl** (api.firecrawl.dev) - renders the Massey page, which sits behind Cloudflare,
  so the fetch script can read it. Firecrawl is a separate third-party service.
- **The ESPN logo CDN** (a.espncdn.com) - team and conference logos. Those marks belong to
  the schools and conferences and are used here only to identify the teams.
- **The Internet Archive Wayback Machine** - used to backfill older weekly snapshots.

None of this is a redistribution of Sagarin, ESPN or AP content for its own sake; it is a
reading tool over numbers that are already public. The team-name aliases, the rivalry
list (updated with ~22 missing FBS rivalries including SEC, Big Ten, Big 12, Sun Belt,
and AAC matchups), and the division data (updated for 2026: Big Ten/ACC divisions removed,
SEC/MAC/Mountain West/Sun Belt active) are hand-built for this project. If you own any of
the material above and want a change, open an issue.

## Layout

```
index.html                the page
assets/parser.js          shared Sagarin parser, works in node and the browser
assets/team-alias.js      Sagarin to ESPN team name aliases, shared with the scripts
assets/rivalries.js       curated rivalry pairs for the games-to-watch score
assets/divisions.js       FBS team division assignments (2026: SEC/MAC/MW/Sun Belt)
assets/core.js            state, theme, table engine, teams/conferences/matchup
assets/predictions.js     Predictions_with_Totals_and_Moneylines views
assets/schedule.js        schedule predictor, reads the ESPN data file
assets/tv.js              TV schedule and games-to-watch ranking
assets/playoff.js         CFP field, 12/24 brackets, simulation
assets/styles.css         styling, light and dark themes
assets/logos/             team logos downloaded from the ESPN CDN
assets/conf-logos/        conference logos downloaded from the ESPN CDN
data/ratings.json         parsed Sagarin snapshot
data/espn-games.json      prefetched ESPN teams, games and season stats
data/logos.json           manifest of which logos are on file
data/ap-poll.json         AP, Coaches and CFP poll snapshots
data/bcs.json             BCS-style score for the season
data/tv-games.json        upcoming games with TV and lines
data/cfp-finals.json      CFP final top 25 per season, for the resume fit
data/cfp-fields.json      the committee's actual field per season, with the bid types
data/sagarin-finals.json  paired Sagarin finals per season, with the conference, for the resume fit
data/resume-weights.json  fitted resume weights read by the playoff predictor
data/history/             weekly archived snapshots, one file per season week
scripts/fetch-sagarin.js  fetch + parse cfsend.htm
scripts/fetch-espn.js     fetch ESPN teams + schedules
scripts/fetch-logos.js    download team logos
scripts/fetch-ap.js       fetch the AP, Coaches and CFP polls
scripts/fetch-bcs.js      build the BCS-style score from the polls and computers
scripts/fetch-tv.js       fetch the upcoming TV schedule
scripts/archive-ratings.js    save the current week into data/history
scripts/fetch-sagarin-history.js  backfill weeks from the Wayback Machine
scripts/history-util.js   shared shape for the archived weeks
scripts/calibrate-resume.js  fit the resume weights to the committee's picks
scripts/fetch-cfp-fields.js  pull the committee's field for every season
.github/workflows/        Sunday refresh, poll refresh, manual backfill, manual calibration
```

## Running locally

The page fetches its data files, so open it through a local server rather than the file
system:

```
python -m http.server 8000
```

Then visit http://localhost:8000/

## Debug tools

The site exposes console commands for debugging when URL parameters are set:

### `?debug=playoff`
Logs the playoff projection details: format, method, CFP availability, conference champions, field seeds with bid types, base records (completed games), projected records, and CFP ranks.

### Simulation queries
Simulation runs are kept in memory on every run, so no URL parameter is needed. After clicking "Run simulation" on the Playoff Predictor tab, or running the Sim Deep Dive (both share the same run for a format), query them from the console:

```js
// All runs where a team made the field
SG.debug.simQuery({ teamInField: "Team Name" })

// Runs where multiple specific teams all made the field
SG.debug.simQuery({ fieldHas: [{team: "Team A"}, {team: "Team B"}] })

// Runs where a team won the championship
SG.debug.simQuery({ champion: "Team Name" })

// Runs where a team had a specific record
SG.debug.simQuery({ teamRecord: { team: "Team Name", ow: 11, ol: 1, cw: 7, cl: 1 } })

// Runs where specific teams won specific conference championships
SG.debug.simQuery({ confChamps: [{team: "Team A", conf: "CONFERENCE A"}, {team: "Team B", conf: "CONFERENCE B"}] })
```

Each query returns an array of run objects with:
- `run`: run index (0-9999)
- `field`: array of {seed, team, bid} for all 12 teams
- `champion`: champion team name
- `confChamps`: array of {conf, champ} for conference title games
- `records`: record object for each team in that run's field

**Important**: start a simulation on the Playoff Predictor or the Sim Deep Dive tab before the query commands will work.

To refresh the data by hand:

```
node scripts/fetch-sagarin.js
node scripts/fetch-espn.js
node scripts/fetch-logos.js
node scripts/fetch-ap.js
node scripts/fetch-bcs.js
node scripts/fetch-tv.js
node scripts/archive-ratings.js
node scripts/fetch-cfp-fields.js
node scripts/calibrate-resume.js
```

`fetch-sagarin.js` takes `--source URL` and `--out PATH`; `fetch-espn.js` takes `--out`
and `--concurrency`; `fetch-logos.js` takes `--force` and `--concurrency`; `fetch-ap.js`
takes `--out`; `fetch-tv.js` takes `--out` and `--weeks`; `archive-ratings.js` takes
`--ratings`; `fetch-sagarin-history.js` takes `--season` and `--dry-run`; `calibrate-resume.js`
takes `--penalty` and `--refresh`; `fetch-cfp-fields.js` takes `--season` and `--dry-run`.
`fetch-bcs.js` needs `FIRECRAWL_API_KEY` set for the Massey page.

## Notes

- The home edge used for the matchup view is read straight off the source page. Sagarin
  prints a separate edge for each rating column and the site uses the matching one.
- Win percentages are an estimate from a normal model with a standard deviation of 15.5
  points. The point spread is the part that comes from the source.
- ESPN schedules are prefetched by the Action into `data/espn-games.json`; the browser
  never calls ESPN. Sagarin names are matched to ESPN teams with `assets/team-alias.js`;
  265 of the 266 rated teams have a schedule (UTRGV is not in ESPN's list).
- The head to head offense, defense and points per game come from ESPN's per-team
  statistics endpoint and are stored in the same file. Total offense and total defense are
  yards per game, points per game is scoring, and each rank counts every rated team that
  has the number.
- Logos come from the ESPN CDN and are committed under `assets/logos/`; the AP and Coaches
  polls come from ESPN's rankings endpoint and the CFP rankings from the CFP site. All are
  refreshed by the Actions, not the browser.
- Playoff conference champions come from projected final conference records (real results
  for games played, predicted winners for the rest; tiebreak: conference record, then
  overall record, then rating).
  The 12-team field follows the NCAA's 2026 rules: the ACC, Big 12, Big Ten and SEC
  champions, the highest Group of 6 team, Notre Dame when it ranks in the top 12, and the
  best remaining resumes to fill 12, seeded 1-12 on the resume score (top four byes). The
  24-team field follows the ESPN-reported 2027 plan: 19 at-large, the four Power 4
  regular-season champions, and the highest Group of 6 team, seeded 1-24 on the resume score
  (seeds 1-8 byes, 9-16 host the first round). The resume score is the rating minus the
  five point per-loss penalty plus the fitted schedule weight and champion bonus
  (`data/resume-weights.json`, see Resume weights above). This is a ratings model, not the
  committee.
- This is an unaffiliated viewer. Ratings are Jeff Sagarin's.

## License

The code here is under the MIT License (see LICENSE). It covers the code only. The ratings,
polls, rankings, logos and other data belong to the sources above and keep their own terms.
