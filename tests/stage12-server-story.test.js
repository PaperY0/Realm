'use strict';

const assert = require('node:assert/strict');
const {
  createAppServer,
  MAX_JSON_BODY_BYTES,
} = require('../server');

function safeStoryBrief(overrides = {}) {
  return {
    schemaVersion: 'stage12-v1',
    briefId: 'brief-stage12-server-story',
    safetyStatus: 'story_safe',
    sessionNeed: 'help_me_sort_it_out',
    situationCategory: '持续努力与休息需要之间的拉扯',
    coreTension: '已经感到疲惫，却担心停下来会证明自己不够好',
    feltPressure: ['持续要求自己再多做一点'],
    repeatedResponse: '感到压力时仍继续要求自己向前',
    fearedMeaning: '担心停下会带来否定性的意义',
    desiredDirection: '允许自己放慢脚步和喘息片刻',
    emotionalDirection: '从紧绷催促走向温柔地辨认界限',
    storyUsableFacts: ['旅人背着会随自我要求增加重量的行囊'],
    factsNotToInvent: ['具体人物身份与关系'],
    prohibitedInterpretations: ['不得作心理诊断'],
    userConfirmedSentence: null,
    missingStoryInformation: [],
    ...overrides,
  };
}

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

async function postJson(baseUrl, body) {
  return fetch(baseUrl + '/api/story-package', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(body),
  });
}

async function run() {
  let imageGenerationCalls = 0;
  const server = createAppServer({
    env: {},
    generateImageImpl: async () => {
      imageGenerationCalls += 1;
      throw new Error('story-package route must not invoke image generation');
    },
  });
  const baseUrl = await listen(server);

  try {
    const success = await postJson(baseUrl, { safeStoryBrief: safeStoryBrief() });
    assert.equal(success.status, 201);
    assert.match(success.headers.get('content-type'), /^application\/json/);
    const successPayload = await success.json();
    assert.equal(successPayload.ok, true);
    assert.equal(successPayload.storyPackage.frozen, true);
    assert.equal(successPayload.storyPackage.safeStoryBrief.safetyStatus, 'story_safe');
    assert.equal(successPayload.storyPackage.chapterCards.length, 7);
    assert.deepEqual(
      successPayload.storyPackage.chapterCards.map((chapter) => chapter.identity.chapterNumber),
      [1, 2, 3, 4, 5, 6, 7],
    );
    assert.equal(imageGenerationCalls, 0);

    const sensitive = await postJson(baseUrl, {
      safeStoryBrief: safeStoryBrief({ safetyStatus: 'high_risk' }),
    });
    assert.equal(sensitive.status, 400);
    assert.equal((await sensitive.json()).error, 'invalid_story_brief');

    const extraField = await postJson(baseUrl, {
      safeStoryBrief: safeStoryBrief(),
      rawInput: '不得进入七章故事包',
    });
    assert.equal(extraField.status, 400);
    assert.equal((await extraField.json()).error, 'invalid_request');

    const invalidJson = await fetch(baseUrl + '/api/story-package', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"safeStoryBrief":',
    });
    assert.equal(invalidJson.status, 400);
    assert.equal((await invalidJson.json()).error, 'invalid_json');

    const wrongMediaType = await fetch(baseUrl + '/api/story-package', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ safeStoryBrief: safeStoryBrief() }),
    });
    assert.equal(wrongMediaType.status, 415);
    assert.equal((await wrongMediaType.json()).error, 'unsupported_media_type');

    const oversized = await fetch(baseUrl + '/api/story-package', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        safeStoryBrief: safeStoryBrief(),
        padding: 'x'.repeat(MAX_JSON_BODY_BYTES),
      }),
    });
    assert.equal(oversized.status, 413);
    assert.equal((await oversized.json()).error, 'request_too_large');

    for (const method of ['GET', 'PUT', 'DELETE']) {
      const rejected = await fetch(baseUrl + '/api/story-package', { method });
      assert.equal(rejected.status, 405, method);
      assert.equal(rejected.headers.get('allow'), 'POST', method);
      assert.equal((await rejected.json()).error, 'method_not_allowed', method);
    }

    const head = await fetch(baseUrl + '/api/story-package', { method: 'HEAD' });
    assert.equal(head.status, 405);
    assert.equal(head.headers.get('allow'), 'POST');
    assert.equal(await head.text(), '');

    const readerState = await fetch(baseUrl + '/reader-state.js');
    assert.equal(readerState.status, 200);
    assert.match(readerState.headers.get('content-type'), /^text\/javascript/);
    assert.match(await readerState.text(), /class ReaderStateError/);

    assert.equal(imageGenerationCalls, 0);
    console.log('stage12 server story tests passed');
  } finally {
    await close(server);
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
