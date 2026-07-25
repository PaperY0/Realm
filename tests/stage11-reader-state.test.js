'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  CHAPTER_COUNT,
  READER_PHASES,
  ReaderStateError,
  createReaderState,
  restoreReaderState,
  presentationFor,
} = require('../src/features/reader/reader-state');

function sevenChapters(prefix = 'chapter') {
  return Array.from({ length: CHAPTER_COUNT }, (_, index) => ({
    chapterNumber: index + 1,
    chapterId: `${prefix}-${index + 1}`,
    title: `第${index + 1}章`,
  }));
}

function assertReaderError(fn, code) {
  assert.throws(fn, (error) => {
    assert.equal(error instanceof ReaderStateError, true);
    assert.equal(error.code, code);
    return true;
  });
}

// A book cannot open with fewer, extra, duplicated, missing, or disordered chapters.
assertReaderError(() => createReaderState({ chapters: sevenChapters().slice(0, 6) }), 'INVALID_CHAPTER_COUNT');
assertReaderError(() => createReaderState({ chapters: [...sevenChapters(), { chapterNumber: 8 }] }), 'INVALID_CHAPTER_COUNT');
assertReaderError(() => {
  const chapters = sevenChapters();
  chapters[3].chapterNumber = 5;
  return createReaderState({ chapters });
}, 'INVALID_CHAPTER_SEQUENCE');
assertReaderError(() => {
  const chapters = sevenChapters();
  chapters[6].chapterId = chapters[5].chapterId;
  return createReaderState({ chapters });
}, 'DUPLICATE_CHAPTER_ID');

const reader = createReaderState({ chapters: sevenChapters() });
assert.deepEqual(reader.snapshot(), {
  version: 1,
  phase: READER_PHASES.READING,
  currentChapter: 1,
  chapterCount: 7,
  chapterIds: sevenChapters().map((chapter) => chapter.chapterId),
});
assert.equal(reader.canGoPrevious(), false);
assert.equal(reader.canGoNext(), true);
assert.equal(reader.canCloseBook(), false);

// Media completion never advances the story; only explicit page commands do.
const beforeMediaEnded = reader.snapshot();
assert.deepEqual(reader.mediaEnded(), beforeMediaEnded);
assert.deepEqual(reader.snapshot(), beforeMediaEnded);
assertReaderError(() => reader.previousChapter(), 'CHAPTER_OUT_OF_BOUNDS');
assertReaderError(() => reader.closeBook(), 'BOOK_CLOSE_NOT_ALLOWED');

// Each explicit next/previous action moves exactly one chapter and never crosses a boundary.
for (let chapter = 2; chapter <= CHAPTER_COUNT; chapter += 1) {
  const previous = reader.currentChapter;
  const nextSnapshot = reader.nextChapter();
  assert.equal(nextSnapshot.currentChapter, chapter);
  assert.equal(nextSnapshot.currentChapter - previous, 1);
  assert.equal(nextSnapshot.phase, READER_PHASES.READING);
}
assert.equal(reader.canGoNext(), false);
assert.equal(reader.canCloseBook(), true);
assertReaderError(() => reader.nextChapter(), 'CHAPTER_OUT_OF_BOUNDS');
assert.equal(reader.currentChapter, 7);
assert.equal(reader.phase, READER_PHASES.READING, 'chapter 7 must not auto-close');

const previousSnapshot = reader.previousChapter();
assert.equal(previousSnapshot.currentChapter, 6);
assert.equal(reader.canCloseBook(), false);
assertReaderError(() => reader.closeBook(), 'BOOK_CLOSE_NOT_ALLOWED');
reader.nextChapter();

// Closing is a separate user action available only after reaching chapter 7.
const closedSnapshot = reader.closeBook();
assert.equal(closedSnapshot.phase, READER_PHASES.CLOSED);
assert.equal(closedSnapshot.currentChapter, 7);
assertReaderError(() => reader.nextChapter(), 'BOOK_ALREADY_CLOSED');
assertReaderError(() => reader.previousChapter(), 'BOOK_ALREADY_CLOSED');
assertReaderError(() => reader.mediaEnded(), 'BOOK_ALREADY_CLOSED');
assertReaderError(() => reader.closeBook(), 'BOOK_ALREADY_CLOSED');

// Snapshot is plain JSON and restores the exact local reading/closed state after refresh.
const serialized = JSON.stringify(closedSnapshot);
const parsed = JSON.parse(serialized);
const restored = restoreReaderState({ chapters: sevenChapters(), snapshot: parsed });
assert.deepEqual(restored.snapshot(), closedSnapshot);
assert.notEqual(restored.snapshot(), closedSnapshot);

const readingReader = createReaderState({ chapters: sevenChapters('resume') });
readingReader.nextChapter();
readingReader.nextChapter();
const readingSnapshot = JSON.parse(JSON.stringify(readingReader.snapshot()));
const restoredReading = restoreReaderState({ chapters: sevenChapters('resume'), snapshot: readingSnapshot });
assert.equal(restoredReading.phase, READER_PHASES.READING);
assert.equal(restoredReading.currentChapter, 3);
restoredReading.nextChapter();
assert.equal(restoredReading.currentChapter, 4);

// Corrupt, out-of-range, or wrong-book snapshots are rejected before opening.
assertReaderError(() => restoreReaderState({
  chapters: sevenChapters(),
  snapshot: { ...closedSnapshot, currentChapter: 8 },
}), 'CHAPTER_OUT_OF_BOUNDS');
assertReaderError(() => restoreReaderState({
  chapters: sevenChapters(),
  snapshot: { ...closedSnapshot, phase: READER_PHASES.CLOSED, currentChapter: 6 },
}), 'INVALID_SNAPSHOT');
assertReaderError(() => restoreReaderState({
  chapters: sevenChapters('different'),
  snapshot: closedSnapshot,
}), 'CHAPTER_SET_MISMATCH');
assertReaderError(() => restoreReaderState({
  chapters: sevenChapters(),
  snapshot: { ...closedSnapshot, chapterIds: closedSnapshot.chapterIds.slice(0, 6) },
}), 'INVALID_SNAPSHOT');

// Reduced motion changes presentation timing only; navigation state and persistence are identical.
const motionReader = createReaderState({ chapters: sevenChapters('motion') });
const stateBeforeMotionChoice = motionReader.snapshot();
const standardPresentation = presentationFor({ reducedMotion: false });
const reducedPresentation = presentationFor({ reducedMotion: true });
assert.equal(standardPresentation.reducedMotion, false);
assert.equal(reducedPresentation.reducedMotion, true);
assert.ok(reducedPresentation.pageTurnDurationMs < standardPresentation.pageTurnDurationMs);
assert.deepEqual(motionReader.snapshot(), stateBeforeMotionChoice);
assert.equal(Object.hasOwn(motionReader.snapshot(), 'reducedMotion'), false);

// The reader state module is local and deterministic: no network, filesystem, or media generation hooks.
const source = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'features', 'reader', 'reader-state.js'),
  'utf8',
);
assert.doesNotMatch(source, /\bfetch\s*\(|https?:\/\/|node:(?:http|https|fs)|image-generation|media-generation|Math\.random|Date\.now/);

console.log('stage11 reader state tests passed');
