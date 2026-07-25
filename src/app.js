'use strict';

const PROFILE_KEY = 'dream-book-world.profile.v0';
const MOTION_KEY = 'dream-book-world.reduce-motion.v0';
const SCENE_ORDER = ['door', 'traveler', 'foyer', 'expression'];
const SCENE_LABELS = {
  door: '世界大门',
  traveler: '旅人初页',
  foyer: '内耗之门',
  expression: '风铃入口',
};
const MARK_LABELS = {
  star: '星星',
  drop: '雨滴',
  line: '蓝线',
  boat: '纸船',
  leaf: '叶子',
};
const MARK_GLYPHS = {
  star: '✦',
  drop: '●',
  line: '〰',
  boat: '△',
  leaf: '❧',
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

const state = {
  scene: 'door',
  doorProgress: 0,
  draggingDoor: false,
  dragStartX: 0,
  dragStartProgress: 0,
  dragTravel: 220,
  dragPointerId: null,
  doorOpened: false,
  displayName: '',
  pocketMark: '',
  reduceMotion: false,
  expression: {
    mode: null,
    rawText: null,
    followUpIndex: 0,
    followUpAnswers: [],
    safeBrief: null,
    generating: false,
    requestToken: 0,
    requestController: null,
    progressTimers: [],
  },
};

const scenes = Array.from(document.querySelectorAll('[data-scene]'));
const body = document.body;
const brandHome = document.querySelector('#brand-home');
const doorScene = document.querySelector('[data-scene="door"]');
const doorFrame = document.querySelector('#door-frame');
const doorHandle = document.querySelector('#door-handle');
const doorHint = document.querySelector('#door-hint');
const travelerForm = document.querySelector('#traveler-form');
const travelerName = document.querySelector('#traveler-name');
const markOptions = Array.from(document.querySelectorAll('.mark-option'));
const skipProfile = document.querySelector('#skip-profile');
const innerDoor = document.querySelector('#inner-door');
const travelerGreeting = document.querySelector('#traveler-greeting');
const arrivalBadge = document.querySelector('#arrival-badge');
const restartDemo = document.querySelector('#restart-demo');
const reduceMotionToggle = document.querySelector('#reduce-motion');
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
const newExpression = document.querySelector('#new-expression');
const generationCard = document.querySelector('#generation-card');
const generationIdle = document.querySelector('#generation-idle');
const generationProgress = document.querySelector('#generation-progress');
const generationStatus = document.querySelector('#generation-status');
const generationError = document.querySelector('#generation-error');
const generationErrorMessage = document.querySelector('#generation-error-message');
const retryGeneration = document.querySelector('#retry-generation');
const generatedFigure = document.querySelector('#generated-figure');
const generatedImage = document.querySelector('#generated-image');
const generatedCaption = document.querySelector('#generated-caption');
const generationSteps = Array.from(document.querySelectorAll('[data-progress-step]'));
const expressionPressTargets = Array.from(document.querySelectorAll('.expression-action'));

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

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

function normalizeName(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, 16);
}

function announce(message) {
  liveStatus.textContent = '';
  window.setTimeout(() => {
    liveStatus.textContent = message;
  }, 20);
}

function updateProfileUI({ syncInput = true } = {}) {
  const name = state.displayName || '旅人';
  if (syncInput) travelerName.value = state.displayName;
  travelerGreeting.textContent = name;

  markOptions.forEach((option) => {
    const selected = option.dataset.mark === state.pocketMark;
    option.classList.toggle('is-selected', selected);
    option.setAttribute('aria-pressed', String(selected));
  });

  const glyph = MARK_GLYPHS[state.pocketMark] || '❧';
  const markText = state.pocketMark ? '，口袋里放着一枚' + MARK_LABELS[state.pocketMark] : '';
  arrivalBadge.innerHTML = '<span aria-hidden="true">' + glyph + '</span><strong>' + escapeHtml(name) + '</strong>' + markText + '，已抵达';
}

function escapeHtml(value) {
  return value.replace(/[&<>"]/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
  })[character]);
}

function saveProfile() {
  safeStorageSet(PROFILE_KEY, JSON.stringify({
    displayName: state.displayName,
    pocketMark: state.pocketMark,
  }));
}

