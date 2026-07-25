'use strict';

const {
  MAX_EXPRESSION_LENGTH,
  MAX_FOLLOW_UP_LENGTH,
  MAX_FOLLOW_UPS,
  EXPRESSION_MODES,
  CONVERSATION_NEEDS,
  FOLLOW_UP_TARGETS,
  SAFETY_STATES,
  SAFETY_REASON_CODES,
  PROCESSING_FAILURES,
} = require('./constants');

function assertEnum(value, allowed, label) {
  if (!allowed.includes(value)) {
    throw new Error('Invalid ' + label + ': ' + String(value));
  }
  return value;
}

function normalizeText(value, label, maxLength, { allowEmpty = false } = {}) {
  if (typeof value !== 'string') throw new Error(label + ' must be a string');
  const normalized = value.replace(/\r\n?/g, '\n').trim();
  if (!allowEmpty && normalized.length === 0) throw new Error(label + ' cannot be empty');
  if (normalized.length > maxLength) throw new Error(label + ' exceeds maximum length');
  return normalized;
}

function normalizeConversationNeed(value) {
  if (value === null || value === undefined || value === '') return null;
  return assertEnum(value, CONVERSATION_NEEDS, 'conversation need');
}

function assertSingleQuestion(prompt) {
  const normalized = normalizeText(prompt, 'follow-up prompt', 240);
  const questionMarks = normalized.match(/[?？]/g) || [];
  if (questionMarks.length > 1) {
    throw new Error('A follow-up must ask only one question');
  }
  return normalized;
}

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

class ExpressionSession {
  #rawExpression = null;
  #followUpAnswers = new Map();

  constructor({ conversationNeed = null } = {}) {
    this.expressionMode = null;
    this.conversationNeed = normalizeConversationNeed(conversationNeed);
    this.followUps = [];
    this.safetyState = 'safety_check_required';
    this.safetyReasonCode = 'direct_confirmation_required';
    this.status = 'collecting_expression';
    this.processingFailure = null;
    this.safeStoryBrief = null;
    this.crisisResources = null;
    this.storyGenerationAllowed = false;
  }

  submitExpression({ mode = 'free_text', text = '', conversationNeed = this.conversationNeed } = {}) {
    this.#assertActive();
    assertEnum(mode, EXPRESSION_MODES, 'expression mode');
    const normalizedNeed = normalizeConversationNeed(conversationNeed);

    if (mode === 'free_text') {
      this.#rawExpression = normalizeText(text, 'expression', MAX_EXPRESSION_LENGTH);
    } else {
      const normalized = normalizeText(String(text || ''), 'expression', MAX_EXPRESSION_LENGTH, { allowEmpty: true });
      if (normalized) throw new Error('not_sure_how_to_say mode must not include free text');
      this.#rawExpression = null;
    }

    this.expressionMode = mode;
    this.conversationNeed = normalizedNeed;
    this.status = 'awaiting_safety_decision';
    this.processingFailure = null;
    return this.snapshot();
  }

  addFollowUp({ id, target, prompt }) {
    this.#assertActive();
    if (!this.expressionMode) throw new Error('Expression must be submitted before a follow-up');
    if (this.followUps.length >= MAX_FOLLOW_UPS) throw new Error('Follow-up limit reached');
    const normalizedId = normalizeText(id, 'follow-up id', 80);
    if (this.followUps.some((item) => item.id === normalizedId)) throw new Error('Follow-up id must be unique');
    assertEnum(target, FOLLOW_UP_TARGETS, 'follow-up target');

    this.followUps.push({
      id: normalizedId,
      target,
      prompt: assertSingleQuestion(prompt),
      status: 'pending',
    });
    this.status = 'collecting_follow_up';
    return clone(this.followUps[this.followUps.length - 1]);
  }

  answerFollowUp(id, answer) {
    this.#assertActive();
    const followUp = this.#pendingFollowUp(id);
    const normalized = normalizeText(answer, 'follow-up answer', MAX_FOLLOW_UP_LENGTH);
    this.#followUpAnswers.set(followUp.id, normalized);
    followUp.status = 'answered';
    this.status = 'awaiting_safety_decision';
    return this.snapshot();
  }

  skipFollowUp(id) {
    this.#assertActive();
    const followUp = this.#pendingFollowUp(id);
    this.#followUpAnswers.delete(followUp.id);
    followUp.status = 'skipped';
    this.status = 'awaiting_safety_decision';
    return this.snapshot();
  }

  readTransientForSafety() {
    this.#assertActive();
    if (!this.expressionMode) throw new Error('Expression has not been submitted');
    return {
      expressionMode: this.expressionMode,
      rawExpression: this.#rawExpression,
      followUpAnswers: this.followUps
        .filter((item) => item.status === 'answered')
        .map((item) => ({
          id: item.id,
          target: item.target,
          answer: this.#followUpAnswers.get(item.id),
        })),
    };
  }

