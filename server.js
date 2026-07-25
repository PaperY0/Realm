'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { URL } = require('node:url');
const {
  generateImage: defaultGenerateImage,
  validateSafeStoryBrief,
  ImageGenerationError,
  DEFAULT_MODEL,
} = require('./src/services/image-generation');
const { createStoryPackage, assertStoryPackage, applyGeneratedChapterScript } = require('./src/domain/story-package');
const { DEMO_SEVEN_CHAPTER_TEMPLATE } = require('./src/features/story/demo-seven-chapter-template');
const { generateTextStoryPackage, textGatewayConfigured, TextGenerationError } = require('./src/services/text-generation');
const { generateChapterIllustrations } = require('./src/services/chapter-image-generation');
const { SQLiteStore } = require('./src/storage/sqlite-store');

const HOST = '127.0.0.1';
const DEFAULT_PORT = 3000;
const MAX_JSON_BODY_BYTES = 64 * 1024;
// A frozen seven-chapter story package contains the validated chapter prompts
// needed by the image worker, so it needs a larger route-specific limit. Keep
// the general JSON limit unchanged for the smaller APIs.
const MAX_STORY_PACKAGE_BODY_BYTES = 128 * 1024;
const MAX_STORYBOOK_STATE_BYTES = 256 * 1024;
const ROOT_DIR = __dirname;
const SRC_DIR = path.join(ROOT_DIR, 'src');
const DEFAULT_GENERATED_DIR = path.join(ROOT_DIR, 'runtime', 'generated');
const REFERENCE_ASSET = 'src/assets/world-gate-reference.png';
const REFERENCE_FILE_NAME = 'world-gate-reference.png';
const REFERENCE_ALIASES = new Set([
  REFERENCE_FILE_NAME,
  '/assets/' + REFERENCE_FILE_NAME,
  REFERENCE_ASSET,
]);
const REFERENCE_FIELDS = new Set(['guardianIp', 'style']);
const GENERATED_FILE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,119}\.png$/;
const ASSETS = new Map([
  ['/', { file: 'index.html', contentType: 'text/html; charset=utf-8' }],
  ['/styles.css', { file: 'styles.css', contentType: 'text/css; charset=utf-8' }],
  ['/app.js', { file: 'app.js', contentType: 'text/javascript; charset=utf-8' }],
  ['/reader-state.js', { file: 'features/reader/reader-state.js', contentType: 'text/javascript; charset=utf-8' }],
  ['/assets/world-gate-reference.png', { file: 'assets/world-gate-reference.png', contentType: 'image/png' }],
  ['/assets/expression-watercolor-reference.png', { file: 'assets/expression-watercolor-reference.png', contentType: 'image/png' }],
  ['/assets/expression-watercolor-wash.png', { file: 'assets/expression-watercolor-wash.png', contentType: 'image/png' }],
  ['/assets/storybook-keepsake-cover.png', { file: 'assets/storybook-keepsake-cover.png', contentType: 'image/png' }],
  ['/assets/emotion-hall.png', { file: 'assets/emotion-hall.png', contentType: 'image/png' }],
  ['/assets/emotion-hall/layers/background.png', { file: 'assets/emotion-hall/layers/background.png', contentType: 'image/png' }],
  ['/assets/emotion-hall/layers/door-overthinking.png', { file: 'assets/emotion-hall/layers/door-overthinking.png', contentType: 'image/png' }],
  ['/assets/emotion-hall/layers/door-sadness.png', { file: 'assets/emotion-hall/layers/door-sadness.png', contentType: 'image/png' }],
  ['/assets/emotion-hall/layers/door-anxiety.png', { file: 'assets/emotion-hall/layers/door-anxiety.png', contentType: 'image/png' }],
  ['/assets/emotion-hall/layers/door-anger.png', { file: 'assets/emotion-hall/layers/door-anger.png', contentType: 'image/png' }],
  ['/assets/emotion-hall/layers/door-joy.png', { file: 'assets/emotion-hall/layers/door-joy.png', contentType: 'image/png' }],
  ['/assets/emotion-hall/layers/guardian-overthinking.png', { file: 'assets/emotion-hall/layers/guardian-overthinking.png', contentType: 'image/png' }],
  ['/assets/emotion-hall/layers/guardian-sadness.png', { file: 'assets/emotion-hall/layers/guardian-sadness.png', contentType: 'image/png' }],
  ['/assets/emotion-hall/layers/guardian-anxiety.png', { file: 'assets/emotion-hall/layers/guardian-anxiety.png', contentType: 'image/png' }],
  ['/assets/emotion-hall/layers/guardian-anger.png', { file: 'assets/emotion-hall/layers/guardian-anger.png', contentType: 'image/png' }],
  ['/assets/emotion-hall/layers/guardian-joy.png', { file: 'assets/emotion-hall/layers/guardian-joy.png', contentType: 'image/png' }],
  ['/assets/guardians/wanxian.png', { file: 'assets/guardians/wanxian.png', contentType: 'image/png' }],
  ['/assets/guardians/tingyu.png', { file: 'assets/guardians/tingyu.png', contentType: 'image/png' }],
  ['/assets/guardians/xibai.png', { file: 'assets/guardians/xibai.png', contentType: 'image/png' }],
  ['/assets/guardians/cangjin.png', { file: 'assets/guardians/cangjin.png', contentType: 'image/png' }],
  ['/assets/guardians/lingya.png', { file: 'assets/guardians/lingya.png', contentType: 'image/png' }],
  ['/assets/fallback/chapter-1.png', { file: 'assets/fallback/chapter-1.png', contentType: 'image/png' }],
  ['/assets/fallback/chapter-2.png', { file: 'assets/fallback/chapter-2.png', contentType: 'image/png' }],
  ['/assets/fallback/chapter-3.png', { file: 'assets/fallback/chapter-3.png', contentType: 'image/png' }],
  ['/assets/fallback/chapter-4.png', { file: 'assets/fallback/chapter-4.png', contentType: 'image/png' }],
  ['/assets/fallback/chapter-5.png', { file: 'assets/fallback/chapter-5.png', contentType: 'image/png' }],
  ['/assets/fallback/chapter-6.png', { file: 'assets/fallback/chapter-6.png', contentType: 'image/png' }],
  ['/assets/fallback/chapter-7.png', { file: 'assets/fallback/chapter-7.png', contentType: 'image/png' }],
  ['/assets/world-entry.mp4', { file: 'assets/world-entry.mp4', contentType: 'video/mp4' }],
  ['/assets/paper-boat.mp4', { file: 'assets/paper-boat.mp4', contentType: 'video/mp4' }],
]);

