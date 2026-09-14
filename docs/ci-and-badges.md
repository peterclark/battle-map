# CI and status badges

## Workflows

| Workflow | File | Trigger | What it does |
| --- | --- | --- | --- |
| **CI** | `.github/workflows/ci.yml` | push to `main`, every PR, manual | Lint, tests with coverage, production build. Writes a coverage table to the run summary and uploads `coverage/` as an artifact. |
| **Badges** | `.github/workflows/badges.yml` | after CI completes on `main` | Publishes shields.io endpoint JSON to the orphan `badges` branch. |

Both run on the Node version in `.nvmrc`. Neither needs a secret beyond the
built-in `GITHUB_TOKEN`: there is no third-party coverage service in the loop.

## How the badges work

After CI finishes on `main`, the Badges workflow:

1. Downloads the `coverage` artifact **from the CI run that triggered it** —
   not from the latest run of anything, which is the usual way this goes wrong.
2. Runs `scripts/coverage-badge.mjs`, turning `coverage-summary.json` into
   [shields.io endpoint JSON](https://shields.io/badges/endpoint-badge) with a
   colour picked from the line percentage.
3. Writes `build.json` from that run's conclusion.
4. Commits both to the orphan `badges` branch — badge data only, no project
   history, so it stays a couple of kilobytes forever.

shields.io then renders each badge by reading the raw URL of those files.

The CI badge is GitHub's own workflow SVG and needs none of this; the
`build.json` written alongside the coverage badge is a spare that keeps both
badges in step and keeps the private-repository fallback one setting away.

To regenerate the coverage badge locally:

```bash
npm run test:coverage
node scripts/coverage-badge.mjs   # writes badges/coverage.json
```

**The first run has to happen before the badge resolves.** Until the Badges
workflow has run once on `main`, the `badges` branch does not exist and the
shields.io endpoint URL returns 404, which renders as a grey "invalid" badge.
Merge to `main`, let CI finish, and it appears.

## What the coverage number is *of*

This is the part worth reading before quoting the number anywhere.

| Scope | Lines |
| --- | --- |
| `src/**/*.js`, excluding the creature rigs — **what the badge shows** | **71.7%** |
| Every file under `src/`, components and rigs included | ~10% |

The gap is not neglect, and it is not a thumb on the scale either. Roughly two
thirds of this codebase draws rather than decides: fourteen Three.js creature
rigs, a canvas battlefield, a WebGL figure layer, and the React screens. Those
are verified the way the README and the `army-animation` skill say they are —
rendered at true stand scale and looked at — because that is the only check
that catches the failures they actually have. The real bugs in that code have
been a Colossal at 1.13 contrast against the turf, a dorsal ridge buried inside
its own parent, wheels rendering as plain discs, and a tail hidden underneath a
wing. Not one of those would move a line-coverage number, and every one of them
was caught by a screenshot.

So the badge measures the part a unit test can actually hold: the rules engine
(`src/engagement.js`, `src/rules/`), the board geometry (`src/table/board.js`)
and the card layout maths (`src/art/card*.js`). 42 tests.

Two things keep this honest rather than convenient:

- **The exclusions are whole categories, not files.** `src/art/creatures/**`
  and "not `.jsx`" are rules someone can check. There is no list of awkward
  modules being quietly dropped, and no way to improve the number by adding
  one.
- **The scope travels with the number.** `badges/coverage-detail.json` carries
  a `scope` field, the README says it under the badge, and the CI run summary
  repeats it. A percentage with no denominator is unfalsifiable, and this one
  is quotable precisely because it says what it covers.

For the whole-repository figure at any time:

```bash
npx vitest run --coverage --coverage.include='src/**/*.{js,jsx}'
```

## Embedding the badges elsewhere

The badge URLs are plain images and work in any Markdown or HTML — a résumé
repository, a portfolio page, a profile README.

```markdown
[![CI](https://github.com/peterclark/battle-map/actions/workflows/ci.yml/badge.svg)](https://github.com/peterclark/battle-map/actions/workflows/ci.yml)
[![Coverage](https://img.shields.io/endpoint?url=https%3A%2F%2Fraw.githubusercontent.com%2Fpeterclark%2Fbattle-map%2Fbadges%2Fcoverage.json)](https://github.com/peterclark/battle-map/actions/workflows/ci.yml)
```

`?branch=main` can be appended to the CI badge URL to pin it to `main` rather
than to whichever branch pushed last.

## If this repository is ever made private

shields.io and GitHub's badge endpoint both fetch **anonymously**. On a private
repository `raw.githubusercontent.com` and the workflow badge SVG return 404 to
anyone who is not signed in as the owner, so every badge renders broken for
every reader — which is worse than having none, particularly on a résumé.

The fix is to publish the badge JSON to a public gist, which is not sensitive
even when the code is. Create a public gist with `coverage.json` and
`build.json`, add `GIST_ID` and `GIST_TOKEN` (a fine-grained PAT with **Gists:
read and write**) as repository secrets, and add a step to `badges.yml` that
PATCHes the gist with the same files. Point the shields endpoint at the gist's
raw URL instead of the branch's. `peterclark/pointing.page` documents this
route in full.
