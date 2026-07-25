'use strict';

const CHAPTER_COUNT = 7;
const FALLBACK_TEMPLATE_SIZE = Object.freeze({ width: 1024, height: 1536 });

function resolveChapterImageFallback(chapterNumber, errorCode = 'IMAGE_PROVIDER_ERROR') {
  if (!Number.isInteger(chapterNumber) || chapterNumber < 1 || chapterNumber > CHAPTER_COUNT) {
    throw new Error('chapterNumber must be 1..7');
  }
  const fileName = 'chapter-' + chapterNumber + '.png';
  return Object.freeze({
    url: '/assets/fallback/' + fileName,
    relativePath: 'assets/fallback/' + fileName,
    fileName,
    mediaType: 'image/png',
    bytes: 0,
    model: 'approved-template',
    size: FALLBACK_TEMPLATE_SIZE.width + 'x' + FALLBACK_TEMPLATE_SIZE.height,
    quality: 'approved',
    outputFormat: 'png',
    requestMode: 'fallback',
    referenceCount: 0,
    width: FALLBACK_TEMPLATE_SIZE.width,
    height: FALLBACK_TEMPLATE_SIZE.height,
    source: 'approved_template',
    fallbackReason: typeof errorCode === 'string' ? errorCode : 'IMAGE_PROVIDER_ERROR',
  });
}

module.exports = { CHAPTER_COUNT, FALLBACK_TEMPLATE_SIZE, resolveChapterImageFallback };
