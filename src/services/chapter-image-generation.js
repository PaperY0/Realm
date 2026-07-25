'use strict';

const path = require('node:path');
const { generateImage: defaultGenerateImage } = require('./image-generation');
const { resolveChapterImageFallback } = require('./chapter-image-fallback');

const CHAPTER_COUNT = 7;
const DEFAULT_CONCURRENCY = 3;
const DEFAULT_IMAGE_ATTEMPTS = 2;

function assertStoryPackageForIllustrations(storyPackage) {
  if (!storyPackage || typeof storyPackage !== 'object' || Array.isArray(storyPackage)) {
    throw new Error('storyPackage must be a plain object');
  }
  if (typeof storyPackage.bookId !== 'string' || !storyPackage.bookId) {
    throw new Error('storyPackage.bookId is required');
  }
  if (!storyPackage.frozen || !Array.isArray(storyPackage.chapterCards) || storyPackage.chapterCards.length !== CHAPTER_COUNT) {
    throw new Error('storyPackage must be frozen with seven chapter cards');
  }
  storyPackage.chapterCards.forEach((card, index) => {
    if (card?.identity?.chapterNumber !== index + 1 || typeof card?.identity?.chapterId !== 'string') {
      throw new Error('storyPackage chapter sequence is invalid');
    }
    if (!card.illustrationContract || typeof card.illustrationContract !== 'object') {
      throw new Error('storyPackage illustration contract is missing');
    }
    const promptContract = card.illustrationContract.promptContract;
    if (
      !promptContract
      || typeof promptContract !== 'object'
      || Array.isArray(promptContract)
      || promptContract.schemaVersion !== 'image-prompt-contract-v1'
      || typeof promptContract.imagePrompt !== 'string'
      || !promptContract.imagePrompt.trim()
      || Object.keys(promptContract).some((key) => !['schemaVersion', 'imagePrompt'].includes(key))
    ) {
      throw new Error('storyPackage image prompt contract is invalid');
    }
  });
  return storyPackage;
}

function normalizeConcurrency(value) {
  const number = value === undefined || value === null || value === ''
    ? DEFAULT_CONCURRENCY
    : Number(value);
  if (!Number.isSafeInteger(number) || number < 1 || number > CHAPTER_COUNT) {
    throw new Error('illustration concurrency must be 1..7');
  }
  return number;
}

function chapterFileName(bookId, chapterNumber) {
  const safeBookId = bookId.replace(/[^A-Za-z0-9_-]+/g, '-').slice(0, 80) || 'book';
  return `${safeBookId}-chapter-${chapterNumber}.png`;
}

async function generateChapterIllustrations(options = {}) {
  const storyPackage = assertStoryPackageForIllustrations(options.storyPackage);
  const generateImageImpl = options.generateImageImpl || defaultGenerateImage;
  if (typeof generateImageImpl !== 'function') throw new Error('generateImageImpl must be a function');
  const concurrency = normalizeConcurrency(
    options.concurrency ?? process.env.IMAGE_GENERATION_CONCURRENCY,
  );
  const attempts = Number(options.attempts ?? process.env.IMAGE_GENERATION_ATTEMPTS ?? DEFAULT_IMAGE_ATTEMPTS);
  if (!Number.isSafeInteger(attempts) || attempts < 1 || attempts > 3) {
    throw new Error('illustration attempts must be 1..3');
  }
  const generatedDir = options.generatedDir ? path.resolve(options.generatedDir) : undefined;
  const onChapterState = typeof options.onChapterState === 'function' ? options.onChapterState : () => {};
  const illustrations = storyPackage.chapterCards.map((card) => ({
    chapterNumber: card.identity.chapterNumber,
    chapterId: card.identity.chapterId,
    state: 'queued',
    image: null,
    error: null,
  }));
  let cursor = 0;

  const update = (index, patch) => {
    illustrations[index] = { ...illustrations[index], ...patch };
    onChapterState(Object.freeze({ ...illustrations[index] }));
  };

  async function worker() {
    while (cursor < storyPackage.chapterCards.length) {
      const index = cursor;
      cursor += 1;
      const card = storyPackage.chapterCards[index];
      update(index, { state: 'generating' });
      let lastError;
      for (let attempt = 1; attempt <= attempts; attempt += 1) {
        try {
          const image = await generateImageImpl({
            safeStoryBrief: storyPackage.safeStoryBrief,
            illustrationContract: card.illustrationContract,
            chapterNumber: card.identity.chapterNumber,
            chapterId: card.identity.chapterId,
            referenceImages: options.referenceImages,
            ...(generatedDir ? { generatedDir } : {}),
            fileName: chapterFileName(storyPackage.bookId, card.identity.chapterNumber),
          });
          update(index, { state: 'succeeded', image });
          lastError = null;
          break;
        } catch (error) {
          lastError = error;
          if (error?.code !== 'IMAGE_PROVIDER_ERROR' || attempt >= attempts) break;
          await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
        }
      }
      if (lastError) {
        update(index, {
          state: 'fallback',
          source: 'approved_template',
          image: resolveChapterImageFallback(card.identity.chapterNumber, lastError.code),
          error: { code: typeof lastError?.code === 'string' ? lastError.code : 'IMAGE_INTERNAL_ERROR' },
        });
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, CHAPTER_COUNT) }, () => worker()));
  const status = illustrations.every((item) => item.state === 'succeeded' || item.state === 'fallback') ? 'succeeded' : 'partial_failure';
  return Object.freeze({
    bookId: storyPackage.bookId,
    status,
    concurrency,
    illustrations: Object.freeze(illustrations.map((item) => Object.freeze({ ...item }))),
  });
}

module.exports = {
  CHAPTER_COUNT,
  DEFAULT_CONCURRENCY,
  DEFAULT_IMAGE_ATTEMPTS,
  generateChapterIllustrations,
  normalizeConcurrency,
};
