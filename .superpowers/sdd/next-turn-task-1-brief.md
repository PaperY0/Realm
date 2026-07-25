### Task 1: Lock the visual contract with a red test

**Files:**
- Modify: `tests/stage13-web-storybook.test.js:244-258`

**Interfaces:**
- Consumes: `animatePageTurn(direction, frontPage, backPage)`.
- Produces: regression coverage for explicit physical faces.

**Global constraints:**
- Never use the current text page as the forward sheet back.
- Keep the 840ms interaction lock and temporary sheet cleanup.
- Do not touch unrelated storybook background declarations.

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