function getPort(value) {
  if (value === undefined || value === '') return DEFAULT_PORT;
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }
  return port;
}

function sendJson(request, response, statusCode, payload, extraHeaders = {}) {
  if (response.writableEnded || response.destroyed) return;
  const body = JSON.stringify(payload);
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    ...extraHeaders,
  });
  if (request.method === 'HEAD') response.end();
  else response.end(body);
}

function imageGatewayConfigured(env) {
  return Boolean(
    env
    && typeof env.AI_GATEWAY_API_KEY === 'string'
    && env.AI_GATEWAY_API_KEY.trim()
    && typeof env.MEDIA_BASE_URL === 'string'
    && env.MEDIA_BASE_URL.trim(),
  );
}

function resolveAsset(requestPath) {
  let decodedPath;
  try {
    decodedPath = decodeURIComponent(requestPath);
  } catch {
    return null;
  }

  if (decodedPath.includes('\0') || decodedPath.includes('\\')) return null;
  const segments = decodedPath.split('/');
  if (segments.some((segment) => segment === '..' || segment === '.')) return null;

  const asset = ASSETS.get(decodedPath);
  if (!asset) return null;

  const candidate = path.resolve(SRC_DIR, asset.file);
  const sourceRoot = path.resolve(SRC_DIR) + path.sep;
  if (!candidate.startsWith(sourceRoot)) return null;
  return { ...asset, filePath: candidate, generated: false };
}

