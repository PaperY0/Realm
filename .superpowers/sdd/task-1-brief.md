# Task 1: 建立表达页视觉回归测试

Read this brief as the exact requirements for Task 1.

Files:
- Modify: `C:/Users/wsy19/Desktop/Realm/tests/stage18-expression-paper.test.js`

Add these static assertions to the existing test:

```js
assert.match(expressionScene, /body\[data-stage="expression"\] \.scene--expression\s*\{[\s\S]*?background:/);
assert.match(expressionScene, /body\[data-stage="expression"\] \.scene--expression::before\s*\{/);
assert.match(expressionScene, /body\[data-stage="expression"\] \.expression-paper::before\s*\{/);
assert.match(expressionScene, /body\[data-stage="expression"\] \.expression-paper::after\s*\{/);
assert.match(expressionScene, /body\[data-stage="expression"\] \.paper-sheet::before\s*\{/);
```

Run `node tests/stage18-expression-paper.test.js` before implementation to confirm the new assertions fail, then implement only the test changes and run it again. Do not modify CSS in this task. Commit the test change. Write a report to `.superpowers/sdd/task-1-report.md` containing the commit hash, exact commands and outputs, and any concerns. Return only status, commit, and one-line test summary.
