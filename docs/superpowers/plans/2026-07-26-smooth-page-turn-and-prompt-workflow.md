# Smooth Page Turn and Prompt Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the mechanical chapter switch with a layered paper-turn animation and expose the existing story-to-image pipeline as four explicit generation stages without replacing the parallel seven-image generator.

**Architecture:** Keep `src/services/chapter-image-generation.js` as the only chapter-image fan-out. Extend the story package with safe, structured prompt metadata; let the browser render stage progress from the existing story-package response into the existing parallel image request; and isolate the page-turn layer from normal page transforms with dedicated front/back DOM faces.

**Tech Stack:** Vanilla JavaScript, HTML, CSS 3D transforms, Node.js HTTP server, existing story-package contracts, existing `npm test` suite, in-app browser acceptance.

## Global Constraints

- Keep the browser limited to `SafeStoryBrief`; never expose API keys or raw unsafe input.
- Preserve the existing seven-chapter package contract and `chapter-image-generation.js` parallel behavior.
- Show short chapter copy in the reader; keep internal prompts inside a collapsible generation panel.
- Do not enter the reader unless all seven chapter illustrations succeed.
- Respect reduced-motion preferences by switching directly without 3D motion.

---

### Task 1: Lock the new contracts with tests

**Files:**
- Modify: `tests/stage10-story-package.test.js`
- Modify: `tests/stage15-chapter-image-generation.test.js`
- Modify: `tests/stage13-web-storybook.test.js`
- Create: `tests/stage16-prompt-workflow.test.js`

**Interfaces:**
- Consumes: current `createStoryPackage`, `generateChapterIllustrations`, and HTML response.
- Produces: assertions for `storyPrompt`, `chapterCards[].promptContract.imagePrompt`, visible workflow stage hooks, and preserved seven-image parallel calls.

- [ ] **Step 1: Add story-package assertions**

Assert that a safe package has a non-empty `storyPrompt`, exactly seven short `userVisibleCopy.chapterText` values, and a non-empty `promptContract.imagePrompt` for every chapter.

- [ ] **Step 2: Add image-generator assertions**

Keep the existing concurrency test and add an assertion that each generated image call receives the matching chapter `illustrationContract` and Image Prompt rather than one shared prompt.

- [ ] **Step 3: Add browser markup assertions**

Assert that the HTML contains workflow stage elements, a collapsible prompt panel, `.storybook-turn-sheet__front`, `.storybook-turn-sheet__back`, and a dedicated `.storybook-turn-shadow` hook.

- [ ] **Step 4: Run the focused tests and confirm failure**

Run:

```powershell
node tests/stage10-story-package.test.js
node tests/stage15-chapter-image-generation.test.js
node tests/stage13-web-storybook.test.js
node tests/stage16-prompt-workflow.test.js
```

Expected: the new contract and markup assertions fail before implementation.

### Task 2: Add structured prompt metadata without changing image fan-out

**Files:**
- Modify: `src/domain/story-package.js`
- Modify: `src/services/chapter-image-generation.js`
- Modify: `server.js`
- Test: `tests/stage10-story-package.test.js`
- Test: `tests/stage15-chapter-image-generation.test.js`

**Interfaces:**
- Consumes: validated `SafeStoryBrief` and existing chapter beats.
- Produces: `storyPrompt`, chapter-level `promptContract.imagePrompt`, and the same `generateChapterIllustrations(options)` return shape.

- [ ] **Step 1: Build safe prompt metadata from existing beats**

Create deterministic prompt strings from already sanitized story signals, chapter setting, required props, palette, lighting, and continuity. Keep prompt metadata free of raw expression fields.

- [ ] **Step 2: Keep chapter copy short**

Normalize each visible chapter body to a small reader-sized maximum while retaining the full semantic fields used by validation and image prompts.

- [ ] **Step 3: Pass the existing chapter contract through the parallel generator**

Do not add a second image loop. Confirm each worker still calls `generateImageImpl` once per chapter and receives that chapter's Image Prompt via `illustrationContract`.

- [ ] **Step 4: Preserve API validation and sanitization**

Allow only the new structured prompt fields in a validated story package; reject arbitrary extra prompt fields and continue returning sanitized image metadata.

- [ ] **Step 5: Run focused contract tests**

Run the two story and image tests from Task 1. Expected: PASS.

### Task 3: Make the generation workflow visible in the expression screen