function resolveGeneratedAsset(requestPath, generatedDir) {
  const prefix = '/runtime/generated/';
  if (!requestPath.startsWith(prefix)) return null;

  let fileName;
  try {
    fileName = decodeURIComponent(requestPath.slice(prefix.length));
  } catch {
    return null;
  }

  if (!GENERATED_FILE_PATTERN.test(fileName) || fileName.includes('..')) return null;
  const root = path.resolve(generatedDir);
  const candidate = path.resolve(root, fileName);
  if (!candidate.startsWith(root + path.sep)) return null;
  return { filePath: candidate, contentType: 'image/png', generated: true };
}

function serveFile(request, response, asset) {
  fs.readFile(asset.filePath, (error, data) => {
    if (error) {
      if (error.code === 'ENOENT') {
        sendJson(request, response, 404, { ok: false, error: 'not_found' });
      } else {
        console.error('Static file read failed:', error.code || 'unknown');
        sendJson(request, response, 500, { ok: false, error: 'internal_server_error' });
      }
      return;
    }

    response.writeHead(200, {
      'Content-Type': asset.contentType,
      'Content-Length': data.length,
      'Cache-Control': asset.generated ? 'private, no-store' : 'no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    if (request.method === 'HEAD') response.end();
    else response.end(data);
  });
}

function requestBodyError(code) {
  return Object.assign(new Error(code.toLowerCase()), { code });
}

function readJsonBody(request, maxBytes = MAX_JSON_BODY_BYTES) {
  return new Promise((resolve, reject) => {
    const declaredLength = Number(request.headers['content-length']);
    if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
      request.resume();
      reject(requestBodyError('REQUEST_TOO_LARGE'));
      return;
    }

    let settled = false;
    let total = 0;
    const chunks = [];

    const fail = (error) => {
      if (settled) return;
      settled = true;
      reject(error);
    };

    request.on('data', (chunk) => {
      if (settled) return;
      total += chunk.length;
      if (total > maxBytes) {
        fail(requestBodyError('REQUEST_TOO_LARGE'));
        request.resume();
        return;
      }
      chunks.push(chunk);
    });

    request.on('end', () => {
      if (settled) return;
      settled = true;
      if (chunks.length === 0) {
        reject(requestBodyError('INVALID_JSON'));
        return;
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(requestBodyError('INVALID_JSON'));
      }
    });

    request.on('aborted', () => fail(requestBodyError('REQUEST_ERROR')));
    request.on('error', () => fail(requestBodyError('REQUEST_ERROR')));
  });
}

function assertPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('value must be a plain object');
  }
  return value;
}

function normalizeReferenceImages(value) {
  if (value === undefined) {
    return Object.freeze({
      guardianIp: REFERENCE_ASSET,
      style: REFERENCE_ASSET,
    });
  }

  assertPlainObject(value);
  const keys = Object.keys(value);
  if (keys.length === 0 || keys.some((key) => !REFERENCE_FIELDS.has(key))) {
    throw new Error('referenceImages contains unsupported fields');
  }

  const normalized = {};
  for (const key of keys) {
    if (typeof value[key] !== 'string' || !REFERENCE_ALIASES.has(value[key])) {
      throw new Error('referenceImages must use an approved project asset alias');
    }
    normalized[key] = REFERENCE_ASSET;
  }
  return Object.freeze(normalized);
}

function validateApiBody(value) {
  assertPlainObject(value);
  const fields = Object.keys(value);
  if (!Object.prototype.hasOwnProperty.call(value, 'safeStoryBrief')) {
    throw new Error('safeStoryBrief is required');
  }
  if (fields.some((field) => field !== 'safeStoryBrief' && field !== 'referenceImages')) {
    throw new Error('request contains unsupported fields');
  }

  return Object.freeze({
    safeStoryBrief: validateSafeStoryBrief(value.safeStoryBrief),
    referenceImages: normalizeReferenceImages(value.referenceImages),
  });
}

