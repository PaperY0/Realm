'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  createAppServer,
  MAX_JSON_BODY_BYTES,
  REFERENCE_ASSET,
} = require('../server');
const { ImageGenerationError } = require('../src/services/image-generation');
const { createStoryPackage } = require('../src/domain/story-package');

function safeStoryBrief(overrides = {}) {
  return {
    schemaVersion: 'stage7-v1',
    briefId: 'brief-stage7-demo',
    safetyStatus: 'story_safe',
    sessionNeed: 'help_me_sort_it_out',
    situationCategory: '持续自我要求带来的疲惫',
    coreTension: '已经很累，却仍然不敢停下来',
    feltPressure: ['担心自己做得不够好', '害怕停下就会失去价值'],
    repeatedResponse: '继续逼迫自己完成更多事情',
    fearedMeaning: '停下来会证明自己不够好',
    desiredDirection: '允许自己在不否定努力的前提下休息',
    emotionalDirection: '从紧绷自责走向温柔地辨认界限',
    storyUsableFacts: ['旅人背着越来越重的行囊', '旅人已经走了很久'],
    factsNotToInvent: ['现实人物身份', '具体工作单位', '医疗诊断'],
    prohibitedInterpretations: ['不得诊断人格', '不得断言他人动机'],
    userConfirmedSentence: null,
    missingStoryInformation: ['压力的现实来源'],
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

async function withServer(options, callback) {
  const server = createAppServer(options);
  const baseUrl = await listen(server);
  try {
    await callback(baseUrl);
  } finally {
    await close(server);
  }
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function successfulImage(overrides = {}) {
  return {
    url: '/runtime/generated/stage7-success.png',
    relativePath: 'runtime/generated/stage7-success.png',
    fileName: 'stage7-success.png',
    mediaType: 'image/png',
    bytes: 12345,
    model: 'gpt-image-2',
    size: '720x1280',
    quality: 'medium',
    outputFormat: 'png',
    requestMode: 'edit',
    referenceCount: 2,
    width: 720,
    height: 1280,
    ...overrides,
  };
}

async function run() {
  const generatedDir = fs.mkdtempSync(path.join(os.tmpdir(), 'realm-stage7-'));
  try {
    // Health exposes only readiness/model metadata, including a clear unconfigured state.
    await withServer({ env: {}, generatedDir, generateImageImpl: async () => successfulImage() }, async (baseUrl) => {
      const healthResponse = await fetch(baseUrl + '/health');
      assert.equal(healthResponse.status, 200);
      const health = await healthResponse.json();
      assert.equal(health.imageConfigured, false);
      assert.equal(health.imageModel, 'gpt-image-2');
      assert.deepEqual(health.image2, {
        configured: false,
        model: 'gpt-image-2',
        referenceAsset: 'world-gate-reference.png',
      });
      assert.doesNotMatch(JSON.stringify(health), /api.?key|authorization|bearer/i);

      const head = await fetch(baseUrl + '/health', { method: 'HEAD' });
      assert.equal(head.status, 200);
      assert.equal(await head.text(), '');
      assert.ok(Number(head.headers.get('content-length')) > 0);
    });

    // Success uses an injected stub, validates the authoritative brief and applies both default references.
    let capturedOptions;
    let calls = 0;
    await withServer({
      env: { AI_GATEWAY_API_KEY: 'must-not-leak', MEDIA_BASE_URL: 'https://example.invalid/v1' },
      generatedDir,
      generateImageImpl: async (options) => {
        calls += 1;
        capturedOptions = options;
        return successfulImage({
          prompt: 'must-not-leak-prompt',
          apiKey: 'must-not-leak',
          providerBody: 'must-not-leak-provider-body',
        });
      },
    }, async (baseUrl) => {
      const response = await fetch(baseUrl + '/api/images/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ safeStoryBrief: safeStoryBrief() }),
      });
      assert.equal(response.status, 201);
      const payload = await response.json();
      assert.equal(payload.ok, true);
      assert.equal(payload.image.url, '/runtime/generated/stage7-success.png');
      assert.equal(payload.image.model, 'gpt-image-2');
      assert.deepEqual(Object.keys(payload.image).sort(), [
        'bytes', 'fileName', 'height', 'mediaType', 'model', 'outputFormat', 'quality',
        'referenceCount', 'relativePath', 'requestMode', 'size', 'url', 'width',
      ].sort());
      assert.doesNotMatch(JSON.stringify(payload), /must-not-leak|prompt|providerBody|apiKey/i);
      assert.equal(calls, 1);
      assert.equal(capturedOptions.generatedDir, path.resolve(generatedDir));
      assert.deepEqual(capturedOptions.referenceImages, {
        guardianIp: REFERENCE_ASSET,
        style: REFERENCE_ASSET,
      });
      assert.deepEqual(capturedOptions.safeStoryBrief.feltPressure, safeStoryBrief().feltPressure);
    });

    // A frozen seven-chapter story submits one isolated image task per chapter.
    let chapterCalls = 0;
    await withServer({
      env: {},
      generatedDir,
      generateImageImpl: async (options) => {
        chapterCalls += 1;
        return successfulImage({
          fileName: options.fileName,
          url: '/runtime/generated/' + options.fileName,
          relativePath: 'runtime/generated/' + options.fileName,
        });
      },
    }, async (baseUrl) => {
      const response = await fetch(baseUrl + '/api/images/generate-book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storyPackage: createStoryPackage(safeStoryBrief()) }),
      });
      assert.equal(response.status, 201);
      const payload = await response.json();
      assert.equal(payload.ok, true);
      assert.equal(payload.status, 'succeeded');
      assert.equal(payload.illustrations.length, 7);
      assert.equal(payload.illustrations.filter((item) => item.state === 'succeeded').length, 7);
      assert.equal(chapterCalls, 7);
    });

    // Optional references are aliases, never caller-controlled filesystem paths.
    await withServer({
      env: {},
      generatedDir,
      generateImageImpl: async (options) => {
        capturedOptions = options;
        return successfulImage({ referenceCount: 1 });
      },
    }, async (baseUrl) => {
      const allowed = await fetch(baseUrl + '/api/images/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          safeStoryBrief: safeStoryBrief(),
          referenceImages: { style: 'world-gate-reference.png' },
        }),
      });
      assert.equal(allowed.status, 201);
      assert.deepEqual(capturedOptions.referenceImages, { style: REFERENCE_ASSET });

      for (const referenceImages of [
        {},
        { guardianIp: '../../secret.png' },
        { unknown: 'world-gate-reference.png' },
        { style: ['world-gate-reference.png'] },
      ]) {
        const rejected = await fetch(baseUrl + '/api/images/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ safeStoryBrief: safeStoryBrief(), referenceImages }),
        });
        assert.equal(rejected.status, 400);
        assert.equal((await rejected.json()).error, 'invalid_request');
      }
    });

    // JSON/media/body/method contracts fail before any paid image call.
    calls = 0;
    await withServer({ env: {}, generatedDir, generateImageImpl: async () => { calls += 1; return successfulImage(); } }, async (baseUrl) => {
      const invalidJson = await fetch(baseUrl + '/api/images/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{not-json',
      });
      assert.equal(invalidJson.status, 400);
      assert.equal((await invalidJson.json()).error, 'invalid_json');

      const wrongMedia = await fetch(baseUrl + '/api/images/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: '{}',
      });
      assert.equal(wrongMedia.status, 415);

      const extraField = await fetch(baseUrl + '/api/images/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ safeStoryBrief: safeStoryBrief(), rawInput: '不得进入网关' }),
      });
      assert.equal(extraField.status, 400);

      const invalidBrief = await fetch(baseUrl + '/api/images/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ safeStoryBrief: { safetyStatus: 'story_safe' } }),
      });
      assert.equal(invalidBrief.status, 400);
      assert.equal((await invalidBrief.json()).error, 'invalid_request');

      const oversized = await fetch(baseUrl + '/api/images/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ safeStoryBrief: safeStoryBrief(), padding: 'x'.repeat(MAX_JSON_BODY_BYTES) }),
      });
      assert.equal(oversized.status, 413);
      assert.equal((await oversized.json()).error, 'request_too_large');

      const getMethod = await fetch(baseUrl + '/api/images/generate');
      assert.equal(getMethod.status, 405);
      assert.equal(getMethod.headers.get('allow'), 'POST');

      const headMethod = await fetch(baseUrl + '/api/images/generate', { method: 'HEAD' });
      assert.equal(headMethod.status, 405);
      assert.equal(headMethod.headers.get('allow'), 'POST');
      assert.equal(await headMethod.text(), '');
      assert.equal(calls, 0);
    });

    // A single-machine lock rejects an overlapping paid request immediately.
    const gate = deferred();
    let startedResolve;
    const started = new Promise((resolve) => { startedResolve = resolve; });
    await withServer({
      env: {},
      generatedDir,
      generateImageImpl: async () => {
        startedResolve();
        return gate.promise;
      },
    }, async (baseUrl) => {
      const first = fetch(baseUrl + '/api/images/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ safeStoryBrief: safeStoryBrief() }),
      });
      await started;
      const second = await fetch(baseUrl + '/api/images/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ safeStoryBrief: safeStoryBrief({ briefId: 'brief-overlap' }) }),
      });
      assert.equal(second.status, 409);
      assert.equal((await second.json()).error, 'image_generation_busy');
      gate.resolve(successfulImage());
      assert.equal((await first).status, 201);
    });

    // Provider details are never reflected in public errors.
    await withServer({
      env: {},
      generatedDir,
      generateImageImpl: async () => {
        throw new ImageGenerationError(
          'IMAGE_PROVIDER_ERROR',
          'provider body: bearer secret-key; prompt: private story text',
        );
      },
    }, async (baseUrl) => {
      const response = await fetch(baseUrl + '/api/images/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ safeStoryBrief: safeStoryBrief() }),
      });
      assert.equal(response.status, 502);
      const text = await response.text();
      assert.match(text, /image_provider_error/);
      assert.doesNotMatch(text, /secret-key|private story|provider body|prompt/i);
    });

    // Generated PNG access is filename-only, traversal-safe and supports HEAD.
    const pngBytes = Buffer.from('stage7-png-fixture');
    fs.writeFileSync(path.join(generatedDir, 'allowed-image.png'), pngBytes);
    await withServer({ env: {}, generatedDir, generateImageImpl: async () => successfulImage() }, async (baseUrl) => {
      const image = await fetch(baseUrl + '/runtime/generated/allowed-image.png');
      assert.equal(image.status, 200);
      assert.equal(image.headers.get('content-type'), 'image/png');
      assert.deepEqual(Buffer.from(await image.arrayBuffer()), pngBytes);

      const head = await fetch(baseUrl + '/runtime/generated/allowed-image.png', { method: 'HEAD' });
      assert.equal(head.status, 200);
      assert.equal(Number(head.headers.get('content-length')), pngBytes.length);
      assert.equal(await head.text(), '');

      for (const pathname of [
        '/runtime/generated/%2e%2e%2fsecret.png',
        '/runtime/generated/%5csecret.png',
        '/runtime/generated/subdir%2fsecret.png',
        '/runtime/generated/not-a-png.jpg',
      ]) {
        const rejected = await fetch(baseUrl + pathname);
        assert.equal(rejected.status, 404, pathname);
      }
    });

    console.log('stage7 server image tests passed');
  } finally {
    fs.rmSync(generatedDir, { recursive: true, force: true });
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
