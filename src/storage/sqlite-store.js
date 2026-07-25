'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const {
  assertVisitorId,
  assertBookId,
  assertEventType,
  assertPlainObject,
  assertNoRawInput,
  assertRelativeMediaPath,
  assertChapterRecord,
  assertWorkflowState,
  assertSafetyState,
  assertIllustrationState,
} = require('../domain/contracts');
const { transitionWorkflow, transitionIllustration } = require('../domain/state-machine');

function now() {
  return new Date().toISOString();
}

function encodeJson(value, label) {
  assertPlainObject(value, label);
  assertNoRawInput(value, label);
  return JSON.stringify(value);
}

function decodeJson(value, fallback = {}) {
  return value == null ? fallback : JSON.parse(value);
}

function rowToVisitor(row) {
  if (!row) return null;
  return { visitorId: row.visitor_id, createdAt: row.created_at, updatedAt: row.updated_at };
}

function rowToSession(row) {
  if (!row) return null;
  return {
    sessionId: row.session_id,
    visitorId: row.visitor_id,
    currentBookId: row.current_book_id,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToBook(row) {
  if (!row) return null;
  return {
    bookId: row.book_id,
    visitorId: row.visitor_id,
    workflowState: row.workflow_state,
    safetyState: row.safety_state,
    metadata: decodeJson(row.metadata_json),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToChapter(row) {
  if (!row) return null;
  return {
    bookId: row.book_id,
    chapterNumber: row.chapter_number,
    illustrationState: row.illustration_state,
    illustrationPath: row.illustration_path,
    motionPath: row.motion_path,
    metadata: decodeJson(row.metadata_json),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToEvent(row) {
  if (!row) return null;
  return {
    id: row.id,
    bookId: row.book_id,
    visitorId: row.visitor_id,
    type: row.event_type,
    payload: decodeJson(row.payload_json),
    createdAt: row.created_at,
  };
}

class SQLiteStore {
  constructor({ dbPath, mediaRoot }) {
    if (!dbPath || typeof dbPath !== 'string') throw new Error('dbPath is required');
    if (!mediaRoot || typeof mediaRoot !== 'string') throw new Error('mediaRoot is required');

    this.dbPath = dbPath;
    this.mediaRoot = path.resolve(mediaRoot);
    if (dbPath !== ':memory:') fs.mkdirSync(path.dirname(path.resolve(dbPath)), { recursive: true });
    fs.mkdirSync(this.mediaRoot, { recursive: true });
    this.db = new DatabaseSync(dbPath);
    this.db.exec(`
      PRAGMA foreign_keys = ON;
      PRAGMA journal_mode = WAL;

      CREATE TABLE IF NOT EXISTS visitors (
        visitor_id TEXT PRIMARY KEY,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS sessions (
        session_id TEXT PRIMARY KEY,
        visitor_id TEXT NOT NULL REFERENCES visitors(visitor_id) ON DELETE CASCADE,
        current_book_id TEXT,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS books (
        book_id TEXT PRIMARY KEY,
        visitor_id TEXT NOT NULL REFERENCES visitors(visitor_id) ON DELETE CASCADE,
        workflow_state TEXT NOT NULL,
        safety_state TEXT NOT NULL,
        metadata_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS chapters (
        book_id TEXT NOT NULL REFERENCES books(book_id) ON DELETE CASCADE,
        chapter_number INTEGER NOT NULL CHECK (chapter_number BETWEEN 1 AND 7),
        illustration_state TEXT NOT NULL,
        illustration_path TEXT,
        motion_path TEXT,
        metadata_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (book_id, chapter_number)
      );

      CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        book_id TEXT REFERENCES books(book_id) ON DELETE CASCADE,
        visitor_id TEXT NOT NULL REFERENCES visitors(visitor_id) ON DELETE CASCADE,
        event_type TEXT NOT NULL,
        payload_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_events_book_id ON events(book_id);

      CREATE TABLE IF NOT EXISTS storybook_state (
        state_id INTEGER PRIMARY KEY CHECK (state_id = 1),
        story_package_json TEXT NOT NULL,
        reader_snapshot_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
  }

  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  ensureVisitor(visitorId) {
    assertVisitorId(visitorId);
    const timestamp = now();
    this.db.prepare(
      'INSERT INTO visitors (visitor_id, created_at, updated_at) VALUES (?, ?, ?) ON CONFLICT(visitor_id) DO UPDATE SET updated_at = excluded.updated_at'
    ).run(visitorId, timestamp, timestamp);
    return this.getVisitor(visitorId);
  }

  getVisitor(visitorId) {
    assertVisitorId(visitorId);
    return rowToVisitor(this.db.prepare('SELECT * FROM visitors WHERE visitor_id = ?').get(visitorId));
  }

  createSession({ sessionId, visitorId, status = 'active' }) {
    assertVisitorId(visitorId);
    if (typeof sessionId !== 'string' || sessionId.length < 8 || sessionId.length > 128) throw new Error('session_id must be 8..128 characters');
    if (typeof status !== 'string' || !status) throw new Error('session status is required');
    this.ensureVisitor(visitorId);
    const timestamp = now();
    this.db.prepare(
      'INSERT INTO sessions (session_id, visitor_id, current_book_id, status, created_at, updated_at) VALUES (?, ?, NULL, ?, ?, ?) ON CONFLICT(session_id) DO UPDATE SET status = excluded.status, updated_at = excluded.updated_at'
    ).run(sessionId, visitorId, status, timestamp, timestamp);
    this.recordEvent({ visitorId, type: 'SESSION_OPENED', payload: { sessionId, status } });
    return this.getSession(sessionId);
  }

  getSession(sessionId) {
    if (typeof sessionId !== 'string' || sessionId.length < 8 || sessionId.length > 128) throw new Error('session_id must be 8..128 characters');
    return rowToSession(this.db.prepare('SELECT * FROM sessions WHERE session_id = ?').get(sessionId));
  }

  createBook({ bookId, visitorId, workflowState = 'entry', safetyState = 'story_safe', metadata = {}, sessionId = null }) {
    assertBookId(bookId);
    assertVisitorId(visitorId);
    assertWorkflowState(workflowState);
    assertSafetyState(safetyState);
    if (sessionId !== null) {
      const session = this.getSession(sessionId);
      if (!session || session.visitorId !== visitorId) throw new Error('Unknown or mismatched session: ' + sessionId);
    }
    this.ensureVisitor(visitorId);
    const metadataJson = encodeJson(metadata, 'book metadata');
    const timestamp = now();
    this.db.prepare(
      'INSERT INTO books (book_id, visitor_id, workflow_state, safety_state, metadata_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(bookId, visitorId, workflowState, safetyState, metadataJson, timestamp, timestamp);
    const chapterStatement = this.db.prepare(
      'INSERT INTO chapters (book_id, chapter_number, illustration_state, illustration_path, motion_path, metadata_json, created_at, updated_at) VALUES (?, ?, ?, NULL, NULL, ?, ?, ?)'
    );
    for (let chapterNumber = 1; chapterNumber <= 7; chapterNumber += 1) {
      chapterStatement.run(bookId, chapterNumber, 'planned', '{}', timestamp, timestamp);
    }
    if (sessionId !== null) {
      this.db.prepare('UPDATE sessions SET current_book_id = ?, updated_at = ? WHERE session_id = ?').run(bookId, timestamp, sessionId);
    }
    this.recordEvent({ bookId, visitorId, type: 'BOOK_CREATED', payload: { chapterCount: 7 } });
    return this.getBook(bookId);
  }

  getBook(bookId) {
    assertBookId(bookId);
    return rowToBook(this.db.prepare('SELECT * FROM books WHERE book_id = ?').get(bookId));
  }

  listBooks() {
    return this.db.prepare('SELECT * FROM books ORDER BY created_at ASC').all().map(rowToBook);
  }

  transitionWorkflow(bookId, to) {
    assertBookId(bookId);
    assertWorkflowState(to);
    const book = this.getBook(bookId);
    if (!book) throw new Error('Unknown book: ' + bookId);
    transitionWorkflow(book.workflowState, to);
    const timestamp = now();
    this.db.prepare('UPDATE books SET workflow_state = ?, updated_at = ? WHERE book_id = ?').run(to, timestamp, bookId);
    this.recordEvent({ bookId, visitorId: book.visitorId, type: 'WORKFLOW_TRANSITIONED', payload: { from: book.workflowState, to } });
    return this.getBook(bookId);
  }

  updateSafetyState(bookId, safetyState) {
    assertBookId(bookId);
    assertSafetyState(safetyState);
    const book = this.getBook(bookId);
    if (!book) throw new Error('Unknown book: ' + bookId);
    const timestamp = now();
    this.db.prepare('UPDATE books SET safety_state = ?, updated_at = ? WHERE book_id = ?').run(safetyState, timestamp, bookId);
    this.recordEvent({ bookId, visitorId: book.visitorId, type: 'SAFETY_EVENT', payload: { safetyState } });
    return this.getBook(bookId);
  }

  upsertChapter(chapter) {
    assertChapterRecord(chapter);
    const book = this.getBook(chapter.bookId);
    if (!book) throw new Error('Unknown book: ' + chapter.bookId);
    const metadataJson = encodeJson(chapter.metadata || {}, 'chapter metadata');
    const timestamp = now();
    const existing = this.getChapter(chapter.bookId, chapter.chapterNumber);
    if (existing && existing.illustrationState !== chapter.illustrationState) transitionIllustration(existing.illustrationState, chapter.illustrationState);
    this.db.prepare(
      `INSERT INTO chapters (book_id, chapter_number, illustration_state, illustration_path, motion_path, metadata_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(book_id, chapter_number) DO UPDATE SET
         illustration_state = excluded.illustration_state,
         illustration_path = excluded.illustration_path,
         motion_path = excluded.motion_path,
         metadata_json = excluded.metadata_json,
         updated_at = excluded.updated_at`
    ).run(
      chapter.bookId,
      chapter.chapterNumber,
      chapter.illustrationState,
      chapter.illustrationPath ?? null,
      chapter.motionPath ?? null,
      metadataJson,
      existing?.createdAt || timestamp,
      timestamp
    );
    this.recordEvent({ bookId: chapter.bookId, visitorId: book.visitorId, type: 'CHAPTER_UPDATED', payload: { chapterNumber: chapter.chapterNumber, illustrationState: chapter.illustrationState } });
    return this.getChapter(chapter.bookId, chapter.chapterNumber);
  }

  saveChapter(chapter) {
    return this.upsertChapter(chapter);
  }

  getChapter(bookId, chapterNumber) {
    assertBookId(bookId);
    if (!Number.isInteger(chapterNumber) || chapterNumber < 1 || chapterNumber > 7) throw new Error('chapterNumber must be an integer from 1 to 7');
    return rowToChapter(this.db.prepare('SELECT * FROM chapters WHERE book_id = ? AND chapter_number = ?').get(bookId, chapterNumber));
  }

  listChapters(bookId) {
    assertBookId(bookId);
    return this.db.prepare('SELECT * FROM chapters WHERE book_id = ? ORDER BY chapter_number ASC').all(bookId).map(rowToChapter);
  }

  updateIllustrationState(bookId, chapterNumber, to) {
    assertIllustrationState(to);
    const chapter = this.getChapter(bookId, chapterNumber);
    if (!chapter) throw new Error('Unknown chapter: ' + bookId + '/' + chapterNumber);
    transitionIllustration(chapter.illustrationState, to);
    return this.upsertChapter({ ...chapter, illustrationState: to });
  }

  recordEvent({ bookId = null, visitorId, type, payload = {} }) {
    if (bookId !== null) assertBookId(bookId);
    assertVisitorId(visitorId);
    assertEventType(type);
    const payloadJson = encodeJson(payload, 'event payload');
    const timestamp = now();
    const result = this.db.prepare(
      'INSERT INTO events (book_id, visitor_id, event_type, payload_json, created_at) VALUES (?, ?, ?, ?, ?)'
    ).run(bookId, visitorId, type, payloadJson, timestamp);
    return rowToEvent(this.db.prepare('SELECT * FROM events WHERE id = ?').get(result.lastInsertRowid));
  }

  listEvents(bookId = null) {
    if (bookId !== null) assertBookId(bookId);
    const rows = bookId === null
      ? this.db.prepare('SELECT * FROM events ORDER BY id ASC').all()
      : this.db.prepare('SELECT * FROM events WHERE book_id = ? ORDER BY id ASC').all(bookId);
    return rows.map(rowToEvent);
  }

  saveStorybookState({ storyPackage, readerSnapshot }) {
    const storyPackageJson = encodeJson(storyPackage, 'story package');
    const readerSnapshotJson = encodeJson(readerSnapshot, 'reader snapshot');
    const timestamp = now();
    this.db.prepare(
      `INSERT INTO storybook_state (state_id, story_package_json, reader_snapshot_json, created_at, updated_at)
       VALUES (1, ?, ?, ?, ?)
       ON CONFLICT(state_id) DO UPDATE SET
         story_package_json = excluded.story_package_json,
         reader_snapshot_json = excluded.reader_snapshot_json,
         updated_at = excluded.updated_at`
    ).run(storyPackageJson, readerSnapshotJson, timestamp, timestamp);
    return this.getStorybookState();
  }

  getStorybookState() {
    const row = this.db.prepare('SELECT * FROM storybook_state WHERE state_id = 1').get();
    if (!row) return null;
    return {
      storyPackage: decodeJson(row.story_package_json),
      readerSnapshot: decodeJson(row.reader_snapshot_json),
    };
  }

  resetStorybookState() {
    this.db.prepare('DELETE FROM storybook_state WHERE state_id = 1').run();
  }

  mediaPathFor(bookId, relativePath) {
    assertBookId(bookId);
    assertRelativeMediaPath(relativePath);
    const bookRoot = path.resolve(this.mediaRoot, bookId);
    const candidate = path.resolve(bookRoot, relativePath);
    if (candidate !== bookRoot && !candidate.startsWith(bookRoot + path.sep)) throw new Error('Media path escapes book directory');
    return candidate;
  }

  ensureBookMediaDir(bookId) {
    assertBookId(bookId);
    const directory = path.resolve(this.mediaRoot, bookId);
    const mediaRootPrefix = this.mediaRoot + path.sep;
    if (!directory.startsWith(mediaRootPrefix)) throw new Error('Invalid book media directory');
    fs.mkdirSync(directory, { recursive: true });
    return directory;
  }

  resetBook(bookId) {
    assertBookId(bookId);
    const book = this.getBook(bookId);
    if (!book) return false;
    const timestamp = now();
    this.db.prepare('UPDATE sessions SET current_book_id = NULL, updated_at = ? WHERE current_book_id = ?').run(timestamp, bookId);
    this.db.prepare('DELETE FROM books WHERE book_id = ?').run(bookId);
    const directory = path.resolve(this.mediaRoot, bookId);
    const mediaRootPrefix = this.mediaRoot + path.sep;
    if (directory.startsWith(mediaRootPrefix) && fs.existsSync(directory)) fs.rmSync(directory, { recursive: true, force: true });
    return true;
  }
}

module.exports = { SQLiteStore };