function validateStoryPackageApiBody(value) {
  assertPlainObject(value);
  const fields = Object.keys(value);
  if (fields.length !== 1 || fields[0] !== 'safeStoryBrief') {
    throw requestBodyError('INVALID_REQUEST');
  }
  if (
    !value.safeStoryBrief
    || typeof value.safeStoryBrief !== 'object'
    || Array.isArray(value.safeStoryBrief)
    || value.safeStoryBrief.safetyStatus !== 'story_safe'
  ) {
    throw requestBodyError('INVALID_STORY_BRIEF');
  }

  try {
    return validateSafeStoryBrief(value.safeStoryBrief);
  } catch {
    throw requestBodyError('INVALID_STORY_BRIEF');
  }
}

function validateChapterImageBody(value) {
  assertPlainObject(value);
  const fields = Object.keys(value);
  if (!Object.prototype.hasOwnProperty.call(value, 'storyPackage')) {
    throw new Error('storyPackage is required');
  }
  if (fields.some((field) => field !== 'storyPackage' && field !== 'referenceImages')) {
    throw new Error('request contains unsupported fields');
  }
  let storyPackage;
  try {
    storyPackage = assertStoryPackage(value.storyPackage);
  } catch {
    throw new Error('storyPackage is not a valid frozen seven-chapter package');
  }
  return Object.freeze({
    storyPackage,
    referenceImages: normalizeReferenceImages(value.referenceImages),
  });
}

function sanitizeChapterIllustration(value) {
  assertPlainObject(value);
  return Object.freeze({
    chapterNumber: value.chapterNumber,
    chapterId: value.chapterId,
    state: value.state,
    image: value.source === 'approved_template' ? sanitizeFallbackImage(value.image) : value.image ? sanitizeGeneratedImage(value.image) : null,
    source: value.source === 'approved_template' ? 'approved_template' : 'generated',
    fallbackReason: value.source === 'approved_template' && typeof value.image?.fallbackReason === 'string'
      ? value.image.fallbackReason.replace(/[^A-Z0-9_]/g, '').slice(0, 64)
      : null,
    error: value.error && typeof value.error.code === 'string'
      ? { code: value.error.code.replace(/[^A-Z0-9_]/g, '').slice(0, 64) }
      : null,
  });
}

function sanitizeFallbackImage(value) {
  assertPlainObject(value);
  if (
    value.source !== 'approved_template'
    || typeof value.fileName !== 'string'
    || !/^chapter-[1-7]\.png$/.test(value.fileName)
    || value.url !== '/assets/fallback/' + value.fileName
    || value.relativePath !== 'assets/fallback/' + value.fileName
    || value.mediaType !== 'image/png'
  ) throw new Error('unsafe fallback image');
  return Object.freeze({
    url: value.url,
    relativePath: value.relativePath,
    fileName: value.fileName,
    mediaType: value.mediaType,
    bytes: value.bytes,
    model: 'approved-template',
    size: value.size,
    quality: 'approved',
    outputFormat: 'png',
    requestMode: 'fallback',
    referenceCount: 0,
    width: value.width,
    height: value.height,
  });
}

function validateStorybookStateBody(value) {
  assertPlainObject(value);
  if (Object.keys(value).some((field) => field !== 'storyPackage' && field !== 'readerSnapshot')) {
    throw requestBodyError('INVALID_REQUEST');
  }
  if (!Object.prototype.hasOwnProperty.call(value, 'storyPackage')
    || !Object.prototype.hasOwnProperty.call(value, 'readerSnapshot')) {
    throw requestBodyError('INVALID_REQUEST');
  }
  assertPlainObject(value.storyPackage);
  assertPlainObject(value.readerSnapshot);
  return Object.freeze({
    storyPackage: value.storyPackage,
    readerSnapshot: value.readerSnapshot,
  });
}

