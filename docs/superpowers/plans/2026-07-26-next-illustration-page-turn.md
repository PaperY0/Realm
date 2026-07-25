# Next Illustration Page Turn Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make each forward turn show the outgoing illustration on the sheet front and the next chapter illustration on its physical back.

**Architecture:** The permanent spread remains stable during motion. `renderStoryChapter` supplies explicit outgoing and incoming snapshots to a two-sided temporary sheet; CSS rotates only that sheet about the spine.

**Tech Stack:** Vanilla JavaScript, DOM APIs, CSS 3D transforms, Node.js assertions.

## Global Constraints

- Never use the current text page as the forward sheet back.
- Keep the 840ms interaction lock and temporary sheet cleanup.
- Do not touch the unrelated uncommitted storybook background declaration.

---

### Task 1: Lock the visual contract with a red test

**Files:**
- Modify: `tests/stage13-web-storybook.test.js:244-258`

**Interfaces:**
- Consumes: `animatePageTurn(direction, frontPage, backPage)`.
- Produces: regression coverage for explicit physical faces.

- [ ] **Step 1: Write the failing test**

```js
const animatePageTurn = functionSource(app, 'animatePageTurn');
assert.match(animatePageTurn, /function\s+animatePageTurn\s*\(\s*direction\s*,\s*frontPage\s*,\s*backPage\s*\)/);
assert.match(animatePageTurn, /makeFace\(frontPage,\s*'storybook-turn-sheet__front'\)/);
assert.match(animatePageTurn, /makeFace\(backPage,\s*'storybook-turn-sheet__back'\)/);
assert.doesNotMatch(animatePageTurn, /storybook-page--copy/);
```

- [ ] **Step 2: Verify red**

Run: `node tests/stage13-web-storybook.test.js`

Expected: FAIL because the current function derives face content from a page class.

- [ ] **Step 3: Commit the test**

Run: `git add tests/stage13-web-storybook.test.js; git commit -m "test: cover next illustration page back"`

### Task 2: Supply real page faces

**Files:**
- Modify: `src/app.js:767-800`
- Modify: `src/app.js:849-892`
- Modify: `tests/stage13-web-storybook.test.js`

**Interfaces:**
- Consumes: outgoing illustration DOM, updated `reader.snapshot()`, and `renderStoryIllustration(storyPackage, snapshot, card, target)`.
- Produces: `animatePageTurn(direction, frontPage, backPage)` with only supplied content on each side.

- [ ] **Step 1: Change the temporary-sheet interface**

```js
function animatePageTurn(direction, frontPage, backPage) {
  if (!storybookBook || !frontPage || !backPage) return;
  clearTurnSheets();
  // makeFace keeps stripping .storybook-page from each clone.
  sheet.append(
    makeFace(frontPage, 'storybook-turn-sheet__front'),
    makeFace(backPage, 'storybook-turn-sheet__back'),
  );
}
```

- [ ] **Step 2: Capture the incoming illustration before permanent content changes**

For a next turn, clone `.storybook-page--illustration` twice: retain one pre-update clone as the outgoing `frontPage`; render the new `snapshot` and `card` into the other clone's `.storybook-illustration-state` and pass it as `backPage`. Keep previous-turn snapshots explicit rather than falling back to a page-class choice.

- [ ] **Step 3: Verify green**

Run: `node tests/stage13-web-storybook.test.js`

Expected: PASS.

- [ ] **Step 4: Commit the behavior**

Run: `git add src/app.js tests/stage13-web-storybook.test.js; git commit -m "fix: show next illustration on page back"`

### Task 3: Verify physical faces and runtime behavior

**Files:**
- Verify: `src/styles.css:3017-3157`
- Verify: `src/app.js`
- Verify: `tests/stage13-web-storybook.test.js`

**Interfaces:**
- Consumes: existing `.storybook-turn-sheet__front`, `.storybook-turn-sheet__back`, 3D keyframes, and completed explicit face contract.
- Produces: a visible incoming illustration after the sheet crosses the spine and no mirrored paragraph.

- [ ] **Step 1: Add CSS contract assertions**

```js
assert.match(css, /\.storybook-turn-sheet__front\s*,\s*\.storybook-turn-sheet__back\s*\{[\s\S]*?backface-visibility\s*:\s*hidden/);
assert.match(css, /\.storybook-turn-sheet__back\s*\{[\s\S]*?transform\s*:\s*rotateY\(180deg\)/);
assert.match(css, /\.storybook-turn-sheet__back\[data-turn-page="illustration"\][\s\S]*?object-fit\s*:\s*cover/);
```

- [ ] **Step 2: Run regression and make only a failing CSS correction**

Run: `node tests/stage13-web-storybook.test.js`

Expected: PASS if current face rules meet the contract. If not, restore `backface-visibility: hidden`, `rotateY(180deg)`, and illustration `object-fit: cover` inside existing turn-face rules only.

- [ ] **Step 3: Run full verification**

Run: `node --check src/app.js; npm.cmd test`

Expected: both commands exit 0.

- [ ] **Step 4: Browser acceptance**

Start the demo and sample a next turn at about 100ms, 420ms, and 900ms. At the middle frame, the visible paper back must be the next chapter illustration with no reversed paragraph; after completion, `.storybook-turn-sheet` must be absent and the spread must match the next chapter.

- [ ] **Step 5: Commit only feature-owned changes**

Run: `git add src/app.js src/styles.css tests/stage13-web-storybook.test.js; git commit -m "style: stabilize storybook turn faces"`
