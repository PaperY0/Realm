# Review package: Task 1

Base: `b5a3c6a`
Head: `d00c791`

## Commit

`d00c791 test: cover next illustration page back`

## Diff stat

`tests/stage13-web-storybook.test.js | 5 insertions`

## Diff

```diff
@@ -241,20 +241,25 @@
 // The turn layer is a two-sided paper sheet, isolated from ordinary page transforms.
+const animatePageTurn = functionSource(app, 'animatePageTurn');
+assert.match(animatePageTurn, /function\s+animatePageTurn\s*\(\s*direction\s*,\s*frontPage\s*,\s*backPage\s*\)/);
+assert.match(animatePageTurn, /makeFace\(frontPage,\s*'storybook-turn-sheet__front'\)/);
+assert.match(animatePageTurn, /makeFace\(backPage,\s*'storybook-turn-sheet__back'\)/);
+assert.doesNotMatch(animatePageTurn, /storybook-page--copy/);
 assert.match(css, /\.storybook-turn-sheet\s*\{/);
```
