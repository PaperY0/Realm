'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { spawnSync } = require('node:child_process');
const { validateSafeStoryBrief } = require('../src/services/image-generation');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'src', 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'src', 'app.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'src', 'styles.css'), 'utf8');
const schema = JSON.parse(fs.readFileSync(path.join(root, 'docs', 'schemas', 'safe-story-brief.schema.json'), 'utf8'));

function sourceBetween(source, startText, endText) {
  const start = source.indexOf(startText);
  const end = source.indexOf(endText, start);
  assert.ok(start >= 0 && end > start, startText + ' source range must exist');
  return source.slice(start, end);
}

// Approved scenes remain present; this step only replaces the expression placeholder.
assert.match(html, /src="\/assets\/world-gate-reference\.png"/);
assert.match(html, /id="door-handle"/);
assert.match(html, /id="traveler-form"/);
assert.match(html, /id="inner-door"/);

// Required Web-only live-generation controls and copy.
assert.match(html, /我总担心自己做得不够好，明明很累，却还是不敢停下来。/);
assert.match(html, /id="expression-text"[^>]*maxlength="800"/);
assert.match(html, /id="expression-not-sure"[^>]*>我还不知道怎么说</);
assert.match(html, /id="followup-skip"/);
assert.match(html, /id="generate-story"[^>]*>把它写成童话</);
assert.match(html, /真实 AI · gpt-image-2/);
assert.match(html, /正在整理故事线/);
assert.match(html, /正在调色/);
assert.match(html, /gpt-image-2 正在绘制/);
assert.match(html, /真实生成未完成/);
assert.match(html, /没有用预制图片替代这次结果/);
assert.doesNotMatch(html, /retry-generation|重新请求真实生成/);
assert.match(html, /不会在页面内重试/);
const imageTag = html.match(/<img id="generated-image"[^>]*>/)?.[0] || '';
assert.ok(imageTag && !/\ssrc=/.test(imageTag), 'result image must start without a placeholder src');