function loadPreferences() {
  const savedProfile = safeStorageGet(PROFILE_KEY);
  if (savedProfile) {
    try {
      const profile = JSON.parse(savedProfile);
      state.displayName = normalizeName(profile.displayName);
      state.pocketMark = Object.hasOwn(MARK_LABELS, profile.pocketMark) ? profile.pocketMark : '';
    } catch {
      // Ignore malformed local values and use the safe defaults.
    }
  }

  const systemPrefersReduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
  const savedMotion = safeStorageGet(MOTION_KEY);
  state.reduceMotion = savedMotion === null ? systemPrefersReduced : savedMotion === 'true';
  reduceMotionToggle.checked = state.reduceMotion;
  body.classList.toggle('reduce-motion', state.reduceMotion);
  updateProfileUI();
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
      window.setTimeout(() => heading.focus({ preventScroll: true }), state.reduceMotion ? 0 : 350);
    }
  }
}

function setDoorProgress(nextProgress) {
  state.doorProgress = clamp(nextProgress, 0, 1);
  body.style.setProperty('--door-open', state.doorProgress.toFixed(3));
  doorHandle.setAttribute('aria-valuenow', String(Math.round(state.doorProgress * 100)));
  doorHint.classList.toggle('is-moving', state.doorProgress > 0.04);

  if (state.doorProgress >= 0.92 && !state.doorOpened) {
    finishOpeningDoor();
  }
}

function clearDoorDrag(pointerId = state.dragPointerId) {
  state.draggingDoor = false;
  state.dragPointerId = null;
  doorHandle.classList.remove('is-dragging');
  doorScene.classList.remove('is-engaged');
  if (pointerId !== null && pointerId !== undefined && doorHandle.hasPointerCapture?.(pointerId)) {
    doorHandle.releasePointerCapture(pointerId);
  }
}

function finishOpeningDoor() {
  if (state.doorOpened) return;
  state.doorOpened = true;
  clearDoorDrag();
  setDoorProgress(1);
  doorHandle.setAttribute('aria-disabled', 'true');
  doorHint.innerHTML = '<span aria-hidden="true">✦</span> 门已经醒了，拾页正带你往前走';
  announce('童话世界大门已经打开');
  window.setTimeout(() => goToScene('traveler'), state.reduceMotion ? 120 : 1050);
}

function handleDoorPointerDown(event) {
  if (state.doorOpened || event.button > 0) return;
  const frameBounds = doorFrame.getBoundingClientRect();
  state.draggingDoor = true;
  state.dragPointerId = event.pointerId;
  state.dragStartX = event.clientX;
  state.dragStartProgress = state.doorProgress;
  const availableTravel = Math.max(80, frameBounds.right - state.dragStartX - 8);
  state.dragTravel = Math.max(80, Math.min(frameBounds.width * 0.48, availableTravel / 0.92));
  doorHandle.setPointerCapture?.(event.pointerId);
  doorHandle.classList.add('is-dragging');
  doorScene.classList.add('is-engaged');
}

function handleDoorPointerMove(event) {
  if (!state.draggingDoor || state.doorOpened) return;
  const delta = event.clientX - state.dragStartX;
  setDoorProgress(state.dragStartProgress + delta / state.dragTravel);
}

function stopDoorDrag(event) {
  if (!state.draggingDoor && state.dragPointerId === null) return;
  const shouldOpen = !state.doorOpened && state.doorProgress > 0.68;
  clearDoorDrag(event?.pointerId);
  if (shouldOpen) finishOpeningDoor();
}

function handleDoorKeyboard(event) {
  if (state.doorOpened) return;
  const increments = {
    ArrowRight: 0.18,
    ArrowUp: 0.18,
    ArrowLeft: -0.18,
    ArrowDown: -0.18,
    PageUp: 0.35,
    PageDown: -0.35,
    Home: -1,
    End: 1,
  };
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    finishOpeningDoor();
    return;
  }
  if (!Object.hasOwn(increments, event.key)) return;
  event.preventDefault();
  setDoorProgress(increments[event.key] === 1 ? 1 : increments[event.key] === -1 ? 0 : state.doorProgress + increments[event.key]);
}


function normalizeExpression(value, maximum = MAX_EXPRESSION_LENGTH) {
  return String(value || '').replace(/\r\n?/g, '\n').trim().slice(0, maximum);
}

