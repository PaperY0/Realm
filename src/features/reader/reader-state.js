'use strict';

const CHAPTER_COUNT = 7;
const READER_SNAPSHOT_VERSION = 1;
const READER_PHASES = Object.freeze({
  READING: 'reading',
  CLOSED: 'closed',
});

const PAGE_TURN_DURATIONS_MS = Object.freeze({
  standard: 550,
  reduced: 200,
});

class ReaderStateError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'ReaderStateError';
    this.code = code;
  }
}

function fail(code, message) {
  throw new ReaderStateError(code, message);
}

function isPlainObject(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function normalizeChapterId(chapter, chapterNumber) {
  const candidate = chapter.chapterId ?? chapter.id ?? `chapter-${chapterNumber}`;
  if (typeof candidate !== 'string' || candidate.trim().length === 0) {
    fail('INVALID_CHAPTER_ID', `Chapter ${chapterNumber} must have a non-empty string id`);
  }
  return candidate.trim();
}

function validateChapters(chapters) {
  if (!Array.isArray(chapters) || chapters.length !== CHAPTER_COUNT) {
    fail('INVALID_CHAPTER_COUNT', `A reader requires exactly ${CHAPTER_COUNT} chapters`);
  }

  const chapterIds = chapters.map((chapter, index) => {
    const expectedChapterNumber = index + 1;
    if (!isPlainObject(chapter)) {
      fail('INVALID_CHAPTER', `Chapter ${expectedChapterNumber} must be a plain object`);
    }
    if (chapter.chapterNumber !== expectedChapterNumber) {
      fail(
        'INVALID_CHAPTER_SEQUENCE',
        `Expected chapter ${expectedChapterNumber}, received ${String(chapter.chapterNumber)}`,
      );
    }
    return normalizeChapterId(chapter, expectedChapterNumber);
  });

  if (new Set(chapterIds).size !== CHAPTER_COUNT) {
    fail('DUPLICATE_CHAPTER_ID', 'Every chapter must have a unique id');
  }

  return Object.freeze(chapterIds);
}

function assertInteger(value, label) {
  if (!Number.isInteger(value)) fail('INVALID_SNAPSHOT', `${label} must be an integer`);
}

function assertSnapshot(snapshot, chapterIds) {
  if (!isPlainObject(snapshot)) fail('INVALID_SNAPSHOT', 'Reader snapshot must be a plain object');
  if (snapshot.version !== READER_SNAPSHOT_VERSION) {
    fail('UNSUPPORTED_SNAPSHOT', `Unsupported reader snapshot version: ${String(snapshot.version)}`);
  }
  if (snapshot.chapterCount !== CHAPTER_COUNT) {
    fail('INVALID_SNAPSHOT', `Snapshot must describe exactly ${CHAPTER_COUNT} chapters`);
  }
  if (!Object.values(READER_PHASES).includes(snapshot.phase)) {
    fail('INVALID_SNAPSHOT', `Invalid reader phase: ${String(snapshot.phase)}`);
  }

  assertInteger(snapshot.currentChapter, 'currentChapter');
  if (snapshot.currentChapter < 1 || snapshot.currentChapter > CHAPTER_COUNT) {
    fail('CHAPTER_OUT_OF_BOUNDS', `currentChapter must be between 1 and ${CHAPTER_COUNT}`);
  }
  if (snapshot.phase === READER_PHASES.CLOSED && snapshot.currentChapter !== CHAPTER_COUNT) {
    fail('INVALID_SNAPSHOT', 'A closed book must remain on chapter 7');
  }

  if (!Array.isArray(snapshot.chapterIds) || snapshot.chapterIds.length !== CHAPTER_COUNT) {
    fail('INVALID_SNAPSHOT', `Snapshot must include exactly ${CHAPTER_COUNT} chapter ids`);
  }
  if (snapshot.chapterIds.some((id, index) => id !== chapterIds[index])) {
    fail('CHAPTER_SET_MISMATCH', 'Snapshot chapters do not match the supplied book');
  }
}

function presentationFor({ reducedMotion = false } = {}) {
  return Object.freeze({
    reducedMotion: Boolean(reducedMotion),
    pageTurnDurationMs: reducedMotion
      ? PAGE_TURN_DURATIONS_MS.reduced
      : PAGE_TURN_DURATIONS_MS.standard,
  });
}

class ReaderState {
  #chapterIds;

  constructor({ chapters, snapshot = null } = {}) {
    this.#chapterIds = validateChapters(chapters);

    if (snapshot === null || snapshot === undefined) {
      this.phase = READER_PHASES.READING;
      this.currentChapter = 1;
      return;
    }

    assertSnapshot(snapshot, this.#chapterIds);
    this.phase = snapshot.phase;
    this.currentChapter = snapshot.currentChapter;
  }

  canGoPrevious() {
    return this.phase === READER_PHASES.READING && this.currentChapter > 1;
  }

  canGoNext() {
    return this.phase === READER_PHASES.READING && this.currentChapter < CHAPTER_COUNT;
  }

  canCloseBook() {
    return this.phase === READER_PHASES.READING && this.currentChapter === CHAPTER_COUNT;
  }

  previousChapter() {
    this.#assertReading();
    if (!this.canGoPrevious()) {
      fail('CHAPTER_OUT_OF_BOUNDS', 'Cannot move before chapter 1');
    }
    this.currentChapter -= 1;
    return this.snapshot();
  }

  nextChapter() {
    this.#assertReading();
    if (!this.canGoNext()) {
      fail('CHAPTER_OUT_OF_BOUNDS', 'Cannot move past chapter 7; close the book explicitly');
    }
    this.currentChapter += 1;
    return this.snapshot();
  }

  mediaEnded() {
    this.#assertReading();
    return this.snapshot();
  }

  closeBook() {
    this.#assertReading();
    if (!this.canCloseBook()) {
      fail('BOOK_CLOSE_NOT_ALLOWED', 'The book can only be closed explicitly from chapter 7');
    }
    this.phase = READER_PHASES.CLOSED;
    return this.snapshot();
  }

  snapshot() {
    return {
      version: READER_SNAPSHOT_VERSION,
      phase: this.phase,
      currentChapter: this.currentChapter,
      chapterCount: CHAPTER_COUNT,
      chapterIds: [...this.#chapterIds],
    };
  }

  #assertReading() {
    if (this.phase !== READER_PHASES.READING) {
      fail('BOOK_ALREADY_CLOSED', 'The closed book cannot be paged');
    }
  }

  static restore({ chapters, snapshot } = {}) {
    return new ReaderState({ chapters, snapshot });
  }
}

function createReaderState(options) {
  return new ReaderState(options);
}

function restoreReaderState(options) {
  return ReaderState.restore(options);
}

module.exports = {
  CHAPTER_COUNT,
  READER_SNAPSHOT_VERSION,
  READER_PHASES,
  PAGE_TURN_DURATIONS_MS,
  ReaderStateError,
  ReaderState,
  validateChapters,
  presentationFor,
  createReaderState,
  restoreReaderState,
};
