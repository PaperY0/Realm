'use strict';

const STORYBOOK_STORAGE_KEY = 'dream-book-world.storybook.v0';
const STORYBOOK_PAGE_TURN_MS = 840;
const SCENE_ORDER = ['door', 'foyer', 'expression', 'storybook'];
const SCENE_LABELS = {
  door: '世界大门',
  foyer: '内耗之门',
  expression: '风铃入口',
  storybook: '七章绘本',
};
const DEMO_SENTENCE = '我总担心自己做得不够好，明明很累，却还是不敢停下来。';
const MAX_EXPRESSION_LENGTH = 800;
const FOLLOW_UPS = [
  {
    id: 'feared-meaning',
    target: 'fearedMeaning',
    prompt: '这份重量最让你担心的，是什么？',
  },
  {
    id: 'desired-direction',
    target: 'desiredDirection',
    prompt: '如果风能替你留下一点空间，你希望故事朝哪里走？',
  },
];
const FOYER_DOORS = Object.freeze({
  overthinking: Object.freeze({
    guardian: '绾线',
    emotion: '内耗',
    asset: '/assets/guardians/wanxian.png',
    dialogue: '先别急着把自己理顺，线头已经在这里了。',
    status: '点击内耗之门，进入风铃入口。',
    open: true,
  }),
  sadness: Object.freeze({
    guardian: '听雨',
    emotion: '悲伤',
    asset: '/assets/guardians/tingyu.png',
    dialogue: '我听见一滴雨落下来了，但这扇门还在学习怎样接住它。',
    status: '这个故事世界还在慢慢长成，先把它留在门后。',
    open: false,
  }),
  anxiety: Object.freeze({
    guardian: '息摆',
    emotion: '焦虑',
    asset: '/assets/guardians/xibai.png',
    dialogue: '先跟我一起慢一点。这里的钟摆，还没有准备好替你停下。',
    status: '这个故事世界还在慢慢长成，先把它留在门后。',
    open: false,
  }),
  anger: Object.freeze({
    guardian: '藏烬',
    emotion: '愤怒',
    asset: '/assets/guardians/cangjin.png',
    dialogue: '火没有错，只是这扇门还在学着把热量留在安全的灯里。',
    status: '这个故事世界还在慢慢长成，先把它留在门后。',
    open: false,
  }),
  joy: Object.freeze({
    guardian: '铃芽',
    emotion: '喜悦',
    asset: '/assets/guardians/lingya.png',
    dialogue: '我把一颗小种子留在门边，等它长出愿意分享的声音。',
    status: '这个故事世界还在慢慢长成，先把它留在门后。',
    open: false,
  }),
});

const state = {
  scene: 'door',
  doorOpened: false,
  foyerDoor: 'overthinking',
  expression: {
    mode: null,
    rawText: null,
    followUpIndex: 0,
    followUpAnswers: [],
    safeBrief: null,
    generating: false,
    generationAttempted: false,
    requestToken: 0,
    requestController: null,
    progressTimers: [],
  },
  storybook: {
    storyPackage: null,
    reader: null,
    loading: false,
    requestToken: 0,
    requestController: null,
    turning: false,
    turnTimer: null,
    illustrationTimer: null,
  },
  paperBoat: {
    state: 'idle',
    transitionTimer: null,
    voyageCopyIndex: -1,
    voyageCopyListener: null,
  },
};

const scenes = Array.from(document.querySelectorAll('[data-scene]'));
const body = document.body;
const brandHome = document.querySelector('#brand-home');
const doorScene = document.querySelector('[data-scene="door"]');
const doorHandle = document.querySelector('#door-handle');
const worldEntryVideo = document.querySelector('#world-entry-video');
const emotionDoorButtons = Array.from(document.querySelectorAll('[data-emotion-door]'));
const emotionDoorGuardian = document.querySelector('#emotion-door-guardian');
const emotionDoorEmotion = document.querySelector('#emotion-door-emotion');
const emotionDoorCopy = document.querySelector('#emotion-door-copy');
const emotionDoorStatus = document.querySelector('#emotion-door-status');
const restartDemo = document.querySelector('#restart-demo');
const journeyProgress = document.querySelector('#journey-progress');
const liveStatus = document.querySelector('#live-status');
const privacyNote = document.querySelector('.privacy-note');
const demoSentence = document.querySelector('#demo-sentence');
const expressionEntry = document.querySelector('#expression-entry');
const expressionForm = document.querySelector('#expression-form');
const expressionText = document.querySelector('#expression-text');
const expressionCount = document.querySelector('#expression-count');
const expressionInlineError = document.querySelector('#expression-inline-error');
const expressionNotSure = document.querySelector('#expression-not-sure');
const followupPanel = document.querySelector('#followup-panel');
const followupStep = document.querySelector('#followup-step');
const followupQuestion = document.querySelector('#followup-question');
const followupAnswer = document.querySelector('#followup-answer');
const followupSubmit = document.querySelector('#followup-submit');
const followupSkip = document.querySelector('#followup-skip');
const briefPanel = document.querySelector('#brief-panel');
const safeSummary = document.querySelector('#safe-summary');
const generateStory = document.querySelector('#generate-story');
const generateImage = document.querySelector('#generate-image');
const newExpression = document.querySelector('#new-expression');
const generationCard = document.querySelector('#generation-card');
const generationIdle = document.querySelector('#generation-idle');
const generationProgress = document.querySelector('#generation-progress');
const generationStatus = document.querySelector('#generation-status');
const generationError = document.querySelector('#generation-error');
const generationErrorMessage = document.querySelector('#generation-error-message');
const generatedFigure = document.querySelector('#generated-figure');
const generatedImage = document.querySelector('#generated-image');
const generatedCaption = document.querySelector('#generated-caption');
const generationSteps = Array.from(document.querySelectorAll('[data-generation-stage]'));
const generationPromptDetails = document.querySelector('#generation-prompt-details');
const storyPromptPreview = document.querySelector('#story-prompt-preview');
const chapterGenerationStatus = document.querySelector('#chapter-generation-status');
const paperBoatSequence = document.querySelector('#paper-boat-sequence');
const paperBoatVideo = document.querySelector('#paper-boat-video');
const paperBoatVoyageMessage = document.querySelector('#paper-boat-voyage-message');
const paperBoatStatus = document.querySelector('#paper-boat-status');
const paperBoatRetry = document.querySelector('#paper-boat-retry');
const paperBoatFoldEyebrow = document.querySelector('.paper-boat-fold-copy__eyebrow');
const paperBoatFoldTitle = document.querySelector('#paper-boat-fold-title');
const paperBoatFoldCopy = document.querySelector('#paper-boat-fold-copy');
const expressionPressTargets = Array.from(document.querySelectorAll('.expression-action'));
const storybookTitle = document.querySelector('#storybook-title');
const brandTitle = document.querySelector('#brand-home strong');
const storybookCoverTitle = document.querySelector('#storybook-cover-title');
const storybookStatus = document.querySelector('#storybook-status');
const storybookBook = document.querySelector('#storybook-book');
const storybookChapterKicker = document.querySelector('#storybook-chapter-kicker');
const storybookChapterTitle = document.querySelector('#storybook-chapter-title');
const storybookChapterText = document.querySelector('#storybook-chapter-text');
const storybookIllustrationState = document.querySelector('#storybook-illustration-state');
const storybookPrevious = document.querySelector('#storybook-prev');
const storybookNext = document.querySelector('#storybook-next');
const storybookClose = document.querySelector('#storybook-close');
const storybookReopen = document.querySelector('#storybook-reopen');
const storybookArchive = document.querySelector('#storybook-archive');
const storybookArchiveNote = document.querySelector('#storybook-archive-note');
const storybookReturn = document.querySelector('#storybook-return');
const storybookProgress = document.querySelector('#storybook-progress');
const storybookKeepsake = document.querySelector('#storybook-keepsake');
const storybookPressTargets = [storybookPrevious, storybookNext, storybookClose, storybookReopen, storybookArchive, storybookReturn].filter(Boolean);

