### Task 3: Verify physical faces and runtime behavior

**Files:**
- Verify: `src/styles.css:3017-3157`
- Verify: `src/app.js`
- Verify: `tests/stage13-web-storybook.test.js`

**Interfaces:**
- Consumes: existing `.storybook-turn-sheet__front`, `.storybook-turn-sheet__back`, 3D keyframes, and the completed explicit-face contract.
- Produces: evidence that the incoming illustration is visible after the sheet crosses the spine and no mirrored paragraph is emitted by the temporary sheet.

**Global constraints:**
- Forward front is outgoing illustration; physical back is incoming illustration.
- Preserve 840ms lock and cleanup.
- Do not edit or stage any pre-existing unrelated working-tree changes, including current server, asset, CSS, or completion-cover work.

- [ ] **Step 1: Verify CSS face contract**

Inspect the existing turn-face rules and confirm that both faces hide their backs, the back face is rotated by 180 degrees, and an illustration back uses `object-fit: cover`. Do not change CSS unless a concrete contract is missing.

- [ ] **Step 2: Run focused regression and full suite**

Run: `node --check src/app.js; node tests/stage13-web-storybook.test.js; npm.cmd test`

Expected: all commands exit 0. If unrelated pre-existing changes cause a failure, report the exact failure without modifying them.

- [ ] **Step 3: Browser acceptance**

Start the local demo and inspect a next turn near 100ms, 420ms, and 900ms. At the middle frame, the visible paper back must be the next chapter illustration and contain no reversed paragraph. At completion, `.storybook-turn-sheet` must be removed and the next spread must be present.

- [ ] **Step 4: Report only**

Do not commit unless you made a necessary, task-owned CSS/test change. Report command results, browser evidence, unchanged-file checks, and any blocker.
