'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const zlib = require('node:zlib');
const { randomUUID } = require('node:crypto');

const {
  buildImagePrompt,
  generateImage,
  loadEnvLocal,
  validateSafeStoryBrief,
} = require('../src/services/image-generation');

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])));
  return Buffer.concat([length, typeBytes, data, crc]);
}

function createPng(width, height) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const rowLength = 1 + width * 4;
  const pixels = Buffer.alloc(rowLength * height);
  for (let row = 0; row < height; row += 1) pixels[row * rowLength] = 0;
  return Buffer.concat([
    signature,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(pixels)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

const PNG_720_1280 = createPng(720, 1280);

function safeStoryBrief(overrides = {}) {
  return {
    schemaVersion: '1.0.0',
    briefId: 'brief-stage6-demo',
    safetyStatus: 'story_safe',
    sessionNeed: 'help_me_sort_it_out',
    situationCategory: '外部评价带来的自我怀疑',
    coreTension: '旅人害怕外部评价会替自己命名',
    feltPressure: ['一句评价在心里反复回响'],
    repeatedResponse: '不断检查那句话是否代表真实的自己',
    fearedMeaning: '担心外部判断成为固定身份',
    desiredDirection: '重新取回自己的声音',
    emotionalDirection: '从被评价牵引走向重新听见自己',
    storyUsableFacts: ['发生过一次持续影响旅人的外部评价'],
    factsNotToInvent: ['现实身份', '具体关系'],
    prohibitedInterpretations: ['不作心理诊断', '不宣称已经治愈'],
    userConfirmedSentence: null,
    missingStoryInformation: ['评价者身份'],
    ...overrides,
  };
}

function response({ ok = true, status = 200, body, jsonError } = {}) {
  return {
    ok,
    status,
    async json() {
      if (jsonError) throw jsonError;
      return body;
    },
  };
}

async function expectPublicError(action, expectedCode, forbidden = []) {
  let caught;
  try {
    await action();
  } catch (error) {
    caught = error;
  }
  assert.ok(caught, 'expected the image gateway to reject');
  assert.equal(caught.code, expectedCode);
  const publicText = [String(caught), caught.stack || '', JSON.stringify(caught)].join('\n');
  for (const secret of forbidden) {
    assert.doesNotMatch(publicText, new RegExp(secret.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  return caught;
}

async function run() {
  const projectRoot = path.resolve(__dirname, '..');
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'realm-stage6-image-'));
  const generatedDir = path.join(tempRoot, 'runtime', 'generated');
  const referenceName = '.stage6-reference-' + randomUUID() + '.png';
  const invalidReferenceName = '.stage6-invalid-' + randomUUID() + '.png';
  const referencePath = path.join(projectRoot, 'src', 'assets', referenceName);
  const invalidReferencePath = path.join(projectRoot, 'src', 'assets', invalidReferenceName);
  const outsideReferencePath = path.join(tempRoot, 'outside-reference.png');
  fs.writeFileSync(referencePath, createPng(64, 64));
  fs.writeFileSync(invalidReferencePath, Buffer.from('not-a-png'));
  fs.writeFileSync(outsideReferencePath, createPng(64, 64));

  try {
    const validated = validateSafeStoryBrief(safeStoryBrief());
    assert.deepEqual(validated.feltPressure, ['一句评价在心里反复回响']);
    assert.equal(validated.safetyStatus, 'story_safe');
    assert.throws(() => validateSafeStoryBrief({ ...safeStoryBrief(), arbitrary: true }), /unsupported field/i);
    assert.throws(() => validateSafeStoryBrief({ ...safeStoryBrief(), feltPressure: 'wrong type' }), /schema type/i);
    const missingBrief = safeStoryBrief();
    delete missingBrief.briefId;
    assert.throws(() => validateSafeStoryBrief(missingBrief), /missing required field: briefId/i);
    assert.throws(() => validateSafeStoryBrief({ ...safeStoryBrief(), safetyStatus: 'unsafe' }), /schema constant/i);

    const prompt = buildImagePrompt(safeStoryBrief());
    const order = [
      prompt.indexOf('[1/5 风格权威声明]'),
      prompt.indexOf('[2/5 V3 不可变核心块]'),
      prompt.indexOf('[3/5 本次角色、场景、动作与构图变量]'),
      prompt.indexOf('[4/5 渲染模式与技术要求]'),
      prompt.indexOf('[5/5 V3 统一负面块]'),
    ];
    assert.ok(order.every((value) => value >= 0));
    assert.deepEqual([...order].sort((a, b) => a - b), order, 'prompt must preserve the five-part STYLE-BIBLE order');
    assert.match(prompt, /STYLE AUTHORITY — DREAMBOOK REALM V3\.3/);
    assert.match(prompt, /UNIFIED NEGATIVE — DREAMBOOK REALM V3\.3/);
    assert.match(prompt, /重新取回自己的声音/);
    assert.match(prompt, /不要出现任何文字、字幕、标识、水印/);
    assert.equal(prompt.trim().endsWith('No text, letters, pseudo-writing, logo, signature, account name or watermark inside the generated image.'), true);
    assert.throws(() => buildImagePrompt(safeStoryBrief(), 'arbitrary style'), /styleGuide overrides are forbidden/i);

    const envFile = path.join(tempRoot, '.env.local');
    fs.writeFileSync(envFile, [
      '# local test',
      'AI_GATEWAY_API_KEY="loaded-key"',
      'MEDIA_BASE_URL=https://media.example.test/v1 # comment',
      'IMAGE_MODEL=gpt-image-2',
      '',
    ].join('\n'));
    const targetEnv = { AI_GATEWAY_API_KEY: 'keep-existing' };
    assert.equal(loadEnvLocal({ filePath: envFile, env: targetEnv }), true);
    assert.equal(targetEnv.AI_GATEWAY_API_KEY, 'keep-existing', 'existing process env must win');
    assert.equal(targetEnv.MEDIA_BASE_URL, 'https://media.example.test/v1');
    const scripts = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8')).scripts;
    assert.match(scripts.start, /-r \.\/src\/services\/image-generation\.js/);
    assert.match(scripts.demo, /-r \.\/src\/services\/image-generation\.js/);
    assert.match(scripts.test, /-r \.\/src\/services\/image-generation\.js/);

    let capturedUrl;
    let capturedOptions;
    const successFetch = async (url, options) => {
      capturedUrl = url;
      capturedOptions = options;
      return response({ body: { data: [{ b64_json: PNG_720_1280.toString('base64') }] } });
    };

    const result = await generateImage({
      safeStoryBrief: safeStoryBrief(),
      apiKey: 'stage6-api-key',
      baseUrl: 'https://media.example.test/v1/',
      fetchImpl: successFetch,
      generatedDir,
      fileName: 'chapter-1.png',
    });
    assert.equal(capturedUrl, 'https://media.example.test/v1/images/generations');
    assert.equal(capturedOptions.headers.Authorization, 'Bearer stage6-api-key');
    assert.equal(capturedOptions.headers['Content-Type'], 'application/json');
    assert.deepEqual(JSON.parse(capturedOptions.body), {
      model: 'gpt-image-2',
      prompt,
      size: '720x1280',
      quality: 'medium',
      output_format: 'png',
      n: 1,
    });
    assert.deepEqual(result, {
      url: '/runtime/generated/chapter-1.png',
      relativePath: 'runtime/generated/chapter-1.png',
      fileName: 'chapter-1.png',
      mediaType: 'image/png',
      bytes: PNG_720_1280.length,
      model: 'gpt-image-2',
      size: '720x1280',
      quality: 'medium',
      outputFormat: 'png',
      requestMode: 'generation',
      referenceCount: 0,
      width: 720,
      height: 1280,
    });
    assert.deepEqual(fs.readFileSync(path.join(generatedDir, 'chapter-1.png')), PNG_720_1280);
    assert.equal(fs.readdirSync(generatedDir).some((name) => name.includes('.tmp-')), false);

    const editResult = await generateImage({
      safeStoryBrief: safeStoryBrief(),
      referenceImages: {
        guardianIp: path.relative(projectRoot, referencePath),
        style: path.relative(projectRoot, referencePath),
      },
      apiKey: 'stage6-api-key',
      baseUrl: 'https://media.example.test/v1',
      fetchImpl: successFetch,
      generatedDir,
      fileName: 'chapter-edit.png',
    });
    assert.equal(capturedUrl, 'https://media.example.test/v1/images/edits');
    assert.equal(capturedOptions.headers['Content-Type'], undefined, 'FormData must set its own multipart boundary');
    assert.ok(capturedOptions.body instanceof FormData);
    assert.equal(capturedOptions.body.get('model'), 'gpt-image-2');
    assert.equal(capturedOptions.body.get('prompt'), prompt);
    assert.equal(capturedOptions.body.getAll('image[]').length, 2);
    assert.equal(editResult.requestMode, 'edit');
    assert.equal(editResult.referenceCount, 2);

    await expectPublicError(() => generateImage({
      safeStoryBrief: safeStoryBrief(),
      referenceImages: { guardianIp: outsideReferencePath },
      apiKey: 'key',
      baseUrl: 'https://media.example.test',
      generatedDir,
      fetchImpl: successFetch,
    }), 'IMAGE_REFERENCE_ERROR');
    await expectPublicError(() => generateImage({
      safeStoryBrief: safeStoryBrief(),
      referenceImages: { style: path.relative(projectRoot, invalidReferencePath) },
      apiKey: 'key',
      baseUrl: 'https://media.example.test',
      generatedDir,
      fetchImpl: successFetch,
    }), 'IMAGE_REFERENCE_ERROR');
    await expectPublicError(() => generateImage({
      safeStoryBrief: safeStoryBrief(),
      referenceImages: { style: path.relative(projectRoot, referencePath) },
      maxReferenceBytes: 8,
      apiKey: 'key',
      baseUrl: 'https://media.example.test',
      generatedDir,
      fetchImpl: successFetch,
    }), 'IMAGE_REFERENCE_ERROR');

    await expectPublicError(() => generateImage({
      safeStoryBrief: safeStoryBrief(),
      apiKey: 'key',
      baseUrl: 'http://remote.example.test',
      generatedDir,
      fetchImpl: successFetch,
    }), 'IMAGE_CONFIG_ERROR');
    const localResult = await generateImage({
      safeStoryBrief: safeStoryBrief(),
      apiKey: 'key',
      baseUrl: 'http://127.0.0.1:9999/v1',
      generatedDir,
      fileName: 'loopback.png',
      fetchImpl: successFetch,
    });
    assert.equal(capturedUrl, 'http://127.0.0.1:9999/v1/images/generations');
    assert.equal(localResult.width, 720);

    const fallbackNames = ['AI_GATEWAY_API_KEY', 'MEDIA_BASE_URL', 'IMAGE_API_KEY', 'CODEX_IMAGE_API_KEY', 'OPENAI_API_KEY', 'IMAGE_BASE_URL', 'OPENAI_BASE_URL'];
    const savedEnvironment = Object.fromEntries(fallbackNames.map((name) => [name, process.env[name]]));
    try {
      delete process.env.AI_GATEWAY_API_KEY;
      delete process.env.MEDIA_BASE_URL;
      process.env.CODEX_IMAGE_API_KEY = 'must-not-be-used';
      process.env.OPENAI_API_KEY = 'must-not-be-used';
      process.env.IMAGE_BASE_URL = 'https://must-not-be-used.example';
      await expectPublicError(() => generateImage({
        safeStoryBrief: safeStoryBrief(),
        generatedDir,
        fetchImpl: successFetch,
      }), 'IMAGE_CONFIG_ERROR', ['must-not-be-used']);
    } finally {
      for (const [name, value] of Object.entries(savedEnvironment)) {
        if (value === undefined) delete process.env[name];
        else process.env[name] = value;
      }
    }

    await expectPublicError(() => generateImage({
      safeStoryBrief: safeStoryBrief(),
      apiKey: 'key',
      baseUrl: 'https://media.example.test',
      generatedDir,
      timeoutMs: 10,
      fetchImpl: () => new Promise(() => {}),
    }), 'IMAGE_TIMEOUT');

    await expectPublicError(() => generateImage({
      safeStoryBrief: safeStoryBrief(),
      apiKey: 'key',
      baseUrl: 'https://media.example.test',
      generatedDir,
      timeoutMs: 10,
      fetchImpl: async () => ({ ok: true, json: () => new Promise(() => {}) }),
    }), 'IMAGE_TIMEOUT');

    await expectPublicError(() => generateImage({
      safeStoryBrief: safeStoryBrief(),
      apiKey: 'key',
      baseUrl: 'https://media.example.test',
      generatedDir,
      fetchImpl: async () => response({ ok: false, status: 429, body: { error: 'vendor-secret' } }),
    }), 'IMAGE_PROVIDER_ERROR', ['vendor-secret']);

    await expectPublicError(() => generateImage({
      safeStoryBrief: safeStoryBrief(),
      apiKey: 'key',
      baseUrl: 'https://media.example.test',
      generatedDir,
      fileName: 'wrong-size.png',
      fetchImpl: async () => response({ body: { data: [{ b64_json: createPng(1, 1).toString('base64') }] } }),
    }), 'IMAGE_RESPONSE_ERROR');

    const corruptPng = Buffer.from(PNG_720_1280);
    corruptPng[corruptPng.length - 1] ^= 0xff;
    await expectPublicError(() => generateImage({
      safeStoryBrief: safeStoryBrief(),
      apiKey: 'key',
      baseUrl: 'https://media.example.test',
      generatedDir,
      fetchImpl: async () => response({ body: { data: [{ b64_json: corruptPng.toString('base64') }] } }),
    }), 'IMAGE_RESPONSE_ERROR');

    const promptSecret = 'PROMPT_SECRET_7F91';
    const keySecret = 'KEY_SECRET_2A44';
    const vendorSecret = 'VENDOR_BODY_SECRET_991B';
    await expectPublicError(() => generateImage({
      safeStoryBrief: safeStoryBrief({ desiredDirection: promptSecret }),
      apiKey: keySecret,
      baseUrl: 'https://media.example.test',
      generatedDir,
      fetchImpl: async () => { throw new Error(vendorSecret + keySecret + promptSecret); },
    }), 'IMAGE_PROVIDER_ERROR', [promptSecret, keySecret, vendorSecret]);

    await expectPublicError(() => generateImage({
      safeStoryBrief: safeStoryBrief(),
      apiKey: 'key',
      baseUrl: 'https://media.example.test',
      generatedDir,
      fileName: '../escape.png',
      fetchImpl: successFetch,
    }), 'IMAGE_INPUT_ERROR');

    console.log('stage6 image tests passed');
  } finally {
    fs.rmSync(referencePath, { force: true });
    fs.rmSync(invalidReferencePath, { force: true });
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
