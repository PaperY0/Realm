# 纸船入湖表达页 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将风铃表达页改成单张卡通纸张叙事，并在生成故事前完成“纸张折成纸船、绾线放入故事湖、陪伴等待”的完整过渡。

**Architecture:** 保留现有表达、安全故事线和故事包 API，只替换表达页的视觉容器与生成前状态机。输入、追问和安全摘要继续共用一张纸；点击生成后切换为折纸动画和故事湖等待层，真实请求结束后进入七章绘本或回到可操作错误态。

**Tech Stack:** 原生 HTML、CSS 动画、浏览器 JavaScript、现有 Node 测试与本地服务。

## Global Constraints

- 表达页不显示左上角项目名称和右上角“减少动态”控件，但继续尊重系统与已有 `body.reduce-motion` 状态。
- 角色名称统一为“绾线”，不得再以“理线”作为该角色的页面称呼。
- 不展示右半边 `generation-card`；生成状态改为纸船与故事湖场景。
- 原始表达仍只在当前页面临时处理，安全拦截和 SafeStoryBrief 流程不改变。
- 动画遵循 `assets/bible/STYLE-BIBLE.md`：平面手绘为主、极浅纸层、低速微动、单一情绪焦点。

---

### Task 1: 重组表达页 DOM 与绾线文案

**Files:** `src/index.html`, `tests/stage4.test.js`, `tests/stage8-web-image.test.js`

- [ ] 新增单张 `expression-paper` 容器，移除右侧生成卡的视觉依赖。
- [ ] 新增 `paper-boat-sequence`、`story-lake-wait` 与绾线陪伴文案节点。
- [ ] 移除表达页可见品牌和动态控件的页面呈现契约。
- [ ] 将表达页中的角色称呼统一为“绾线”。

### Task 2: 接入纸张折叠、纸船入湖与真实生成状态

**Files:** `src/app.js`

- [ ] 增加 `setPaperBoatState(state)`，覆盖 `idle / folding / floating / error`。
- [ ] `requestStoryPackage()` 请求开始时先进入折纸状态，再显示故事湖等待状态。
- [ ] 使用真实请求状态更新等待文案，成功后进入七章绘本，失败后回到安全故事线。
- [ ] 在所有新文案、live region 和状态提示中使用“绾线”。

### Task 3: 实现新画风与等待动画

**Files:** `src/styles.css`

- [ ] 用暖白卡通纸张、彩铅折痕、轻微纸边和水彩留白替换双栏卡片视觉。
- [ ] 实现低幅度折纸、纸船漂浮、水面涟漪与绾线陪伴动画。
- [ ] 删除/覆盖右侧生成卡布局，保持移动端单列纸张可用。
- [ ] 增加 reduced-motion 覆盖，停止持续动画但保留状态与文案。

### Task 4: 验收

**Files:** `tests/stage4.test.js`, `tests/stage8-web-image.test.js`

- [ ] 运行 `npm test`。
- [ ] 运行 `npm run demo:check`。
- [ ] 浏览器验证无品牌/动态控件、单纸张布局、绾线文案、折纸/入湖等待和失败回退。
