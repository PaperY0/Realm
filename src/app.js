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

innerDoor.addEventListener('click', () => goToScene('expression'));

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

loadPreferences();
setDoorProgress(0);
goToScene('door', { focus: false });