function safeStorageGet(key) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeStorageSet(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // The journey remains usable when storage is unavailable.
  }
}

function announce(message) {
  liveStatus.textContent = '';
  window.setTimeout(() => {
    liveStatus.textContent = message;
  }, 20);
}

function selectEmotionDoor(doorId) {
  const door = FOYER_DOORS[doorId] || FOYER_DOORS.overthinking;
  state.foyerDoor = doorId in FOYER_DOORS ? doorId : 'overthinking';
  emotionDoorButtons.forEach((button) => {
    const isSelected = button.dataset.emotionDoor === state.foyerDoor;
    button.classList.toggle('is-selected', isSelected);
    button.setAttribute('aria-pressed', String(isSelected));
  });
  emotionDoorGuardian.src = door.asset;
  emotionDoorGuardian.alt = door.guardian;
  emotionDoorEmotion.textContent = door.emotion + ' · ' + door.guardian;
  emotionDoorCopy.textContent = door.dialogue;
  emotionDoorStatus.textContent = door.status;
}

function activateEmotionDoor(doorId) {
  const door = FOYER_DOORS[doorId];
  if (!door) return;
  selectEmotionDoor(doorId);
  if (!door.open) {
    announce(door.status);
    return;
  }
  resetExpressionFlow();
  goToScene('expression');
}

function goToScene(sceneName, { focus = true } = {}) {
  if (!SCENE_ORDER.includes(sceneName)) return;
  state.scene = sceneName;
  body.dataset.stage = sceneName;

  scenes.forEach((scene) => {
    const isActive = scene.dataset.scene === sceneName;
    scene.classList.toggle('is-active', isActive);
    scene.setAttribute('aria-hidden', String(!isActive));
  });

  const sceneNumber = SCENE_ORDER.indexOf(sceneName) + 1;
  journeyProgress.textContent = sceneNumber + ' / ' + SCENE_ORDER.length + ' · ' + SCENE_LABELS[sceneName];
  announce('已进入' + SCENE_LABELS[sceneName]);

  if (focus) {
    const heading = document.querySelector('[data-scene="' + sceneName + '"] h1, [data-scene="' + sceneName + '"] h2');
    if (heading) {
      heading.setAttribute('tabindex', '-1');
      window.setTimeout(() => heading.focus({ preventScroll: true }), 350);
    }
  }
}

function finishOpeningDoor() {
  if (state.doorOpened) return;
  state.doorOpened = true;
  doorScene.classList.add('is-playing');
  doorHandle.disabled = true;
  announce('世界大门正在打开');
  const playPromise = worldEntryVideo.play();
  if (playPromise?.catch) playPromise.catch(() => completeWorldEntry());
}

function completeWorldEntry() {
  if (doorScene.classList.contains('is-transitioning')) return;
  doorScene.classList.add('is-transitioning');
  window.setTimeout(() => goToScene('foyer'), 900);
}

function normalizeExpression(value, maximum = MAX_EXPRESSION_LENGTH) {
  return String(value || '').replace(/\r\n?/g, '\n').trim().slice(0, maximum);
}

