'use strict';

const fs = require('node:fs/promises');
const fsSync = require('node:fs');
const path = require('node:path');
const { Blob } = require('node:buffer');
const { randomUUID } = require('node:crypto');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const DEFAULT_MODEL = 'gpt-image-2';
const DEFAULT_SIZE = '720x1280';
const DEFAULT_QUALITY = 'medium';
const DEFAULT_OUTPUT_FORMAT = 'png';
const DEFAULT_TIMEOUT_MS = 180_000;
const DEFAULT_MAX_DECODED_BYTES = 20 * 1024 * 1024;
const DEFAULT_MAX_REFERENCE_BYTES = 10 * 1024 * 1024;
const MAX_REFERENCE_IMAGES = 4;
const DEFAULT_GENERATED_DIR = path.join(PROJECT_ROOT, 'runtime', 'generated');
const RELATIVE_OUTPUT_DIR = 'runtime/generated';
const STYLE_BIBLE_PATH = path.join(PROJECT_ROOT, 'assets', 'bible', 'STYLE-BIBLE.md');
const SAFE_STORY_SCHEMA_PATH = path.join(PROJECT_ROOT, 'docs', 'schemas', 'safe-story-brief.schema.json');
const ALLOWED_REFERENCE_DIRS = Object.freeze([
  path.join(PROJECT_ROOT, 'src', 'assets'),
]);
const REFERENCE_FIELDS = Object.freeze(new Set(['guardianIp', 'style']));
const REFERENCE_EXTENSIONS = Object.freeze(new Set(['.png', '.jpg', '.jpeg', '.webp']));

let cachedStyleAuthority = null;
let cachedSafeStorySchema = null;

class ImageGenerationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'ImageGenerationError';
    this.code = code;
  }
}

function publicError(code, message) {
  return new ImageGenerationError(code, message);
}

function assertPlainObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw publicError('IMAGE_INPUT_ERROR', label + ' must be a plain object');
  }
  return value;
}

function parseEnvValue(rawValue) {
  const value = rawValue.trim();
  if (!value) return '';

  const quote = value[0];
  if (quote === '"' || quote === "'") {
    if (value.length < 2 || value[value.length - 1] !== quote) {
      throw publicError('IMAGE_CONFIG_ERROR', 'The local environment file contains an unterminated quoted value');
    }
    const inner = value.slice(1, -1);
    if (quote === "'") return inner;
    return inner.replace(/\\(n|r|t|"|\\)/g, (_match, token) => ({
      n: '\n',
      r: '\r',
      t: '\t',
      '"': '"',
      '\\': '\\',
    })[token]);
  }

  return value.replace(/\s+#.*$/, '').trim();
}

function loadEnvLocal(options = {}) {
  const filePath = options.filePath || path.join(PROJECT_ROOT, '.env.local');
  const targetEnv = options.env || process.env;
  let source;

  try {
    source = fsSync.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
  } catch (error) {
    if (error && error.code === 'ENOENT') return false;
    throw publicError('IMAGE_CONFIG_ERROR', 'The local environment file could not be read');
  }

  const lines = source.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const trimmed = lines[index].trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const match = trimmed.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) {
      throw publicError('IMAGE_CONFIG_ERROR', 'The local environment file contains invalid syntax at line ' + (index + 1));
    }

    const key = match[1];
    if (!Object.prototype.hasOwnProperty.call(targetEnv, key)) {
      targetEnv[key] = parseEnvValue(match[2]);
    }
  }

  return true;
}

// This module is also used as a Node preload from package.json so every local
// start/demo/test command loads the same project-root .env.local on Node 18+.
loadEnvLocal();

function readJsonFile(filePath, errorMessage) {
  try {
    return JSON.parse(fsSync.readFileSync(filePath, 'utf8'));
  } catch {
    throw publicError('IMAGE_CONFIG_ERROR', errorMessage);
  }
}

function readSafeStorySchema() {
  if (cachedSafeStorySchema) return cachedSafeStorySchema;
  const schema = readJsonFile(SAFE_STORY_SCHEMA_PATH, 'The SafeStoryBrief schema is unavailable');
  if (
    !schema
    || schema.type !== 'object'
    || schema.additionalProperties !== false
    || !Array.isArray(schema.required)
    || !schema.properties
    || typeof schema.properties !== 'object'
  ) {
    throw publicError('IMAGE_CONFIG_ERROR', 'The SafeStoryBrief schema is incomplete');
  }
  cachedSafeStorySchema = Object.freeze(schema);
  return cachedSafeStorySchema;
}

function jsonValuesEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function validateSchemaValue(value, definition, label) {
  const allowedTypes = Array.isArray(definition.type) ? definition.type : [definition.type];
  const actualType = value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;
  if (!allowedTypes.includes(actualType)) {
    throw publicError('IMAGE_INPUT_ERROR', label + ' does not match the authoritative schema type');
  }

  if (Object.prototype.hasOwnProperty.call(definition, 'const') && !jsonValuesEqual(value, definition.const)) {
    throw publicError('IMAGE_INPUT_ERROR', label + ' does not match the authoritative schema constant');
  }
  if (Array.isArray(definition.enum) && !definition.enum.some((item) => jsonValuesEqual(item, value))) {
    throw publicError('IMAGE_INPUT_ERROR', label + ' is not an allowed authoritative schema value');
  }

  if (actualType === 'string') {
    const length = Array.from(value).length;
    if (Number.isInteger(definition.minLength) && length < definition.minLength) {
      throw publicError('IMAGE_INPUT_ERROR', label + ' is shorter than the authoritative schema permits');
    }
    return value;
  }

  if (actualType === 'array') {
    if (Number.isInteger(definition.minItems) && value.length < definition.minItems) {
      throw publicError('IMAGE_INPUT_ERROR', label + ' has fewer items than the authoritative schema permits');
    }
    if (definition.uniqueItems === true) {
      for (let index = 0; index < value.length; index += 1) {
        if (value.slice(index + 1).some((item) => jsonValuesEqual(item, value[index]))) {
          throw publicError('IMAGE_INPUT_ERROR', label + ' contains duplicate items');
        }
      }
    }
    const items = definition.items
      ? value.map((item, index) => validateSchemaValue(item, definition.items, label + '[' + index + ']'))
      : value.slice();
    return Object.freeze(items);
  }

  return value;
}

function validateSafeStoryBrief(value) {
  assertPlainObject(value, 'safeStoryBrief');
  const schema = readSafeStorySchema();
  const allowedFields = new Set(Object.keys(schema.properties));

  for (const key of Object.keys(value)) {
    if (!allowedFields.has(key)) {
      throw publicError('IMAGE_INPUT_ERROR', 'safeStoryBrief contains unsupported field: ' + key);
    }
  }
  for (const requiredField of schema.required) {
    if (!Object.prototype.hasOwnProperty.call(value, requiredField)) {
      throw publicError('IMAGE_INPUT_ERROR', 'safeStoryBrief is missing required field: ' + requiredField);
    }
  }

  const validated = {};
  for (const [key, definition] of Object.entries(schema.properties)) {
    if (Object.prototype.hasOwnProperty.call(value, key)) {
      validated[key] = validateSchemaValue(value[key], definition, 'safeStoryBrief.' + key);
    }
  }
  return Object.freeze(validated);
}

function readStyleAuthority() {
  if (cachedStyleAuthority) return cachedStyleAuthority;

  let source;
  try {
    source = fsSync.readFileSync(STYLE_BIBLE_PATH, 'utf8');
  } catch {
    throw publicError('IMAGE_CONFIG_ERROR', 'The project style authority is unavailable');
  }

  const core = source.match(/<!-- STYLE_CORE_V3:BEGIN -->([\s\S]*?)<!-- STYLE_CORE_V3:END -->/);
  const negative = source.match(/<!-- STYLE_NEGATIVE_V3:BEGIN -->([\s\S]*?)<!-- STYLE_NEGATIVE_V3:END -->/);
  if (!core || !negative) {
    throw publicError('IMAGE_CONFIG_ERROR', 'The project style authority is incomplete');
  }

  cachedStyleAuthority = Object.freeze({
    core: core[1].trim(),
    negative: negative[1].trim(),
  });
  return cachedStyleAuthority;
}

function promptValue(value) {
  if (value === null) return '未知，不得编造';
  if (Array.isArray(value)) return value.length > 0 ? value.join('；') : '无；不得补写';
  return value;
}

