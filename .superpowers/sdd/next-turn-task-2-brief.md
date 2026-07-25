### Task 2: Supply real page faces

**Files:**
- Modify: `src/app.js:767-800`
- Modify: `src/app.js:849-892`
- Test: `tests/stage13-web-storybook.test.js`

**Interfaces:**
- Consumes: outgoing illustration DOM, updated `reader.snapshot()`, and `renderStoryIllustration(storyPackage, snapshot, card, target)`.
- Produces: `animatePageTurn(direction, frontPage, backPage)` with only supplied content on each side.

**Global constraints:**
- Forward turn front is the outgoing chapter illustration and its back is the incoming chapter illustration.
- Never use the current text page as the forward sheet back.
- Keep the existing 840ms single-flight lock, temporary sheet cleanup, and reverse-turn behavior.
- Do not edit unrelated storybook background or completion-cover changes.

- [ ] **Step 1: Replace page-class selection with explicit inputs**

```js
function animatePageTurn(direction, frontPage, backPage) {
  if (!storybookBook || !frontPage || !backPage) return;
  clearTurnSheets();
  // keep makeFace unchanged
  sheet.append(
    makeFace(frontPage, 'storybook-turn-sheet__front'),
    makeFace(backPage, 'storybook-turn-sheet__back'),
  );
}
```

- [ ] **Step 2: Build the incoming illustration before replacing the permanent DOM**

For a next turn, clone `.storybook-page--illustration` twice: retain one pre-update clone as outgoing `frontPage`; render the new `snapshot` and `card` into the other clone's `.storybook-illustration-state` and pass it as `backPage`. The forward path must not use `.storybook-page--copy` to select either temporary face. Keep previous-turn snapshots explicit rather than reverting to page-class selection.

- [ ] **Step 3: Verify green**

Run: `node tests/stage13-web-storybook.test.js`

Expected: PASS.

- [ ] **Step 4: Commit**

Run: `git add src/app.js tests/stage13-web-storybook.test.js; git commit -m "fix: show next illustration on page back"`