function publicImageError(error) {
  if (!(error instanceof ImageGenerationError)) {
    return { status: 500, error: 'image_internal_error', message: '真实生成未完成，请稍后再试。' };
  }

  const mapping = {
    IMAGE_INPUT_ERROR: { status: 400, error: 'invalid_story_brief', message: '故事摘要未通过安全校验。' },
    IMAGE_CONFIG_ERROR: { status: 503, error: 'image2_not_configured', message: 'Image 2 服务尚未配置。' },
    IMAGE_REFERENCE_ERROR: { status: 500, error: 'reference_asset_unavailable', message: '绘本参考图暂时不可用。' },
    IMAGE_TIMEOUT: { status: 504, error: 'image_generation_timeout', message: 'Image 2 绘制超时，本次没有生成结果。' },
    IMAGE_PROVIDER_ERROR: { status: 502, error: 'image_provider_error', message: 'Image 2 暂时没有完成这幅画。' },
    IMAGE_RESPONSE_ERROR: { status: 502, error: 'invalid_image_response', message: 'Image 2 返回的图片未通过校验。' },
    IMAGE_TOO_LARGE: { status: 502, error: 'image_too_large', message: 'Image 2 返回的图片超过大小限制。' },
    IMAGE_FILE_EXISTS: { status: 409, error: 'image_file_conflict', message: '生成文件发生冲突，请重新发起。' },
    IMAGE_WRITE_ERROR: { status: 500, error: 'image_write_error', message: '图片生成成功，但未能安全保存。' },
  };
  return mapping[error.code]
    || { status: 500, error: 'image_internal_error', message: '真实生成未完成，请稍后再试。' };
}

function sanitizeGeneratedImage(value) {
  assertPlainObject(value);
  if (
    typeof value.fileName !== 'string'
    || !GENERATED_FILE_PATTERN.test(value.fileName)
    || value.fileName.includes('..')
    || value.url !== '/runtime/generated/' + value.fileName
    || value.relativePath !== 'runtime/generated/' + value.fileName
    || value.mediaType !== 'image/png'
  ) {
    throw new Error('image service returned an unsafe result');
  }

  const numberFields = ['bytes', 'referenceCount', 'width', 'height'];
  for (const field of numberFields) {
    if (!Number.isInteger(value[field]) || value[field] < 0) {
      throw new Error('image service returned invalid metadata');
    }
  }

  return Object.freeze({
    url: value.url,
    relativePath: value.relativePath,
    fileName: value.fileName,
    mediaType: value.mediaType,
    bytes: value.bytes,
    model: String(value.model || DEFAULT_MODEL),
    size: String(value.size || ''),
    quality: String(value.quality || ''),
    outputFormat: String(value.outputFormat || 'png'),
    requestMode: String(value.requestMode || ''),
    referenceCount: value.referenceCount,
    width: value.width,
    height: value.height,
  });
}

