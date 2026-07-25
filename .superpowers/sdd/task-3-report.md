# Task 3 browser acceptance report

## Browser verification

- Route: brand entry -> world door -> 内耗 emotion door -> 风铃入口 expression scene.
- Desktop (1280x720): `stage: "expression"`; HTML scroll `[720, 720]`; body scroll `[720, 720]`; paper rect `{ left: 133.65, top: 105.00, right: 1146.35, bottom: 643.08 }`; paper and expression-scene background images were both non-empty.
- Narrow (390x844), before fix: horizontal overflow `0`, but the non-active foyer remained `display: block` and consumed 720px of document flow. The expression paper began at `top: 791.32px` and the active scene clipped its content (`overflow: hidden`), making the form unreadable/unreachable.
- Narrow (390x844), after fix: `stage: "expression"`; horizontal overflow `0`; foyer display `none`; paper rect `{ left: 8.61, top: 71.32, right: 366.06, bottom: 796.68 }`, fully visible; all form text controls visible; `#paper-boat-sequence` and `#generation-card` hidden. Screenshot review found no text covered by the paper pseudo-elements.

## Fix

- Added an expression-stage, max-width-820px rule that hides the inactive foyer only while the expression scene is active.
- Commit: `03a41fc` (`fix: keep expression scene visible on narrow screens`).

## Required commands

| Command | Result |
| --- | --- |
| `npm.cmd test` | Pass: stages 3 through 17 all passed. |
| `node --check src/app.js` | Pass. |
| `git diff --check` | Pass (exit 0); emitted only existing CRLF conversion warnings for dirty workspace files. |

## Concerns

- The workspace contained substantial pre-existing unstaged and untracked work. The commit contains only the four-line CSS fix; this report is intentionally uncommitted.

## Follow-up breakpoint review

- Correction: moved `body[data-stage="expression"] .scene--foyer { display: none; }` outside the `max-width: 820px` media query, preserving the foyer in every non-expression stage.
- For expression at widths `390x844`, `820x720`, `821x720`, `900x720`, `901x720`, and `1280x720`, `stage` was `expression`, the paper was fully visible, and both HTML/body scroll heights exactly equaled their client heights: `[844, 844]`, `[720, 720]`, `[720, 720]`, `[720, 720]`, `[720, 720]`, `[720, 720]`.
- At widths through 900px, the expression-only footer suppression and `#live-status { top: 0; }` remove the mobile-flow overflow without changing other stages. At 901px and 1280px the footer remains visible.
- Browser screenshot review at 390px confirmed readable, uncovered form text.
- Required checks rerun: `npm.cmd test` passed stages 3-17; `node --check src/app.js` passed; `git diff --check` passed (only existing CRLF warnings).
- Commit: `4841f2b` (`fix: preserve expression viewport across breakpoints`).
