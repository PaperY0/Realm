'use strict';

const assert = require('node:assert/strict');
const { createStoryPackage } = require('../src/domain/story-package');
const { generateTextStoryPackage } = require('../src/services/text-generation');

function safeBrief() {
  return {
    schemaVersion: 'stage16-v1', briefId: 'stage16-brief', safetyStatus: 'story_safe',
    sessionNeed: 'help_me_sort_it_out', situationCategory: '疲惫与犹豫',
    coreTension: '已经很累，却不敢停下来', feltPressure: ['害怕不够好'],
    repeatedResponse: '继续赶路', fearedMeaning: '停下就会失败',
    desiredDirection: '允许自己休息', emotionalDirection: '从催促走向呼吸',
    storyUsableFacts: ['旅人背着沉重行囊'], factsNotToInvent: ['现实身份'],
    prohibitedInterpretations: ['不得诊断'], userConfirmedSentence: null,
    missingStoryInformation: ['现实事件'],
  };
}

function response(body) {
  return { ok: true, status: 200, async json() { return body; } };
}

async function run() {
  const basePackage = createStoryPackage(safeBrief());
  let request;
  const generated = {
    chapters: basePackage.chapterCards.map((_card, index) => ({
      chapterNumber: index + 1,
      title: 'AI 标题 ' + (index + 1),
      chapterText: 'AI 正文 ' + (index + 1),
      narrativeBeat: 'AI 节拍 ' + (index + 1),
      imagePrompt: 'AI 画面约束 ' + (index + 1),
    })),
  };
  const result = await generateTextStoryPackage({
    safeStoryBrief: safeBrief(),
    baseStoryPackage: basePackage,
    apiKey: 'stage16-key',
    baseUrl: 'https://text.example.test/v1',
    model: 'gpt-5.6-sol',
    fetchImpl: async (url, options) => {
      request = { url, options };
      return response({ choices: [{ message: { content: JSON.stringify(generated) } }] });
    },
  });

  assert.equal(request.url, 'https://text.example.test/v1/chat/completions');
  assert.equal(JSON.parse(request.options.body).model, 'gpt-5.6-sol');
  assert.match(JSON.parse(request.options.body).messages[1].content, /疲惫与犹豫/);
  assert.equal(result.chapterCards[0].userVisibleCopy.chapterTitle, 'AI 标题 1');
  assert.equal(result.chapterCards[6].userVisibleCopy.chapterText, 'AI 正文 7');
  assert.equal(result.frozen, true);
  console.log('stage16 text generation tests passed');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
