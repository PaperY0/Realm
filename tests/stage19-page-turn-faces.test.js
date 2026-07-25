'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'src', 'app.js'), 'utf8');

function functionSource(source, name) {
  const declaration = new RegExp(`(?:async\\s+)?function\\s+${name}\\s*\\(`);
  const match = declaration.exec(source);
  assert.ok(match, `${name} must exist`);
  const rest = source.slice(match.index + match[0].length);
  const next = /\n(?:async\s+)?function\s+[A-Za-z_$][\w$]*\s*\(/.exec(rest);
  return source.slice(match.index, next ? match.index + match[0].length + next.index : source.length);
}

function balancedBlock(source, marker) {
  const markerIndex = source.indexOf(marker);
  assert.ok(markerIndex >= 0, `must include ${marker}`);
  const openIndex = source.indexOf('{', markerIndex);
  assert.ok(openIndex >= 0, `${marker} must open a block`);
  let depth = 0;
  for (let index = openIndex; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(markerIndex, index + 1);
    }
  }
  assert.fail(`${marker} block must be balanced`);
}

const renderChapter = functionSource(app, 'renderStoryChapter');
const temporaryFaces = balancedBlock(renderChapter, 'if (animate)');

assert.match(
  temporaryFaces,
  /storybookBook\.querySelector\(\s*['"]\.storybook-page--illustration['"]\s*\)/,
  'the temporary turn faces must start from the illustration page',
);
assert.match(
  temporaryFaces,
  /turnFrontPage\s*=\s*illustrationPage\?\.cloneNode\(\s*true\s*\)/,
  'the outgoing illustration must be cloned into the front face',
);
assert.match(
  temporaryFaces,
  /turnBackPage\s*=\s*illustrationPage\?\.cloneNode\(\s*true\s*\)/,
  'the incoming illustration must be cloned separately into the back face',
);
assert.match(
  temporaryFaces,
  /turnBackPage\?\.querySelector\(\s*['"]\.storybook-illustration-state['"]\s*\)/,
  'the incoming illustration state must belong to the back face',
);
assert.match(
  temporaryFaces,
  /renderStoryIllustration\(\s*storyPackage\s*,\s*snapshot\s*,\s*card\s*,\s*turnIllustrationState\s*\)/,
  'the incoming snapshot and card must render into the back-face illustration state',
);
assert.doesNotMatch(
  temporaryFaces,
  /\.storybook-page--copy/,
  'temporary turn faces must not use the copy page',
);

const animationCall = /animatePageTurn\(\s*animate\s*,\s*turnFrontPage\s*,\s*turnBackPage\s*\)/.exec(renderChapter);
assert.ok(animationCall, 'the page turn must receive front then back illustration faces');
const renderBackIndex = renderChapter.indexOf('renderStoryIllustration(storyPackage, snapshot, card, turnIllustrationState)');
assert.ok(renderBackIndex >= 0 && renderBackIndex < animationCall.index, 'the back face must render before the page-turn animation starts');

console.log('stage19 page-turn face wiring tests passed');
