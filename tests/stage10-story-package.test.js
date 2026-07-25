'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const crypto = require('node:crypto');
const path = require('node:path');
const {
  FIXED_GATEKEEPER,
  StoryPackageValidationError,
  createStoryPackage,
  validateStoryPackage,
  assertStoryPackage,
} = require('../src/domain/story-package');
const {
  MIANMIAN_UNFINISHED_NAME_TEMPLATE,
} = require('../src/features/story/mianmian-unfinished-name-template');

const root = path.resolve(__dirname, '..');
const storySourcePaths = [
  path.join(root, 'src', 'domain', 'story-package.js'),
  path.join(root, 'src', 'features', 'story', 'mianmian-fallback.js'),
  path.join(root, 'src', 'features', 'story', 'mianmian-unfinished-name-template.js'),
];
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
assert.equal(typeof packageA.storyPrompt, 'string');
assert.ok(packageA.storyPrompt.length > 0);
assert.equal(packageA.chapterCards.filter((card) => card.userVisibleCopy.chapterText.length <= 120).length, 7);
assert.equal(packageA.chapterCards.filter((card) => typeof card.illustrationContract.promptContract?.imagePrompt === 'string'
  && card.illustrationContract.promptContract.imagePrompt.length > 0).length, 7);
assert.deepEqual(packageA.chapterCards.map((card) => card.identity.chapterNumber), [1, 2, 3, 4, 5, 6, 7]);
assert.deepEqual(packageA.chapterCards.map((card) => card.illustrationContract.illustrationId), ['I1', 'I2', 'I3', 'I4', 'I5', 'I6', 'I7']);
assert.ok(packageA.chapterCards.every((card) => card.userVisibleCopy.chapterText.includes('绾线')));
assert.equal(packageA.safeStoryBrief.userConfirmedSentence, null);
assert.equal(JSON.stringify(packageA).includes(rawSensitiveText), false);
assert.equal(Object.isFrozen(packageA), true);
assert.equal(Object.isFrozen(packageA.chapterCards), true);
assert.equal(Object.isFrozen(packageA.chapterCards[0].narrativeContract), true);
assert.equal(validateStoryPackage(packageA, { forbiddenSourceTexts: [rawSensitiveText] }).overallResult, 'pass');


// A sufficiently grounded brief keeps the existing echo route unchanged.
assert.equal(packageA.storyTemplateMatch.route, 'echo');
assert.equal(packageA.storyTemplateMatch.templateVersion, 'echo-controlled-v1');
assert.equal(Object.hasOwn(packageA.storyTemplateMatch, 'templateTitle'), false);
assert.ok(packageA.chapterCards.every((card) => !Object.hasOwn(card.narrativeContract, 'templateSpreadNumbers')));


// Two semantically different, sufficiently grounded briefs produce distinct echo stories.
// coreStruggle, desiredDirection, and symbolicPreference are mapped through controlled local motifs.
const restEchoBrief = validSafeStoryBrief({
  briefId: 'brief-stage10-echo-rest-moon-clock',
  coreTension: '总想把每件事做到完美，已经疲惫仍不敢停下来',
  coreStruggle: '总想把每件事做到完美，已经疲惫仍不敢停下来',
  desiredDirection: '希望允许自己休息、放慢速度，并为呼吸留白',
  emotionalDirection: '从被完美刻度追赶，走向能够在月光里放慢并照看自己的呼吸',
  symbolicPreference: '月亮和慢钟',
  storyUsableFacts: [
    '旅人会在任务完成后立刻寻找下一格刻度',
    '旅人已经感到疲惫，却仍担心休息等于不够努力',
    '旅人希望从一小段可以呼吸的留白开始',
  ],
  missingStoryInformation: [],
});
const connectionEchoBrief = validSafeStoryBrief({
  briefId: 'brief-stage10-echo-connection-paper-boat',
  situationCategory: '想表达真实感受与害怕被误解之间的拉扯',
  coreTension: '想向重要的朋友开口，却害怕被误解，所以总把话藏起来',
  coreStruggle: '想向重要的朋友开口，却害怕被误解，所以总把话藏起来',
  feltPressure: ['担心表达不够准确', '担心开口后产生更远的距离'],
  repeatedResponse: '把已经来到嘴边的话重新收回去',
  fearedMeaning: '害怕一次误解会被当作无法连接的证明',
  desiredDirection: '希望尝试诚实表达，让声音抵达并重新建立连接',
  emotionalDirection: '从把话藏进沉默，走向允许一句真实的话乘着纸船抵达',
  symbolicPreference: '纸船与回声河',
  storyUsableFacts: [
    '旅人已经多次想开口，却在最后一刻把话收回',
    '旅人担心表达会被误解',
    '旅人希望先尝试说出一句具体而真实的话',
  ],
  missingStoryInformation: [],
});
const restEchoPackage = createStoryPackage(restEchoBrief);
const connectionEchoPackage = createStoryPackage(connectionEchoBrief);
const restTitles = restEchoPackage.chapterCards.map((card) => card.userVisibleCopy.chapterTitle);
const connectionTitles = connectionEchoPackage.chapterCards.map((card) => card.userVisibleCopy.chapterTitle);
const restTexts = restEchoPackage.chapterCards.map((card) => card.userVisibleCopy.chapterText);
const connectionTexts = connectionEchoPackage.chapterCards.map((card) => card.userVisibleCopy.chapterText);

