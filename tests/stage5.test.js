'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  ExpressionSession,
  MAX_EXPRESSION_LENGTH,
  MAX_FOLLOW_UPS,
  CONVERSATION_NEEDS,
  SAFETY_STATES,
  validateMainlandResourcePack,
} = require('../src/features/expression');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(
  path.join(root, 'src', 'features', 'expression', 'expression-session.js'),
  'utf8',
);

function safeBrief(overrides = {}) {
  return {
    schemaVersion: 'stage5-v1',
    coreTension: '一件外部评价与自我命名之间的拉扯',
    feltPressure: '担心自己的努力仍然不够',
    repeatedResponse: '反复回想当时的话',
    fearedMeaning: '害怕一次评价会替自己下定义',
    desiredDirection: '希望重新拿回对自己的命名权',
    usableFacts: ['发生过一次令人难以消化的评价'],
    boundaries: ['不编造现实人物动机', '不作诊断或现实关系裁决'],
    confirmedQuote: null,
    ...overrides,
  };
}

function verifiedResourcePack(overrides = {}) {
  return {
    region: 'CN-mainland',
    status: 'verified',
    verifiedAt: '2026-07-01',
    expiresAt: '2026-08-01',
    scopeNote: '仅用于已人工核验的中国大陆演示范围。',
    resources: [
      {
        id: 'fixture-resource',
        label: '人工核验资源占位项',
        contact: '由部署时核验资源包提供',
        availability: '以核验来源为准',
        sourceName: 'Stage 5 测试资源包',
      },
    ],
    ...overrides,
  };
}

// The domain vocabulary describes workflow state, never a clinical/personality label.
assert.deepEqual(SAFETY_STATES, ['story_safe', 'safety_check_required', 'crisis_route']);
assert.doesNotMatch(source, /(?:low|medium|high)[_-]?risk|diagnos(?:is|e)|personality[_-]?(?:type|judgment)/i);
assert.deepEqual(CONVERSATION_NEEDS, [
  'stay_with_me',
  'help_me_sort_it_out',
  'give_me_courage',
  'leave_it_here',
]);

// Free expression: empty input is rejected, exact boundary is accepted, overlong input is rejected.
const empty = new ExpressionSession();
assert.throws(() => empty.submitExpression({ mode: 'free_text', text: ' \n\t ' }), /cannot be empty/);

const boundary = new ExpressionSession({ conversationNeed: 'help_me_sort_it_out' });
boundary.submitExpression({ mode: 'free_text', text: '字'.repeat(MAX_EXPRESSION_LENGTH) });
assert.equal(boundary.snapshot().hasTransientRawInput, true);
assert.equal(boundary.readTransientForSafety().rawExpression.length, MAX_EXPRESSION_LENGTH);
assert.doesNotMatch(JSON.stringify(boundary), /字{20}/, 'serialization must not expose raw expression');

const overlong = new ExpressionSession();
assert.throws(
  () => overlong.submitExpression({ mode: 'free_text', text: '字'.repeat(MAX_EXPRESSION_LENGTH + 1) }),
  /exceeds maximum length/,
);

// “I do not know how to say it” is a first-class path and does not fabricate placeholder raw text.
const notSure = new ExpressionSession();
notSure.submitExpression({ mode: 'not_sure_how_to_say', conversationNeed: null });
assert.deepEqual(notSure.readTransientForSafety(), {
  expressionMode: 'not_sure_how_to_say',
  rawExpression: null,
  followUpAnswers: [],
});
assert.throws(
  () => new ExpressionSession().submitExpression({ mode: 'not_sure_how_to_say', text: '不要藏在模式里' }),
  /must not include free text/,
);

// Guard IP can ask at most two skippable, single-target questions.
const followUps = new ExpressionSession({ conversationNeed: 'stay_with_me' });
followUps.submitExpression({ mode: 'free_text', text: '我总在想一句别人说过的话。' });
followUps.addFollowUp({
  id: 'meaning',
  target: 'feared_meaning',
  prompt: '那句话最让你担心的，是什么？',
});
followUps.skipFollowUp('meaning');
followUps.addFollowUp({
  id: 'direction',
  target: 'desired_direction',
  prompt: '如果风能带走一点重量，你希望留下什么？',
});
followUps.answerFollowUp('direction', '我想把自己的声音留下来。');
assert.equal(followUps.snapshot().followUpCount, MAX_FOLLOW_UPS);
assert.deepEqual(followUps.snapshot().followUps.map((item) => item.status), ['skipped', 'answered']);
assert.throws(() => followUps.addFollowUp({
  id: 'third',
  target: 'situation',
  prompt: '还发生了什么？',
}), /Follow-up limit reached/);

