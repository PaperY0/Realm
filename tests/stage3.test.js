'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { SQLiteStore } = require('../src/storage/sqlite-store');

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dream-book-stage3-'));
const dbPath = path.join(tempRoot, 'state.sqlite');
const mediaRoot = path.join(tempRoot, 'media');
const bookId = 'book-stage3-001';
const visitorId = 'visitor-stage3-01';
const sessionId = 'session-stage3-01';

let store;
try {
  store = new SQLiteStore({ dbPath, mediaRoot });

  // Visitor/session are anonymous and recoverable from SQLite.
  assert.equal(store.ensureVisitor(visitorId).visitorId, visitorId);
  assert.equal(store.createSession({ sessionId, visitorId }).currentBookId, null);
  assert.equal(store.getSession(sessionId).status, 'active');

  assert.deepEqual(store.listBooks(), []);
  const created = store.createBook({
    bookId,
    visitorId,
    sessionId,
    metadata: { source: 'stage3-test' },
  });
  assert.equal(created.workflowState, 'entry');
  assert.equal(created.safetyState, 'story_safe');
  assert.deepEqual(created.metadata, { source: 'stage3-test' });
  assert.equal(store.getSession(sessionId).currentBookId, bookId);

  // Every book starts with seven independent chapter records.
  assert.equal(store.listChapters(bookId).length, 7);
  assert.deepEqual(store.listChapters(bookId).map((chapter) => chapter.chapterNumber), [1, 2, 3, 4, 5, 6, 7]);
  assert.ok(store.listChapters(bookId).every((chapter) => chapter.illustrationState === 'planned'));

  const expression = store.transitionWorkflow(bookId, 'expression');
  assert.equal(expression.workflowState, 'expression');
  assert.throws(() => store.transitionWorkflow(bookId, 'completed'), /Illegal workflow transition/);

  const chapter = store.saveChapter({
    bookId,
    chapterNumber: 1,
    illustrationState: 'planned',
    illustrationPath: 'chapters/chapter-1.png',
    motionPath: null,
    metadata: { role: 'primary' },
  });
  assert.equal(chapter.illustrationPath, 'chapters/chapter-1.png');
  assert.equal(store.listChapters(bookId).length, 7);
  assert.throws(() => store.updateIllustrationState(bookId, 1, 'approved'), /Illegal illustration transition/);
  assert.equal(store.updateIllustrationState(bookId, 1, 'queued').illustrationState, 'queued');
  assert.equal(store.getChapter(bookId, 2).illustrationState, 'planned');

  const mediaFile = store.mediaPathFor(bookId, 'chapters/chapter-1.png');
  assert.equal(mediaFile, path.join(mediaRoot, bookId, 'chapters', 'chapter-1.png'));
  assert.throws(() => store.mediaPathFor(bookId, '../outside.png'), /invalid segment|portable|escapes/);
  assert.throws(() => store.mediaPathFor(bookId, 'C:/outside.png'), /portable/);
  assert.throws(() => store.mediaPathFor(bookId, '/outside.png'), /portable/);
  assert.throws(() => store.saveChapter({
    bookId: 'other-book-001',
    chapterNumber: 1,
    illustrationState: 'planned',
    illustrationPath: 'chapter.png',
  }), /Unknown book/);

  // Raw user input is rejected before it can reach SQLite.
  assert.throws(() => store.recordEvent({
    bookId,
    visitorId,
    type: 'SAFETY_EVENT',
    payload: { raw_input: 'must not persist' },
  }), /Raw input is not allowed/);
  assert.equal(store.listEvents(bookId).some((event) => JSON.stringify(event).includes('must not persist')), false);

  const columns = store.db.prepare('PRAGMA table_info(chapters)').all().map((column) => column.name);
  assert.equal(columns.includes('blob'), false);
  assert.equal(columns.includes('illustration_path'), true);

  store.ensureBookMediaDir(bookId);
  fs.mkdirSync(path.dirname(mediaFile), { recursive: true });
  fs.writeFileSync(mediaFile, 'placeholder');
  store.close();

  // Reopen the same DB and recover state and media reference.
  store = new SQLiteStore({ dbPath, mediaRoot });
  assert.equal(store.getBook(bookId).workflowState, 'expression');
  assert.equal(store.getChapter(bookId, 1).illustrationState, 'queued');
  assert.equal(store.listChapters(bookId).length, 7);
  assert.equal(fs.existsSync(mediaFile), true);

  // Reset removes only the current book and its isolated media directory.
  assert.equal(store.resetBook(bookId), true);
  assert.equal(store.getBook(bookId), null);
  assert.equal(store.listChapters(bookId).length, 0);
  assert.equal(store.getSession(sessionId).currentBookId, null);
  assert.equal(fs.existsSync(path.join(mediaRoot, bookId)), false);
  assert.equal(fs.existsSync(mediaRoot), true);
  assert.equal(store.resetBook(bookId), false);

  console.log('stage3 tests passed');
} finally {
  store?.close();
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