assert.equal(restEchoPackage.storyTemplateMatch.route, 'echo');
assert.equal(connectionEchoPackage.storyTemplateMatch.route, 'echo');
assert.equal(restTitles.length, 7);
assert.equal(connectionTitles.length, 7);
assert.equal(restTitles.filter((title, index) => title !== connectionTitles[index]).length, 7);
assert.equal(restTexts.filter((chapterText, index) => chapterText !== connectionTexts[index]).length, 7);
assert.notDeepEqual(restTexts, connectionTexts, 'different grounded briefs must not receive identical chapter copy');

const restTitleCopy = restTitles.join('\n');
const restChapterCopy = restTexts.join('\n');
assert.match(restTitleCopy, /过满的刻度/);
assert.match(restTitleCopy, /月亮慢钟/);
assert.match(restTitleCopy, /慢灯|呼吸/);
assert.match(restChapterCopy, /总想把每件事做到完美/);
assert.match(restChapterCopy, /允许自己休息、放慢速度/);
assert.match(restChapterCopy, /月亮慢钟|月光的慢钟/);

const connectionTitleCopy = connectionTitles.join('\n');
const connectionChapterCopy = connectionTexts.join('\n');
assert.match(connectionTitleCopy, /藏起的声音/);
assert.match(connectionTitleCopy, /纸船与回声河/);
assert.match(connectionTitleCopy, /让声音抵达|声音抵达/);
assert.match(connectionChapterCopy, /想向重要的朋友开口/);
assert.match(connectionChapterCopy, /诚实表达，让声音抵达/);
assert.match(connectionChapterCopy, /纸船|回声河/);
assert.equal(validateStoryPackage(restEchoPackage).overallResult, 'pass');
assert.equal(validateStoryPackage(connectionEchoPackage).overallResult, 'pass');

// The complete fallback source is preserved verbatim and mapped without dropping a spread.
assert.equal(MIANMIAN_UNFINISHED_NAME_TEMPLATE.title, '《绵绵和没有写完的名字》');
assert.equal(MIANMIAN_UNFINISHED_NAME_TEMPLATE.format, '标签卷｜绘本正文');
assert.equal(MIANMIAN_UNFINISHED_NAME_TEMPLATE.recommendedSpecification, '15个跨页，约30—32页。');
assert.equal(
  MIANMIAN_UNFINISHED_NAME_TEMPLATE.overallTone,
  '前半段温柔中逐渐压抑，高潮有风暴感，结尾不是“战胜评价”，而是重新拿回观看自己的权利。',
);
assert.equal(MIANMIAN_UNFINISHED_NAME_TEMPLATE.cover.title, '《绵绵和没有写完的名字》');
assert.equal(MIANMIAN_UNFINISHED_NAME_TEMPLATE.spreads.length, 16);
assert.deepEqual(
  MIANMIAN_UNFINISHED_NAME_TEMPLATE.spreads.map((spread) => spread.number),
  Array.from({ length: 16 }, (_item, index) => index + 1),
);
assert.deepEqual(
  MIANMIAN_UNFINISHED_NAME_TEMPLATE.spreads.map((spread) => spread.title),
  [
    '名字抽屉', '绵绵的抽屉', '无字纸签', '成为纸签上的绵绵',
    '被盖住的月亮', '一张很重的纸签', '请写一个好一点的我', '风来了',
    '黑纸签', '水里的月亮', '每张纸签只带走了一个瞬间', '黑纸签风筝',
    '重新整理名字抽屉', '你到底是怎样的羊？', '风可以改变方向', '没有写完的名字',
  ],
);
assert.match(MIANMIAN_UNFINISHED_NAME_TEMPLATE.cover.text, /黑纸签拼成的风筝/);
assert.match(MIANMIAN_UNFINISHED_NAME_TEMPLATE.backCover, /自己的名字，不必交给别人写完/);
assert.ok(MIANMIAN_UNFINISHED_NAME_TEMPLATE.spreads.every((spread) => (
  Array.isArray(spread.body)
  && spread.body.length > 0
  && spread.body.every((paragraph) => typeof paragraph === 'string' && paragraph.length > 0)
  && typeof spread.visualDirection === 'string'
  && spread.visualDirection.length > 0
)));
assert.deepEqual(
  Object.values(MIANMIAN_UNFINISHED_NAME_TEMPLATE.emotionalDesign).map((item) => item.title),
  ['不把负面标签当成唯一敌人', '不让绵绵突然变得自信', '黑纸签没有被毁掉'],
);
assert.deepEqual(MIANMIAN_UNFINISHED_NAME_TEMPLATE.coreLines, [
  '没有一张纸签，能写完一个人。',
  '别人看见的也许是真的，但从来不是全部。',
  '花了很久，绵绵才发现：那些写满自己的纸签，没有一张出自自己。',
  '她不再忙着证明别人看错了，只是把观看自己的位置，慢慢还给了自己。',
  '风可以改变方向，别人可以改变看法，而你仍有权决定，今天怎样称呼自己',
]);
assert.deepEqual(
  MIANMIAN_UNFINISHED_NAME_TEMPLATE.sevenChapterMapping.map((mapping) => mapping.spreadNumbers),
  [[1, 2], [3, 4, 5], [6, 7], [8, 9], [10, 11], [12, 13], [14, 15, 16]],
);
assert.equal(
  crypto.createHash('sha256')
    .update(JSON.stringify(MIANMIAN_UNFINISHED_NAME_TEMPLATE))
    .digest('hex'),
  '2e7f1e6248dcd37d803c0d02a4a794c9d45aa00c78165f2c8c7bcd68f37df2da',
  'the user-provided complete template must not be shortened or silently rewritten',
);