function createBriefId() {
  if (window.crypto?.randomUUID) return 'brief-' + window.crypto.randomUUID();
  return 'brief-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

function assessExpressionSafety(rawText, followUpAnswers = []) {
  const answerText = followUpAnswers
    .filter((answer) => answer?.status === 'answered' && answer.value)
    .map((answer) => normalizeExpression(answer.value, 240))
    .join('\n');
  const combined = [normalizeExpression(rawText), answerText].filter(Boolean).join('\n');
  const immediateRiskPattern = /(?:自杀|想死|不想活|结束生命|轻生|伤害自己|割腕|跳楼|上吊|服毒|伤害他人|杀死|杀了|弄死|同归于尽)/i;
  return Object.freeze({
    safe: !immediateRiskPattern.test(combined),
    code: immediateRiskPattern.test(combined) ? 'immediate_safety_risk' : 'story_safe',
  });
}

function classifyExpressionTheme(text) {
  const value = normalizeExpression(text);
  if (/去世|离世|逝去|过世|失去.{0,6}(?:亲人|家人|朋友|爱人)|想念.{0,8}(?:奶奶|爷爷|外婆|外公|亲人|家人|朋友)|告别|怀念/.test(value)) return 'grief_memory';
  if (/不够好|很累|疲惫|不敢停|停下来|完美|失败|落后|必须|应该/.test(value)) return 'performance_pressure';
  if (/争吵|冷战|关系|不被理解|被拒绝|孤独|孤单|朋友|家人|伴侣/.test(value)) return 'relationship_tension';
  if (/迷茫|未来|选择|决定|改变|不知道怎么办|不确定/.test(value)) return 'uncertainty_change';
  return value ? 'unclassified' : 'not_yet_said';
}

function abstractFearedMeaning(value) {
  const answer = normalizeExpression(value, 240);
  if (!answer) return null;
  if (/不够好|失败|否定|没用|落后|做不好/.test(answer)) return '担心一次停顿或不完美会被理解为对自身价值的否定';
  if (/忘记|消失|失去|离开|回忆|记不住/.test(answer)) return '担心重要的连接或记忆会随着时间变淡';
  if (/拒绝|抛弃|不理解|孤单|孤独/.test(answer)) return '担心失去理解、连接或陪伴';
  if (/失控|未知|来不及|没有选择/.test(answer)) return '担心未知变化会让自己失去可选择的空间';
  return null;
}

function abstractDesiredDirection(value) {
  const answer = normalizeExpression(value, 240);
  if (!answer) return null;
  if (/休息|停一停|慢下来|喘息|放松/.test(answer)) return '希望获得一点允许自己放慢脚步和喘息的空间';
  if (/记住|留住|回忆|纪念|保存/.test(answer)) return '希望以温柔而不失真的方式保存重要记忆';
  if (/理解|说清|沟通|被听见|陪伴/.test(answer)) return '希望获得被理解、被听见或重新连接的空间';
  if (/勇气|开始|尝试|向前|选择/.test(answer)) return '希望按自己的节奏靠近一个可以尝试的方向';
  return null;
}

function createSafeStoryBrief({ mode, rawText, followUpAnswers = [] }) {
  const normalized = normalizeExpression(rawText);
  if (!assessExpressionSafety(normalized, followUpAnswers).safe) {
    throw new Error('unsafe_expression');
  }

  const hasExpression = mode === 'free_text' && normalized.length > 0;
  const theme = classifyExpressionTheme(hasExpression ? normalized : '');
  const answerByTarget = new Map(
    followUpAnswers
      .filter((answer) => answer?.status === 'answered' && answer.value)
      .map((answer) => [answer.target, normalizeExpression(answer.value, 240)]),
  );
  let fearedMeaning = abstractFearedMeaning(answerByTarget.get('fearedMeaning'));
  let desiredDirection = abstractDesiredDirection(answerByTarget.get('desiredDirection'));
  let situationCategory;
  let coreTension;
  let feltPressure;
  let repeatedResponse = null;
  let emotionalDirection;
  let storyUsableFacts;

  if (theme === 'performance_pressure') {
    situationCategory = '持续努力、自我要求与休息需要之间的拉扯';
    coreTension = '已经感到疲惫，却担心停下来会证明自己不够好';
    feltPressure = ['持续要求自己再多做一点', '难以允许自己在疲惫时停下'];
    repeatedResponse = '在感到压力时仍继续要求自己向前';
    emotionalDirection = '从被无尽刻度催促，走向允许自己在灯光里停留和喘息片刻';
    storyUsableFacts = [
      '旅人背着一只会随自我要求增加重量的行囊',
      '旅人已经疲惫，却仍难以允许自己停下',
      '故事可以让守门者邀请旅人放下一枚不必完成的刻度',
    ];
    if (!fearedMeaning && /不够好|失败|落后|不敢停/.test(normalized)) {
      fearedMeaning = '担心停下或做得不完美会带来否定性的意义';
    }
  } else if (theme === 'grief_memory') {
    situationCategory = '面对重要关系的失去与记忆保存';
    coreTension = '一边承受思念与失去的重量，一边希望珍贵记忆不会被时间冲淡';
    feltPressure = ['重要关系离开后留下的思念', '担心珍贵记忆随时间变淡'];
    emotionalDirection = '从独自抱紧思念，走向让重要记忆以温柔象征被安放';
    storyUsableFacts = [
      '旅人带着一盏承载重要记忆的小灯来到门前',
      '时间的风让灯影摇晃，却不能替旅人定义这段关系',
      '故事可以寻找一种温柔保存记忆的方式，而不虚构现实结局',
    ];
    if (!fearedMeaning && /忘记|失去|离开|回忆|想念/.test(normalized)) {
      fearedMeaning = '担心重要的连接或记忆会随着时间变淡';
    }
    if (!desiredDirection && /希望|想要|留住|记住|回忆|纪念/.test(normalized)) {
      desiredDirection = '希望以温柔而不失真的方式保存重要记忆';
    }
  } else if (theme === 'relationship_tension') {
    situationCategory = '关系中的距离、理解与连接';
    coreTension = '想靠近理解与连接，同时担心表达会带来更多距离';
    feltPressure = ['关系中的距离感', '表达与被理解之间的不确定'];
    emotionalDirection = '从独自猜测，走向为真实表达保留一个不被催促的空间';
    storyUsableFacts = [
      '旅人站在两座相隔的灯塔之间',
      '故事只呈现距离与靠近的愿望，不替任何人断言动机',
    ];
  } else if (theme === 'uncertainty_change') {
    situationCategory = '面对变化、选择与未知方向';
    coreTension = '想向前选择，却还看不清哪条路更适合自己';
    feltPressure = ['未知变化带来的不确定', '希望作出选择却缺少足够信息'];
    emotionalDirection = '从急着找到唯一答案，走向允许自己先看清下一小步';
    storyUsableFacts = [
      '旅人来到一处分岔的微光小径',
      '故事可以照亮下一小步，但不替旅人决定现实选择',
    ];
  } else {
    situationCategory = hasExpression ? '一段尚未被完整分类的个人经历' : '一份尚未找到完整说法的生活压力';
    coreTension = hasExpression
      ? '用户希望被温柔理解，但现有信息不足以安全概括具体冲突'
      : '想让一份说不清的重量被温柔接住，又不希望它被擅自解释';
    feltPressure = ['一份仍在寻找合适表达方式的重量'];
    emotionalDirection = '从急于得到解释，走向允许未知被谨慎保留';
    storyUsableFacts = [
      '旅人带着一份尚未命名的重量来到门前',
      '故事必须保留未知，不替旅人补写原因、人物或结局',
    ];
  }

  const missingStoryInformation = [];
  if (!hasExpression) missingStoryInformation.push('具体情境与压力来源');
  if (!fearedMeaning) missingStoryInformation.push('这份压力最令人担心的意义');
  if (!desiredDirection) missingStoryInformation.push('旅人此刻最希望靠近的方向');
  if (theme === 'unclassified') missingStoryInformation.push('可被安全抽象的主题线索');

  return {
    schemaVersion: 'stage8-web-v2',
    briefId: createBriefId(),
    safetyStatus: 'story_safe',
    sessionNeed: null,
    situationCategory,
    coreTension,
    feltPressure,
    repeatedResponse,
    fearedMeaning,
    desiredDirection,
    emotionalDirection,
    storyUsableFacts,
    factsNotToInvent: ['具体人物身份与关系', '未说明的现实事件与结局', '未表达过的动机或经历'],
    prohibitedInterpretations: ['不得作心理诊断', '不得断言他人动机', '不得承诺治愈或现实问题已经解决'],
    userConfirmedSentence: null,
    missingStoryInformation,
  };
}

function clearProgressTimers() {
  state.expression.progressTimers.forEach((timer) => window.clearTimeout(timer));
  state.expression.progressTimers = [];
}

function clearTransientExpression() {
  state.expression.rawText = null;
  state.expression.followUpAnswers = [];
  expressionText.value = '';
  followupAnswer.value = '';
  expressionCount.textContent = '0 / ' + MAX_EXPRESSION_LENGTH;
}

function setExpressionStep(step) {
  expressionEntry.hidden = step !== 'entry';
  followupPanel.hidden = step !== 'followup';
  briefPanel.hidden = step !== 'brief';
}

function setGenerationView(view) {
  generationCard.dataset.generationState = view;
  generationIdle.hidden = view !== 'idle';
  generationProgress.hidden = view !== 'progress';
  generationError.hidden = view !== 'error';
  generatedFigure.hidden = view !== 'success';
}

function resetGenerationView() {
  clearProgressTimers();
  state.expression.requestController?.abort();
  state.expression.requestController = null;
  state.expression.generating = false;
  state.expression.requestToken += 1;
  generatedImage.removeAttribute('src');
  state.expression.generationAttempted = false;
  if (generateImage) generateImage.disabled = true;
  generationErrorMessage.textContent = '本次请求已安全结束，不会在页面内重试。';
  generationSteps.forEach((step) => step.classList.remove('is-active', 'is-complete'));
  setGenerationView('idle');
}

const PAPER_BOAT_VOYAGE_COPY = [
  '纸船载着这句话，驶入还没有名字的湖面。',
  '风把没说完的部分，轻轻收进水波里。',
  '远处的灯还没有亮起，故事正在另一岸慢慢展开。',
  '不必现在抵达，先让这一点重量有地方安放。',
  '七章故事正在水面下，一页一页长出来。',
];

function syncPaperBoatVoyageCopy() {
  if (!paperBoatVideo || !paperBoatVoyageMessage) return;
  const duration = paperBoatVideo.duration;
  const nextIndex = Number.isFinite(duration) && duration > 0 && Number.isFinite(paperBoatVideo.currentTime)
    ? Math.min(
      PAPER_BOAT_VOYAGE_COPY.length - 1,
      Math.max(0, Math.floor((paperBoatVideo.currentTime / duration) * PAPER_BOAT_VOYAGE_COPY.length)),
    )
    : 0;
  if (state.paperBoat.voyageCopyIndex === nextIndex) return;
  state.paperBoat.voyageCopyIndex = nextIndex;
  paperBoatVoyageMessage.textContent = PAPER_BOAT_VOYAGE_COPY[nextIndex];
}

function clearPaperBoatWait() {
  if (state.paperBoat.transitionTimer) window.clearTimeout(state.paperBoat.transitionTimer);
  state.paperBoat.transitionTimer = null;
  if (paperBoatVideo && state.paperBoat.voyageCopyListener) {
    paperBoatVideo.removeEventListener('timeupdate', state.paperBoat.voyageCopyListener);
  }
  state.paperBoat.voyageCopyListener = null;
  state.paperBoat.voyageCopyIndex = -1;
  if (paperBoatVideo) {
    paperBoatVideo.pause();
    paperBoatVideo.currentTime = 0;
  }
}

function setPaperBoatState(nextState, message = null) {
  if (!paperBoatSequence) return;
  clearPaperBoatWait();
  state.paperBoat.state = nextState;
  paperBoatSequence.dataset.paperBoatState = nextState;
  paperBoatSequence.hidden = nextState === 'idle';
  document.body.dataset.paperBoatWaiting = nextState === 'idle' ? 'false' : 'true';
  paperBoatSequence.setAttribute('aria-hidden', nextState === 'idle' ? 'true' : 'false');
  if (paperBoatRetry) paperBoatRetry.hidden = nextState !== 'error';
  if (paperBoatStatus && message) paperBoatStatus.textContent = message;
}

function startPaperBoatWait() {
  if (!paperBoatSequence) return;
  // Keep the cinematic waiting layer outside the expression workbench so no
  // parent layout, transform, or overflow rule can constrain its viewport.
  if (paperBoatSequence.parentElement !== document.body) {
    document.body.appendChild(paperBoatSequence);
  }
  clearPaperBoatWait();
  state.paperBoat.state = 'folding';
  if (paperBoatFoldEyebrow) paperBoatFoldEyebrow.textContent = '风铃正在收好这句话';
  if (paperBoatFoldTitle) paperBoatFoldTitle.textContent = '纸张正在折叠';
  if (paperBoatFoldCopy) paperBoatFoldCopy.textContent = '把这句话，折成一只可以出发的纸船。';
  paperBoatSequence.dataset.paperBoatState = 'folding';
  paperBoatSequence.hidden = false;
  document.body.dataset.paperBoatWaiting = 'true';
  paperBoatSequence.setAttribute('aria-hidden', 'false');
  if (paperBoatRetry) paperBoatRetry.hidden = true;
  if (paperBoatVideo) {
    paperBoatVideo.currentTime = 0;
  }
  state.paperBoat.transitionTimer = window.setTimeout(() => {
    setPaperBoatState('floating');
    if (paperBoatFoldEyebrow) paperBoatFoldEyebrow.textContent = '纸船已经出发';
    if (paperBoatFoldTitle) paperBoatFoldTitle.textContent = '纸船正驶向远方';
    if (paperBoatFoldCopy) paperBoatFoldCopy.textContent = '载着这句话，去往还没有名字的湖面。';
    if (paperBoatVideo) {
      state.paperBoat.voyageCopyListener = syncPaperBoatVoyageCopy;
      paperBoatVideo.addEventListener('timeupdate', state.paperBoat.voyageCopyListener);
      const playback = paperBoatVideo.play();
      if (playback?.catch) playback.catch(() => {});
    }
    syncPaperBoatVoyageCopy();
  }, 1800);
}

function resetExpressionFlow({ focus = false, preserveStorybook = false } = {}) {
  setPaperBoatState('idle');
  resetGenerationView();
  if (!preserveStorybook) resetStorybook();
  state.expression.mode = null;
  state.expression.followUpIndex = 0;
  state.expression.safeBrief = null;
  clearTransientExpression();
  expressionInlineError.hidden = true;
  safeSummary.replaceChildren();
  setExpressionStep('entry');
  privacyNote.textContent = '原始心事只在当前页面临时处理，形成安全故事线后立即清除';
  if (focus) window.setTimeout(() => expressionText.focus(), 180);
}

function blockUnsafeExpression() {
  state.expression.mode = null;
  state.expression.followUpIndex = 0;
  state.expression.safeBrief = null;
  clearTransientExpression();
  setExpressionStep('entry');
  expressionInlineError.textContent = '这段话可能涉及即时安全风险，当前不会发送到图像服务。若你或他人正处危险，请立即联系当地急救、警方或可信任的人。';
  expressionInlineError.hidden = false;
  privacyNote.textContent = '高风险内容已在当前页面拦截并清除，未发送到图像服务';
  announce('这段内容不会进入生图流程，请先寻求现实中的即时支持');
  window.setTimeout(() => expressionText.focus(), 180);
}

function showFollowUp() {
  const followUp = FOLLOW_UPS[state.expression.followUpIndex];
  if (!followUp) {
    finishExpressionBrief();
    return;
  }
  setExpressionStep('followup');
  followupStep.textContent = '绾线的第 ' + (state.expression.followUpIndex + 1) + ' 个问题 / 最多 2 个';
  followupQuestion.textContent = followUp.prompt;
  followupAnswer.value = '';
  window.setTimeout(() => followupAnswer.focus(), 180);
  announce(followupQuestion.textContent);
}

function startExpression(mode, rawText = null) {
  const normalized = mode === 'free_text' ? normalizeExpression(rawText) : null;
  if (mode === 'free_text' && !normalized) {
    expressionInlineError.textContent = '写下一句话，或选择“我还不知道怎么说”。';
    expressionInlineError.hidden = false;
    expressionText.focus();
    return;
  }
  if (!assessExpressionSafety(normalized).safe) {
    blockUnsafeExpression();
    return;
  }
  expressionInlineError.hidden = true;
  state.expression.mode = mode;
  state.expression.rawText = normalized;
  state.expression.followUpIndex = 0;
  state.expression.followUpAnswers = [];
  showFollowUp();
}

function completeFollowUp(status) {
  const followUp = FOLLOW_UPS[state.expression.followUpIndex];
  if (!followUp) return;
  const answer = normalizeExpression(followupAnswer.value, 240);
  const nextAnswer = {
    id: followUp.id,
    target: followUp.target,
    status: status === 'answered' && answer ? 'answered' : 'skipped',
    value: status === 'answered' && answer ? answer : null,
  };
  const nextAnswers = [...state.expression.followUpAnswers, nextAnswer];
  if (!assessExpressionSafety(state.expression.rawText, nextAnswers).safe) {
    blockUnsafeExpression();
    return;
  }
  state.expression.followUpAnswers.push(nextAnswer);
  followupAnswer.value = '';
  state.expression.followUpIndex += 1;
  showFollowUp();
}

function renderSafeSummary(brief) {
  const items = [
    '核心拉扯：' + brief.coreTension,
    '故事方向：' + brief.emotionalDirection,
    '不擅自补写人物、关系、诊断或现实结局',
  ];
  safeSummary.replaceChildren(...items.map((text) => {
    const item = document.createElement('li');
    item.textContent = text;
    return item;
  }));
}

function finishExpressionBrief() {
  if (!assessExpressionSafety(state.expression.rawText, state.expression.followUpAnswers).safe) {
    blockUnsafeExpression();
    return;
  }
  const brief = createSafeStoryBrief({
    mode: state.expression.mode,
    rawText: state.expression.rawText,
    followUpAnswers: state.expression.followUpAnswers,
  });
  state.expression.safeBrief = brief;
  clearTransientExpression();
  renderSafeSummary(brief);
  setExpressionStep('brief');
  privacyNote.textContent = '原始心事已从页面与临时内存清除；服务端只接收安全故事线';
  announce('故事线已经整理好，原始心事已清除');
  window.setTimeout(() => generateStory.focus(), 180);
}

function clearStorybookStorage() {
  try {
    window.localStorage.removeItem(STORYBOOK_STORAGE_KEY);
  } catch {
    // Storage is optional; the in-memory reader remains usable.
  }
}

async function clearServerStorybookState() {
  try {
    await fetch('/api/storybook-state', { method: 'DELETE' });
  } catch {
    // The local snapshot remains available when the server is unreachable.
  }
}

function resetStorybook() {
  releaseStorybookPageTurn();
  state.storybook.requestController?.abort();
  state.storybook.requestController = null;
  state.storybook.requestToken += 1;
  state.storybook.loading = false;
  state.storybook.storyPackage = null;
  state.storybook.reader = null;
  clearStorybookStorage();
  void clearServerStorybookState();
  if (storybookBook) storybookBook.classList.remove('is-turning-next', 'is-turning-previous', 'is-closed');
  if (storybookStatus) storybookStatus.textContent = '七章故事尚未生成';
  if (generateStory) {
    generateStory.disabled = false;
  generateStory.textContent = '寄出这封信';
  }
}

function readerChaptersFrom(storyPackage) {
  const cards = storyPackage?.chapterCards;
  if (!Array.isArray(cards) || cards.length !== 7) throw new Error('invalid_story_package');
  return cards.map((card, index) => {
    const chapterNumber = card?.identity?.chapterNumber;
    const chapterId = card?.identity?.chapterId;
    const title = card?.userVisibleCopy?.chapterTitle;
    const text = card?.userVisibleCopy?.chapterText;
    if (chapterNumber !== index + 1 || typeof chapterId !== 'string' || !chapterId || typeof title !== 'string' || !title || typeof text !== 'string' || !text) {
      throw new Error('invalid_story_package');
    }
    return { chapterNumber, chapterId };
  });
}

function saveStorybookSnapshot() {
  if (!state.storybook.storyPackage || !state.storybook.reader) return;
  const snapshot = {
    storyPackage: state.storybook.storyPackage,
    readerSnapshot: state.storybook.reader.snapshot(),
  };
  safeStorageSet(STORYBOOK_STORAGE_KEY, JSON.stringify(snapshot));
  void fetch('/api/storybook-state', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(snapshot),
  }).catch(() => {
    // The local snapshot remains the recovery path when persistence is unavailable.
  });
}