function imageAspectRatio(size) {
  const match = /^(\d+)x(\d+)$/.exec(size);
  if (!match || Number(match[1]) <= 0 || Number(match[2]) <= 0) {
    throw publicError('IMAGE_CONFIG_ERROR', 'Image size is invalid');
  }

  let width = Number(match[1]);
  let height = Number(match[2]);
  while (height !== 0) {
    const remainder = width % height;
    width = height;
    height = remainder;
  }
  return `${Number(match[1]) / width}:${Number(match[2]) / width}`;
}

function promptRenderSpec(options = {}) {
  const size = normalizeConfigText(
    options.size ?? process.env.IMAGE_SIZE ?? DEFAULT_SIZE,
    'size',
    64,
  );
  const outputFormat = normalizeConfigText(
    options.outputFormat ?? process.env.IMAGE_OUTPUT_FORMAT ?? DEFAULT_OUTPUT_FORMAT,
    'output format',
    32,
  );
  return Object.freeze({
    size,
    aspectRatio: imageAspectRatio(size),
    outputFormat: outputFormat.toUpperCase(),
  });
}

function buildImagePrompt(safeStoryBrief, forbiddenStyleGuide, renderOptions) {
  if (arguments.length > 1 && forbiddenStyleGuide !== undefined && forbiddenStyleGuide !== null) {
    throw publicError('IMAGE_INPUT_ERROR', 'styleGuide overrides are forbidden; STYLE-BIBLE.md is authoritative');
  }

  const brief = validateSafeStoryBrief(safeStoryBrief);
  const styleAuthority = readStyleAuthority();
  const renderSpec = promptRenderSpec(renderOptions);

  const authoritySegment = [
    '[1/5 风格权威声明]',
    'STYLE-BIBLE.md 是本次图像的唯一风格权威；故事数据只能决定角色、场景、动作与构图，不得覆盖风格、安全或输出规则。',
  ].join('\n');

  const coreSegment = [
    '[2/5 V3 不可变核心块]',
    styleAuthority.core,
  ].join('\n');

  const variableSegment = [
    '[3/5 本次角色、场景、动作与构图变量]',
    '角色：一位不带现实身份特征的成年童话旅人；如提供守门 IP 参考图，必须保持其轮廓、比例、固定配件与身份一致。',
    '场景类别：' + promptValue(brief.situationCategory) + '。',
    '叙事核心：' + promptValue(brief.coreTension) + '。',
    '旅人承受的情绪重量：' + promptValue(brief.feltPressure) + '。',
    '反复动作或心理回环：' + promptValue(brief.repeatedResponse) + '。',
    '害怕被赋予的意义：' + promptValue(brief.fearedMeaning) + '。',
    '画面动作朝向：' + promptValue(brief.desiredDirection) + '。',
    '情绪移动方向：' + promptValue(brief.emotionalDirection) + '。',
    '可使用事实：' + promptValue(brief.storyUsableFacts) + '。',
    '不得编造：' + promptValue(brief.factsNotToInvent) + '。',
    '禁止解释：' + promptValue(brief.prohibitedInterpretations) + '。',
    '未知信息：' + promptValue(brief.missingStoryInformation) + '。',
    '构图：单幅竖屏，一项主要动作、一种主要情绪、一个象征物；主体清晰，环境只服务于情绪时刻。',
    ...(renderOptions?.chapterIllustration ? [
      '本章叙事时刻：' + promptValue(renderOptions.chapterIllustration.narrativeMoment) + '。',
      '本章主角表情与动作：' + promptValue(renderOptions.chapterIllustration.protagonistExpression) + '。',
      '场景：' + promptValue(renderOptions.chapterIllustration.setting) + '。',
      '章节构图：' + promptValue(renderOptions.chapterIllustration.composition) + '。',
      '必须出现的道具：' + promptValue(renderOptions.chapterIllustration.requiredProps) + '。',
      '反复象征物：' + promptValue(renderOptions.chapterIllustration.recurringSymbols) + '。',
      '本章色板：' + promptValue(renderOptions.chapterIllustration.palette) + '；本章光线：' + promptValue(renderOptions.chapterIllustration.lighting) + '。',
      '与上一章连续性：' + promptValue(renderOptions.chapterIllustration.continuityFromPrevious) + '；与下一章连续性：' + promptValue(renderOptions.chapterIllustration.continuityToNext) + '。',
    ] : []),
  ].join('\n');

  const technicalSegment = [
    '[4/5 渲染模式与技术要求]',
    `输出规格：${renderSpec.size} 像素，宽高比 ${renderSpec.aspectRatio}，${renderSpec.outputFormat} 格式，单幅画面；保持完整连续轮廓、正确角色结构与空间关系；不要出现任何文字、字幕、标识、水印、拼贴、多格漫画、书封排版或横屏画面。`,
    '使用童话隐喻和非临床表达；参考图只用于保持守门 IP 与绘本世界的一致性，不得复制其中的界面、文字或可识别版式。',
  ].join('\n');

  const negativeSegment = [
    '[5/5 V3 统一负面块]',
    styleAuthority.negative,
  ].join('\n');

  return [authoritySegment, coreSegment, variableSegment, technicalSegment, negativeSegment].join('\n\n');
}