// Too little safe story information selects the template without inspecting raw expression text.
const insufficientBrief = validSafeStoryBrief({
  briefId: 'brief-stage10-insufficient-001',
  situationCategory: '一份尚未找到完整说法的生活压力',
  coreTension: '想让一份说不清的重量被温柔接住，又不希望它被擅自解释',
  feltPressure: ['一份仍在寻找合适表达方式的重量'],
  repeatedResponse: null,
  fearedMeaning: null,
  desiredDirection: '希望被温柔接住，同时保留还不能确定的部分',
  emotionalDirection: '从急于得到解释，走向允许未知被谨慎保留',
  storyUsableFacts: ['旅人带着一份尚未命名的重量来到门前'],
  missingStoryInformation: ['具体情境与压力来源', '这份压力最令人担心的意义'],
});
const fallbackPackage = createStoryPackage(insufficientBrief, { forbiddenSourceTexts: [rawSensitiveText] });
assert.equal(fallbackPackage.storyTemplateMatch.route, 'mianmian-labels-fallback');
assert.equal(fallbackPackage.storyTemplateMatch.templateVersion, 'mianmian-unfinished-name-v1');
assert.equal(fallbackPackage.storyTemplateMatch.templateTitle, '《绵绵和没有写完的名字》');
assert.equal(fallbackPackage.bookTitle, '《绵绵和没有写完的名字》');
assert.deepEqual(fallbackPackage.storyTemplateMatch.templateContent, MIANMIAN_UNFINISHED_NAME_TEMPLATE);
assert.equal(fallbackPackage.storyBible.protagonist.ipId, FIXED_GATEKEEPER.ipId);
assert.equal(fallbackPackage.storyBible.protagonist.visualReferenceSetId, FIXED_GATEKEEPER.visualReferenceSetId);
assert.equal(fallbackPackage.chapterCards.length, 7);
assert.deepEqual(
  fallbackPackage.chapterCards.map((card) => card.identity.chapterNumber),
  [1, 2, 3, 4, 5, 6, 7],
);
assert.deepEqual(
  fallbackPackage.chapterCards.map((card) => card.illustrationContract.illustrationId),
  ['I1', 'I2', 'I3', 'I4', 'I5', 'I6', 'I7'],
);
assert.deepEqual(
  fallbackPackage.chapterCards.flatMap((card) => card.narrativeContract.templateSpreadNumbers),
  Array.from({ length: 16 }, (_item, index) => index + 1),
);
assert.deepEqual(
  fallbackPackage.chapterCards.flatMap((card) => card.narrativeContract.templateSpreads),
  MIANMIAN_UNFINISHED_NAME_TEMPLATE.spreads,
);
assert.deepEqual(
  fallbackPackage.chapterCards.flatMap((card) => card.illustrationContract.templateVisualDirections)
    .map((item) => item.visualDirection),
  MIANMIAN_UNFINISHED_NAME_TEMPLATE.spreads.map((spread) => spread.visualDirection),
);
assert.ok(fallbackPackage.chapterCards.every((card) => card.userVisibleCopy.chapterText.includes('绾线')));
const fallbackCopy = fallbackPackage.chapterCards.map((card) => card.userVisibleCopy.chapterText).join('\n');
for (const spread of MIANMIAN_UNFINISHED_NAME_TEMPLATE.spreads) {
  assert.ok(fallbackCopy.includes(spread.title), `missing spread title: ${spread.title}`);
  for (const paragraph of spread.body) {
    assert.ok(fallbackCopy.includes(paragraph), `missing body from spread ${spread.number}`);
  }
}
for (const preservedBeat of ['名字抽屉', '无字纸签', '总让人失望', '黑纸签', '月亮', '风筝', '今天，我是正在过桥的绵绵', '没有一张纸签，能写完一个绵绵']) {
  assert.ok(fallbackCopy.includes(preservedBeat), preservedBeat);
}
assert.equal(JSON.stringify(fallbackPackage).includes(rawSensitiveText), false);
assert.equal(validateStoryPackage(fallbackPackage, { forbiddenSourceTexts: [rawSensitiveText] }).overallResult, 'pass');