function syncStorybookControls(snapshot = state.storybook.reader?.snapshot()) {
  if (!snapshot || !state.storybook.reader) return;
  const closed = snapshot.phase === window.DreamBookReader.READER_PHASES.CLOSED;
  const turning = state.storybook.turning;
  storybookPrevious.disabled = closed || turning || !state.storybook.reader.canGoPrevious();
  storybookNext.disabled = closed || turning || !state.storybook.reader.canGoNext();
  storybookNext.hidden = closed || state.storybook.reader.canCloseBook();
  storybookClose.hidden = closed || !state.storybook.reader.canCloseBook();
  storybookClose.disabled = closed || turning || !state.storybook.reader.canCloseBook();
  storybookReopen.hidden = !closed;
}

function releaseStorybookPageTurn() {
  if (state.storybook.turnTimer !== null) window.clearTimeout(state.storybook.turnTimer);
  if (state.storybook.illustrationTimer !== null) window.clearTimeout(state.storybook.illustrationTimer);
  state.storybook.turnTimer = null;
  state.storybook.illustrationTimer = null;
  state.storybook.turning = false;
  syncStorybookControls();
}

function beginStorybookPageTurn() {
  if (state.storybook.turning) return false;
  state.storybook.turning = true;
  syncStorybookControls();
  state.storybook.turnTimer = window.setTimeout(() => {
    state.storybook.turnTimer = null;
    state.storybook.turning = false;
    syncStorybookControls();
  }, STORYBOOK_PAGE_TURN_MS);
  return true;
}