**Files:**
- Modify: `src/index.html`
- Modify: `src/app.js`
- Modify: `src/styles.css`
- Test: `tests/stage16-prompt-workflow.test.js`

**Interfaces:**
- Consumes: `storyPrompt`, `chapterCards`, and `chapterIllustrations` from the existing two server requests.
- Produces: visible states `prompting`, `writing`, `image-prompting`, `illustrating`, `ready`, and `error`; collapsible prompt details; per-chapter image status.

- [ ] **Step 1: Add workflow markup**

Add a compact stage rail, a `<details>` prompt inspector, a seven-item chapter status list, and a “进入绘本” readiness message inside the existing generation card. Keep the reader-facing chapter copy separate.

- [ ] **Step 2: Add workflow state helpers**

Implement `setStoryGenerationStage(stage, payload)` and `renderChapterGenerationStates(illustrations)` in `src/app.js`. These functions must update text through `textContent`, never `innerHTML` with model output.

- [ ] **Step 3: Update request sequencing**

Set `prompting` before `/api/story-package`, `writing` after the story package returns, `image-prompting` while chapter Image Prompt metadata is displayed, and `illustrating` while `/api/images/generate-book` runs. Only set `ready` and enter the storybook after a successful seven-image result.

- [ ] **Step 4: Style the workflow without expanding the reader chrome**

Keep the panel compact, use the existing cream/purple storybook palette, and ensure long prompts wrap inside a scrollable details area. Do not put internal prompts on the right reading page.

- [ ] **Step 5: Run the focused web test**

Run `node tests/stage16-prompt-workflow.test.js`. Expected: PASS.

### Task 4: Replace the mechanical page switch with a layered paper turn

**Files:**
- Modify: `src/app.js`
- Modify: `src/styles.css`
- Modify: `tests/stage13-web-storybook.test.js`

**Interfaces:**
- Consumes: `renderStoryChapter({ animate })`, current and next chapter DOM content, and `STORYBOOK_PAGE_TURN_MS`.
- Produces: `.storybook-turn-sheet` with front/back faces and `.storybook-turn-shadow`, correct next/previous direction, and cleanup after the animation.

- [ ] **Step 1: Capture both page faces**

Replace the single cloned page with a turn-sheet wrapper containing a front face for the departing page and a back face for the arriving page preview. Strip ordinary `.storybook-page` classes from the temporary faces so global page reset rules cannot override the turn transform.

- [ ] **Step 2: Add explicit animation phases**

Use a roughly 840ms timeline: lift from 0° to 12°, cross the spine through 90°, then settle near 178°. Animate shadow opacity and back-face brightness with the same timing. Reverse transform origins for previous-page turns.

- [ ] **Step 3: Keep controls locked and clean up safely**

Remove old temporary sheets before starting, prevent double clicks during the 840ms lock, remove the sheet on completion, and preserve reduced-motion direct switching.

- [ ] **Step 4: Run syntax and storybook tests**

Run:

```powershell
node --check src/app.js
node tests/stage13-web-storybook.test.js
```

Expected: PASS.

### Task 5: Verify the full workflow and browser motion

**Files:**
- Modify: `README.md` only if the existing status text becomes inaccurate.
- Test: all existing tests.

**Interfaces:**
- Consumes: completed Tasks 1–4.
- Produces: verified source, tests, and browser acceptance evidence.

- [ ] **Step 1: Run the complete test suite**

Run `npm.cmd test`, `node --check src/app.js`, `node --check server.js`, and `node --check src/services/chapter-image-generation.js`. Expected: all PASS.

- [ ] **Step 2: Start the local server and open the real storybook**

Use the existing local server, restore a valid safe story state if necessary, and navigate the browser to the storybook scene.

- [ ] **Step 3: Inspect page-turn middle frames**

Click next and sample around 100ms, 400ms, and after 900ms. Confirm the temporary sheet exists, front/back faces exist, computed transform is non-identity 3D, shadow changes, and the chapter number updates after cleanup. Repeat once for previous.

- [ ] **Step 4: Inspect generation workflow**

Run the generation path in the browser and confirm each stage appears in order, prompts are contained in the details panel, seven chapter statuses render, and the reader remains blocked until all images succeed.

- [ ] **Step 5: Commit the implementation**

```powershell
git add src/app.js src/index.html src/styles.css src/domain/story-package.js src/services/chapter-image-generation.js server.js tests
git commit -m "feat: add smooth page turn and prompt workflow"
```