// A single unresolved detail is allowed when enough safe facts remain, so the bespoke route is not replaced too eagerly.
const sufficientlyGroundedPackage = createStoryPackage(validSafeStoryBrief({
  briefId: 'brief-stage10-grounded-with-one-gap',
  storyUsableFacts: ['事实一', '事实二'],
  missingStoryInformation: ['一个仍需保留的未知'],
}));
assert.equal(sufficientlyGroundedPackage.storyTemplateMatch.route, 'echo');

// Each side of the OR threshold independently selects fallback; blank strings never count as facts.
const tooFewFactsPackage = createStoryPackage(validSafeStoryBrief({
  briefId: 'brief-stage10-too-few-facts',
  storyUsableFacts: ['唯一事实'],
  missingStoryInformation: [],
}));
assert.equal(tooFewFactsPackage.storyTemplateMatch.route, 'mianmian-labels-fallback');

const tooManyGapsPackage = createStoryPackage(validSafeStoryBrief({
  briefId: 'brief-stage10-too-many-gaps',
  storyUsableFacts: ['事实一', '事实二', '事实三'],
  missingStoryInformation: ['缺口一', '缺口二'],
}));
assert.equal(tooManyGapsPackage.storyTemplateMatch.route, 'mianmian-labels-fallback');

// The browser's 'I do not know how to say it' path deliberately has no desiredDirection.
// Insufficient input must still reach the complete fallback instead of being rejected.
const browserNotSurePackage = createStoryPackage(validSafeStoryBrief({
  briefId: 'brief-stage10-browser-not-sure',
  desiredDirection: null,
  storyUsableFacts: [
    '旅人带着一份尚未命名的重量来到门前',
    '故事必须保留未知，不替旅人补写原因、人物或结局',
  ],
  missingStoryInformation: ['具体情境与压力来源', '担心的意义', '希望靠近的方向'],
}));
assert.equal(browserNotSurePackage.storyTemplateMatch.route, 'mianmian-labels-fallback');
assert.equal(browserNotSurePackage.bookTitle, '《绵绵和没有写完的名字》');
assert.equal(browserNotSurePackage.chapterCards.length, 7);

const blankFactsPackage = createStoryPackage(validSafeStoryBrief({
  briefId: 'brief-stage10-blank-facts',
  storyUsableFacts: ['事实一', '   ', ''],
  missingStoryInformation: [],
}));
assert.equal(blankFactsPackage.storyTemplateMatch.route, 'mianmian-labels-fallback');

// Raw-input-shaped data is blocked rather than consumed by fallback selection or copied into a package.
assert.throws(
  () => createStoryPackage({
    ...insufficientBrief,
    rawInput: rawSensitiveText,
  }, { forbiddenSourceTexts: [rawSensitiveText] }),
  (error) => error instanceof StoryPackageValidationError
    && error.report.failedCheckIds.includes('semantic.raw_input_fields')
    && error.report.failedCheckIds.includes('semantic.source_text_leakage')
    && !error.message.includes(rawSensitiveText),
);

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

// Prompt metadata is structured and rejects arbitrary prompt-shaped fields.
const arbitraryPromptField = mutableCopy(packageA);
arbitraryPromptField.chapterCards[0].illustrationContract.promptContract.rawPrompt = '任意原文';
assertBlocked(arbitraryPromptField, 'structure.prompt_contract');

// Domain implementation stays offline and does not include paid/provider behavior.
for (const storySourcePath of storySourcePaths) {
  const source = fs.readFileSync(storySourcePath, 'utf8');
  assert.doesNotMatch(source, /\bfetch\s*\(|\bhttps?\b|openai|gpt-image|images\/generations|child_process/i, storySourcePath);
}

console.log('stage10 story package tests passed');
