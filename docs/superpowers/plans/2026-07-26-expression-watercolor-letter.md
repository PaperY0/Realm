# 风铃入口水彩信纸视觉修正 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将表达页改为参照图三的水彩底与真实信纸构图，同时保持现有表达流程和移动端可用性。

**Architecture:** 复用现有 `expression-watercolor-reference.png` 作为桌面端完整背景，使用透明的布局容器承载交互内容；小屏使用同一素材作为底色并让内容自然滚动。只调整表达页 CSS，不改变 `src/app.js` 的状态与数据流。

**Tech Stack:** 原生 HTML、CSS、Node demo server、现有 Node 测试脚本。

## Global Constraints

- 不修改表达数据流、隐私处理、安全拦截或纸船生成逻辑。
- 保留参照图的手绘水彩配色、纸张纹理、不规则边缘与阴影。
- 桌面端内容必须位于复合参考图中央纸张区域内。
- 375px 左右小屏不得出现横向滚动或主要操作被遮挡。

---

### Task 1: Replace expression page visual stack

**Files:**
- Modify: `C:\Users\wsy19\Desktop\Realm\src\styles.css` (final expression-page override block)

**Interfaces:**
- Consumes: `src/assets/expression-watercolor-reference.png`, existing `.expression-paper`, `.paper-sheet`, and expression controls.
- Produces: a single final expression-page visual layer with transparent content geometry on desktop and scroll-safe geometry on mobile.

- [ ] **Step 1: Remove conflicting final background simulation rules**

  In the final expression override area, replace the CSS-gradient paper treatment with an explicit `background-image: url('/assets/expression-watercolor-reference.png')` on `.scene--expression`, and remove any later rule that reintroduces gradient paper colors.

- [ ] **Step 2: Align the content frame to the reference paper**

  Use a desktop frame sized against the 16:9 reference composition:

  ```css
  body[data-stage="expression"] .scene--expression {
    min-height: 100dvh;
    padding: 0;
    overflow: hidden;
    background: #eadfc9 url('/assets/expression-watercolor-reference.png?v=20260726') center / cover no-repeat;
  }

  body[data-stage="expression"] .expression-paper {
    width: min(66.5vw, 1060px);
    height: min(80.5vh, 690px);
    margin: 6.8vh auto 0;
    transform: none;
    background: transparent;
    box-shadow: none;
  }

  body[data-stage="expression"] .paper-sheet {
    height: 100%;
    padding: clamp(28px, 3.1vw, 52px);
    overflow: hidden;
    background: transparent;
  }
  ```

- [ ] **Step 3: Keep controls readable without adding a second card**

  Set expression card surfaces to translucent warm white only where controls need separation, preserving the paper texture behind them; keep the central letter itself borderless and remove decorative CSS corners/clouds/sparks.

- [ ] **Step 4: Add mobile fallback geometry**

  At `max-width: 820px`, change the scene to `min-height: 100dvh; overflow-y: auto`, use `background-size: auto 100%` with a warm fallback color, and let `.expression-paper` use `width: calc(100% - 24px); height: auto; min-height: calc(100dvh - 32px); margin: 16px auto;` so the controls remain reachable.

- [ ] **Step 5: Run syntax and targeted page tests**

  Run:

  ```powershell
  node --check src/app.js
  node tests/stage8-web-image.test.js
  node tests/stage18-expression-paper.test.js
  ```

  Expected: all commands exit 0.

- [ ] **Step 6: Commit the implementation**

  ```powershell
  git add src/styles.css
  git commit -m "fix: match expression page watercolor letter reference"
  ```

### Task 2: Rendered visual verification

**Files:**
- Inspect: `C:\Users\wsy19\Desktop\Realm\src\styles.css`, `C:\Users\wsy19\Desktop\Realm\src\index.html`
- Verify: running local Realm demo in the browser

**Interfaces:**
- Consumes: Task 1 CSS and existing expression route.
- Produces: verified desktop and mobile screenshots/observations.

- [ ] **Step 1: Start the demo server**

  Run `npm.cmd run demo` from `C:\Users\wsy19\Desktop\Realm`.

- [ ] **Step 2: Navigate to the expression stage**

  Open the local demo, follow the door/foyer path, and inspect the expression page at desktop width.

- [ ] **Step 3: Verify visual acceptance**

  Confirm the page shows the supplied watercolor palette, authentic paper edge/texture, content aligned to the paper, no duplicate gradient card, and usable controls.

- [ ] **Step 4: Verify small-screen acceptance**

  Inspect a 375px-wide viewport and confirm no horizontal overflow, readable title/input, and reachable primary/secondary actions.
