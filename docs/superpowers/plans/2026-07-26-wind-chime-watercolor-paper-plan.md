# 风铃入口手绘水彩纸张视觉改造 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 只改造表达页，使其拥有手绘水彩背景、带褶皱和颗粒的信纸质感，同时保持一屏布局与现有交互。

**Architecture:** 仅在 `src/styles.css` 的表达页作用域内增加视觉层。使用伪元素和 CSS 渐变生成背景晕染、纸张纤维、折痕和不规则边缘，避免新增大体积图片资源；HTML 与 JavaScript 交互保持不变。

**Tech Stack:** 原生 HTML、CSS、JavaScript、Node.js 静态测试、浏览器验收。

## Global Constraints

- 只改造 `.scene--expression`，其他场景保持现状。
- 不修改表达提交、追问、寄出信件和隐藏生成流程的行为。
- 不恢复纸船等待动画或生成过程卡片。
- 表达页在 1280×720 下不产生页面滚动。
- 不新增大体积背景图片依赖。

---

### Task 1: 建立表达页视觉回归测试

**Files:**
- Modify: `C:/Users/wsy19/Desktop/Realm/tests/stage18-expression-paper.test.js`
- Test: `C:/Users/wsy19/Desktop/Realm/tests/stage18-expression-paper.test.js`

**Interfaces:**
- Consumes: `src/styles.css` 中的表达页选择器。
- Produces: 对水彩背景、纸张褶皱伪元素和纹理层的静态约束。

- [ ] **Step 1: 在现有测试末尾增加失败断言**

```js
assert.match(expressionScene, /body\[data-stage="expression"\] \.scene--expression\s*\{[\s\S]*?background:/);
assert.match(expressionScene, /body\[data-stage="expression"\] \.scene--expression::before\s*\{/);
assert.match(expressionScene, /body\[data-stage="expression"\] \.expression-paper::before\s*\{/);
assert.match(expressionScene, /body\[data-stage="expression"\] \.expression-paper::after\s*\{/);
assert.match(expressionScene, /body\[data-stage="expression"\] \.paper-sheet::before\s*\{/);
```

- [ ] **Step 2: 运行测试确认新断言失败**

Run: `node tests/stage18-expression-paper.test.js`

Expected: FAIL，因为当前 CSS 没有完整的表达页水彩与纸张伪元素约束。

### Task 2: 实现水彩背景与纸张褶皱纹理

**Files:**
- Modify: `C:/Users/wsy19/Desktop/Realm/src/styles.css:1538-1600, 4300-4550`

**Interfaces:**
- Consumes: 现有 `body[data-stage="expression"]` 作用域、`.expression-paper`、`.paper-sheet` 和现有媒体查询。
- Produces: 表达页专属的水彩背景、纸张纤维、褶皱和不规则边缘层。

- [ ] **Step 1: 为表达页背景增加水彩底色和伪元素**

```css
body[data-stage="expression"] .scene--expression {
  background:
    radial-gradient(ellipse at 18% 22%, rgba(255, 232, 154, .64) 0 12%, transparent 36%),
    radial-gradient(ellipse at 82% 17%, rgba(235, 174, 177, .68) 0 14%, transparent 42%),
    radial-gradient(ellipse at 52% 100%, rgba(232, 168, 124, .56) 0 18%, transparent 52%),
    linear-gradient(145deg, #c4c8c7 0%, #8f7e9f 29%, #d48b92 57%, #f2bb78 82%, #e8dca4 100%);
  isolation: isolate;
}

body[data-stage="expression"] .scene--expression::before {
  content: "";
  position: absolute;
  inset: -12%;
  z-index: -1;
  pointer-events: none;
  opacity: .4;
  background:
    repeating-linear-gradient(12deg, rgba(255,255,255,.08) 0 1px, transparent 1px 8px),
    repeating-linear-gradient(102deg, rgba(68,48,79,.05) 0 2px, transparent 2px 13px);
  filter: blur(.4px);
  transform: rotate(-1.3deg) scale(1.06);
}
```

- [ ] **Step 2: 为表达页纸张增加纤维层和不规则晕染**