function clearTurnSheets() {
  if (!storybookBook) return;
  storybookBook.querySelectorAll('.storybook-turn-sheet').forEach((sheet) => sheet.remove());
}

function animatePageTurn(direction, frontPage, backPage) {
  if (!storybookBook || !frontPage || !backPage) return;
  clearTurnSheets();

  const makeFace = (page, faceClass) => {
    const face = page.cloneNode(true);
    const isIllustration = page.classList.contains('storybook-page--illustration');
    face.classList.remove('storybook-page');
    face.classList.add('storybook-turn-face', faceClass);
    face.dataset.turnPage = isIllustration ? 'illustration' : 'copy';
    face.removeAttribute('aria-label');
    face.querySelectorAll('[id]').forEach((node) => node.removeAttribute('id'));
    return face;
  };
  const sheet = document.createElement('div');
  sheet.className = 'storybook-turn-sheet ' + (direction === 'previous'
    ? 'storybook-turn-sheet--previous'
    : 'storybook-turn-sheet--next');
  sheet.setAttribute('aria-hidden', 'true');
  sheet.append(
    makeFace(frontPage, 'storybook-turn-sheet__front'),
    makeFace(backPage, 'storybook-turn-sheet__back'),
  );
  const shadow = document.createElement('span');
  shadow.className = 'storybook-turn-shadow';
  shadow.setAttribute('aria-hidden', 'true');
  sheet.append(shadow);
  storybookBook.append(sheet);
  void sheet.offsetWidth;
  sheet.classList.add('is-active');
  window.setTimeout(() => sheet.remove(), STORYBOOK_PAGE_TURN_MS);
}

function renderStoryProgress(storyPackage, currentChapter) {
  const items = storyPackage.chapterCards.map((card, index) => {
    const item = document.createElement('li');
    const number = index + 1;
    item.dataset.chapterNumber = String(number);
    item.classList.toggle('is-current', number === currentChapter);
    if (number === currentChapter) item.setAttribute('aria-current', 'step');
    const numberLabel = document.createElement('span');
    numberLabel.textContent = String(number).padStart(2, '0');
    const title = document.createElement('small');
    title.textContent = card.userVisibleCopy.chapterTitle;
    item.append(numberLabel, title);
    return item;
  });
  storybookProgress.replaceChildren(...items);
}

function renderStoryIllustration(storyPackage, snapshot, card, target = storybookIllustrationState) {
  target.replaceChildren();
  const illustration = storyPackage.chapterIllustrations?.find(
    (item) => item.chapterNumber === snapshot.currentChapter
      && (item.state === 'succeeded' || item.state === 'fallback')
      && item.image?.url,
  );
  if (illustration) {
    const illustrationImage = document.createElement('img');
    illustrationImage.className = 'storybook-chapter-illustration';
    illustrationImage.src = validateGeneratedImageUrl(illustration.image.url);
    illustrationImage.alt = card.userVisibleCopy.chapterTitle + '章节插画';
    illustrationImage.width = 720;
    illustrationImage.height = 1280;
    illustrationImage.loading = 'eager';
    target.append(illustrationImage);
    return;
  }

  const illustrationGlyph = document.createElement('span');
  illustrationGlyph.className = 'storybook-empty-glyph';
  illustrationGlyph.setAttribute('aria-hidden', 'true');
  illustrationGlyph.textContent = '✧';
  const illustrationTitle = document.createElement('strong');
  illustrationTitle.textContent = '章节插画尚未生成';
  const illustrationDetail = document.createElement('span');
  illustrationDetail.textContent = '七章真实生成完成后才会在这里出现。';
  target.append(illustrationGlyph, illustrationTitle, illustrationDetail);
}

