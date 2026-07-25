'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createAppServer } = require('../server');
const { createStoryPackage } = require('../src/domain/story-package');

function safeBrief() {
  return {
    schemaVersion: 'stage17-v1', briefId: 'stage17-brief', safetyStatus: 'story_safe',
    sessionNeed: 'help_me_sort_it_out', situationCategory: '疲惫与犹豫',
    coreTension: '已经很累，却不敢停下来', feltPressure: ['害怕不够好'],
    repeatedResponse: '继续赶路', fearedMeaning: '停下就会失败',
    desiredDirection: '允许自己休息', emotionalDirection: '从催促走向呼吸',
    storyUsableFacts: ['旅人背着沉重行囊'], factsNotToInvent: ['现实身份'],
    prohibitedInterpretations: ['不得诊断'], userConfirmedSentence: null,
    missingStoryInformation: ['现实事件'],
  };
}

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen({ host: '127.0.0.1', port: 0 }, () => resolve('http://127.0.0.1:' + server.address().port));
  });
}

function close(server) {
  return new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

async function run() {
  const generatedDir = fs.mkdtempSync(path.join(os.tmpdir(), 'realm-stage17-'));
  const basePackage = createStoryPackage(safeBrief());
  const aiScript = {
    chapters: basePackage.chapterCards.map((_card, index) => ({
      chapterNumber: index + 1,
      title: '真实文本标题 ' + (index + 1),
      chapterText: '真实文本正文 ' + (index + 1),
      narrativeBeat: '真实节拍 ' + (index + 1),
      imagePrompt: '真实画面约束 ' + (index + 1),
    })),
  };
  let textCalls = 0;
  let imageCalls = 0;
  const server = createAppServer({
    env: {
      AI_GATEWAY_API_KEY: 'stage17-key',
      TEXT_BASE_URL: 'https://text.example.test/v1',
      TEXT_MODEL: 'gpt-5.6-sol',
    },
    textFetchImpl: async () => {
      textCalls += 1;
      return { ok: true, status: 200, async json() { return { choices: [{ message: { content: JSON.stringify(aiScript) } }] }; } };
    },
    generatedDir,
    generateImageImpl: async (options) => {
      imageCalls += 1;
      return {
        url: '/runtime/generated/' + options.fileName,
        relativePath: 'runtime/generated/' + options.fileName,
        fileName: options.fileName,
        mediaType: 'image/png', bytes: 123, model: 'gpt-image-2', size: '720x1280',
        quality: 'medium', outputFormat: 'png', requestMode: 'edit', referenceCount: 2,
        width: 720, height: 1280,
      };
    },
  });
  const baseUrl = await listen(server);
  try {
    const storyResponse = await fetch(baseUrl + '/api/story-package', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ safeStoryBrief: safeBrief() }),
    });
    assert.equal(storyResponse.status, 201);
    const storyPayload = await storyResponse.json();
    assert.equal(storyPayload.storyPackage.chapterCards[0].userVisibleCopy.chapterTitle, '真实文本标题 1');
    assert.equal(textCalls, 1);

    const imageResponse = await fetch(baseUrl + '/api/images/generate-book', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ storyPackage: storyPayload.storyPackage }),
    });
    assert.equal(imageResponse.status, 201);
    const imagePayload = await imageResponse.json();
    assert.equal(imagePayload.status, 'succeeded');
    assert.equal(imagePayload.illustrations.length, 7);
    assert.equal(imageCalls, 7);
    console.log('stage17 AI core flow tests passed');
  } finally {
    await close(server);
    fs.rmSync(generatedDir, { recursive: true, force: true });
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
