# Task 1 report: red regression coverage

## Outcome

Added the required regression assertions for `animatePageTurn(direction, frontPage, backPage)` in `tests/stage13-web-storybook.test.js`.

## RED verification

Command:

```powershell
node tests/stage13-web-storybook.test.js
```

Result: failed as expected (exit code 1).

Relevant output:

```text
AssertionError [ERR_ASSERTION]: The input did not match the regular expression /function\s+animatePageTurn\s*\(\s*direction\s*,\s*frontPage\s*,\s*backPage\s*\)/.
Input:
'function animatePageTurn(direction, oldPage, currentPageOverride = null) {'
```

The current implementation also derives the back face from `storybook-page--copy`, so the regression test correctly captures the missing explicit-face contract.

## Files changed

- `tests/stage13-web-storybook.test.js`
- `.superpowers/sdd/next-turn-task-1-report.md`

## Commit

`d00c791` — `test: cover next illustration page back`

Only `tests/stage13-web-storybook.test.js` was staged for this commit. The report and pre-existing unrelated working-tree changes remain uncommitted.