function renderStoryChapter({ animate = false } = {}) {
  const storyPackage = state.storybook.storyPackage;
  const reader = state.storybook.reader;
  if (!storyPackage || !reader) return;

  const snapshot = reader.snapshot();
  const closed = snapshot.phase === window.DreamBookReader.READER_PHASES.CLOSED;
  const card = storyPackage.chapterCards[snapshot.currentChapter - 1];
  let turnFrontPage = null;
  let turnBackPage = null;
  if (animate) {
    const illustrationPage = storybookBook.querySelector('.storybook-page--illustration');
    turnFrontPage = illustrationPage?.cloneNode(true);
    turnBackPage = illustrationPage?.cloneNode(true);
    const turnIllustrationState = turnBackPage?.querySelector('.storybook-illustration-state');
    if (turnIllustrationState) renderStoryIllustration(storyPackage, snapshot, card, turnIllustrationState);
  }
  storybookBook.classList.toggle('is-closed', closed);
  storybookBook.dataset.readerPhase = snapshot.phase;
  storybookBook.dataset.currentChapter = String(snapshot.currentChapter);
  storybookBook.hidden = closed;
  storybookKeepsake.hidden = !closed;
  const bookTitle = storyPackage.bookTitle || storyPackage.storyTemplateMatch?.templateTitle || storyPackage.storyBible?.title || '绾线与旅人的七章童话';
  storybookTitle.textContent = bookTitle;
  if (brandTitle) brandTitle.textContent = bookTitle;
  if (storybookCoverTitle) storybookCoverTitle.textContent = bookTitle;
  storybookChapterKicker.textContent = '第 ' + snapshot.currentChapter + ' 章 / 共 7 章';
  storybookChapterTitle.textContent = card.userVisibleCopy.chapterTitle;
  storybookChapterText.textContent = card.userVisibleCopy.chapterText;
  if (!animate) renderStoryIllustration(storyPackage, snapshot, card);
  renderStoryProgress(storyPackage, snapshot.currentChapter);
  storybookStatus.textContent = closed ? '书已合上，故事停在第七章' : '请由你亲手翻动每一章';
  syncStorybookControls(snapshot);
  if (animate) {
    animatePageTurn(animate, turnFrontPage, turnBackPage);
    state.storybook.illustrationTimer = window.setTimeout(() => {
      state.storybook.illustrationTimer = null;
      const latestSnapshot = state.storybook.reader?.snapshot();
      if (latestSnapshot) {
        const latestCard = storyPackage.chapterCards[latestSnapshot.currentChapter - 1];
        renderStoryIllustration(storyPackage, latestSnapshot, latestCard);
      }
    }, STORYBOOK_PAGE_TURN_MS);
  }
  saveStorybookSnapshot();
}

// 章节插画尚未生成时，阅读器仍然可以正常打开。
function initializeStoryReader(storyPackage, snapshot = null) {
  releaseStorybookPageTurn();
  if (!window.DreamBookReader) throw new Error('reader_unavailable');
  const chapters = readerChaptersFrom(storyPackage);
  const reader = snapshot
    ? window.DreamBookReader.restoreReaderState({ chapters, snapshot })
    : window.DreamBookReader.createReaderState({ chapters });
  state.storybook.storyPackage = storyPackage;
  state.storybook.reader = reader;
  renderStoryChapter();
  return reader;
}

function restoreStorybookPreview() {
  const stored = safeStorageGet(STORYBOOK_STORAGE_KEY);
  if (!stored) return false;
  try {
    const saved = JSON.parse(stored);
    if (!saved || typeof saved !== 'object' || Array.isArray(saved)) throw new Error('invalid_snapshot');
    initializeStoryReader(saved.storyPackage, saved.readerSnapshot);
    return true;
  } catch {
    resetStorybook();
    return false;
  }
}

async function restoreStorybookFromServer() {
  if (state.storybook.storyPackage) return false;
  try {
    const response = await fetch('/api/storybook-state');
    const payload = await response.json();
    if (!response.ok || payload?.ok !== true || !payload.state) return false;
    initializeStoryReader(payload.state.storyPackage, payload.state.readerSnapshot);
    goToScene('storybook', { focus: false });
    return true;
  } catch {
    return false;
  }
}

function friendlyStoryPackageError(payload, response) {
  if (payload?.message && typeof payload.message === 'string') return payload.message;
  if (response?.status === 413) return '故事摘要超过 64KB 限制，请缩短后再试。';
  if (response?.status === 400) return '安全故事线未通过服务端校验，请换一句重新说。';
  return '七章故事暂时没有生成，请检查本机服务后再试。';
}

function friendlyStorybookImageError(payload, response) {
  if (payload?.message && typeof payload.message === 'string') return payload.message;
  if (response?.status === 413) return '七章故事包超过图片请求大小限制，请缩短故事内容后再试。';
  if (response?.status === 409) return '七章插画仍在生成，请等待本次绘本完成。';
  if (response?.status === 503) return 'Image 2 服务尚未配置，暂时无法绘制七章插画。';
  if (response?.status === 504) return '七章插画绘制等待超时，本次没有生成结果。';
  if (payload?.status === 'partial_failure') {
    const failedChapters = Array.isArray(payload.illustrations)
      ? payload.illustrations.filter((item) => item.state === 'failed').map((item) => item.chapterNumber)
      : [];
    return failedChapters.length
      ? '七章故事已写好，但第 ' + failedChapters.join('、') + ' 章插画生成失败，请检查服务后再试。'
      : '七章故事已写好，但插画生成未完成，请检查各章生成状态后再试。';
  }
  return '七章故事已写好，但图片生成服务未完成本次插画，请检查服务后再试。';
}