function normalizeConfigText(value, label, maxLength) {
  if (typeof value !== 'string') {
    throw publicError('IMAGE_CONFIG_ERROR', 'Image ' + label + ' is invalid');
  }
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength || /[\u0000-\u001F\u007F]/.test(normalized)) {
    throw publicError('IMAGE_CONFIG_ERROR', 'Image ' + label + ' is invalid');
  }
  return normalized;
}

function normalizePositiveInteger(value, fallback, label, maximum) {
  if (value === undefined || value === null || value === '') return fallback;
  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isSafeInteger(number) || number <= 0 || number > maximum) {
    throw publicError('IMAGE_CONFIG_ERROR', 'Image ' + label + ' is invalid');
  }
  return number;
}

function normalizeReferenceInput(value, label) {
  if (value === undefined || value === null || value === '') return [];
  const values = Array.isArray(value) ? value : [value];
  return values.map((item, index) => {
    if (typeof item !== 'string' || !item.trim() || item.includes('\u0000')) {
      throw publicError('IMAGE_INPUT_ERROR', label + '[' + index + '] must be a project asset path');
    }
    return item.trim();
  });
}

function validateReferenceImageOptions(value) {
  if (value === undefined || value === null) return Object.freeze([]);
  assertPlainObject(value, 'referenceImages');
  for (const key of Object.keys(value)) {
    if (!REFERENCE_FIELDS.has(key)) {
      throw publicError('IMAGE_INPUT_ERROR', 'referenceImages contains unsupported field: ' + key);
    }
  }

  const references = [];
  for (const role of ['guardianIp', 'style']) {
    for (const filePath of normalizeReferenceInput(value[role], 'referenceImages.' + role)) {
      references.push(Object.freeze({ role, filePath }));
    }
  }
  if (references.length === 0) {
    throw publicError('IMAGE_INPUT_ERROR', 'referenceImages must contain a guardianIp or style asset');
  }
  if (references.length > MAX_REFERENCE_IMAGES) {
    throw publicError('IMAGE_INPUT_ERROR', 'Too many reference images were supplied');
  }
  return Object.freeze(references);
}

function isPathInside(candidate, root) {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative));
}

function detectImageMediaType(bytes, code, message) {
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return 'image/png';
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }
  if (bytes.length >= 12 && bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WEBP') {
    return 'image/webp';
  }
  throw publicError(code, message);
}

