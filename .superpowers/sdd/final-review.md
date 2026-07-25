diff --git a/src/styles.css b/src/styles.css
index fcb5ef1..35e11cb 100644
--- a/src/styles.css
+++ b/src/styles.css
@@ -4556,6 +4556,20 @@ body[data-stage="expression"] .paper-boat-sequence[data-paper-boat-state="error"
   }
 }
 
+body[data-stage="expression"] .scene--foyer {
+  display: none;
+}
+
+@media (max-width: 900px) {
+  body[data-stage="expression"] .world-footer {
+    display: none;
+  }
+
+  body[data-stage="expression"] #live-status {
+    top: 0;
+  }
+}
+
 @media (max-width: 820px) {
   body[data-stage="expression"] .scene--expression {
     height: 100dvh;
@@ -4571,3 +4585,99 @@ body[data-stage="expression"] .paper-boat-sequence[data-paper-boat-state="error"
     padding: 20px 16px;
   }
 }
+
+body[data-stage="expression"] .scene--expression {
+  background:
+    radial-gradient(ellipse at 18% 22%, rgba(255, 232, 154, .64) 0 12%, transparent 36%),
+    radial-gradient(ellipse at 82% 17%, rgba(235, 174, 177, .68) 0 14%, transparent 42%),
+    radial-gradient(ellipse at 52% 100%, rgba(232, 168, 124, .56) 0 18%, transparent 52%),
+    linear-gradient(145deg, #c4c8c7 0%, #8f7e9f 29%, #d48b92 57%, #f2bb78 82%, #e8dca4 100%);
+  isolation: isolate;
+}
+
+body[data-stage="expression"] .scene--expression::before {
+  content: "";
+  position: absolute;
+  inset: -12%;
+  z-index: -1;
+  pointer-events: none;
+  opacity: .4;
+  background:
+    repeating-linear-gradient(12deg, rgba(255,255,255,.08) 0 1px, transparent 1px 8px),
+    repeating-linear-gradient(102deg, rgba(68,48,79,.05) 0 2px, transparent 2px 13px);
+  filter: blur(.4px);
+  transform: rotate(-1.3deg) scale(1.06);
+}
+
+body[data-stage="expression"] .expression-paper {
+  position: relative;
+  overflow: visible;
+  transform: rotate(-.22deg);
+  background:
+    radial-gradient(ellipse at 88% 12%, rgba(255, 218, 147, .25), transparent 34%),
+    radial-gradient(ellipse at 6% 88%, rgba(218, 169, 147, .16), transparent 32%),
+    linear-gradient(98deg, #fff7d9, #fff3d0 49%, #fff9e7);
+  box-shadow: 18px 22px 0 rgba(95, 65, 86, .11), 0 18px 36px rgba(83, 58, 72, .18);
+}
+
+body[data-stage="expression"] .expression-paper::before {
+  content: "";
+  position: absolute;
+  inset: 13px 18px 16px 14px;
+  pointer-events: none;
+  border-radius: 2% 4% 3% 5%;
+  opacity: .72;
+  background:
+    repeating-linear-gradient(4deg, rgba(120, 91, 87, .045) 0 1px, transparent 1px 9px),
+    repeating-linear-gradient(94deg, rgba(255, 255, 255, .22) 0 1px, transparent 1px 17px);
+  mix-blend-mode: multiply;
+}
+
+body[data-stage="expression"] .expression-paper::after {
+  content: "";
+  position: absolute;
+  inset: 0;
+  pointer-events: none;
+  opacity: .6;
+  background:
+    linear-gradient(8deg, transparent 0 29%, rgba(191, 134, 115, .11) 29.2% 29.5%, transparent 30%),
+    linear-gradient(173deg, transparent 0 64%, rgba(124, 97, 116, .08) 64.2% 64.55%, transparent 65%),
+    radial-gradient(ellipse at 92% 76%, rgba(247, 201, 137, .22), transparent 30%);
+  clip-path: polygon(1% 0, 99% 1%, 100% 98%, 97% 100%, 3% 99%, 0 2%);
+}
+
+body[data-stage="expression"] .paper-sheet {
+  position: relative;
+  overflow: hidden;
+  background:
+    repeating-linear-gradient(0deg, rgba(121, 93, 86, .035) 0 1px, transparent 1px 12px),
+    linear-gradient(103deg, rgba(255, 255, 255, .22), transparent 22% 72%, rgba(231, 181, 132, .12)),
+    rgba(255, 249, 226, .76);
+}
+
+body[data-stage="expression"] .paper-sheet::before {
+  content: "";
+  position: absolute;
+  inset: 0;
+  pointer-events: none;
+  opacity: .55;
+  background:
+    linear-gradient(79deg, transparent 0 26%, rgba(152, 112, 103, .08) 26.2% 26.55%, transparent 27%),
+    linear-gradient(101deg, transparent 0 72%, rgba(255, 255, 255, .28) 72.2% 72.8%, transparent 73%),
+    radial-gradient(ellipse at 52% 51%, transparent 0 43%, rgba(177, 128, 122, .08) 63%, transparent 77%);
+  transform: rotate(.35deg) scale(1.04);
+}
+
+@media (max-width: 720px) {
+  body[data-stage="expression"] .scene--expression::before,
+  body[data-stage="expression"] .expression-paper::before,
+  body[data-stage="expression"] .paper-sheet::before {
+    opacity: .34;
+  }
+}
+
+@media (max-height: 800px) and (min-width: 821px) {
+  body[data-stage="expression"] .expression-paper {
+    transform: rotate(-.22deg) scale(0.9);
+  }
+}
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