const multiQuestion = new ExpressionSession();
multiQuestion.submitExpression({ mode: 'not_sure_how_to_say' });
assert.throws(() => multiQuestion.addFollowUp({
  id: 'too-many',
  target: 'situation',
  prompt: '发生了什么？你当时怎么想？',
}), /only one question/);

// A direct safety confirmation can pause the story path without describing the user.
followUps.applySafetyDecision({
  state: 'safety_check_required',
  reasonCode: 'direct_confirmation_required',
});
assert.equal(followUps.snapshot().status, 'awaiting_direct_confirmation');
assert.equal(followUps.canCreateStoryTask(), false);
assert.throws(() => followUps.assertCanCreateStoryTask(), /not allowed/);

// Normal input is scrubbed immediately after a minimal SafeStoryBrief is formed.
followUps.applySafetyDecision({
  state: 'story_safe',
  reasonCode: 'story_route_allowed',
});
const brief = followUps.finalizeSafeStoryBrief(safeBrief());
assert.equal(brief.conversationNeed, 'stay_with_me');
assert.equal(brief.safetyState, 'story_safe');
assert.equal(followUps.snapshot().hasTransientRawInput, false);
assert.equal(followUps.snapshot().safeStoryBriefReady, true);
assert.equal(followUps.canCreateStoryTask(), true);
assert.equal(followUps.assertCanCreateStoryTask(), true);
assert.throws(() => followUps.readTransientForSafety(), /already finalized/);
assert.doesNotMatch(JSON.stringify(followUps), /别人说过的话|自己的声音/);
assert.throws(
  () => new ExpressionSession().finalizeSafeStoryBrief(safeBrief()),
  /story_safe decision/,
);

// SafeStoryBrief is an allowlisted abstraction, not a conversation dump or route result.
const invalidBriefSession = new ExpressionSession();
invalidBriefSession.submitExpression({ mode: 'free_text', text: '仅在内存里的原话' });
invalidBriefSession.applySafetyDecision({ state: 'story_safe', reasonCode: 'story_route_allowed' });
assert.throws(
  () => invalidBriefSession.finalizeSafeStoryBrief(safeBrief({ originalText: '不应出现' })),
  /unsupported field: originalText/,
);
assert.equal(invalidBriefSession.snapshot().hasTransientRawInput, true, 'failed abstraction keeps input only in ephemeral memory for correction');

// Crisis route requires a currently verified mainland resource pack, scrubs input, and blocks all story work.
const crisis = new ExpressionSession({ conversationNeed: 'give_me_courage' });
crisis.submitExpression({ mode: 'free_text', text: '危机原文只可短暂存在。' });
crisis.addFollowUp({ id: 'confirm', target: 'situation', prompt: '你此刻是否处在紧迫危险中？' });
crisis.answerFollowUp('confirm', '需要直接安全确认的原话。');
crisis.applySafetyDecision({
  state: 'crisis_route',
  reasonCode: 'current_danger_not_ruled_out',
  resourcePack: verifiedResourcePack(),
  now: new Date('2026-07-25T00:00:00.000Z'),
});
assert.equal(crisis.snapshot().hasTransientRawInput, false);
assert.equal(crisis.snapshot().storyGenerationAllowed, false);
assert.equal(crisis.canCreateStoryTask(), false);
assert.throws(() => crisis.assertCanCreateStoryTask(), /not allowed/);
assert.throws(() => crisis.readTransientForSafety(), /crisis_route/);
assert.doesNotMatch(JSON.stringify(crisis), /危机原文|安全确认的原话/);
const crisisView = crisis.getCrisisViewModel();
assert.equal(crisisView.region, 'CN-mainland');
assert.deepEqual(crisisView.actions, ['return_to_world', 'leave']);
assert.deepEqual(crisisView.generationActions, []);
assert.equal(crisisView.resources.length, 1);

assert.throws(() => validateMainlandResourcePack(
  verifiedResourcePack({ expiresAt: '2026-07-24' }),
  new Date('2026-07-25T00:00:00.000Z'),
), /expired/);
assert.throws(() => validateMainlandResourcePack(
  verifiedResourcePack({ region: 'global' }),
  new Date('2026-07-25T00:00:00.000Z'),
), /CN-mainland/);