function createBriefId() {
  if (window.crypto?.randomUUID) return 'brief-' + window.crypto.randomUUID();
  return 'brief-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

function createSafeStoryBrief({ mode, rawText, followUpAnswers = [] }) {
  const normalized = normalizeExpression(rawText);
  const demoPattern = /不够好|很累|不敢停|停下来|做得.{0,3}好/;
  const exhaustionPattern = /累|疲惫|撑不住|休息|停下来/;
  const perfectionPattern = /不够|必须|应该|完美|做好|失败|落后/;
  const hasExpression = mode === 'free_text' && normalized.length > 0;
  const resemblesDemo = hasExpression && demoPattern.test(normalized);
  const mentionsExhaustion = hasExpression && exhaustionPattern.test(normalized);
  const mentionsPerformance = hasExpression && perfectionPattern.test(normalized);
  const answeredTargets = new Set(
    followUpAnswers.filter((answer) => answer.status === 'answered').map((answer) => answer.target),
  );

  const situationCategory = hasExpression
    ? '持续努力、外部标准与自我照顾之间的拉扯'
    : '一份尚未找到完整说法的生活压力';
  const coreTension = resemblesDemo || (mentionsExhaustion && mentionsPerformance)
    ? '已经感到疲惫，却担心停下来会证明自己不够好'
    : hasExpression
      ? '想照顾自己的感受，同时担心放慢脚步会带来不好的意义'
      : '想让一份说不清的重量被温柔接住，又不希望它被擅自解释';
  const feltPressure = resemblesDemo || mentionsPerformance
    ? ['持续要求自己再多做一点', '难以允许自己在疲惫时停下']
    : hasExpression
      ? ['需要继续维持眼前的努力', '担心自己的感受不被理解']
      : ['暂时还找不到合适的表达方式'];

  const missingStoryInformation = [];
  if (!hasExpression) missingStoryInformation.push('具体情境与压力来源');
  if (!answeredTargets.has('fearedMeaning')) missingStoryInformation.push('这份压力最令人担心的意义');
  if (!answeredTargets.has('desiredDirection')) missingStoryInformation.push('旅人此刻最希望靠近的方向');

  return {
    schemaVersion: 'stage8-web-v1',
    briefId: createBriefId(),
    safetyStatus: 'story_safe',
    sessionNeed: null,
    situationCategory,
    coreTension,
    feltPressure,
    repeatedResponse: hasExpression ? '在感到压力时仍继续要求自己向前' : null,
    fearedMeaning: answeredTargets.has('fearedMeaning')
      ? '担心停下或做得不完美会带来否定性的意义'
      : null,
    desiredDirection: answeredTargets.has('desiredDirection')
      ? '希望获得一点允许自己放慢脚步的空间'
      : null,
    emotionalDirection: '从被标准追赶，走向允许自己在灯光里停留和喘息片刻',
    storyUsableFacts: [
      coreTension,
      '童话可以把压力转译成一条不断催促旅人前行的发光道路',
      '故事只支持温柔看见与重新选择，不宣称现实问题已经解决',
    ],
    factsNotToInvent: ['具体人物身份与关系', '未说明的现实事件与结局', '未表达过的动机或经历'],
    prohibitedInterpretations: ['不得作心理诊断', '不得断言他人动机', '不得把停下描述为失败', '不得承诺现实问题已经解决'],
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
  generationErrorMessage.textContent = '请检查服务端配置后重试。';
  generationSteps.forEach((step) => step.classList.remove('is-active', 'is-complete'));
  setGenerationView('idle');
}

function resetExpressionFlow({ focus = false } = {}) {
  resetGenerationView();
  state.expression.mode = null;
  state.expression.followUpIndex = 0;
  state.expression.safeBrief = null;
  clearTransientExpression();
  expressionInlineError.hidden = true;
  safeSummary.replaceChildren();
  setExpressionStep('entry');
  privacyNote.textContent = '原始心事只在当前页面临时处理，形成安全故事线后立即清除';
  if (focus) window.setTimeout(() => expressionText.focus(), state.reduceMotion ? 0 : 180);
}

function showFollowUp() {
  const followUp = FOLLOW_UPS[state.expression.followUpIndex];
  if (!followUp) {
    finishExpressionBrief();
    return;
  }
  setExpressionStep('followup');
  followupStep.textContent = '理线的第 ' + (state.expression.followUpIndex + 1) + ' 个问题 / 最多 2 个 · 可跳过';
  followupQuestion.textContent = followUp.prompt;
  followupAnswer.value = '';
  window.setTimeout(() => followupAnswer.focus(), state.reduceMotion ? 0 : 180);
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
  state.expression.followUpAnswers.push({
    id: followUp.id,
    target: followUp.target,
    status: status === 'answered' && answer ? 'answered' : 'skipped',
    value: status === 'answered' && answer ? answer : null,
  });
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
  window.setTimeout(() => generateStory.focus(), state.reduceMotion ? 0 : 180);
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
    window.setTimeout(() => updateGenerationProgress(2), 3200),
  );
}

function validateGeneratedImageUrl(value) {
  const url = new URL(String(value || ''), window.location.href);
  if (url.origin !== window.location.origin || !url.pathname.startsWith('/runtime/generated/')) {
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
  if (response?.status === 409) return '上一幅童话插画仍在绘制，请稍后再试。';
  if (response?.status === 503) return 'Image 2 服务尚未配置，请检查服务端 .env.local。';
  if (response?.status === 504) return '这次绘制等待太久，已安全结束，没有生成替代图片。';
  return '真实生成未完成，请确认服务端和网络状态后再试。';
}

async function requestRealImage() {
  if (state.expression.generating || !state.expression.safeBrief) return;
  state.expression.generating = true;
  generateStory.disabled = true;
  retryGeneration.disabled = true;
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
      generateStory.disabled = false;
      retryGeneration.disabled = false;
    }
  }
}


