'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'src/index.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'src/app.js'), 'utf8');

assert.match(html, /data-generation-stage="prompting"/);
assert.match(html, /data-generation-stage="writing"/);
assert.match(html, /data-generation-stage="image-prompting"/);
assert.match(html, /data-generation-stage="illustrating"/);
assert.match(html, /id="generation-prompt-details"/);
assert.match(html, /id="chapter-generation-status"/);
assert.match(app, /function setStoryGenerationStage\(stage/);
assert.match(app, /function renderStoryChapter\(\{ animate = false \} = \{\}\)/);
assert.match(app, /storybook-turn-sheet__front/);
assert.match(app, /storybook-turn-sheet__back/);
assert.match(app, /storybook-turn-shadow/);

console.log('stage16 prompt workflow tests passed');
