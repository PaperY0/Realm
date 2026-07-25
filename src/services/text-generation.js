'use strict';

const { applyGeneratedChapterScript } = require('../domain/story-package');

const DEFAULT_TEXT_MODEL = 'gpt-5.6-sol';
const DEFAULT_TEXT_TIMEOUT_MS = 120_000;
const DEFAULT_TEXT_ATTEMPTS = 2;

function textGatewayConfigured(env = process.env) {
  return Boolean(
    env
    && typeof env.AI_GATEWAY_API_KEY === 'string'
    && env.AI_GATEWAY_API_KEY.trim()
    && typeof env.TEXT_BASE_URL === 'string'
    && env.TEXT_BASE_URL.trim()
    && typeof env.TEXT_MODEL === 'string'
    && env.TEXT_MODEL.trim(),
  );
}

class TextGenerationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'TextGenerationError';
    this.code = code;
  }
}

function textError(code, message) {
  return new TextGenerationError(code, message);
}

function normalizeTextConfig(value, label, fallback) {
  const normalized = String(value ?? fallback).trim();
  if (!normalized || normalized.length > 2_048 || /[\u0000-\u001f\u007f]/.test(normalized)) {
    throw textError('TEXT_CONFIG_ERROR', 'Text ' + label + ' is invalid');
  }
  return normalized;
}

function buildTextEndpoint(baseUrl) {
  let parsed;
  try {
    parsed = new URL(normalizeTextConfig(baseUrl, 'base URL', ''), 'http://127.0.0.1');
  } catch {
    throw textError('TEXT_CONFIG_ERROR', 'Text base URL is invalid');
  }
  if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(parsed.hostname))) {
    throw textError('TEXT_CONFIG_ERROR', 'Text gateway must use HTTPS');
  }
  const basePath = parsed.pathname.replace(/\/+$/, '');
  parsed.pathname = (basePath && basePath !== '/' ? basePath : '/v1') + '/chat/completions';
  parsed.search = '';
  parsed.hash = '';
  return parsed.toString();
}

function buildTextPrompt(safeStoryBrief, baseStoryPackage) {
  const chapterStructure = baseStoryPackage.chapterCards.map((card) => ({
    chapterNumber: card.identity.chapterNumber,
    narrativeFunction: card.narrativeContract.narrativeFunction,
    startState: card.narrativeContract.startState,
    endState: card.narrativeContract.endState,
    scene: card.illustrationContract.setting,
    narrativeMoment: card.illustrationContract.narrativeMoment,
  }));
  return [
    '只输出一个 JSON 对象，不要 Markdown，不要代码围栏。',
    '返回格式必须是 {"chapters":[{"chapterNumber":1,"title":"...","chapterText":"...","narrativeBeat":"...","imagePrompt":"..."}]}，必须正好 7 章，chapterNumber 为 1 到 7。',
    '根据安全故事摘要写出七章中文绘本文字。每章标题不超过 48 个字符，正文不超过 360 个字符；使用童话隐喻，不做心理诊断，不补写现实人物、关系、职业、地点、时间或医学结论。',
    'imagePrompt 只描述本章画面动作、场景、道具、构图和连续性，不出现文字、水印或现实身份。',
    JSON.stringify({ safeStoryBrief, chapterStructure }),
  ].join('\n');
}

function textFromPayload(payload) {
  const choice = payload?.choices?.[0];
  const content = choice?.message?.content ?? payload?.output_text;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content.map((part) => typeof part === 'string' ? part : part?.text || '').join('');
  }
  throw textError('TEXT_RESPONSE_ERROR', 'Text provider returned no usable content');
}

function parseGeneratedScript(content) {
  const normalized = content.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  try {
    const parsed = JSON.parse(normalized);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('not_object');
    return parsed;
  } catch {
    throw textError('TEXT_RESPONSE_ERROR', 'Text provider returned invalid JSON');
  }
}

async function generateTextStoryPackage(options = {}) {
  if (!options.baseStoryPackage || !Array.isArray(options.baseStoryPackage.chapterCards)) {
    throw textError('TEXT_INPUT_ERROR', 'A base seven-chapter story package is required');
  }
  const apiKey = String(options.apiKey ?? process.env.AI_GATEWAY_API_KEY ?? '').trim();
  if (!apiKey) throw textError('TEXT_CONFIG_ERROR', 'Text API credentials are not configured');
  const endpoint = buildTextEndpoint(options.baseUrl ?? process.env.TEXT_BASE_URL);
  const model = normalizeTextConfig(options.model ?? process.env.TEXT_MODEL, 'model', DEFAULT_TEXT_MODEL);
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  if (typeof fetchImpl !== 'function') throw textError('TEXT_CONFIG_ERROR', 'A text fetch implementation is required');
  const timeoutMs = Number(options.timeoutMs ?? process.env.TEXT_TIMEOUT_MS ?? DEFAULT_TEXT_TIMEOUT_MS);
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1_000 || timeoutMs > 15 * 60_000) {
    throw textError('TEXT_CONFIG_ERROR', 'Text timeout is invalid');
  }

  const attempts = Number(options.attempts ?? process.env.TEXT_GENERATION_ATTEMPTS ?? DEFAULT_TEXT_ATTEMPTS);
  if (!Number.isSafeInteger(attempts) || attempts < 1 || attempts > 3) {
    throw textError('TEXT_CONFIG_ERROR', 'Text attempts is invalid');
  }
  const requestBody = JSON.stringify({
    model,
    messages: [
      { role: 'system', content: '你是安全童话绘本编剧，只生成结构化七章内容。' },
      { role: 'user', content: buildTextPrompt(options.safeStoryBrief, options.baseStoryPackage) },
    ],
    response_format: { type: 'json_object' },
  });
  let response;
  let lastFailure;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      response = await fetchImpl(endpoint, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + apiKey,
          'Content-Type': 'application/json',
        },
        body: requestBody,
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (response?.ok === true) break;
      lastFailure = textError('TEXT_PROVIDER_ERROR', 'Text provider rejected the request');
    } catch {
      clearTimeout(timer);
      lastFailure = controller.signal.aborted
        ? textError('TEXT_TIMEOUT', 'Text generation timed out')
        : textError('TEXT_PROVIDER_ERROR', 'Text provider request failed');
    }
    if (attempt < attempts && lastFailure.code === 'TEXT_PROVIDER_ERROR') {
      await new Promise((resolve) => setTimeout(resolve, 750 * attempt));
    }
  }
  if (!response || response.ok !== true) throw lastFailure || textError('TEXT_PROVIDER_ERROR', 'Text provider request failed');

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw textError('TEXT_RESPONSE_ERROR', 'Text provider returned an unreadable response');
  }
  const generatedScript = parseGeneratedScript(textFromPayload(payload));
  try {
    return applyGeneratedChapterScript(options.baseStoryPackage, generatedScript, {
      forbiddenSourceTexts: [],
    });
  } catch {
    throw textError('TEXT_RESPONSE_ERROR', 'Text provider returned an invalid seven-chapter script');
  }
}

module.exports = {
  DEFAULT_TEXT_MODEL,
  DEFAULT_TEXT_ATTEMPTS,
  TextGenerationError,
  buildTextPrompt,
  generateTextStoryPackage,
  textGatewayConfigured,
};