```css
body[data-stage="expression"] .expression-paper {
  position: relative;
  overflow: visible;
  transform: rotate(-.22deg);
  background:
    radial-gradient(ellipse at 88% 12%, rgba(255, 218, 147, .25), transparent 34%),
    radial-gradient(ellipse at 6% 88%, rgba(218, 169, 147, .16), transparent 32%),
    linear-gradient(98deg, #fff7d9, #fff3d0 49%, #fff9e7);
  box-shadow: 18px 22px 0 rgba(95, 65, 86, .11), 0 18px 36px rgba(83, 58, 72, .18);
}

body[data-stage="expression"] .expression-paper::before {
  content: "";
  position: absolute;
  inset: 13px 18px 16px 14px;
  pointer-events: none;
  border-radius: 2% 4% 3% 5%;
  opacity: .72;
  background:
    repeating-linear-gradient(4deg, rgba(120, 91, 87, .045) 0 1px, transparent 1px 9px),
    repeating-linear-gradient(94deg, rgba(255, 255, 255, .22) 0 1px, transparent 1px 17px);
  mix-blend-mode: multiply;
}

body[data-stage="expression"] .expression-paper::after {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: .6;
  background:
    linear-gradient(8deg, transparent 0 29%, rgba(191, 134, 115, .11) 29.2% 29.5%, transparent 30%),
    linear-gradient(173deg, transparent 0 64%, rgba(124, 97, 116, .08) 64.2% 64.55%, transparent 65%),
    radial-gradient(ellipse at 92% 76%, rgba(247, 201, 137, .22), transparent 30%);
  clip-path: polygon(1% 0, 99% 1%, 100% 98%, 97% 100%, 3% 99%, 0 2%);
}
```

- [ ] **Step 3: 为内层纸张增加折痕和纤维纹理**

```css
body[data-stage="expression"] .paper-sheet {
  position: relative;
  overflow: hidden;
  background:
    repeating-linear-gradient(0deg, rgba(121, 93, 86, .035) 0 1px, transparent 1px 12px),
    linear-gradient(103deg, rgba(255, 255, 255, .22), transparent 22% 72%, rgba(231, 181, 132, .12)),
    rgba(255, 249, 226, .76);
}

body[data-stage="expression"] .paper-sheet::before {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: .55;
  background:
    linear-gradient(79deg, transparent 0 26%, rgba(152, 112, 103, .08) 26.2% 26.55%, transparent 27%),
    linear-gradient(101deg, transparent 0 72%, rgba(255, 255, 255, .28) 72.2% 72.8%, transparent 73%),
    radial-gradient(ellipse at 52% 51%, transparent 0 43%, rgba(177, 128, 122, .08) 63%, transparent 77%);
  transform: rotate(.35deg) scale(1.04);
}
```

- [ ] **Step 4: 增加窄屏下的纹理降级**

```css
@media (max-width: 720px) {
  body[data-stage="expression"] .scene--expression::before,
  body[data-stage="expression"] .expression-paper::before,
  body[data-stage="expression"] .paper-sheet::before {
    opacity: .34;
  }
}
```

- [ ] **Step 5: 运行静态测试确认通过**

Run: `node tests/stage18-expression-paper.test.js`

Expected: PASS。

### Task 3: 浏览器验收桌面与窄屏

**Files:**
- Modify: `C:/Users/wsy19/Desktop/Realm/src/styles.css` only if browser evidence shows clipping or unreadable contrast.

**Interfaces:**
- Consumes: Task 2 的表达页视觉层。
- Produces: 依据浏览器证据完成局部 CSS 修正，并记录桌面与窄屏验收结果。

- [ ] **Step 1: 启动或复用本地开发服务并进入表达页**

Open: `http://localhost:3000/`

操作路径：品牌入口 → 大门 → 内耗风铃，进入 `body[data-stage="expression"]`。

- [ ] **Step 2: 读取桌面验收指标**

```js
({
  stage: document.body.dataset.stage,
  htmlScroll: [document.documentElement.scrollHeight, document.documentElement.clientHeight],
  bodyScroll: [document.body.scrollHeight, document.body.clientHeight],
  paper: document.querySelector('#expression-paper').getBoundingClientRect().toJSON()
})
```

Expected: `stage === "expression"`，两个滚动高度数组的值分别相等，纸张矩形位于视口内。

- [ ] **Step 3: 设置窄屏视口并检查横向溢出**

使用 390×844 视口检查：

```js
({
  viewport: [innerWidth, innerHeight],
  overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  paperOverflow: getComputedStyle(document.querySelector('#expression-paper')).overflow
})
```

Expected: 横向溢出为 `0`，纸张仍可见，纹理不遮挡文字。

- [ ] **Step 4: 运行全量验证**

Run: `npm.cmd test; node --check src/app.js; git diff --check`

Expected: 所有 stage tests passed，语法检查通过，diff 无空白错误。
