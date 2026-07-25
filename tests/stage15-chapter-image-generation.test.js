'use strict';

const assert = require('node:assert/strict');
const { generateChapterIllustrations } = require('../src/services/chapter-image-generation');

function storyPackage() {
  return {
    bookId: 'book-parallel-test',
    frozen: true,
    safeStoryBrief: { briefId: 'brief-parallel-test', safetyStatus: 'story_safe' },
    chapterCards: Array.from({ length: 7 }, (_, index) => ({
      identity: {
        chapterId: 'chapter-' + (index + 1),
        chapterNumber: index + 1,
      },
      illustrationContract: {
        narrativeMoment: '时刻 ' + (index + 1),
        protagonistExpression: '表情 ' + (index + 1),
        setting: '场景 ' + (index + 1),
        composition: '构图 ' + (index + 1),
        promptContract: {
          schemaVersion: 'image-prompt-contract-v1',
          imagePrompt: 'Image Prompt ' + (index + 1),
        },
        requiredProps: ['道具 ' + (index + 1)],
        recurringSymbols: ['符号 ' + (index + 1)],
        palette: ['颜色 ' + (index + 1)],
        lighting: '光线 ' + (index + 1),
        continuityFromPrevious: index === 0 ? null : '上一章 ' + index,
        continuityToNext: index === 6 ? null : '下一章 ' + (index + 2),
      },
    })),
  };
}

async function run() {
  let active = 0;
  let maxActive = 0;
  const calls = [];
  const states = [];
  const result = await generateChapterIllustrations({
    storyPackage: storyPackage(),
    concurrency: 7,
    onChapterState: (state) => states.push(state),
    generateImageImpl: async (input) => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      calls.push(input);
      await new Promise((resolve) => setTimeout(resolve, 10));
      active -= 1;
      return { fileName: input.fileName, url: '/runtime/generated/' + input.fileName };
    },
  });

  assert.equal(maxActive, 7);
  assert.equal(calls.length, 7);
  assert.deepEqual(calls.map((call) => call.illustrationContract.narrativeMoment), [
    '时刻 1', '时刻 2', '时刻 3', '时刻 4', '时刻 5', '时刻 6', '时刻 7',
  ]);
  assert.deepEqual(calls.map((call) => call.illustrationContract.promptContract.imagePrompt), [
    'Image Prompt 1', 'Image Prompt 2', 'Image Prompt 3', 'Image Prompt 4', 'Image Prompt 5', 'Image Prompt 6', 'Image Prompt 7',
  ]);
  assert.equal(result.status, 'succeeded');
  assert.equal(result.illustrations.filter((item) => item.state === 'succeeded').length, 7);
  assert.equal(states.filter((state) => state.state === 'generating').length, 7);

  const partial = await generateChapterIllustrations({
    storyPackage: storyPackage(),
    generateImageImpl: async (input) => {
      if (input.chapterNumber === 3) throw Object.assign(new Error('provider'), { code: 'IMAGE_PROVIDER_ERROR' });
      return { fileName: input.fileName, url: '/runtime/generated/' + input.fileName };
    },
  });
  assert.equal(partial.status, 'succeeded');
  assert.equal(partial.illustrations[2].state, 'fallback');
  assert.equal(partial.illustrations[2].source, 'approved_template');
  assert.equal(partial.illustrations[2].image.url, '/assets/fallback/chapter-3.png');
  assert.equal(partial.illustrations[2].error.code, 'IMAGE_PROVIDER_ERROR');
  assert.equal(partial.illustrations.filter((item) => item.state === 'succeeded').length, 6);

  console.log('stage15 chapter image generation tests passed');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
