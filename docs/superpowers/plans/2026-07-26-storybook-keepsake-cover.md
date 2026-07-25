# Storybook Keepsake Cover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the completed storybook into a V3.3-inspired colorful fairy-tale keepsake with a dynamic book title, watercolor controls, a pale-purple index, and revised completion copy.

**Architecture:** Keep the book-cover illustration CSS-native so generated story titles remain real DOM text and the project is not dependent on a failed image-generation request. Reuse the existing `bookTitle` resolution in `renderStoryChapter`, binding it to one new cover-title node. Scope all visual overrides to the storybook scene.

**Tech Stack:** Static HTML, vanilla JavaScript, CSS, Node test scripts.

## Global Constraints

- Preserve the current reader state machine, storage format, and chapter illustration pipeline.
- Apply V3.3 medium-to-slightly-high saturation watercolor colors with one small golden focal point; do not introduce rasterized text, 3D effects, or extra generated assets.
- Keep focus, disabled-button, and responsive behavior intact.

---

### Task 1: Bind the real story title to the closed cover

**Files:**
- Modify: `src/index.html:337-348`
- Modify: `src/app.js:158-174,849-880`

**Interfaces:**
- Consumes: the existing `bookTitle` resolved from `storyPackage.bookTitle`, template title, or story-bible title.
- Produces: `#storybook-cover-title`, updated on each `renderStoryChapter` call.

- [ ] **Step 1: Add a cover-title node and replace the completion copy**

```html
<strong id="storybook-cover-title">绾线与旅人的七章童话</strong>
<small>藏梦书境 · 七章绘本</small>
...
<h3 id="storybook-keepsake-title">这封信，已经长成了一本童话。</h3>
<p>那些一度挂在心上的话，已随纸页走过七段旅程；风会替你轻轻合上书，也等你想起时再翻开。</p>
```

- [ ] **Step 2: Cache and render the title**

```js
const storybookCoverTitle = document.querySelector('#storybook-cover-title');
// Inside renderStoryChapter after bookTitle is resolved:
if (storybookCoverTitle) storybookCoverTitle.textContent = bookTitle;
```

- [ ] **Step 3: Verify syntax and fixed copy removal**

Run: `node --check src/app.js; rg -n '本机纪念页|你已经亲手读完这本书|故事停在第七章。只有你主动选择' src/index.html`

Expected: syntax check exits 0 and `rg` finds no old completion strings.

### Task 2: Create the V3.3 closed-cover, control, and index treatments

**Files:**
- Modify: `src/styles.css:2782-2855,2888-2969`

**Interfaces:**
- Consumes: existing `.storybook-closed-book`, `.storybook-control--primary`, and rendered `li` nodes in `#storybook-progress`.
- Produces: colorful CSS-native cover and scoped watercolor/pale-purple visual tokens.

- [ ] **Step 1: Add final storybook-scoped visual overrides**

```css
body[data-stage="storybook"] .storybook-control--primary {
  background: linear-gradient(115deg, #7465a3 0%, #b57b9a 37%, #d99867 68%, #d7ae58 100%);
  color: #fffdf7;
}

body[data-stage="storybook"] .storybook-closed-book {
  background: /* layered lavender, coral, gold, green and blue-violet watercolor fields */;
}
```

- [ ] **Step 2: Keep non-primary disabled controls visibly disabled and use pale purple for the progress rail**

```css
body[data-stage="storybook"] .storybook-control--primary:disabled { /* muted version of the watercolor treatment */ }
body[data-stage="storybook"] .storybook-progress { background: rgba(232, 220, 241, .78); }
```

- [ ] **Step 3: Validate CSS and relevant reader behavior**

Run: `git diff --check; node tests/stage13-web-storybook.test.js; node tests/stage18-expression-paper.test.js`

Expected: all commands exit 0.