// Only the safe brief is sent, and transient user text is cleared before fetch.
const requestSource = sourceBetween(app, 'async function requestRealImage()', '\nfunction bindPressFeedback');
assert.match(requestSource, /fetch\('\/api\/images\/generate'/);
assert.match(requestSource, /JSON\.stringify\(\{ safeStoryBrief: state\.expression\.safeBrief \}\)/);
assert.doesNotMatch(requestSource, /rawText\s*:/);
assert.ok(requestSource.indexOf('clearTransientExpression()') < requestSource.indexOf("fetch('/api/images/generate'"));
const finishSource = sourceBetween(app, 'function finishExpressionBrief()', '\nfunction updateGenerationProgress');
assert.match(finishSource, /clearTransientExpression\(\)/);
assert.doesNotMatch(app, /safeStorageSet\([^\n]*(expression|brief|raw)/i);
assert.match(app, /url\.origin !== window\.location\.origin/);
assert.match(app, /url\.pathname\.startsWith\('\/runtime\/generated\/'\)/);
assert.match(app, /generatedImage\.removeAttribute\('src'\)/);
assert.match(requestSource, /state\.expression\.generationAttempted/);
assert.match(requestSource, /generateStory\.disabled = true/);
assert.doesNotMatch(app, /retryGeneration/);

// Evaluate the pure Stage 8 logic in isolation.
const constants = sourceBetween(app, 'const DEMO_SENTENCE', '\nconst state =');
const pureFunctions = sourceBetween(app, 'function normalizeExpression', '\nfunction clearProgressTimers');
const context = {
  window: { crypto: { randomUUID: () => 'stage8-test-id' } },
  Date,
  Math,
  Set,
  String,
};
vm.createContext(context);
vm.runInContext(constants + '\n' + pureFunctions + '\nthis.logic = { DEMO_SENTENCE, FOLLOW_UPS, assessExpressionSafety, classifyExpressionTheme, createSafeStoryBrief, normalizeExpression };', context);
const logic = context.logic;

assert.equal(logic.FOLLOW_UPS.length, 2);
for (const followUp of logic.FOLLOW_UPS) {
  assert.equal((followUp.prompt.match(/[？?]/g) || []).length, 1, followUp.prompt);
}

const brief = logic.createSafeStoryBrief({
  mode: 'free_text',
  rawText: logic.DEMO_SENTENCE,
  followUpAnswers: [
    { target: 'fearedMeaning', status: 'answered', value: '会觉得自己不够好' },
    { target: 'desiredDirection', status: 'skipped', value: null },
  ],
});
assert.deepEqual(Object.keys(brief).sort(), Object.keys(schema.properties).sort());
assert.equal(brief.safetyStatus, 'story_safe');
assert.equal(brief.sessionNeed, null);
assert.ok(Array.isArray(brief.feltPressure) && brief.feltPressure.length > 0);
assert.ok(Array.isArray(brief.storyUsableFacts) && brief.storyUsableFacts.length > 0);
assert.ok(Array.isArray(brief.prohibitedInterpretations) && brief.prohibitedInterpretations.length > 0);
assert.equal(brief.fearedMeaning, '担心一次停顿或不完美会被理解为对自身价值的否定');
assert.equal(brief.desiredDirection, null);
assert.ok(brief.missingStoryInformation.includes('旅人此刻最希望靠近的方向'));
assert.equal(JSON.stringify(brief).includes(logic.DEMO_SENTENCE), false);
assert.equal(JSON.stringify(brief).includes('会觉得自己不够好'), false);

const notSureBrief = logic.createSafeStoryBrief({ mode: 'not_sure_how_to_say', rawText: null, followUpAnswers: [] });
assert.equal(notSureBrief.safetyStatus, 'story_safe');
assert.equal(notSureBrief.repeatedResponse, null);
assert.ok(notSureBrief.missingStoryInformation.includes('具体情境与压力来源'));

validateSafeStoryBrief(brief);
validateSafeStoryBrief(notSureBrief);

const griefBrief = logic.createSafeStoryBrief({
  mode: 'free_text',
  rawText: '我很想念去世的奶奶，希望留住和她的回忆。',
  followUpAnswers: [],
});
assert.equal(griefBrief.situationCategory, '面对重要关系的失去与记忆保存');
assert.match(griefBrief.coreTension, /思念|记忆/);
assert.doesNotMatch(griefBrief.coreTension, /不够好|被标准追赶/);
assert.equal(griefBrief.desiredDirection, '希望以温柔而不失真的方式保存重要记忆');
assert.equal(JSON.stringify(griefBrief).includes('奶奶'), false);
validateSafeStoryBrief(griefBrief);

const answerSensitiveBrief = logic.createSafeStoryBrief({
  mode: 'free_text',
  rawText: '我正在经历一段告别。',
  followUpAnswers: [
    { target: 'fearedMeaning', status: 'answered', value: '我怕以后会忘记那些回忆' },
    { target: 'desiredDirection', status: 'answered', value: '我想用一种方式好好纪念' },
  ],
});
assert.equal(answerSensitiveBrief.fearedMeaning, '担心重要的连接或记忆会随着时间变淡');
assert.equal(answerSensitiveBrief.desiredDirection, '希望以温柔而不失真的方式保存重要记忆');
assert.equal(JSON.stringify(answerSensitiveBrief).includes('我怕以后'), false);
validateSafeStoryBrief(answerSensitiveBrief);

assert.equal(logic.assessExpressionSafety('我想伤害自己。').safe, false);
assert.throws(
  () => logic.createSafeStoryBrief({ mode: 'free_text', rawText: '我想伤害自己。', followUpAnswers: [] }),
  /unsafe_expression/,
);
assert.match(app, /function blockUnsafeExpression\(\)/);
assert.match(app, /当前不会发送到图像服务/);
assert.match(requestSource, /safeBrief\.safetyStatus !== 'story_safe'/);

// Apple-style feedback is local to the newly introduced controls.
assert.match(app, /expressionPressTargets\.forEach\(bindPressFeedback\)/);
assert.match(app, /element\.addEventListener\('pointerdown'/);
assert.match(css, /\.expression-action\.is-pressed\s*\{[^}]*scale\(0\.97\)/s);
assert.match(css, /cubic-bezier\(0\.2, 1\.42, 0\.32, 1\)/);
assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.expression-action[\s\S]*?transform: none !important/);
assert.doesNotMatch(app, /bindPressFeedback\(doorHandle\)/);

// Explicit desktop-height compaction covers the 1366x768 demo target; fluid grid covers 1920x1080.
assert.match(css, /grid-template-columns: minmax\(0, 1\.08fr\) minmax\(390px, 0\.82fr\)/);
assert.match(css, /@media \(max-height: 800px\) and \(min-width: 821px\)/);
assert.match(css, /max-height: calc\(100dvh - 128px\)/);

const syntax = spawnSync(process.execPath, ['--check', path.join(root, 'src', 'app.js')], { encoding: 'utf8' });
assert.equal(syntax.status, 0, syntax.stderr || syntax.stdout);
console.log('stage8 web image tests passed');
