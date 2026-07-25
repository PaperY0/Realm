'use strict';

const MAX_EXPRESSION_LENGTH = 4000;
const MAX_FOLLOW_UP_LENGTH = 2000;
const MAX_FOLLOW_UPS = 2;

const EXPRESSION_MODES = Object.freeze([
  'free_text',
  'not_sure_how_to_say',
]);

const CONVERSATION_NEEDS = Object.freeze([
  'stay_with_me',
  'help_me_sort_it_out',
  'give_me_courage',
  'leave_it_here',
]);

const FOLLOW_UP_TARGETS = Object.freeze([
  'situation',
  'felt_pressure',
  'repeated_response',
  'feared_meaning',
  'desired_direction',
]);

const SAFETY_STATES = Object.freeze([
  'story_safe',
  'safety_check_required',
  'crisis_route',
]);

const SAFETY_REASON_CODES = Object.freeze([
  'story_route_allowed',
  'direct_confirmation_required',
  'current_danger_confirmed',
  'current_danger_not_ruled_out',
]);

const PROCESSING_FAILURES = Object.freeze([
  'timeout',
  'failure',
]);

module.exports = {
  MAX_EXPRESSION_LENGTH,
  MAX_FOLLOW_UP_LENGTH,
  MAX_FOLLOW_UPS,
  EXPRESSION_MODES,
  CONVERSATION_NEEDS,
  FOLLOW_UP_TARGETS,
  SAFETY_STATES,
  SAFETY_REASON_CODES,
  PROCESSING_FAILURES,
};
