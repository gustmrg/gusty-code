# Tracking upstream

Gusty Code is a fork of [T3 Code](https://github.com/pingdotgg/t3code) and follows its stable releases.

- `main` is the latest T3 Code stable release plus this fork's changes. Changes land through pull requests.
- New T3 Code stables are merged in through `sync/vX.Y.Z` branches.
- A fix from a T3 Code nightly can be brought in early as a backport.

[AGENTS.md](../../AGENTS.md#branches) has the full workflow.

# Data directory

Gusty Code keeps its data in `~/.gusty`, not T3 Code's `~/.t3`, so the two never migrate each other's database. `T3CODE_HOME` still overrides it. To bring T3 Code's threads and settings over, copy `~/.t3` to `~/.gusty` once while both apps are closed.