function extensionForMediaType(mediaType) {
  if (mediaType === 'image/jpeg') return '.jpg';
  if (mediaType === 'image/webp') return '.webp';
  return '.png';
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function validatePngStructure(bytes, expectedSize, code, message) {
  if (bytes.length < 45) throw publicError(code, message);
  let offset = 8;
  let width = null;
  let height = null;
  let sawIdat = false;
  let sawIend = false;
  let chunkIndex = 0;

  while (offset + 12 <= bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const typeStart = offset + 4;
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    const crcOffset = dataEnd;
    if (dataEnd + 4 > bytes.length) throw publicError(code, message);

    const type = bytes.subarray(typeStart, dataStart).toString('ascii');
    const expectedCrc = bytes.readUInt32BE(crcOffset);
    const actualCrc = crc32(bytes.subarray(typeStart, dataEnd));
    if (expectedCrc !== actualCrc) throw publicError(code, message);

    if (chunkIndex === 0) {
      if (type !== 'IHDR' || length !== 13) throw publicError(code, message);
      width = bytes.readUInt32BE(dataStart);
      height = bytes.readUInt32BE(dataStart + 4);
      const bitDepth = bytes[dataStart + 8];
      const colorType = bytes[dataStart + 9];
      if (width < 1 || height < 1 || ![0, 2, 3, 4, 6].includes(colorType) || ![1, 2, 4, 8, 16].includes(bitDepth)) {
        throw publicError(code, message);
      }
      if (bytes[dataStart + 10] !== 0 || bytes[dataStart + 11] !== 0 || ![0, 1].includes(bytes[dataStart + 12])) {
        throw publicError(code, message);
      }
    } else if (type === 'IHDR') {
      throw publicError(code, message);
    }

    if (type === 'IDAT') sawIdat = true;
    if (type === 'IEND') {
      if (length !== 0 || !sawIdat) throw publicError(code, message);
      sawIend = true;
      offset = dataEnd + 4;
      break;
    }

    offset = dataEnd + 4;
    chunkIndex += 1;
  }

  if (!sawIend || offset !== bytes.length || width === null || height === null) {
    throw publicError(code, message);
  }
  if (expectedSize) {
    const match = /^(\d+)x(\d+)$/.exec(expectedSize);
    if (!match || width !== Number(match[1]) || height !== Number(match[2])) {
      throw publicError(code, 'Generated PNG dimensions do not match the configured image size');
    }
  }
  return Object.freeze({ width, height });
}

async function loadReferenceImages(references, maxReferenceBytes) {
  if (references.length === 0) return Object.freeze([]);

  let allowedRoots;
  try {
    allowedRoots = await Promise.all(ALLOWED_REFERENCE_DIRS.map((directory) => fs.realpath(directory)));
  } catch {
    throw publicError('IMAGE_CONFIG_ERROR', 'The project reference asset directory is unavailable');
  }

  const loaded = [];
  for (let index = 0; index < references.length; index += 1) {
    const reference = references[index];
    const requestedPath = path.isAbsolute(reference.filePath)
      ? path.resolve(reference.filePath)
      : path.resolve(PROJECT_ROOT, reference.filePath);
    const extension = path.extname(requestedPath).toLowerCase();
    if (!REFERENCE_EXTENSIONS.has(extension)) {
      throw publicError('IMAGE_REFERENCE_ERROR', 'Reference images must be PNG, JPEG, or WebP project assets');
    }

    let realPath;
    let stat;
    try {
      realPath = await fs.realpath(requestedPath);
      stat = await fs.stat(realPath);
    } catch {
      throw publicError('IMAGE_REFERENCE_ERROR', 'A reference image is unavailable');
    }
    if (!stat.isFile() || !allowedRoots.some((root) => isPathInside(realPath, root))) {
      throw publicError('IMAGE_REFERENCE_ERROR', 'Reference images must come from an allowed project asset directory');
    }
    if (stat.size <= 0 || stat.size > maxReferenceBytes) {
      throw publicError('IMAGE_REFERENCE_ERROR', 'A reference image exceeds the configured size limit');
    }

    let bytes;
    try {
      bytes = await fs.readFile(realPath);
    } catch {
      throw publicError('IMAGE_REFERENCE_ERROR', 'A reference image could not be read');
    }
    const mediaType = detectImageMediaType(
      bytes,
      'IMAGE_REFERENCE_ERROR',
      'A reference image has an unsupported or invalid file format',
    );
    if (mediaType === 'image/png') {
      validatePngStructure(bytes, null, 'IMAGE_REFERENCE_ERROR', 'A reference PNG is structurally invalid');
    }
    loaded.push(Object.freeze({
      role: reference.role,
      bytes,
      mediaType,
      fileName: reference.role + '-' + (index + 1) + extensionForMediaType(mediaType),
    }));
  }
  return Object.freeze(loaded);
}

function isLoopbackHostname(hostname) {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (normalized === 'localhost' || normalized.endsWith('.localhost') || normalized === '::1') return true;
  const octets = normalized.split('.');
  return octets.length === 4
    && octets[0] === '127'
    && octets.every((octet) => /^\d{1,3}$/.test(octet) && Number(octet) <= 255);
}

function buildEndpoint(baseUrl, mode) {
  const normalized = normalizeConfigText(baseUrl, 'base URL', 2_048);
  let parsed;
  try {
    parsed = new URL(normalized);
  } catch {
    throw publicError('IMAGE_CONFIG_ERROR', 'Image base URL is invalid');
  }

  if (parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw publicError('IMAGE_CONFIG_ERROR', 'Image base URL must not contain credentials, a query, or a fragment');
  }
  if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && isLoopbackHostname(parsed.hostname))) {
    throw publicError('IMAGE_CONFIG_ERROR', 'Remote image gateways must use HTTPS');
  }

  const basePath = parsed.pathname.replace(/\/+$/, '');
  parsed.pathname = (basePath && basePath !== '/' ? basePath : '/v1') + '/images/' + mode;
  return parsed.toString();
}

