# Sagarin — project rules

Personal rules that apply to every project are in `~/.config/opencode/AGENTS.md`
and are mechanically enforced by the `rules` plugin. This file is only about
things specific to this repo.

- Never commit AGENTS.md to remote repo.
- No inferences. Do not base conclusions on assistants memory. Always verify any conclusion you make.
- Always revert accidental deletions or additions.
- Provide a summary of any commit and get final approval before committing
- Only implement what is explicitly requested. Do not add features, redesigns, or "improvements" beyond the scope of the prompt. If you see an opportunity for improvement, ask first.
- Always ask to proceed before commit and push to remote.
- Review all code changes for bugs before making a commit.
- Do not assume the user is at fault unless you can provide evidence for the claim, otherwise assume you have not fixed the issue.

## Repository

- Remote: `https://github.com/RoundSalmon4/sagarin`
- Canonical local working copy: `C:\Users\cwekselblatt\Downloads\OpenCode\sagarin`
- Always work in that local path. Do not clone, fork, or work in a copy.
- Before starting any task, re-sync the local copy with the remote and verify
  it is up to date.
- Push with the PAT, never a cached credential:

  ```powershell
  $pat = "<your PAT>"
  $b64 = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("x-access-token:$pat"))
  git -c http.extraHeader="Authorization: Basic $b64" push origin main
  ```

## Working tree

- Re-evaluate uncommitted changes before deciding what to do with them.
- Verify the working tree is clean and matches the remote before committing.

## Architecture

- **Static site**: `index.html` + `assets/*.js` + `assets/styles.css` + `assets/logos/` + `assets/conf-logos/`
- **Data files** in `data/`: committed JSON, updated by GitHub Actions on a schedule
- **No package.json** — uses native Node.js modules only (Node 20 in CI)
- **Shared parser** (`assets/parser.js`) works in both Node and browser
- **Team aliases** (`assets/team-alias.js`) map Sagarin names → ESPN names

## Running locally

```bash
python -m http.server 8000
# visit http://localhost:8000/
```

## Key data files (source of truth)

| File | Purpose | Updated by |
|------|---------|------------|
| `data/ratings.json` | Parsed Sagarin ratings | `fetch-sagarin.js` (Sun/Mon) |
| `data/espn-games.json` | ESPN teams, schedules, stats | `fetch-espn.js` (Sun/Mon, Wed-Fri) |
| `data/tv-games.json` | Upcoming games, TV, lines | `fetch-tv.js` (Sun/Mon, Wed-Fri) |
| `data/ap-poll.json` | AP, Coaches, CFP polls | `fetch-ap.js` (Sun/Mon, Wed) |
| `data/bcs.json` | BCS-style rating | `fetch-bcs.js` (after polls) |
| `data/logos.json` | Logo manifest | `fetch-logos.js` (Sun/Mon) |
| `data/resume-weights.json` | Fitted schedule weight + champ bonus | `calibrate-resume.js` (manual) |
| `data/cfp-fields.json` | Committee's actual field per season | `fetch-cfp-fields.js` (manual) |
| `data/cfp-finals.json` | CFP final top 25 per season | `calibrate-resume.js --refresh` |
| `data/sagarin-finals.json` | Paired Sagarin finals per season | `calibrate-resume.js --refresh` |
| `data/history/<season>/week-<n>.json` | Weekly archived snapshots | `archive-ratings.js` (after fetch) |

## GitHub Actions (`.github/workflows/`)

| Workflow | Schedule | Purpose |
|----------|----------|---------|
| `update-data.yml` | Sun 09:00 UTC, Mon 13:00 UTC | Fetch Sagarin, ESPN, logos, TV; archive week |
| `update-ap.yml` | Sun 19:00 UTC, Mon 13:00 UTC, Wed 03:00 UTC | Fetch polls, rebuild BCS rating |
| `midweek-scores.yml` | Wed-Fri 06:00 UTC | Fetch ESPN scores + TV for midweek games |
| `calibrate-resume.yml` | Manual | Refit resume weights after season ends |
| `backfill-ratings.yml` | Manual | Backfill past weeks from Wayback Machine |

All workflows: `runs-on: ubuntu-latest`, `node-version: "20"`, commit with `roundsalmon4` identity.

## Manual data refresh commands

```bash
# Full refresh (what the Sunday Action does)
node scripts/fetch-sagarin.js
node scripts/fetch-espn.js
node scripts/fetch-logos.js
node scripts/fetch-tv.js
node scripts/archive-ratings.js

# Polls + BCS
node scripts/fetch-ap.js
node scripts/fetch-bcs.js        # needs FIRECRAWL_API_KEY for Massey

# Resume weights (after season ends, once CFP final ranking + bracket set)
node scripts/fetch-cfp-fields.js
node scripts/calibrate-resume.js --refresh

# Backfill history
node scripts/fetch-sagarin-history.js --season 2026
node scripts/fetch-sagarin-history.js --season 2026 --dry-run
```

## Debug tools (browser console)

| URL param | Purpose |
|-----------|---------|
| `?debug=playoff` | Log playoff projection details |

Simulation queries (after running a simulation on Playoff Predictor or Sim Deep Dive tab):

```js
SG.debug.simQuery({ teamInField: "Team Name" })
SG.debug.simQuery({ fieldHas: [{team: "A"}, {team: "B"}] })
SG.debug.simQuery({ champion: "Team Name" })
SG.debug.simQuery({ teamRecord: { team: "Team Name", ow: 11, ol: 1, cw: 7, cl: 1 } })
SG.debug.simQuery({ confChamps: [{team: "A", conf: "CONF A"}, {team: "B", conf: "CONF B"}] })
```

## Important conventions

- **Scripts are idempotent**: they only write when data actually changes (check `fetched_at` or content hash)
- **Logo downloads are incremental**: `fetch-logos.js` only downloads missing logos
- **Sagarin page is HTTP**: cannot be fetched from browser (CORS), must be server-side
- **ESPN data is prefetched**: browser never calls ESPN directly
- **Home edge** read from source page per rating column
- **Loss penalty** fixed at 5 points; schedule weight + champ bonus fitted
- **265 of 266 rated teams** have ESPN schedules (UTRGV missing)

## Verification Discipline
- Never assume deployed code matches local code. Always verify by fetching the actual remote resources before concluding.

When debugging discrepancies:

Fetch the live JS/data files (curl https://.../assets/playoff.js)
Compare line-by-line with local version
Only then form hypotheses
Type coercion bugs are common in JavaScript. When comparing values from dataset attributes, URL params, or form inputs, always coerce explicitly: Number(), String(), Boolean() — never rely on === with implicit types.

- If the user says "it's still wrong" after a fix: The fix likely hasn't deployed yet, or the fix was incomplete. Re-verify the live code first. Do not explain why it "should" work — check why it doesn't.

- Own the verification gap. "I assumed X deployed" is not an acceptable substitute for "I fetched the live file and confirmed X."