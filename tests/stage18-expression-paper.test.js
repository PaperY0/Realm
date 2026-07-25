const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const css = fs.readFileSync(path.join(root, 'src', 'styles.css'), 'utf8');
const html = fs.readFileSync(path.join(root, 'src', 'index.html'), 'utf8');

assert.match(html, /id="expression-paper"/);
assert.match(html, /class="paper-sheet"/);
assert.match(html, /class="expression-card expression-card--compose"/);
assert.match(html, /id="followup-panel"/);
assert.match(html, /id="brief-panel"/);
assert.match(html, /风铃入口 · 这封信从这里开始/);
assert.match(html, /原始文字只在当前页面临时处理/);

const expressionScene = css.slice(css.lastIndexOf('/* Stage 18:'));
assert.match(expressionScene, /body\[data-stage="expression"\] \.scene--expression\s*\{[\s\S]*?height:\s*100dvh[\s\S]*?overflow:\s*hidden/);
assert.match(expressionScene, /body\[data-stage="expression"\] \.scene--expression\s*\{[\s\S]*?background:/);
assert.match(expressionScene, /body\[data-stage="expression"\] \.scene--expression::before\s*\{/);
assert.match(expressionScene, /body\[data-stage="expression"\] \.expression-paper\s*\{[\s\S]*?display:\s*grid[\s\S]*?grid-template-rows:/);
assert.match(expressionScene, /body\[data-stage="expression"\] \.expression-paper\s*\{[\s\S]*?width:\s*min\(1080px/);
assert.match(expressionScene, /body\[data-stage="expression"\] \.expression-paper\s*\{[\s\S]*?height:\s*min\(676px/);
assert.match(expressionScene, /body\[data-stage="expression"\] \.expression-paper\s*\{[\s\S]*?clip-path:\s*polygon/);
assert.match(expressionScene, /body\[data-stage="expression"\] \.scene--expression\s*\{[\s\S]*?url\(['"]?\/assets\/expression-watercolor-wash\.png/);
assert.match(expressionScene, /body\[data-stage="expression"\] \.expression-paper::before\s*\{/);
assert.match(expressionScene, /body\[data-stage="expression"\] \.expression-paper::after\s*\{/);
assert.match(expressionScene, /body\[data-stage="expression"\] \.paper-sheet\s*\{[\s\S]*?display:\s*grid[\s\S]*?grid-template-columns:/);
assert.match(expressionScene, /body\[data-stage="expression"\] \.paper-sheet::before\s*\{/);
assert.match(expressionScene, /body\[data-stage="expression"\] \.expression-card--compose\s*,[\s\S]*?\.paper-generation-card\s*\{[\s\S]*?background:/);
assert.match(expressionScene, /body\[data-stage="expression"\] \.expression-card--compose\s*\{[\s\S]*?overflow:\s*hidden/);
assert.match(expressionScene, /font-size:\s*clamp\(/);
assert.match(expressionScene, /transform:\s*scale\(/);
assert.doesNotMatch(expressionScene, /body\[data-stage="expression"\][^{}]*\{[^}]*overflow-y:\s*auto/);
assert.match(css, /body\[data-stage="expression"\] \.paper-boat-sequence\s*\{[\s\S]*?display:\s*none;/);
assert.match(css, /body\[data-stage="expression"\] \.paper-generation-card\s*\{[\s\S]*?display:\s*none\s*!important/);
assert.match(expressionScene, /body\[data-stage="expression"\] \.expression-primary,[\s\S]*?body\[data-stage="expression"\] \.expression-quiet\s*\{[\s\S]*?border-radius:/);
assert.match(expressionScene, /@media \(max-height:\s*800px\) and \(min-width:\s*821px\)/);

console.log('stage18 expression paper tests passed');
