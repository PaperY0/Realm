'use strict';

const WORKFLOW_STATES = Object.freeze([
  'entry',
  'expression',
  'safety_check_required',
  'planning',
  'generating_illustrations',
  'first_chapter_ready',
  'reading',
  'closing',
  'reflection',
  'crisis_route',
  'completed',
]);

const SAFETY_STATES = Object.freeze([
  'story_safe',
  'safety_check_required',
  'crisis_route',
]);

const ILLUSTRATION_STATES = Object.freeze([
  'planned',
  'queued',
  'generating',
  'validating',
  'awaiting_human_review',
  'approved',
  'rejected',
  'failed',
]);

const WORKFLOW_TRANSITIONS = Object.freeze({
  entry: Object.freeze(['expression', 'crisis_route']),
  expression: Object.freeze(['safety_check_required', 'planning', 'crisis_route']),
  safety_check_required: Object.freeze(['expression', 'planning', 'crisis_route']),
  planning: Object.freeze(['generating_illustrations', 'crisis_route']),
  generating_illustrations: Object.freeze(['first_chapter_ready', 'crisis_route']),
  first_chapter_ready: Object.freeze(['reading', 'crisis_route']),
  reading: Object.freeze(['closing', 'crisis_route']),
  closing: Object.freeze(['reflection', 'crisis_route']),
  reflection: Object.freeze(['completed', 'crisis_route']),
  crisis_route: Object.freeze([]),
  completed: Object.freeze([]),
});

const ILLUSTRATION_TRANSITIONS = Object.freeze({
  planned: Object.freeze(['queued', 'failed']),
  queued: Object.freeze(['generating', 'failed']),
  generating: Object.freeze(['validating', 'failed']),
  validating: Object.freeze(['awaiting_human_review', 'failed']),
  awaiting_human_review: Object.freeze(['approved', 'rejected', 'failed']),
  approved: Object.freeze([]),
  rejected: Object.freeze(['queued', 'failed']),
  failed: Object.freeze(['queued']),
});

function assertMember(value, allowed, label) {
  if (typeof value !== 'string' || !allowed.includes(value)) {
    throw new Error('Invalid ' + label + ': ' + String(value));
  }
  return value;
}

function assertWorkflowState(state) {
  return assertMember(state, WORKFLOW_STATES, 'workflow state');
}

function assertSafetyState(state) {
  return assertMember(state, SAFETY_STATES, 'safety state');
}

function assertIllustrationState(state) {
  return assertMember(state, ILLUSTRATION_STATES, 'illustration state');
}

function canTransitionWorkflow(from, to) {
  assertWorkflowState(from);
  assertWorkflowState(to);
  return WORKFLOW_TRANSITIONS[from].includes(to);
}

function transitionWorkflow(from, to) {
  if (!canTransitionWorkflow(from, to)) {
    throw new Error('Illegal workflow transition: ' + from + ' -> ' + to);
  }
  return to;
}

function canTransitionIllustration(from, to) {
  assertIllustrationState(from);
  assertIllustrationState(to);
  return ILLUSTRATION_TRANSITIONS[from].includes(to);
}

function transitionIllustration(from, to) {
  if (!canTransitionIllustration(from, to)) {
    throw new Error('Illegal illustration transition: ' + from + ' -> ' + to);
  }
  return to;
}

module.exports = {
  WORKFLOW_STATES,
  SAFETY_STATES,
  ILLUSTRATION_STATES,
  WORKFLOW_TRANSITIONS,
  ILLUSTRATION_TRANSITIONS,
  assertWorkflowState,
  assertSafetyState,
  assertIllustrationState,
  canTransitionWorkflow,
  transitionWorkflow,
  canTransitionIllustration,
  transitionIllustration,
};