function bindPressFeedback(element) {
  const release = () => element.classList.remove('is-pressed');

  element.addEventListener('pointerdown', (event) => {
    if (event.button > 0 || state.reduceMotion) return;
    element.classList.add('is-pressed');
  });
  element.addEventListener('pointerup', release);
  element.addEventListener('pointercancel', release);
  element.addEventListener('pointerleave', release);
  element.addEventListener('blur', release);
  element.addEventListener('keydown', (event) => {
    if (state.reduceMotion || (event.key !== 'Enter' && event.key !== ' ')) return;
    element.classList.add('is-pressed');
  });
  element.addEventListener('keyup', release);
}

function resetEntry() {
  resetExpressionFlow();
  state.doorOpened = false;
  clearDoorDrag();
  doorHandle.removeAttribute('aria-disabled');
  doorHint.innerHTML = '<span aria-hidden="true">↔</span> 向右拉开门把 · 也可按 Enter';
  setDoorProgress(0);
  goToScene('door');
  window.setTimeout(() => doorHandle.focus(), state.reduceMotion ? 0 : 350);
}

function continueFromTraveler() {
  state.displayName = normalizeName(travelerName.value);
  saveProfile();
  updateProfileUI();
  goToScene('foyer');
}

const travelerPressTargets = [travelerForm.querySelector('.primary-button'), skipProfile, ...markOptions];
travelerPressTargets.forEach(bindPressFeedback);
expressionPressTargets.forEach(bindPressFeedback);

doorHandle.addEventListener('pointerdown', handleDoorPointerDown);
doorHandle.addEventListener('pointermove', handleDoorPointerMove);
doorHandle.addEventListener('pointerup', stopDoorDrag);
doorHandle.addEventListener('pointercancel', stopDoorDrag);
doorHandle.addEventListener('keydown', handleDoorKeyboard);

travelerForm.addEventListener('submit', (event) => {
  event.preventDefault();
  continueFromTraveler();
});

skipProfile.addEventListener('click', () => {
  travelerName.value = '';
  state.displayName = '';
  state.pocketMark = '';
  continueFromTraveler();
});

markOptions.forEach((option) => {
  option.addEventListener('click', () => {
    const mark = option.dataset.mark;
    state.pocketMark = state.pocketMark === mark ? '' : mark;
    updateProfileUI({ syncInput: false });
  });
});

innerDoor.addEventListener('click', () => {
  resetExpressionFlow();
  goToScene('expression');
});

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
generateStory.addEventListener('click', requestRealImage);
retryGeneration.addEventListener('click', requestRealImage);
newExpression.addEventListener('click', () => resetExpressionFlow({ focus: true }));

reduceMotionToggle.addEventListener('change', () => {
  state.reduceMotion = reduceMotionToggle.checked;
  body.classList.toggle('reduce-motion', state.reduceMotion);
  safeStorageSet(MOTION_KEY, String(state.reduceMotion));
  announce(state.reduceMotion ? '已开启减少动态效果' : '已恢复完整动态效果');
});

brandHome.addEventListener('click', (event) => {
  event.preventDefault();
  resetEntry();
});

restartDemo.addEventListener('click', resetEntry);

window.__REALM_STAGE8__ = Object.freeze({
  DEMO_SENTENCE,
  FOLLOW_UPS,
  createSafeStoryBrief,
  normalizeExpression,
});

loadPreferences();
resetExpressionFlow();
setDoorProgress(0);
goToScene('door', { focus: false });