async function requestStoryPackage() {
  if (state.storybook.loading || !state.expression.safeBrief || state.expression.safeBrief.safetyStatus !== 'story_safe') return;
  state.storybook.loading = true;
  generateStory.disabled = true;
  generateStory.textContent = '正在寄出…';
  startPaperBoatWait();
  storybookStatus.textContent = '绾线正在整理七章故事';
  setGenerationView('progress');
  setStoryGenerationStage('prompting');
  if (storyPromptPreview) storyPromptPreview.textContent = '正在生成安全故事 Prompt…';
  if (chapterGenerationStatus) chapterGenerationStatus.replaceChildren();
  if (generationPromptDetails) generationPromptDetails.open = false;
  const requestToken = ++state.storybook.requestToken;
  const controller = new AbortController();
  state.storybook.requestController = controller;
  let response = null;
  let payload = null;
  let imageResponse = null;
  let imagePayload = null;
  let initialChapters = null;

  try {
    response = await fetch('/api/story-package', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ safeStoryBrief: state.expression.safeBrief }),
      signal: controller.signal,
    });
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }
    if (!response.ok || payload?.ok !== true || !payload.storyPackage) throw new Error('story_generation_failed');
    initialChapters = payload.storyPackage.chapterCards.map((card) => ({
      chapterNumber: card.identity?.chapterNumber,
      title: card.userVisibleCopy?.chapterTitle,
      chapterText: card.userVisibleCopy?.chapterText,
      imagePrompt: card.illustrationContract?.promptContract?.imagePrompt,
      statusLabel: '短剧本与 Image Prompt 已生成',
      state: 'written',
    }));
    setStoryGenerationStage('writing', { storyPrompt: payload.storyPackage.storyPrompt, chapters: initialChapters });
    setStoryGenerationStage('image-prompting', { storyPrompt: payload.storyPackage.storyPrompt, chapters: initialChapters });
    storybookStatus.textContent = '七章故事已冻结，正在并行绘制七张插画';
    setStoryGenerationStage('illustrating', {
      storyPrompt: payload.storyPackage.storyPrompt,
      chapters: initialChapters.map((chapter) => ({ ...chapter, statusLabel: '等待图片生成', state: 'queued' })),
    });
    imageResponse = await fetch('/api/images/generate-book', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ storyPackage: payload.storyPackage }),
      signal: controller.signal,
    });
    try {
      imagePayload = await imageResponse.json();
    } catch {
      imagePayload = null;
    }
    if (!imageResponse.ok || imagePayload?.ok !== true || !['succeeded', 'partial_failure'].includes(imagePayload.status)) {
      throw new Error('chapter_image_generation_failed');
    }
    const storyPackage = {
      ...payload.storyPackage,
      chapterIllustrations: imagePayload.illustrations,
    };
    if (requestToken !== state.storybook.requestToken) return;
    initializeStoryReader(storyPackage);
    generateStory.textContent = '七章故事已生成';
    setStoryGenerationStage('ready', {
      storyPrompt: storyPackage.storyPrompt,
      chapters: storyPackage.chapterCards.map((card) => {
        const illustration = imagePayload.illustrations.find((item) => item.chapterNumber === card.identity.chapterNumber);
        return {
          chapterNumber: card.identity.chapterNumber,
          title: card.userVisibleCopy.chapterTitle,
          chapterText: card.userVisibleCopy.chapterText,
          imagePrompt: card.illustrationContract?.promptContract?.imagePrompt,
          statusLabel: illustration?.state === 'fallback' ? '使用审核模板' : illustration?.state === 'succeeded' ? '插画已完成' : '插画未完成',
          state: illustration?.state || 'failed',
        };
      }),
    });
    setPaperBoatState('idle');
    goToScene('storybook');
    announce('七章童话已经写好，请由你亲手翻页');
  } catch (error) {
    if (requestToken !== state.storybook.requestToken || error?.name === 'AbortError') return;
    const imageGenerationFailed = error.message === 'chapter_image_generation_failed';
    const failedResponse = imageGenerationFailed ? imageResponse : response;
    storybookStatus.textContent = imageGenerationFailed
      ? friendlyStorybookImageError(imagePayload, imageResponse)
      : friendlyStoryPackageError(payload, response);
    setStoryGenerationStage('error', imageGenerationFailed && initialChapters
      ? {
        storyPrompt: payload?.storyPackage?.storyPrompt,
        chapters: initialChapters.map((chapter) => {
          const illustration = imagePayload?.illustrations?.find(
            (item) => item.chapterNumber === chapter.chapterNumber,
          );
          return {
            ...chapter,
            statusLabel: illustration?.error?.code
              ? '插画失败：' + illustration.error.code
              : illustration?.state === 'succeeded' ? '插画已完成' : '插画未完成',
            state: illustration?.state || 'failed',
          };
        }),
      }
      : undefined);
    generateStory.disabled = false;
    generateStory.textContent = '寄出这封信';
    setPaperBoatState('error');
    announce(storybookStatus.textContent);
  } finally {
    if (requestToken === state.storybook.requestToken) {
      state.storybook.loading = false;
      state.storybook.requestController = null;
      if (state.paperBoat.state !== 'error') setPaperBoatState('idle');
    }
  }
}

function goPreviousChapter() {
  if (!state.storybook.reader?.canGoPrevious() || !beginStorybookPageTurn()) return;
  state.storybook.reader.previousChapter();
  renderStoryChapter({ animate: 'previous' });
  announce(storybookChapterKicker.textContent + '，' + storybookChapterTitle.textContent);
}

function goNextChapter() {
  if (!state.storybook.reader?.canGoNext() || !beginStorybookPageTurn()) return;
  state.storybook.reader.nextChapter();
  renderStoryChapter({ animate: 'next' });
  announce(storybookChapterKicker.textContent + '，' + storybookChapterTitle.textContent);
}

function closeStorybook() {
  if (!state.storybook.reader?.canCloseBook() || !beginStorybookPageTurn()) return;
  state.storybook.reader.closeBook();
  renderStoryChapter({ animate: 'next' });
  announce('你已经亲手合上这本七章童话');
}

function reopenStorybook() {
  if (!state.storybook.storyPackage) return;
  storybookArchive.textContent = '存入书架';
  storybookArchive.disabled = false;
  storybookArchiveNote.hidden = true;
  initializeStoryReader(state.storybook.storyPackage);
  announce('故事重新从第一章打开');
}

function archiveStorybook() {
  if (!state.storybook.storyPackage || !state.storybook.reader) return;
  saveStorybookSnapshot();
  storybookArchive.textContent = '已存入书架';
  storybookArchive.disabled = true;
  storybookArchiveNote.hidden = false;
  announce('风把它送进书架，世界已经记住了你的故事');
}

function returnToExpression() {
  goToScene('expression');
  announce('已回到安全故事线，当前七章故事仍保留在本机');
}

function setStoryGenerationStage(stage, details = {}) {
  const labels = {
    prompting: '正在整理 AI Prompt',
    writing: '正在生成七章短剧本',
    'image-prompting': '正在生成每章 AI Image Prompt',
    illustrating: '七章图片正在并行生成',
    ready: '七章绘本已经准备完成',
    error: '绘本生成未完成',
  };
  const activeIndex = ['prompting', 'writing', 'image-prompting', 'illustrating'].indexOf(stage);
  generationStatus.textContent = labels[stage] || labels.prompting;
  generationSteps.forEach((step, index) => {
    step.classList.toggle('is-complete', stage === 'ready' || (activeIndex >= 0 && index < activeIndex));
    step.classList.toggle('is-active', activeIndex === index);
  });
  if (storyPromptPreview && details.storyPrompt !== undefined) {
    storyPromptPreview.textContent = details.storyPrompt || '本次没有返回可展示的 Prompt';
  }
  if (chapterGenerationStatus && Array.isArray(details.chapters)) {
    chapterGenerationStatus.replaceChildren();
    details.chapters.forEach((chapter, index) => {
      const item = document.createElement('li');
      item.dataset.chapterState = chapter.state || 'written';
      const title = document.createElement('strong');
      title.textContent = '第 ' + (chapter.chapterNumber || index + 1) + ' 章 · ' + (chapter.title || '未命名章节');
      const copy = document.createElement('span');
      copy.textContent = chapter.chapterText || '短剧本已生成';
      const prompt = document.createElement('small');
      prompt.textContent = chapter.imagePrompt ? 'Image Prompt：' + chapter.imagePrompt : (chapter.statusLabel || '等待插画生成');
      item.append(title, copy, prompt);
      chapterGenerationStatus.append(item);
    });
  }
  if (stage === 'ready' && generationPromptDetails) generationPromptDetails.open = false;
  if (stage === 'error' && generationPromptDetails) generationPromptDetails.open = true;
  if (labels[stage]) announce(labels[stage]);
}