  applySafetyDecision({ state, reasonCode, resourcePack = null, now = new Date() }) {
    this.#assertActive();
    assertEnum(state, SAFETY_STATES, 'safety state');
    assertEnum(reasonCode, SAFETY_REASON_CODES, 'safety reason code');

    const validPair = (
      (state === 'story_safe' && reasonCode === 'story_route_allowed')
      || (state === 'safety_check_required' && reasonCode === 'direct_confirmation_required')
      || (state === 'crisis_route' && ['current_danger_confirmed', 'current_danger_not_ruled_out'].includes(reasonCode))
    );
    if (!validPair) throw new Error('Safety state and reason code do not match');

    this.safetyState = state;
    this.safetyReasonCode = reasonCode;
    this.processingFailure = null;

    if (state === 'story_safe') {
      this.status = 'ready_for_safe_brief';
      this.storyGenerationAllowed = false;
      this.crisisResources = null;
    } else if (state === 'safety_check_required') {
      this.status = 'awaiting_direct_confirmation';
      this.storyGenerationAllowed = false;
      this.crisisResources = null;
    } else {
      // A crisis decision is fail-closed: scrub first and block generation even if
      // the separately maintained resource pack is missing or stale.
      this.status = 'crisis_route';
      this.storyGenerationAllowed = false;
      this.crisisResources = null;
      this.#scrubTransientInput();
      this.crisisResources = validateMainlandResourcePack(resourcePack, now);
    }

    return this.snapshot();
  }

  finalizeSafeStoryBrief(draft) {
    this.#assertActive();
    if (this.safetyState !== 'story_safe' || this.status !== 'ready_for_safe_brief') {
      throw new Error('SafeStoryBrief requires a story_safe decision');
    }

    this.safeStoryBrief = validateSafeStoryBrief({
      ...draft,
      safetyState: 'story_safe',
      conversationNeed: this.conversationNeed,
    });
    this.status = 'safe_brief_ready';
    this.storyGenerationAllowed = true;
    this.#scrubTransientInput();
    return clone(this.safeStoryBrief);
  }

  recordProcessingFailure(kind) {
    this.#assertActive();
    assertEnum(kind, PROCESSING_FAILURES, 'processing failure');
    this.processingFailure = kind;
    this.status = 'recoverable_failure';
    this.storyGenerationAllowed = false;
    return {
      code: kind === 'timeout' ? 'PROCESSING_TIMEOUT' : 'PROCESSING_FAILED',
      retryable: true,
      message: '这一步暂时没有完成。你可以重试、返回，或离开。',
    };
  }

  resumeAfterFailure() {
    this.#assertActive();
    if (!this.processingFailure) throw new Error('No processing failure to resume');
    this.processingFailure = null;
    this.status = this.safetyState === 'story_safe' ? 'ready_for_safe_brief' : 'awaiting_safety_decision';
    return this.snapshot();
  }

  exit() {
    this.#scrubTransientInput();
    this.safeStoryBrief = null;
    this.crisisResources = null;
    this.storyGenerationAllowed = false;
    this.processingFailure = null;
    this.status = 'exited';
    return this.snapshot();
  }

  canCreateStoryTask() {
    return this.status === 'safe_brief_ready'
      && this.safetyState === 'story_safe'
      && this.storyGenerationAllowed === true;
  }

  assertCanCreateStoryTask() {
    if (!this.canCreateStoryTask()) {
      throw new Error('Story task creation is not allowed for the current expression session');
    }
    return true;
  }

  getCrisisViewModel() {
    if (this.status !== 'crisis_route' || !this.crisisResources) {
      throw new Error('Crisis resources are only available in crisis_route');
    }
    return {
      title: '先把此刻的安全放在故事前面',
      body: '这一刻不会继续生成故事。请优先联系你信任的人或下方已核验资源；如有紧迫危险，请立即联系当地紧急服务。',
      region: this.crisisResources.region,
      scopeNote: this.crisisResources.scopeNote,
      resources: clone(this.crisisResources.resources),
      actions: ['return_to_world', 'leave'],
      generationActions: [],
    };
  }

  snapshot() {
    return {
      expressionMode: this.expressionMode,
      conversationNeed: this.conversationNeed,
      followUps: clone(this.followUps),
      followUpCount: this.followUps.length,
      safetyState: this.safetyState,
      safetyReasonCode: this.safetyReasonCode,
      status: this.status,
      processingFailure: this.processingFailure,
      hasTransientRawInput: this.#rawExpression !== null || this.#followUpAnswers.size > 0,
      safeStoryBriefReady: this.safeStoryBrief !== null,
      crisisResourceCount: this.crisisResources?.resources.length || 0,
      storyGenerationAllowed: this.storyGenerationAllowed,
    };
  }

  toJSON() {
    return this.snapshot();
  }

