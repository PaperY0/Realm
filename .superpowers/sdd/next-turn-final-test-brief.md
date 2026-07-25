### Final test hardening: verify caller-side illustration wiring

**Files:**
- Create: `tests/stage19-page-turn-faces.test.js`
- Modify: `package.json`

**Requirement:** Add an independently runnable Node assertion test that reads `src/app.js` and proves the caller-side contract, not only the `animatePageTurn` signature:

1. `renderStoryChapter` selects `.storybook-page--illustration` for its temporary-page source.
2. It makes two separate clones into `turnFrontPage` and `turnBackPage`.
3. It renders the current `snapshot` and `card` into `turnBackPage`'s `.storybook-illustration-state` through `renderStoryIllustration`.
4. It calls `animatePageTurn(animate, turnFrontPage, turnBackPage)` in that order.
5. It does not select `.storybook-page--copy` within the `renderStoryChapter` temporary-face block.

Use TDD: the test must fail before its test file exists, then pass after addition. Add the test to `npm.cmd test` via `package.json`. Do not edit `src/app.js`, `src/styles.css`, `src/index.html`, existing stage13 test, server, media, or any unrelated pending change. Commit only the new test and package manifest. Full report: `.superpowers/sdd/next-turn-final-test-report.md`.