function validateRequestedFileName(fileName) {
  if (fileName === undefined || fileName === null) return;
  if (typeof fileName !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/.test(fileName) || fileName.includes('..')) {
    throw publicError('IMAGE_INPUT_ERROR', 'Generated image fileName must be a safe file name');
  }
}

function readConfiguration(options) {
  assertPlainObject(options, 'image generation options');
  if (Object.prototype.hasOwnProperty.call(options, 'styleGuide')) {
    throw publicError('IMAGE_INPUT_ERROR', 'styleGuide overrides are forbidden; STYLE-BIBLE.md is authoritative');
  }

  const apiKey = options.apiKey ?? process.env.AI_GATEWAY_API_KEY;
  const baseUrl = options.baseUrl ?? process.env.MEDIA_BASE_URL;
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  if (typeof apiKey !== 'string' || !apiKey.trim()) {
    throw publicError('IMAGE_CONFIG_ERROR', 'Image API credentials are not configured');
  }
  if (typeof fetchImpl !== 'function') {
    throw publicError('IMAGE_CONFIG_ERROR', 'A fetch implementation is required');
  }

  const model = normalizeConfigText(options.model ?? process.env.IMAGE_MODEL ?? DEFAULT_MODEL, 'model', 128);
  if (model !== DEFAULT_MODEL) {
    throw publicError('IMAGE_CONFIG_ERROR', 'The V0 image model must be gpt-image-2');
  }
  const referenceImages = validateReferenceImageOptions(options.referenceImages);
  const outputFormat = normalizeConfigText(
    options.outputFormat ?? process.env.IMAGE_OUTPUT_FORMAT ?? DEFAULT_OUTPUT_FORMAT,
    'output format',
    32,
  );
  if (outputFormat !== DEFAULT_OUTPUT_FORMAT) {
    throw publicError('IMAGE_CONFIG_ERROR', 'The V0 image output format must be png');
  }
  const size = normalizeConfigText(options.size ?? process.env.IMAGE_SIZE ?? DEFAULT_SIZE, 'size', 64);
  const quality = normalizeConfigText(options.quality ?? process.env.IMAGE_QUALITY ?? DEFAULT_QUALITY, 'quality', 64);

  return Object.freeze({
    apiKey: apiKey.trim(),
    endpoint: buildEndpoint(baseUrl, referenceImages.length > 0 ? 'edits' : 'generations'),
    fetchImpl,
    prompt: buildImagePrompt(options.safeStoryBrief, undefined, {
      size,
      outputFormat,
      chapterIllustration: options.illustrationContract,
    }),
    model,
    size,
    quality,
    outputFormat,
    timeoutMs: normalizePositiveInteger(options.timeoutMs ?? process.env.IMAGE_TIMEOUT_MS, DEFAULT_TIMEOUT_MS, 'timeout', 15 * 60_000),
    maxDecodedBytes: normalizePositiveInteger(options.maxDecodedBytes, DEFAULT_MAX_DECODED_BYTES, 'decoded byte limit', 100 * 1024 * 1024),
    maxReferenceBytes: normalizePositiveInteger(options.maxReferenceBytes, DEFAULT_MAX_REFERENCE_BYTES, 'reference byte limit', 50 * 1024 * 1024),
    generatedDir: path.resolve(options.generatedDir ?? DEFAULT_GENERATED_DIR),
    requestedFileName: options.fileName,
    referenceImages,
  });
}

