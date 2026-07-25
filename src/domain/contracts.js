'use strict';

const {
  assertWorkflowState,
  assertSafetyState,
  assertIllustrationState,
} = require('./state-machine');

const VISITOR_ID_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;
const BOOK_ID_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;
const EVENT_TYPES = Object.freeze([
  'SESSION_OPENED',
  'WORKFLOW_TRANSITIONED',
  'SAFETY_EVENT',
  'CRISIS_ROUTE_ENTERED',
  'STORY_BRIEF_ACCEPTED',
  'BOOK_CREATED',
  'CHAPTER_UPDATED',
  'MEDIA_RECORDED',
  'BOOK_RESET',
]);

function assertString(value, label, { min = 1, max = 10000 } = {}) {
  if (typeof value !== 'string' || value.length < min || value.length > max) {
    throw new Error(label + ' must be a string with length ' + min + '..' + max);
  }
  return value;
}

function assertId(value, label, pattern) {
  assertString(value, label, { min: 8, max: 128 });
  if (!pattern.test(value)) throw new Error(label + ' contains unsupported characters');
  return value;
}

function assertVisitorId(value) {
  return assertId(value, 'visitor_id', VISITOR_ID_PATTERN);
}

function assertBookId(value) {
  return assertId(value, 'book_id', BOOK_ID_PATTERN);
}

function assertEventType(value) {
  if (typeof value !== 'string' || !EVENT_TYPES.includes(value)) {
    throw new Error('Invalid event type: ' + String(value));
  }
  return value;
}

function assertPlainObject(value, label) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(label + ' must be a plain object');
  }
  return value;
}

function assertNoRawInput(value, location = 'payload') {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoRawInput(item, location + '[' + index + ']'));
    return value;
  }
  if (typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      if (/^(raw_?input|original_?text|risk_?text|verbatim_?input)$/i.test(key)) {
        throw new Error('Raw input is not allowed in ' + location + '.' + key);
      }
      assertNoRawInput(child, location + '.' + key);
    }
  }
  return value;
}

function assertRelativeMediaPath(value) {
  assertString(value, 'media relative path', { min: 1, max: 512 });
  if (value.includes('\\') || value.includes('\0') || value.startsWith('/') || /^[A-Za-z]:[\/]/.test(value)) {
    throw new Error('Media path must be relative and portable');
  }
  const segments = value.split('/');
  if (segments.some((segment) => !segment || segment === '.' || segment === '..')) {
    throw new Error('Media path contains an invalid segment');
  }
  return value;
}

function assertSafeStoryBrief(brief) {
  assertPlainObject(brief, 'safe_story_brief');
  assertNoRawInput(brief, 'safe_story_brief');
  assertString(brief.schemaVersion, 'safe_story_brief.schemaVersion', { min: 1, max: 64 });
  assertString(brief.echoWord, 'safe_story_brief.echoWord', { min: 1, max: 80 });
  assertString(brief.openingState, 'safe_story_brief.openingState', { min: 1, max: 2000 });
  assertString(brief.endingState, 'safe_story_brief.endingState', { min: 1, max: 2000 });
  if (!Array.isArray(brief.chapterFunctions) || brief.chapterFunctions.length !== 7 || brief.chapterFunctions.some((item) => typeof item !== 'string' || !item.trim())) {
    throw new Error('safe_story_brief.chapterFunctions must contain exactly 7 non-empty strings');
  }
  return brief;
}

function assertChapterRecord(chapter) {
  assertPlainObject(chapter, 'chapter');
  assertBookId(chapter.bookId);
  if (!Number.isInteger(chapter.chapterNumber) || chapter.chapterNumber < 1 || chapter.chapterNumber > 7) {
    throw new Error('chapterNumber must be an integer from 1 to 7');
  }
  assertIllustrationState(chapter.illustrationState);
  if (chapter.illustrationPath !== null && chapter.illustrationPath !== undefined) assertRelativeMediaPath(chapter.illustrationPath);
  if (chapter.motionPath !== null && chapter.motionPath !== undefined) assertRelativeMediaPath(chapter.motionPath);
  return chapter;
}

module.exports = {
  VISITOR_ID_PATTERN,
  BOOK_ID_PATTERN,
  EVENT_TYPES,
  assertString,
  assertVisitorId,
  assertBookId,
  assertEventType,
  assertPlainObject,
  assertNoRawInput,
  assertRelativeMediaPath,
  assertSafeStoryBrief,
  assertChapterRecord,
  assertWorkflowState,
  assertSafetyState,
  assertIllustrationState,
};
