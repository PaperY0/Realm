# 情绪大门世界 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将门厅页改造成五扇情绪大门的水彩世界，支持微动效、悬停反馈、守门 IP 对话，并确保内耗之门继续进入风铃表达页。

**Architecture:** 使用现有 `foyer` scene 作为唯一页面容器，以图一风格的五门场景资产作为背景，叠加五个语义化门按钮和一个统一的守门 IP 对话层。只有 `overthinking` 门允许调用 `goToScene('expression')`，其他门只更新未开放提示，不改变路由。

**Tech Stack:** 原生 HTML、CSS、浏览器 JavaScript、现有本地 Node server、现有 Node test runner。

## Global Constraints

- 保留 `SCENE_ORDER` 中的 `foyer` 与 `expression`，内耗门路由必须仍为 `innerDoor -> goToScene('expression')`。
- 五门视觉遵循 `assets/bible/STYLE-BIBLE.md` 与现有水彩绘本资产，不引入新 UI 框架。
- 默认动效轻微；`body.reduce-motion` 与系统减少动态设置必须禁用持续动画。
- 非内耗门不能跳转，只显示“故事世界还未开启”语义的产品文案。
- 守门 IP 使用 `assets/characters/guardians/final` 中的资产，不把用户输入或风险内容放进门厅对话。

---

### Task 1: 建立五门交互结构与可测试文案

**Files:**
- Modify: `src/index.html` foyer scene
- Modify: `tests/stage4.test.js`
- Modify: `tests/stage8-web-image.test.js`

**Interfaces:**
- Produces five buttons with `data-emotion-door`, one `data-emotion-door="overthinking"` and four unopened doors.
- Produces `#emotion-door-dialogue`, `#emotion-door-status`, and `#emotion-door-guardian` as the shared feedback layer.

- [x] **Step 1: Write failing assertions** for five door buttons, guardian names, unopened copy, and the existing inner-door route.
- [x] **Step 2: Run `node tests/stage4.test.js` and confirm the new assertions fail.**
- [x] **Step 3: Replace the single `#inner-door` visual block with five semantic door buttons and the shared dialogue layer.** Use `绾线 / 听雨 / 息摆 / 藏烬 / 铃芽` and copy that makes the unopened worlds feel intentionally unfinished rather than disabled by error.
- [x] **Step 4: Run the focused stage tests and confirm they pass.**

### Task 2: Add guardian asset mapping and foyer interaction state

**Files:**
- Modify: `src/app.js`
- Modify: `src/index.html`
- Modify: `server.js`

**Interfaces:**
- Adds a `FOYER_DOORS` data map containing id, guardian name, emotion, dialogue, and local asset path for all five doors.
- Adds `selectEmotionDoor(doorId)` for hover/focus feedback and `activateEmotionDoor(doorId)` for click behavior.

- [x] **Step 1: Add the five-door map and render helper using local `/assets/characters/guardians/final/...png` URLs.**
- [x] **Step 2: Bind pointerenter, focus, and click events to `.emotion-door`.**
- [x] **Step 3: Keep `overthinking` as the only navigable door; its activation calls `resetExpressionFlow()` then `goToScene('expression')`.**
- [x] **Step 4: Make unopened doors announce their status through the live region without navigation.**
- [x] **Step 5: Add static server routes for the seven guardian final images if the existing static allowlist does not already expose them.**
- [x] **Step 6: Run `node --check src/app.js`, `node --check server.js`, and focused tests.**

### Task 3: Replace foyer styling with watercolor five-door world

**Files:**
- Modify: `src/styles.css`

**Interfaces:**
- `.scene--foyer` becomes a full-bleed picture-book hall with responsive door hit zones.
- `.emotion-door` supports idle, hover/focus, selected, and unopened states.
- `.emotion-door-dialogue` supports guardian portrait, copy, and status without covering the primary door composition.

- [x] **Step 1: Use the approved scene background and warm paper/pastel palette.**
- [x] **Step 2: Add low-amplitude `door-breathe`, `guardian-float`, and `hall-light` animations.**
- [x] **Step 3: Add hover/focus selection with warm halo, local elevation, and a clear selected label for the leftmost inner-consumption door.**
- [x] **Step 4: Add unopened-door styling that is subdued but still readable.**
- [x] **Step 5: Add mobile fallback: stacked hit zones and dialogue panel without relying on exact desktop coordinates.**
- [x] **Step 6: Add reduced-motion overrides that remove animation and preserve selected-state contrast.**

### Task 4: Verify behavior and visual acceptance

**Files:**
- Modify: `tests/stage4.test.js` if browser contracts require final wording changes
- Modify: `tests/stage8-web-image.test.js` if asset route assertions require final paths

- [x] **Step 1: Run `npm test`.**
- [x] **Step 2: Run `npm run demo:check`.**
- [x] **Step 3: Open the local page and verify all five door hover/focus states.**
- [x] **Step 4: Verify non-inner doors never change `body[data-stage]` and show unopened copy.**
- [x] **Step 5: Verify clicking the leftmost inner-consumption door changes `body[data-stage]` to `expression`.**
- [x] **Step 6: Verify reduced-motion mode removes continuous motion and keeps the route usable.**

**Acceptance:** The foyer visually reads as five emotional worlds, the leftmost inner-consumption door is the only open path, every guardian has a product-consistent line, all five doors have subtle motion by default, and the current expression route remains intact.