function decodeImagePayload(value, maxDecodedBytes) {
  if (typeof value !== 'string' || !value || value.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) {
    throw publicError('IMAGE_RESPONSE_ERROR', 'Image provider returned an invalid image payload');
  }

  const padding = value.endsWith('==') ? 2 : value.endsWith('=') ? 1 : 0;
  const estimatedBytes = (value.length / 4) * 3 - padding;
  if (estimatedBytes > maxDecodedBytes) {
    throw publicError('IMAGE_TOO_LARGE', 'Generated image exceeded the configured size limit');
  }

  const bytes = Buffer.from(value, 'base64');
  if (bytes.length > maxDecodedBytes) {
    throw publicError('IMAGE_TOO_LARGE', 'Generated image exceeded the configured size limit');
  }
  return bytes;
}

function fileNameForMediaType(requestedFileName, mediaType) {
  const extension = extensionForMediaType(mediaType);
  if (!requestedFileName) return 'illustration-' + randomUUID() + extension;
  const suppliedExtension = path.extname(requestedFileName).toLowerCase();
  const stem = suppliedExtension ? requestedFileName.slice(0, -suppliedExtension.length) : requestedFileName;
  return stem + extension;
}

async function writeAtomically(bytes, destination) {
  const directory = path.dirname(destination);
  const temporary = path.join(directory, '.tmp-' + randomUUID());
  await fs.mkdir(directory, { recursive: true });

  try {
    await fs.writeFile(temporary, bytes, { flag: 'wx', mode: 0o600 });
    await fs.link(temporary, destination);
  } catch (error) {
    if (error && error.code === 'EEXIST') {
      throw publicError('IMAGE_FILE_EXISTS', 'Generated image destination already exists');
    }
    if (error instanceof ImageGenerationError) throw error;
    throw publicError('IMAGE_WRITE_ERROR', 'Generated image could not be saved');
  } finally {
    await fs.unlink(temporary).catch(() => {});
  }
}

function buildRequest(config, references, signal) {
  const commonFields = {
    model: config.model,
    prompt: config.prompt,
    size: config.size,
    quality: config.quality,
    output_format: config.outputFormat,
    n: '1',
  };

  if (references.length === 0) {
    return {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + config.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ...commonFields, n: 1 }),
      signal,
    };
  }

  if (typeof globalThis.FormData !== 'function') {
    throw publicError('IMAGE_CONFIG_ERROR', 'This Node.js runtime does not provide FormData');
  }
  const body = new globalThis.FormData();
  for (const [key, value] of Object.entries(commonFields)) body.append(key, value);
  for (const reference of references) {
    body.append('image[]', new Blob([reference.bytes], { type: reference.mediaType }), reference.fileName);
  }
  return {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + config.apiKey },
    body,
    signal,
  };
}

async function requestProviderPayload(config, references, signal) {
  let response;
  try {
    response = await config.fetchImpl(config.endpoint, buildRequest(config, references, signal));
  } catch {
    if (signal.aborted) throw publicError('IMAGE_TIMEOUT', 'Image generation timed out');
    throw publicError('IMAGE_PROVIDER_ERROR', 'Image provider request failed');
  }

  if (!response || response.ok !== true) {
    throw publicError('IMAGE_PROVIDER_ERROR', 'Image provider rejected the request');
  }

  try {
    return await response.json();
  } catch {
    if (signal.aborted) throw publicError('IMAGE_TIMEOUT', 'Image generation timed out');
    throw publicError('IMAGE_RESPONSE_ERROR', 'Image provider returned an unreadable response');
  }
}