function createRequestHandler(options = {}) {
  const generateImageImpl = options.generateImageImpl || defaultGenerateImage;
  const textFetchImpl = options.textFetchImpl || globalThis.fetch;
  const env = options.env || process.env;
  const generatedDir = path.resolve(options.generatedDir || DEFAULT_GENERATED_DIR);
  const storybookStore = options.enablePersistence
    ? (options.storybookStore || new SQLiteStore({
      dbPath: options.dbPath || path.join(ROOT_DIR, 'runtime', 'dream-book.sqlite'),
      mediaRoot: options.mediaRoot || path.join(ROOT_DIR, 'runtime', 'media'),
    }))
    : null;
  if (typeof generateImageImpl !== 'function') throw new TypeError('generateImageImpl must be a function');

  let generationInFlight = false;

  return async function handleRequest(request, response) {
    let requestUrl;
    try {
      requestUrl = new URL(request.url, 'http://127.0.0.1');
    } catch {
      sendJson(request, response, 400, { ok: false, error: 'bad_request' });
      return;
    }

    if (requestUrl.pathname === '/api/story-package') {
      if (request.method !== 'POST') {
        sendJson(request, response, 405, { ok: false, error: 'method_not_allowed' }, { Allow: 'POST' });
        return;
      }

      const contentType = String(request.headers['content-type'] || '').split(';', 1)[0].trim().toLowerCase();
      if (contentType !== 'application/json') {
        sendJson(request, response, 415, {
          ok: false,
          error: 'unsupported_media_type',
          message: '请求必须使用 JSON。',
        });
        return;
      }

      let body;
      try {
        body = await readJsonBody(request);
      } catch (error) {
        if (error.code === 'REQUEST_TOO_LARGE') {
          sendJson(request, response, 413, {
            ok: false,
            error: 'request_too_large',
            message: '故事摘要超过 64KB 限制。',
          });
        } else {
          sendJson(request, response, 400, {
            ok: false,
            error: 'invalid_json',
            message: '请求内容不是有效 JSON。',
          });
        }
        return;
      }

      let safeStoryBrief;
      try {
        safeStoryBrief = validateStoryPackageApiBody(body);
      } catch (error) {
        const invalidStoryBrief = error.code === 'INVALID_STORY_BRIEF';
        sendJson(request, response, 400, {
          ok: false,
          error: invalidStoryBrief ? 'invalid_story_brief' : 'invalid_request',
          message: invalidStoryBrief
            ? '故事摘要未通过 story_safe 安全校验。'
            : '请求只能包含 safeStoryBrief。',
        });
        return;
      }

      let storyPackage;
      try {
        try {
          storyPackage = createStoryPackage(safeStoryBrief);
        } catch {
          storyPackage = createStoryPackage({
            schemaVersion: 'story-safe-fallback-v1',
            briefId: safeStoryBrief.briefId || 'demo-fallback',
            safetyStatus: 'story_safe',
            coreTension: typeof safeStoryBrief.coreTension === 'string' && safeStoryBrief.coreTension.trim()
              ? safeStoryBrief.coreTension
              : '旅人背着一份还没有被命名的重量',
            emotionalDirection: typeof safeStoryBrief.emotionalDirection === 'string' && safeStoryBrief.emotionalDirection.trim()
              ? safeStoryBrief.emotionalDirection
              : '允许自己先停下来，找到可以呼吸的下一步',
            desiredDirection: typeof safeStoryBrief.desiredDirection === 'string' && safeStoryBrief.desiredDirection.trim()
              ? safeStoryBrief.desiredDirection
              : '先走好今天的一步',
            storyUsableFacts: [],
            missingStoryInformation: ['未补写现实人物、关系与结局'],
          });
        }
        if (textGatewayConfigured(env)) {
          storyPackage = await generateTextStoryPackage({
            safeStoryBrief,
            baseStoryPackage: storyPackage,
            apiKey: env.AI_GATEWAY_API_KEY,
            baseUrl: env.TEXT_BASE_URL,
            model: env.TEXT_MODEL,
            fetchImpl: textFetchImpl,
          });
        }
        sendJson(request, response, 201, { ok: true, storyPackage });
      } catch (error) {
        if (storyPackage) {
          try {
            const fallbackStoryPackage = applyGeneratedChapterScript(storyPackage, {
              chapters: DEMO_SEVEN_CHAPTER_TEMPLATE,
            }, { forbiddenSourceTexts: [] });
            sendJson(request, response, 201, {
              ok: true,
              textSource: 'approved_template',
              textFallbackReason: typeof error?.code === 'string' ? error.code : 'TEXT_GENERATION_FAILED',
              storyPackage: fallbackStoryPackage,
            });
            return;
          } catch {
            // Fall through to the safe client-visible error when even the
            // approved fixed story template cannot be applied.
          }
        }
        sendJson(request, response, 400, {
          ok: false,
          error: 'invalid_story_brief',
          message: '故事摘要无法生成安全的七章故事包。',
        });
      }
      return;
    }

    if (requestUrl.pathname === '/api/storybook-state') {
      if (!storybookStore) {
        sendJson(request, response, 503, { ok: false, error: 'persistence_unavailable' });
        return;
      }

      if (request.method === 'GET') {
        sendJson(request, response, 200, { ok: true, state: storybookStore.getStorybookState() });
        return;
      }

      if (request.method === 'DELETE') {
        storybookStore.resetStorybookState();
        response.writeHead(204, { 'Cache-Control': 'no-store' });
        response.end();
        return;
      }

      if (request.method !== 'PUT') {
        sendJson(request, response, 405, { ok: false, error: 'method_not_allowed' }, { Allow: 'GET, PUT, DELETE' });
        return;
      }

      let body;
      try {
        body = await readJsonBody(request, MAX_STORYBOOK_STATE_BYTES);
      } catch (error) {
        sendJson(request, response, 400, {
          ok: false,
          error: error.code === 'REQUEST_TOO_LARGE' ? 'request_too_large' : 'invalid_json',
        });
        return;
      }

      try {
        const state = validateStorybookStateBody(body);
        sendJson(request, response, 200, { ok: true, state: storybookStore.saveStorybookState(state) });
      } catch {
        sendJson(request, response, 400, { ok: false, error: 'invalid_request' });
      }
      return;
    }

    if (requestUrl.pathname === '/api/images/generate-book') {
      if (request.method !== 'POST') {
        sendJson(request, response, 405, { ok: false, error: 'method_not_allowed' }, { Allow: 'POST' });
        return;
      }
      if (generationInFlight) {
        sendJson(request, response, 409, {
          ok: false,
          error: 'image_generation_busy',
          message: '七章插画仍在生成，请等待本次绘本完成。',
        });
        return;
      }
      const contentType = String(request.headers['content-type'] || '').split(';', 1)[0].trim().toLowerCase();
      if (contentType !== 'application/json') {
        sendJson(request, response, 415, { ok: false, error: 'unsupported_media_type', message: '请求必须使用 JSON。' });
        return;
      }
      let body;
      try {
        body = await readJsonBody(request, MAX_STORY_PACKAGE_BODY_BYTES);
      } catch (error) {
        sendJson(request, response, error.code === 'REQUEST_TOO_LARGE' ? 413 : 400, {
          ok: false,
          error: error.code === 'REQUEST_TOO_LARGE' ? 'request_too_large' : 'invalid_json',
        });
        return;
      }
      let input;
      try {
        input = validateChapterImageBody(body);
      } catch {
        sendJson(request, response, 400, {
          ok: false,
          error: 'invalid_story_package',
          message: '故事包未通过七章插画生成前的结构校验。',
        });
        return;
      }

      generationInFlight = true;
      try {
        const result = await generateChapterIllustrations({
          storyPackage: input.storyPackage,
          referenceImages: input.referenceImages,
          generatedDir,
          generateImageImpl,
          concurrency: env.IMAGE_GENERATION_CONCURRENCY,
        });
        sendJson(request, response, result.status === 'succeeded' ? 201 : 207, {
          ok: result.status === 'succeeded',
          status: result.status,
          bookId: result.bookId,
          concurrency: result.concurrency,
          illustrations: result.illustrations.map(sanitizeChapterIllustration),
        });
      } catch (error) {
        sendJson(request, response, 500, {
          ok: false,
          error: 'chapter_image_generation_internal_error',
          message: '七章插画任务未能启动。',
        });
      } finally {
        generationInFlight = false;
      }
      return;
    }

    if (requestUrl.pathname === '/api/images/generate') {
      if (request.method !== 'POST') {
        sendJson(request, response, 405, { ok: false, error: 'method_not_allowed' }, { Allow: 'POST' });
        return;
      }

      if (generationInFlight) {
        sendJson(request, response, 409, {
          ok: false,
          error: 'image_generation_busy',
          message: '上一幅童话插画仍在绘制，请等待它完成。',
        });
        return;
      }

      const contentType = String(request.headers['content-type'] || '').split(';', 1)[0].trim().toLowerCase();
      if (contentType !== 'application/json') {
        sendJson(request, response, 415, {
          ok: false,
          error: 'unsupported_media_type',
          message: '请求必须使用 JSON。',
        });
        return;
      }

      let body;
      try {
        body = await readJsonBody(request);
      } catch (error) {
        if (error.code === 'REQUEST_TOO_LARGE') {
          sendJson(request, response, 413, {
            ok: false,
            error: 'request_too_large',
            message: '故事摘要超过 64KB 限制。',
          });
        } else {
          sendJson(request, response, 400, {
            ok: false,
            error: 'invalid_json',
            message: '请求内容不是有效 JSON。',
          });
        }
        return;
      }

      let input;
      try {
        input = validateApiBody(body);
      } catch {
        sendJson(request, response, 400, {
          ok: false,
          error: 'invalid_request',
          message: '请求只允许包含权威安全故事摘要和受限参考图。',
        });
        return;
      }

      generationInFlight = true;
      try {
        const result = await generateImageImpl({
          safeStoryBrief: input.safeStoryBrief,
          referenceImages: input.referenceImages,
          generatedDir,
        });
        const image = sanitizeGeneratedImage(result);
        sendJson(request, response, 201, { ok: true, image });
      } catch (error) {
        const publicError = publicImageError(error);
        sendJson(request, response, publicError.status, {
          ok: false,
          error: publicError.error,
          message: publicError.message,
        });
      } finally {
        generationInFlight = false;
      }
      return;
    }

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      sendJson(request, response, 405, { ok: false, error: 'method_not_allowed' }, { Allow: 'GET, HEAD' });
      return;
    }

    if (requestUrl.pathname === '/health') {
      const configured = imageGatewayConfigured(env);
      sendJson(request, response, 200, {
        ok: true,
        service: 'dream-book-world',
        stage: 'image2-gateway',
        imageConfigured: configured,
        imageModel: DEFAULT_MODEL,
        image2: {
          configured,
          model: DEFAULT_MODEL,
          referenceAsset: REFERENCE_FILE_NAME,
        },
      });
      return;
    }

    const asset = resolveAsset(requestUrl.pathname)
      || resolveGeneratedAsset(requestUrl.pathname, generatedDir);
    if (asset) {
      serveFile(request, response, asset);
      return;
    }

    sendJson(request, response, 404, { ok: false, error: 'not_found' });
  };
}

