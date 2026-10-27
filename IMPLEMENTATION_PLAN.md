IMPLEMENTATION PLAN

1. assets/tv.js - unreachable cross-division CCG logic (lines 223-235)
   - Move the else-if (!sameDiv) block out of the if (sameDiv) branch
     so different-division, same-conference games can trigger CCG implications.

2. assets/tv.js - impossible leader checks (lines 211, 255)
   - Replace "dStandings.leader === na && dStandings.leader === nb"
     with proper separate conditions (e.g., leader equals one team and
     the other is a contender, or both are top-2 with division implications).

3. assets/tv.js - redundant else-if chain (lines 180-190)
   - Remove the no-op else-if branches after the top-4 seed bonus
     (they repeat conditions without changing stakes).

4. assets/tv.js - unused divMap (line 196)
   - Either delete the declaration or replace direct window.TeamDivisions
     references with divMap where appropriate.

5. README.md - formula discrepancy (lines 43-46)
   - Update description to match index.html / tv.js:
     35% closeness, 25% stakes, 15% quality, 10% rivalry,
     10% CCG implications, 5% division race,
     renormalize by 0.85 for games without CCG/division implications.

VERIFICATION BEFORE COMMIT:
- Open index.html and confirm legend text matches tv.js weights.
- Run a local server (python -m http.server 8000) and check the watch-score
  values in the browser console for a sample game.
- Confirm the README reads consistently with the code.