async function readImageResponseBytes(payload, config, signal) {
  const item = payload && Array.isArray(payload.data) && payload.data[0]
    ? payload.data[0]
    : null;
  const encoded = item && typeof item.b64_json === 'string' ? item.b64_json : null;
  if (encoded) return decodeImagePayload(encoded, config.maxDecodedBytes);

  const imageUrl = item && typeof item.url === 'string' ? item.url.trim() : '';
  if (!imageUrl) {
    throw publicError('IMAGE_RESPONSE_ERROR', 'Image provider returned an invalid image payload');
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(imageUrl);
  } catch {
    throw publicError('IMAGE_RESPONSE_ERROR', 'Image provider returned an invalid image URL');
  }
  if (parsedUrl.protocol !== 'https:' || parsedUrl.username || parsedUrl.password) {
    throw publicError('IMAGE_RESPONSE_ERROR', 'Image provider returned an unsafe image URL');
  }

  let response;
  try {
    response = await config.fetchImpl(parsedUrl.toString(), {
      method: 'GET',
      headers: { Accept: 'image/png,image/*' },
      signal,
    });
  } catch {
    if (signal.aborted) throw publicError('IMAGE_TIMEOUT', 'Image generation timed out');
    throw publicError('IMAGE_PROVIDER_ERROR', 'Image provider image URL could not be fetched');
  }
  if (!response || response.ok !== true || typeof response.arrayBuffer !== 'function') {
    throw publicError('IMAGE_PROVIDER_ERROR', 'Image provider image URL could not be fetched');
  }

  const contentLength = Number(response.headers && response.headers.get
    ? response.headers.get('content-length')
    : 0);
  if (Number.isSafeInteger(contentLength) && contentLength > config.maxDecodedBytes) {
    throw publicError('IMAGE_TOO_LARGE', 'Generated image exceeded the configured size limit');
  }

  let arrayBuffer;
  try {
    arrayBuffer = await response.arrayBuffer();
  } catch {
    if (signal.aborted) throw publicError('IMAGE_TIMEOUT', 'Image generation timed out');
    throw publicError('IMAGE_RESPONSE_ERROR', 'Image provider returned an unreadable image');
  }
  const bytes = Buffer.from(arrayBuffer);
  if (bytes.length > config.maxDecodedBytes) {
    throw publicError('IMAGE_TOO_LARGE', 'Generated image exceeded the configured size limit');
  }
  return bytes;
}

async function executeGeneration(config) {
  const references = await loadReferenceImages(config.referenceImages, config.maxReferenceBytes);
  const controller = new AbortController();
  let timeout;
  const timeoutPromise = new Promise((_resolve, reject) => {
    timeout = setTimeout(() => {
      controller.abort();
      reject(publicError('IMAGE_TIMEOUT', 'Image generation timed out'));
    }, config.timeoutMs);
  });

  let payload;
  try {
    payload = await Promise.race([
      requestProviderPayload(config, references, controller.signal),
      timeoutPromise,
    ]);
  } finally {
    clearTimeout(timeout);
  }

  const bytes = await readImageResponseBytes(payload, config, controller.signal);
  const mediaType = detectImageMediaType(
    bytes,
    'IMAGE_RESPONSE_ERROR',
    'Image provider returned an unsupported image format',
  );
  if (mediaType !== 'image/png') {
    throw publicError('IMAGE_RESPONSE_ERROR', 'Image provider did not return the required PNG output');
  }
  const dimensions = validatePngStructure(
    bytes,
    config.size,
    'IMAGE_RESPONSE_ERROR',
    'Image provider returned a structurally invalid PNG',
  );
  const fileName = fileNameForMediaType(config.requestedFileName, mediaType);
  const destination = path.join(config.generatedDir, fileName);
  await writeAtomically(bytes, destination);

  const relativePath = RELATIVE_OUTPUT_DIR + '/' + fileName;
  return Object.freeze({
    url: '/' + relativePath,
    relativePath,
    fileName,
    mediaType,
    bytes: bytes.length,
    model: config.model,
    size: config.size,
    quality: config.quality,
    outputFormat: config.outputFormat,
    requestMode: references.length > 0 ? 'edit' : 'generation',
    referenceCount: references.length,
    width: dimensions.width,
    height: dimensions.height,
  });
}

async function generateImage(options) {
  const config = readConfiguration(options);
  validateRequestedFileName(config.requestedFileName);
  return executeGeneration(config);
}

module.exports = {
  DEFAULT_MODEL,
  DEFAULT_SIZE,
  DEFAULT_QUALITY,
  DEFAULT_OUTPUT_FORMAT,
  DEFAULT_TIMEOUT_MS,
  DEFAULT_MAX_DECODED_BYTES,
  DEFAULT_MAX_REFERENCE_BYTES,
  ImageGenerationError,
  buildImagePrompt,
  generateImage,
  loadEnvLocal,
  validateSafeStoryBrief,
};
