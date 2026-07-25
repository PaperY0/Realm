'use strict';

const { ExpressionSession } = require('./expression-session');

const OFFLINE_DEMO_SCENARIOS = Object.freeze({
  guided_expression: Object.freeze({
    id: 'guided_expression',
    label: '自然表达与一次跳过',
    expression: Object.freeze({
      mode: 'free_text',
      text: '有人给了我一句评价，我已经反复想了很久，像是它替我写好了名字。',
      conversationNeed: 'help_me_sort_it_out',
    }),
    followUps: Object.freeze([
      Object.freeze({
        id: 'demo-feared-meaning',
        target: 'feared_meaning',
        prompt: '那句话最让你担心的，是什么？',
        action: 'skip',
      }),
      Object.freeze({
        id: 'demo-desired-direction',
        target: 'desired_direction',
        prompt: '如果能把名字重新写一遍，你希望留下什么？',
        action: 'answer',
        answer: '我想留下自己的声音，而不是那句评价。',
      }),
    ]),
    brief: Object.freeze({
      schemaVersion: 'stage5-demo-v1',
      coreTension: '外部评价试图替旅人命名，旅人想重新取回自己的声音',
      feltPressure: '一句评价在心里持续回响',
      repeatedResponse: '反复回想并检查那句话是否代表真实的自己',
      fearedMeaning: '担心外部判断会成为固定身份',
      desiredDirection: '重新取得自我命名权',
      usableFacts: Object.freeze(['发生过一次持续影响旅人的外部评价']),
      boundaries: Object.freeze(['不编造评价者动机', '不复述现实身份信息', '不作诊断或关系裁决']),
      confirmedQuote: null,
    }),
  }),
  not_sure_how_to_say: Object.freeze({
    id: 'not_sure_how_to_say',
    label: '不知道怎么说与全部可跳过',
    expression: Object.freeze({
      mode: 'not_sure_how_to_say',
      text: '',
      conversationNeed: 'leave_it_here',
    }),
    followUps: Object.freeze([
      Object.freeze({
        id: 'demo-situation',
        target: 'situation',
        prompt: '如果只说一个画面，此刻最先浮起来的是什么？',
        action: 'skip',
      }),
    ]),
    brief: Object.freeze({
      schemaVersion: 'stage5-demo-v1',
      coreTension: '旅人暂时找不到合适的话，但愿意把这份停顿留在风铃边',
      feltPressure: '表达本身带来重量',
      repeatedResponse: '暂时停在不知道怎么说的位置',
      fearedMeaning: '不把沉默解释成任何人格或结论',
      desiredDirection: '允许故事从一段停顿开始',
      usableFacts: Object.freeze([]),
      boundaries: Object.freeze(['不补写用户没有提供的现实事件', '不把沉默解释为诊断或人格']),
      confirmedQuote: null,
    }),
  }),
});

function buildOfflineExpressionDemo(scenarioId = 'guided_expression') {
  const scenario = OFFLINE_DEMO_SCENARIOS[scenarioId];
  if (!scenario) throw new Error('Unknown offline demo scenario: ' + String(scenarioId));

  const session = new ExpressionSession({ conversationNeed: scenario.expression.conversationNeed });
  const states = [];
  const record = (event, extra = {}) => {
    states.push(Object.freeze({
      event,
      ...extra,
      state: Object.freeze(session.snapshot()),
    }));
  };

  session.submitExpression(scenario.expression);
  record('EXPRESSION_SUBMITTED');

  for (const followUp of scenario.followUps) {
    const presented = session.addFollowUp(followUp);
    record('FOLLOW_UP_PRESENTED', { followUp: Object.freeze(presented) });
    if (followUp.action === 'skip') {
      session.skipFollowUp(followUp.id);
      record('FOLLOW_UP_SKIPPED', { followUpId: followUp.id });
    } else {
      session.answerFollowUp(followUp.id, followUp.answer);
      record('FOLLOW_UP_ANSWERED', { followUpId: followUp.id });
    }
  }

  session.applySafetyDecision({ state: 'story_safe', reasonCode: 'story_route_allowed' });
  record('SAFETY_ROUTE_READY');
  const safeStoryBrief = session.finalizeSafeStoryBrief(scenario.brief);
  record('SAFE_STORY_BRIEF_READY', { safeStoryBrief });

  return Object.freeze({
    fixtureVersion: 'stage5-offline-demo-v1',
    scenario: Object.freeze({ id: scenario.id, label: scenario.label }),
    uiInput: Object.freeze({ ...scenario.expression }),
    states: Object.freeze(states),
    safeStoryBrief,
    storyTaskAllowed: session.canCreateStoryTask(),
  });
}

module.exports = {
  OFFLINE_DEMO_SCENARIOS,
  buildOfflineExpressionDemo,
};
