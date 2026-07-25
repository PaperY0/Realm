# Folding Transition and Voyage Overlay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an independent paper-folding transition page before the existing full-screen paper-boat voyage video, with synchronized project-style copy, without changing the original letter layout or story-generation fallback flow.

**Architecture:** The existing `paper-boat-sequence` becomes a two-phase full-screen layer. Phase `folding` shows a standalone paper-texture transition and copy for 1.8 seconds; phase `floating` shows the full-screen video and a timed copy overlay. The existing request lifecycle remains authoritative: the layer starts synchronously when the user clicks send, clears on success, and shows the existing error state on failure.

**Tech Stack:** Vanilla JavaScript, HTML, CSS, existing `/assets/paper-boat.mp4`, Node test suite, Playwright in-app browser verification.

## Global Constraints

- Do not alter the original letter composition before the send action.
- The folding transition must be a separate full-screen page/layer, not an animation inside the letter.
- The voyage video must remain muted, inline-compatible, and looped.
- Existing text-generation, seven-chapter image generation, and approved-template fallbacks must remain unchanged.
- Voyage copy must never expose raw user input or identifying information.

---

### Task 1: Add the independent folding transition surface

**Files:**
- Modify: `src/index.html` near `#paper-boat-sequence`
- Modify: `src/styles.css` in the paper-boat waiting styles

**Interfaces:**
- Consumes: `#paper-boat-sequence[data-paper-boat-state="folding"]`
- Produces: A full-screen folding state containing only paper texture, fold layers, a paper-boat mark, and fixed transition copy.

- [ ] **Step 1: Add semantic transition copy elements**

Add `#paper-boat-fold-title` and `#paper-boat-fold-copy` inside the existing waiting layer, with copy:

```html
<div class="paper-boat-fold-copy" aria-live="polite">
  <p class="paper-boat-fold-copy__eyebrow">风铃正在收好这句话</p>
  <h2 id="paper-boat-fold-title">纸张正在折叠</h2>
  <p id="paper-boat-fold-copy">把这句话，折成一只可以出发的纸船。</p>
</div>
```

- [ ] **Step 2: Style the folding state as a separate full-screen page**

Use `position: fixed`, `inset: 0`, `z-index: 1000`, `min-height: 100dvh`, the existing cream paper texture, centered fold layers, and a soft warm radial glow. Keep the existing letter underneath untouched. Hide the voyage video, voyage copy, and guide content while `data-paper-boat-state="folding"`.

- [ ] **Step 3: Run static checks**

Run:

```powershell
node --check src/app.js
git diff --check
```

Expected: both commands pass; no existing story-generation files are changed.

---

### Task 2: Synchronize voyage copy with video playback

**Files:**
- Modify: `src/index.html` near `#paper-boat-video`
- Modify: `src/app.js` near `PAPER_BOAT_MESSAGES` and `startPaperBoatWait`
- Modify: `src/styles.css` in the paper-boat overlay styles

**Interfaces:**
- Consumes: `HTMLVideoElement#paper-boat-video` `timeupdate` and `ended`-safe loop behavior.
- Produces: `PAPER_BOAT_VOYAGE_COPY`, `syncPaperBoatVoyageCopy()`, and a visual `.paper-boat-voyage-copy` overlay.

- [ ] **Step 1: Add the voyage copy element**

Add an `aria-live="polite"` overlay containing an eyebrow and message:

```html
<div class="paper-boat-voyage-copy" id="paper-boat-voyage-copy" aria-live="polite">
  <p class="paper-boat-voyage-copy__eyebrow">纸船航行中</p>
  <p id="paper-boat-voyage-message">纸船载着这句话，驶入还没有名字的湖面。</p>
</div>
```

- [ ] **Step 2: Define timed copy beats**

Use safe fixed strings and normalized video progress:

```js
const PAPER_BOAT_VOYAGE_COPY = [
  '纸船载着这句话，驶入还没有名字的湖面。',
  '风把没说完的部分，轻轻收进水波里。',
  '远处的灯还没有亮起，故事正在另一岸慢慢展开。',
  '不必现在抵达，先让这一点重量有地方安放。',
  '七章故事正在水面下，一页一页长出来。',
];
```

Implement `syncPaperBoatVoyageCopy()` so it chooses a beat with `Math.floor((currentTime / duration) * length)`, clamps invalid duration to index 0, and updates text only when the index changes. Register it on video `timeupdate`; call it immediately when entering `floating`.

- [ ] **Step 3: Style copy without blocking the video**

Place the copy near the lower-left safe area with a translucent paper panel, cream text, subtle shadow, and a fade transition. Hide it during `folding`; show it during `floating`; preserve the existing error-state guide for recoverable failures.

- [ ] **Step 4: Run focused tests**

Run:

```powershell
node --check src/app.js
npm.cmd test
```

Expected: all stage tests pass.

---

### Task 3: Connect state transitions and cleanup

**Files:**
- Modify: `src/app.js` in `setPaperBoatState`, `startPaperBoatWait`, and `clearPaperBoatWait`

**Interfaces:**
- Consumes: existing `state.paperBoat`, `paperBoatSequence`, `paperBoatVideo`, and story request lifecycle.
- Produces: deterministic `folding -> floating -> idle/error` transitions.

- [ ] **Step 1: Start folding synchronously on send**

Keep `startPaperBoatWait()` called immediately after disabling the send button. Set `data-paper-boat-state="folding"`, reset the video, show the folding copy, and start the existing 1.8-second transition timer.

- [ ] **Step 2: Switch to voyage state**

When the timer fires, set `data-paper-boat-state="floating"`, call `paperBoatVideo.play()`, and call `syncPaperBoatVoyageCopy()` once. Keep `loop` on the video so copy beats repeat from the first beat when the video loops.

- [ ] **Step 3: Make cleanup complete**

In `clearPaperBoatWait()`, clear timers, remove the video `timeupdate` listener if it was registered, pause and reset the video, reset the voyage-copy index, and restore `body[data-paper-boat-waiting]` to `false` through `setPaperBoatState('idle')`.

- [ ] **Step 4: Verify state contract**

Run:

```powershell
node --check src/app.js
node --check server.js
git diff --check
```

Expected: pass with no API contract changes.

---

### Task 4: Browser acceptance

**Files:**
- Test: running local demo at `http://127.0.0.1:3000/`

- [ ] **Step 1: Verify pre-send composition**

Open the expression page and confirm the letter remains visible; the folding layer is hidden and the generation card is not visible.

- [ ] **Step 2: Verify folding phase**

Complete the demo expression and click `寄出这封信`. Within the first 500 ms confirm `data-paper-boat-state="folding"`, the fixed layer is visible, the folding copy is visible, and the voyage video/copy is hidden.

- [ ] **Step 3: Verify voyage phase**

After about 2 seconds confirm `data-paper-boat-state="floating"`, video `paused === false`, `loop === true`, and the voyage message is visible. Wait through at least two copy beats and verify the message changes.

- [ ] **Step 4: Verify completion cleanup**

After the story package returns, confirm the full-screen layer is hidden and the seven-chapter reader is visible. If image generation fails, confirm the existing approved fallback still renders.

- [ ] **Step 5: Run the complete regression suite**

Run:

```powershell
npm.cmd test
```

Expected: all existing stage tests pass.
