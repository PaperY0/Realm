'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  FIXED_GATEKEEPER,
  StoryPackageValidationError,
  createStoryPackage,
  validateStoryPackage,
  assertStoryPackage,
} = require('../src/domain/story-package');

const root = path.resolve(__dirname, '..');
const sourcePath = path.join(root, 'src', 'domain', 'story-package.js');
const rawSensitiveText = '原始敏感原话-不要让这句话进入冻结故事包';

function validSafeStoryBrief(overrides = {}) {
  return {
    schemaVersion: 'stage8-web-v2',
    briefId: 'brief-stage10-echo-001',
    safetyStatus: 'story_safe',
    sessionNeed: null,
    situationCategory: '持续努力、自我要求与休息需要之间的拉扯',
    coreTension: '已经感到疲惫，却担心停下来会证明自己不够好',
    feltPressure: ['持续要求自己再多做一点', '难以允许自己在疲惫时停下'],
    repeatedResponse: '在感到压力时仍继续要求自己向前并反复确认',
    fearedMeaning: '担心停下或做得不完美会带来否定性的意义',
    desiredDirection: '希望获得一点允许自己放慢脚步和喘息的空间',
    emotionalDirection: '从被无尽刻度催促，走向允许自己在灯光里停留和喘息片刻',
    storyUsableFacts: [
      '旅人背着一只会随自我要求增加重量的行囊',
      '旅人已经疲惫，却仍难以允许自己停下',
    ],
    factsNotToInvent: ['具体人物身份与关系', '未说明的现实事件与结局'],
    prohibitedInterpretations: ['不得作心理诊断', '不得断言他人动机'],
    userConfirmedSentence: null,
    missingStoryInformation: [],
    ...overrides,
  };
}

function mutableCopy(value) {
  return structuredClone(value);
}

function assertBlocked(packageValue, expectedCheckId, options = {}) {
  const report = validateStoryPackage(packageValue, options);
  assert.equal(report.overallResult, 'blocked');
  assert.ok(report.failedCheckIds.includes(expectedCheckId), JSON.stringify(report.failedCheckIds));
  assert.throws(
    () => assertStoryPackage(packageValue, options),
    (error) => error instanceof StoryPackageValidationError
      && error.report.failedCheckIds.includes(expectedCheckId),
  );
}

// Legal input produces one deterministic, deeply frozen, schema-shaped seven-chapter package.
const brief = validSafeStoryBrief();
const packageA = createStoryPackage(brief, { forbiddenSourceTexts: [rawSensitiveText] });
const packageB = createStoryPackage(brief, { forbiddenSourceTexts: [rawSensitiveText] });
assert.deepEqual(packageA, packageB, 'same SafeStoryBrief must produce the same controlled StoryPackage');
assert.equal(packageA.frozen, true);
assert.equal(packageA.storyTemplateMatch.route, 'echo');
assert.equal(packageA.storyBible.protagonist.ipId, FIXED_GATEKEEPER.ipId);
assert.equal(packageA.storyBible.protagonist.visualReferenceSetId, FIXED_GATEKEEPER.visualReferenceSetId);
assert.equal(packageA.chapterCards.length, 7);
assert.equal(packageA.chapterIllustrationPlan.illustrations.length, 7);
assert.deepEqual(packageA.chapterCards.map((card) => card.identity.chapterNumber), [1, 2, 3, 4, 5, 6, 7]);
assert.deepEqual(packageA.chapterCards.map((card) => card.illustrationContract.illustrationId), ['I1', 'I2', 'I3', 'I4', 'I5', 'I6', 'I7']);
assert.ok(packageA.chapterCards.every((card) => card.userVisibleCopy.chapterText.includes('理线')));
assert.equal(packageA.safeStoryBrief.userConfirmedSentence, null);
assert.equal(JSON.stringify(packageA).includes(rawSensitiveText), false);
assert.equal(Object.isFrozen(packageA), true);
assert.equal(Object.isFrozen(packageA.chapterCards), true);
assert.equal(Object.isFrozen(packageA.chapterCards[0].narrativeContract), true);
assert.equal(validateStoryPackage(packageA, { forbiddenSourceTexts: [rawSensitiveText] }).overallResult, 'pass');

// Every chapter begins from the exact state produced by its predecessor.
for (let index = 1; index < packageA.chapterCards.length; index += 1) {
  const previous = packageA.chapterCards[index - 1];
  const current = packageA.chapterCards[index];
  assert.equal(current.narrativeContract.startState, previous.narrativeContract.endState);
  assert.match(current.illustrationContract.continuityFromPrevious, new RegExp('^' + previous.identity.chapterId + ':'));
}
assert.equal(packageA.chapterCards[0].illustrationContract.continuityFromPrevious, null);
assert.equal(packageA.chapterCards[6].illustrationContract.continuityToNext, null);

// Missing chapter is a hard structural rejection.
const missingChapter = mutableCopy(packageA);
missingChapter.chapterCards.pop();
assertBlocked(missingChapter, 'structure.chapter_count');

// Duplicate chapter identity/number is rejected even when array length remains seven.
const duplicateChapter = mutableCopy(packageA);
duplicateChapter.chapterCards[6].identity.chapterNumber = 6;
duplicateChapter.chapterCards[6].identity.chapterId = duplicateChapter.chapterCards[5].identity.chapterId;
assertBlocked(duplicateChapter, 'structure.chapter_sequence');

// Broken cross-artifact references are rejected before any media work can start.
const brokenReference = mutableCopy(packageA);
brokenReference.chapterCards[2].identity.illustrationPlanId = 'plan-from-another-book';
assertBlocked(brokenReference, 'structure.cross_references');

// Verbatim sensitive source text is never reported back and blocks the semantic gate.
const leakedSource = mutableCopy(packageA);
leakedSource.chapterCards[3].userVisibleCopy.chapterText = rawSensitiveText;
const leakedReport = validateStoryPackage(leakedSource, { forbiddenSourceTexts: [rawSensitiveText] });
assert.equal(leakedReport.overallResult, 'blocked');
assert.ok(leakedReport.failedCheckIds.includes('semantic.source_text_leakage'));
assert.equal(JSON.stringify(leakedReport).includes(rawSensitiveText), false, 'validation reports must not echo leaked source text');
assert.throws(
  () => assertStoryPackage(leakedSource, { forbiddenSourceTexts: [rawSensitiveText] }),
  (error) => error instanceof StoryPackageValidationError
    && error.report.failedCheckIds.includes('semantic.source_text_leakage')
    && !error.message.includes(rawSensitiveText),
);

// Raw-input-shaped fields are rejected independently of their value.
const rawFieldLeak = mutableCopy(packageA);
rawFieldLeak.chapterCards[0].rawInput = '任意原文';
assertBlocked(rawFieldLeak, 'semantic.raw_input_fields');

// Domain implementation stays offline and does not include paid/provider behavior.
const source = fs.readFileSync(sourcePath, 'utf8');
assert.doesNotMatch(source, /\bfetch\s*\(|\bhttps?\b|openai|gpt-image|images\/generations|child_process/i);

console.log('stage10 story package tests passed');
