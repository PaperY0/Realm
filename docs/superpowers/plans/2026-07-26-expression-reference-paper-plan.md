# 风铃入口参考图信纸重设计 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将风铃入口/表达页重做为参考图比例的手绘水彩背景与旧信纸构图，同时保持现有交互。

**Architecture:** 保留现有 HTML 结构和 JavaScript 状态机，仅在 `src/styles.css` 的 expression stage 覆盖层中调整尺寸、背景、纸张材质和响应式规则。测试继续使用现有 stage18 静态断言，并用浏览器检查实际视口边界。

**Tech Stack:** 原生 CSS、现有 HTML/JS、Node 静态测试、浏览器验收。

## Global Constraints

- 只允许影响 `body[data-stage="expression"]` 相关视觉规则。
- 不引入外部图片、依赖或新的交互状态。
- 不恢复纸船等待动画或生成过程展示。
- 1280×720 目标纸张尺寸约 920×596px，且页面无横向溢出。

---

### Task 1: 参考图构图与材质覆盖层

**Files:**
- Modify: `C:\Users\wsy19\Desktop\Realm\src\styles.css` expression stage override section
- Test: `C:\Users\wsy19\Desktop\Realm\tests\stage18-expression-paper.test.js`

**Interfaces:**
- Consumes: Existing `.scene--expression`, `.expression-paper`, `.paper-sheet` DOM.
- Produces: Reference-proportioned paper stage with watercolor background and paper texture.

- [ ] **Step 1: Add/adjust visual assertions**

Assert that the expression CSS includes the reference paper max dimensions, watercolor background layers, and paper pseudo-elements while retaining the existing hidden generation/boat selectors.

- [ ] **Step 2: Run the focused test**

Run `node tests/stage18-expression-paper.test.js` from `C:\Users\wsy19\Desktop\Realm` and expect the new assertions to fail before the CSS change if the properties are absent.

- [ ] **Step 3: Implement the CSS change**

Update the final expression-stage rules so that desktop uses `width: min(920px, calc(100% - 36px))`, `height: min(596px, calc(100dvh - 124px))`, centered placement, low-contrast rotation, watercolor gradient layers, irregular paper clip-path, fiber/crease pseudo-elements, and responsive overrides at 900px/820px without changing non-expression selectors.

- [ ] **Step 4: Run focused checks**

Run `node tests/stage18-expression-paper.test.js; node --check src/app.js; git diff --check` and expect all commands to exit successfully.

- [ ] **Step 5: Commit the focused change**

Run `git add src/styles.css tests/stage18-expression-paper.test.js docs/superpowers/specs/2026-07-26-expression-reference-paper-design.md docs/superpowers/plans/2026-07-26-expression-reference-paper-plan.md; git commit -m "feat: match expression paper to watercolor reference"`.

### Task 2: Browser visual acceptance

**Files:**
- Modify: none unless a concrete viewport regression is found in `src/styles.css`

**Interfaces:**
- Consumes: Task 1 CSS and existing local server.
- Produces: Verified desktop and narrow-screen expression layout.

- [ ] **Step 1: Start the app**

Run `npm.cmd start` from `C:\Users\wsy19\Desktop\Realm` and open `http://localhost:3000/` in the browser.

- [ ] **Step 2: Enter expression stage and inspect desktop**

At 1280×720, verify the expression paper is centered, approximately 920×596px, the watercolor background remains visible on all sides, and the page has no horizontal scroll.

- [ ] **Step 3: Inspect narrow layout**

Repeat at 390×844 and 820×720. Verify the paper remains visible, controls remain reachable, and `document.documentElement.scrollWidth === document.documentElement.clientWidth`.

- [ ] **Step 4: Run the complete test suite**

Run `npm.cmd test` and record the result. Do not report full success if an unrelated pre-existing test fails.
