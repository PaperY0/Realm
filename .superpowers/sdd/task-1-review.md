diff --git a/tests/stage18-expression-paper.test.js b/tests/stage18-expression-paper.test.js
index fe6295d..3beb345 100644
--- a/tests/stage18-expression-paper.test.js
+++ b/tests/stage18-expression-paper.test.js
@@ -16,8 +16,13 @@ assert.match(html, /原始文字只在当前页面临时处理/);
 
 const expressionScene = css.slice(css.lastIndexOf('/* Stage 18:'));
 assert.match(expressionScene, /body\[data-stage="expression"\] \.scene--expression\s*\{[\s\S]*?height:\s*100dvh[\s\S]*?overflow:\s*hidden/);
+assert.match(expressionScene, /body\[data-stage="expression"\] \.scene--expression\s*\{[\s\S]*?background:/);
+assert.match(expressionScene, /body\[data-stage="expression"\] \.scene--expression::before\s*\{/);
 assert.match(expressionScene, /body\[data-stage="expression"\] \.expression-paper\s*\{[\s\S]*?display:\s*grid[\s\S]*?grid-template-rows:/);
+assert.match(expressionScene, /body\[data-stage="expression"\] \.expression-paper::before\s*\{/);
+assert.match(expressionScene, /body\[data-stage="expression"\] \.expression-paper::after\s*\{/);
 assert.match(expressionScene, /body\[data-stage="expression"\] \.paper-sheet\s*\{[\s\S]*?display:\s*grid[\s\S]*?grid-template-columns:/);
+assert.match(expressionScene, /body\[data-stage="expression"\] \.paper-sheet::before\s*\{/);
 assert.match(expressionScene, /body\[data-stage="expression"\] \.expression-card--compose\s*,[\s\S]*?\.paper-generation-card\s*\{[\s\S]*?background:/);
 assert.match(expressionScene, /body\[data-stage="expression"\] \.expression-card--compose\s*\{[\s\S]*?overflow:\s*hidden/);
 assert.match(expressionScene, /font-size:\s*clamp\(/);