function updateGenerationProgress(activeIndex) {
  const labels = ['正在整理故事线', '正在调色', 'gpt-image-2 正在绘制'];
  generationStatus.textContent = labels[activeIndex];
  generationSteps.forEach((step, index) => {
    step.classList.toggle('is-complete', index < activeIndex);
    step.classList.toggle('is-active', index === activeIndex);
  });
  announce(labels[activeIndex]);
}

function startGenerationProgress() {
  clearProgressTimers();
  setGenerationView('progress');
  updateGenerationProgress(0);
  state.expression.progressTimers.push(
    window.setTimeout(() => updateGenerationProgress(1), 1100),
    window.setTimeout(() => updateGenerationProgress(2), 2200),
  );
}

function validateGeneratedImageUrl(value) {
  const url = new URL(String(value || ''), window.location.href);
  if (
    url.origin !== window.location.origin
    || (!url.pathname.startsWith('/runtime/generated/') && !url.pathname.startsWith('/assets/fallback/'))
  ) {
    throw new Error('invalid_image_url');
  }
  return url.pathname + url.search;
}

function preloadGeneratedImage(url) {
  return new Promise((resolve, reject) => {
    const preview = new Image();
    preview.onload = () => resolve();
    preview.onerror = () => reject(new Error('image_load_failed'));
    preview.src = url;
  });
}

function friendlyGenerationError(payload, response) {
  if (payload?.message && typeof payload.message === 'string') return payload.message;
  if (response?.status === 409) return '上一幅童话插画仍在绘制，本次请求没有再次发送。';
  if (response?.status === 503) return 'Image 2 服务尚未配置，请检查服务端 .env.local。';
  if (response?.status === 504) return '这次绘制等待太久，已安全结束，没有生成替代图片。';
  return '真实生成未完成，本次请求已结束；请在演示后检查服务端和网络状态。';
}

async function requestRealImage() {
  if (
    state.expression.generating
    || state.expression.generationAttempted
    || !state.expression.safeBrief
    || state.expression.safeBrief.safetyStatus !== 'story_safe'
  ) return;
  state.expression.generating = true;
  state.expression.generationAttempted = true;
  generateImage.disabled = true;
  clearTransientExpression();
  startGenerationProgress();

  const requestToken = ++state.expression.requestToken;
  const controller = new AbortController();
  state.expression.requestController = controller;
  let response = null;
  let payload = null;

  try {
    response = await fetch('/api/images/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ safeStoryBrief: state.expression.safeBrief }),
      signal: controller.signal,
    });
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }
    if (!response.ok || payload?.ok !== true || !payload.image?.url) {
      throw new Error('generation_failed');
    }
    const imageUrl = validateGeneratedImageUrl(payload.image.url);
    await preloadGeneratedImage(imageUrl);
    if (requestToken !== state.expression.requestToken) return;
    clearProgressTimers();
    updateGenerationProgress(2);
    generationSteps.forEach((step) => step.classList.add('is-complete'));
    generatedImage.src = imageUrl;
    generatedCaption.textContent = '真实生成完成 · ' + (payload.image.model || 'gpt-image-2') + ' · 720 × 1280 PNG';
    setGenerationView('success');
    announce('gpt-image-2 真实童话插画已经生成完成');
  } catch (error) {
    if (requestToken !== state.expression.requestToken || error?.name === 'AbortError') return;
    clearProgressTimers();
    generationErrorMessage.textContent = friendlyGenerationError(payload, response);
    generatedImage.removeAttribute('src');
    setGenerationView('error');
    announce('真实生成未完成，没有显示预制替代图片');
  } finally {
    if (requestToken === state.expression.requestToken) {
      state.expression.generating = false;
      state.expression.requestController = null;
      generateImage.disabled = true;
    }
  }
}


function bindPressFeedback(element) {
  const release = () => element.classList.remove('is-pressed');

  element.addEventListener('pointerdown', (event) => {
    if (event.button > 0) return;
    element.classList.add('is-pressed');
  });
  element.addEventListener('pointerup', release);
  element.addEventListener('pointercancel', release);
  element.addEventListener('pointerleave', release);
  element.addEventListener('blur', release);
  element.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    element.classList.add('is-pressed');
  });
  element.addEventListener('keyup', release);
}

function resetEntry() {
  resetExpressionFlow();
  state.doorOpened = false;
  doorScene.classList.remove('is-playing', 'is-transitioning');
  doorHandle.disabled = false;
  worldEntryVideo.currentTime = 0;
  worldEntryVideo.pause();
  goToScene('door');
  window.setTimeout(() => doorHandle.focus(), 350);
}

expressionPressTargets.forEach(bindPressFeedback);
storybookPressTargets.forEach(bindPressFeedback);

emotionDoorButtons.forEach((button) => {
  const doorId = button.dataset.emotionDoor;
  button.addEventListener('pointerenter', () => selectEmotionDoor(doorId));
  button.addEventListener('focus', () => selectEmotionDoor(doorId));
  button.addEventListener('click', () => activateEmotionDoor(doorId));
});

doorHandle.addEventListener('click', finishOpeningDoor);
worldEntryVideo.addEventListener('ended', completeWorldEntry);
worldEntryVideo.addEventListener('error', completeWorldEntry);

demoSentence.addEventListener('click', () => {
  expressionText.value = DEMO_SENTENCE;
  expressionCount.textContent = DEMO_SENTENCE.length + ' / ' + MAX_EXPRESSION_LENGTH;
  expressionInlineError.hidden = true;
  expressionText.focus();
  announce('现场演示句已填入');
});

expressionText.addEventListener('input', () => {
  expressionCount.textContent = expressionText.value.length + ' / ' + MAX_EXPRESSION_LENGTH;
  expressionInlineError.hidden = true;
});

expressionForm.addEventListener('submit', (event) => {
  event.preventDefault();
  startExpression('free_text', expressionText.value);
});

expressionNotSure.addEventListener('click', () => startExpression('not_sure_how_to_say'));
followupSubmit.addEventListener('click', () => completeFollowUp('answered'));
followupSkip.addEventListener('click', () => completeFollowUp('skipped'));
generateStory.addEventListener('click', requestStoryPackage);
paperBoatRetry?.addEventListener('click', () => {
  setPaperBoatState('idle');
  generateStory.click();
});
generateImage.addEventListener('click', requestRealImage);
storybookPrevious.addEventListener('click', goPreviousChapter);
storybookNext.addEventListener('click', goNextChapter);
storybookClose.addEventListener('click', closeStorybook);
storybookReopen.addEventListener('click', reopenStorybook);
storybookArchive.addEventListener('click', archiveStorybook);
storybookReturn.addEventListener('click', returnToExpression);
newExpression.addEventListener('click', () => resetExpressionFlow({ focus: true }));

brandHome.addEventListener('click', (event) => {
  event.preventDefault();
  resetEntry();
});

restartDemo.addEventListener('click', resetEntry);

window.__REALM_STAGE8__ = Object.freeze({
  DEMO_SENTENCE,
  FOLLOW_UPS,
  assessExpressionSafety,
  classifyExpressionTheme,
  createSafeStoryBrief,
  normalizeExpression,
});

selectEmotionDoor('overthinking');
resetExpressionFlow({ preserveStorybook: true });
if (restoreStorybookPreview()) {
  goToScene('storybook', { focus: false });
} else {
  goToScene('door', { focus: false });
}
void restoreStorybookFromServer();