const invalidCrisisPack = new ExpressionSession();
invalidCrisisPack.submitExpression({ mode: 'free_text', text: '即使资源包过期也必须立刻清除的危机原文。' });
assert.throws(() => invalidCrisisPack.applySafetyDecision({
  state: 'crisis_route',
  reasonCode: 'current_danger_confirmed',
  resourcePack: verifiedResourcePack({ expiresAt: '2026-07-24' }),
  now: new Date('2026-07-25T00:00:00.000Z'),
}), /expired/);
assert.equal(invalidCrisisPack.snapshot().status, 'crisis_route');
assert.equal(invalidCrisisPack.snapshot().hasTransientRawInput, false);
assert.equal(invalidCrisisPack.canCreateStoryTask(), false);
assert.doesNotMatch(JSON.stringify(invalidCrisisPack), /危机原文/);

// Timeout and failure are recoverable, sanitized, and never echo the expression into errors.
for (const kind of ['timeout', 'failure']) {
  const failed = new ExpressionSession();
  const secret = '不应出现在错误页或日志中的原始内容-' + kind;
  failed.submitExpression({ mode: 'free_text', text: secret });
  const publicError = failed.recordProcessingFailure(kind);
  assert.equal(publicError.retryable, true);
  assert.doesNotMatch(JSON.stringify(publicError), new RegExp(secret));
  assert.equal(failed.snapshot().storyGenerationAllowed, false);
  assert.equal(failed.snapshot().hasTransientRawInput, true);
  failed.resumeAfterFailure();
  assert.equal(failed.snapshot().status, 'awaiting_safety_decision');
}

// Leaving midway clears all ephemeral expression data and prevents further work.
const exited = new ExpressionSession({ conversationNeed: 'leave_it_here' });
exited.submitExpression({ mode: 'free_text', text: '离开后必须消失的内容。' });
exited.addFollowUp({ id: 'optional', target: 'felt_pressure', prompt: '哪一部分最沉？' });
exited.answerFollowUp('optional', '这也是临时内容。');
exited.exit();
assert.equal(exited.snapshot().status, 'exited');
assert.equal(exited.snapshot().hasTransientRawInput, false);
assert.equal(exited.canCreateStoryTask(), false);
assert.doesNotMatch(JSON.stringify(exited), /离开后必须消失|临时内容/);
assert.throws(() => exited.submitExpression({ mode: 'free_text', text: '不能继续' }), /has ended/);

// Offline deterministic fixtures can drive a UI without API, database, filesystem, clocks, or randomness.
{
  const {
    buildOfflineExpressionDemo,
    OFFLINE_DEMO_SCENARIOS,
  } = require('../src/features/expression');
  assert.deepEqual(Object.keys(OFFLINE_DEMO_SCENARIOS), ['guided_expression', 'not_sure_how_to_say']);

  const first = buildOfflineExpressionDemo('guided_expression');
  const second = buildOfflineExpressionDemo('guided_expression');
  assert.deepEqual(first, second, 'offline demo output must be deterministic');
  assert.equal(first.fixtureVersion, 'stage5-offline-demo-v1');
  assert.equal(first.storyTaskAllowed, true);
  assert.deepEqual(first.states.map((item) => item.event), [
    'EXPRESSION_SUBMITTED',
    'FOLLOW_UP_PRESENTED',
    'FOLLOW_UP_SKIPPED',
    'FOLLOW_UP_PRESENTED',
    'FOLLOW_UP_ANSWERED',
    'SAFETY_ROUTE_READY',
    'SAFE_STORY_BRIEF_READY',
  ]);
  assert.equal(first.states.at(-1).state.hasTransientRawInput, false);
  assert.equal(first.states.at(-1).state.storyGenerationAllowed, true);

  const notSureDemo = buildOfflineExpressionDemo('not_sure_how_to_say');
  assert.equal(notSureDemo.uiInput.mode, 'not_sure_how_to_say');
  assert.equal(notSureDemo.states.at(-1).state.hasTransientRawInput, false);
  assert.equal(notSureDemo.storyTaskAllowed, true);

  const offlineDemoSource = fs.readFileSync(
    path.join(root, 'src', 'features', 'expression', 'offline-demo.js'),
    'utf8',
  );
  assert.doesNotMatch(offlineDemoSource, /\bfetch\s*\(|https?:\/\/|node:(?:http|https|fs)|sqlite|Math\.random|Date\.now/);
  assert.throws(() => buildOfflineExpressionDemo('missing'), /Unknown offline demo scenario/);
}

console.log('stage5 tests passed');