  #pendingFollowUp(id) {
    const normalizedId = normalizeText(id, 'follow-up id', 80);
    const followUp = this.followUps.find((item) => item.id === normalizedId);
    if (!followUp) throw new Error('Unknown follow-up: ' + normalizedId);
    if (followUp.status !== 'pending') throw new Error('Follow-up is already resolved');
    return followUp;
  }

  #scrubTransientInput() {
    this.#rawExpression = null;
    this.#followUpAnswers.clear();
    for (const followUp of this.followUps) delete followUp.prompt;
  }

  #assertActive() {
    if (this.status === 'exited') throw new Error('Expression session has ended');
    if (this.status === 'crisis_route') throw new Error('Expression session is in crisis_route');
    if (this.status === 'safe_brief_ready') throw new Error('Expression session is already finalized');
  }
}

function validateSafeStoryBrief(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('SafeStoryBrief must be an object');
  }
  const allowedKeys = new Set([
    'schemaVersion',
    'coreTension',
    'feltPressure',
    'repeatedResponse',
    'fearedMeaning',
    'desiredDirection',
    'usableFacts',
    'boundaries',
    'safetyState',
    'conversationNeed',
    'confirmedQuote',
  ]);
  for (const key of Object.keys(value)) {
    if (!allowedKeys.has(key)) throw new Error('SafeStoryBrief contains unsupported field: ' + key);
  }

  const brief = {
    schemaVersion: normalizeText(value.schemaVersion, 'schemaVersion', 32),
    coreTension: normalizeText(value.coreTension, 'coreTension', 600),
    feltPressure: normalizeText(value.feltPressure, 'feltPressure', 400),
    repeatedResponse: normalizeText(value.repeatedResponse, 'repeatedResponse', 400),
    fearedMeaning: normalizeText(value.fearedMeaning, 'fearedMeaning', 400),
    desiredDirection: normalizeText(value.desiredDirection, 'desiredDirection', 400),
    usableFacts: normalizeStringArray(value.usableFacts, 'usableFacts', 8, 300),
    boundaries: normalizeStringArray(value.boundaries, 'boundaries', 8, 300),
    safetyState: assertEnum(value.safetyState, ['story_safe'], 'SafeStoryBrief safety state'),
    conversationNeed: normalizeConversationNeed(value.conversationNeed),
    confirmedQuote: value.confirmedQuote == null
      ? null
      : normalizeText(value.confirmedQuote, 'confirmedQuote', 120),
  };

  const serialized = JSON.stringify(brief);
  if (/raw_?input|original_?text|risk_?text|verbatim_?input|full_?conversation/i.test(serialized)) {
    throw new Error('SafeStoryBrief must not contain raw-input fields');
  }
  return Object.freeze(brief);
}

function normalizeStringArray(value, label, maxItems, maxItemLength) {
  if (!Array.isArray(value) || value.length > maxItems) {
    throw new Error(label + ' must be an array with at most ' + maxItems + ' items');
  }
  return value.map((item, index) => normalizeText(item, label + '[' + index + ']', maxItemLength));
}

function validateMainlandResourcePack(value, now = new Date()) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('A verified mainland resource pack is required');
  }
  if (value.region !== 'CN-mainland') throw new Error('Resource pack must target CN-mainland');
  if (value.status !== 'verified') throw new Error('Resource pack must be verified');

  const verifiedAt = parseDate(value.verifiedAt, 'verifiedAt');
  const expiresAt = parseDate(value.expiresAt, 'expiresAt');
  const current = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(current.getTime())) throw new Error('now must be a valid date');
  if (verifiedAt > current) throw new Error('Resource pack cannot be verified in the future');
  if (expiresAt < current) throw new Error('Resource pack verification has expired');
  if (expiresAt < verifiedAt) throw new Error('Resource pack expiry precedes verification');

  const scopeNote = normalizeText(value.scopeNote, 'resource pack scopeNote', 300);
  if (!Array.isArray(value.resources) || value.resources.length === 0 || value.resources.length > 12) {
    throw new Error('Resource pack must contain 1..12 resources');
  }
  const resources = value.resources.map((resource, index) => {
    if (!resource || typeof resource !== 'object' || Array.isArray(resource)) {
      throw new Error('resource[' + index + '] must be an object');
    }
    return {
      id: normalizeText(resource.id, 'resource id', 80),
      label: normalizeText(resource.label, 'resource label', 120),
      contact: normalizeText(resource.contact, 'resource contact', 160),
      availability: normalizeText(resource.availability, 'resource availability', 160),
      sourceName: normalizeText(resource.sourceName, 'resource sourceName', 160),
    };
  });

  return Object.freeze({
    region: 'CN-mainland',
    status: 'verified',
    verifiedAt: verifiedAt.toISOString().slice(0, 10),
    expiresAt: expiresAt.toISOString().slice(0, 10),
    scopeNote,
    resources: Object.freeze(resources),
  });
}

function parseDate(value, label) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(label + ' must use YYYY-MM-DD');
  }
  const date = new Date(value + 'T00:00:00.000Z');
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error(label + ' must be a valid calendar date');
  }
  return date;
}

module.exports = {
  ExpressionSession,
  validateSafeStoryBrief,
  validateMainlandResourcePack,
};
