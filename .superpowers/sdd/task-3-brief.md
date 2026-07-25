# Task 3: 浏览器验收桌面与窄屏

Read this brief as the exact requirements for Task 3.

Use the existing local app at `http://localhost:3000/`. Do not modify HTML or JavaScript. Inspect and, only if browser evidence proves clipping or unreadable contrast, modify `C:/Users/wsy19/Desktop/Realm/src/styles.css` with the smallest expression-scoped fix. Do not alter other scenes or interaction behavior.

Enter the expression scene through the UI: brand entry -> door -> inner-door/emotion choice. Verify at desktop 1280x720:

```js
({
  stage: document.body.dataset.stage,
  htmlScroll: [document.documentElement.scrollHeight, document.documentElement.clientHeight],
  bodyScroll: [document.body.scrollHeight, document.body.clientHeight],
  paper: document.querySelector('#expression-paper').getBoundingClientRect().toJSON(),
  paperBackground: getComputedStyle(document.querySelector('#expression-paper')).backgroundImage,
  sceneBackground: getComputedStyle(document.querySelector('.scene--expression')).backgroundImage
})
```

Expected: `stage === "expression"`; HTML and body scroll heights equal their client heights; paper rect is inside the viewport; both background images are non-empty.

Verify at 390x844 (or an equivalent narrow viewport) that `document.documentElement.scrollWidth - document.documentElement.clientWidth === 0`, the paper remains visible, and no text is covered by pseudo-elements. Also verify that the hidden `#paper-boat-sequence` and `#generation-card` remain hidden.

Run `npm.cmd test`, `node --check src/app.js`, and `git diff --check`. If a CSS fix is necessary, commit only that CSS fix. Write `.superpowers/sdd/task-3-report.md` with browser metrics, commands and outputs, commit hash if any, and concerns. Return only status, one-line browser summary, test summary, commit hash if any, and concerns.