function createAppServer(options = {}) {
  const handleRequest = createRequestHandler(options);
  return http.createServer((request, response) => {
    handleRequest(request, response).catch(() => {
      sendJson(request, response, 500, { ok: false, error: 'internal_server_error' });
    });
  });
}

function startFromCommandLine() {
  const port = getPort(process.env.PORT);
  const storybookStore = new SQLiteStore({
    dbPath: path.join(ROOT_DIR, 'runtime', 'dream-book.sqlite'),
    mediaRoot: path.join(ROOT_DIR, 'runtime', 'media'),
  });
  const server = createAppServer({ enablePersistence: true, storybookStore });
  let isShuttingDown = false;

  function shutdown(signal) {
    if (isShuttingDown) return;
    isShuttingDown = true;
    console.log('Received ' + signal + '; shutting down.');
    server.close((error) => {
      storybookStore.close();
      if (error) {
        console.error(error);
        process.exitCode = 1;
      }
    });
  }

  server.on('error', (error) => {
    console.error(error);
    process.exitCode = 1;
  });
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  server.listen({ host: HOST, port }, () => {
    console.log('藏梦书境 web demo listening at http://' + HOST + ':' + port);
  });
  return server;
}

if (require.main === module) startFromCommandLine();

module.exports = {
  HOST,
  DEFAULT_PORT,
  MAX_JSON_BODY_BYTES,
  MAX_STORY_PACKAGE_BODY_BYTES,
  REFERENCE_ASSET,
  createAppServer,
  createRequestHandler,
};
