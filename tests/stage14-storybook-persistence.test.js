'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createAppServer } = require('../server');

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen({ host: '127.0.0.1', port: 0 }, () => {
      server.off('error', reject);
      resolve('http://127.0.0.1:' + server.address().port);
    });
  });
}

function close(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

async function run() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'realm-stage14-'));
  const server = createAppServer({
    dbPath: path.join(tempRoot, 'realm.sqlite'),
    mediaRoot: path.join(tempRoot, 'media'),
    enablePersistence: true,
  });
  const baseUrl = await listen(server);
  const snapshot = {
    storyPackage: {
      schemaVersion: 'story-package-v1',
      bookId: 'book-stage14',
      chapterCards: Array.from({ length: 7 }, (_, index) => ({
        identity: { chapterNumber: index + 1, chapterId: 'chapter-' + (index + 1) },
      })),
    },
    readerSnapshot: {
      phase: 'reading',
      currentChapter: 3,
      chapterCount: 7,
      chapterIds: Array.from({ length: 7 }, (_, index) => 'chapter-' + (index + 1)),
    },
  };

  try {
    const empty = await fetch(baseUrl + '/api/storybook-state');
    assert.equal(empty.status, 200);
    assert.deepEqual(await empty.json(), { ok: true, state: null });

    const saved = await fetch(baseUrl + '/api/storybook-state', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(snapshot),
    });
    assert.equal(saved.status, 200);
    assert.deepEqual((await saved.json()).state, snapshot);

    const restored = await fetch(baseUrl + '/api/storybook-state');
    assert.deepEqual((await restored.json()).state, snapshot);

    const reset = await fetch(baseUrl + '/api/storybook-state', { method: 'DELETE' });
    assert.equal(reset.status, 204);
    const afterReset = await fetch(baseUrl + '/api/storybook-state');
    assert.deepEqual(await afterReset.json(), { ok: true, state: null });

    console.log('stage14 storybook persistence tests passed');
  } finally {
    await close(server);
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
