'use strict';

const fs = require('node:fs/promises');
const fsSync = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

const {
  generateImage,
  loadEnvLocal,
} = require('../src/services/image-generation');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const ENV_FILE_PATH = path.join(PROJECT_ROOT, '.env.local');
const REFERENCE_IMAGE_PATH = path.join(PROJECT_ROOT, 'src', 'assets', 'world-gate-reference.png');
const REPORT_PATH = path.join(PROJECT_ROOT, 'runtime', 'probe', 'latest.json');
const PAID_CONFIRMATION_FLAG = '--confirm-paid-generation';
const LOCKED_MODEL = 'gpt-image-2';
const LOCKED_SIZE = '720x1280';
const LOCKED_QUALITY = 'medium';
const LOCKED_OUTPUT_FORMAT = 'png';

class ProbeError extends Error {
  constructor(code) {
    super(code);
    this.name = 'ProbeError';
    this.code = code;
  }
}

function createSafeDemoBrief() {
  return Object.freeze({
    schemaVersion: '1.0.0',
    briefId: 'image2-live-probe-demo',
    safetyStatus: 'story_safe',
    sessionNeed: 'help_me_sort_it_out',
    situationCategory: '长期自我要求带来的疲惫与犹豫',
    coreTension: '旅人已经疲惫，却担心停下就意味着自己做得不够好',
    feltPressure: Object.freeze(['必须一直向前才算足够好', '休息会被误解为放弃']),
    repeatedResponse: '即使很累也继续检查和赶路',
    fearedMeaning: '担心一次停歇会否定此前的努力',
    desiredDirection: '允许自己在不否定努力的前提下短暂停靠',
    emotionalDirection: '从被无尽刻度催促，走向看见休息也是旅程的一部分',
    storyUsableFacts: Object.freeze([
      '旅人长期背着一只会不断增加刻度的行囊',
      '旅人已经疲惫，却仍不敢在灯火旁停下',
      '一扇守门之门邀请旅人放下一枚不必完成的刻度',
    ]),
    factsNotToInvent: Object.freeze(['现实身份', '具体关系', '具体工作或学习经历', '医学或心理诊断']),
    prohibitedInterpretations: Object.freeze(['不作心理诊断', '不宣称已经治愈', '不把疲惫解释为软弱或失败']),
    userConfirmedSentence: null,
    missingStoryInformation: Object.freeze(['现实中的具体事件', '他人身份', '事件发生时间']),
  });
}

function parseArguments(argv) {
  if (!Array.isArray(argv)) throw new ProbeError('IMAGE_PROBE_ARGUMENT_ERROR');
  if (argv.length === 0) return Object.freeze({ confirmPaidGeneration: false });
  if (argv.length === 1 && argv[0] === PAID_CONFIRMATION_FLAG) {
    return Object.freeze({ confirmPaidGeneration: true });
  }
  throw new ProbeError('IMAGE_PROBE_ARGUMENT_ERROR');
}

function isLoopbackHostname(hostname) {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (normalized === 'localhost' || normalized.endsWith('.localhost') || normalized === '::1') return true;
  const octets = normalized.split('.');
  return octets.length === 4
    && octets[0] === '127'
    && octets.every((octet) => /^\d{1,3}$/.test(octet) && Number(octet) <= 255);
}

function validateGatewayUrl(value) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new ProbeError('IMAGE_CONFIG_ERROR');
  }
  if (parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new ProbeError('IMAGE_CONFIG_ERROR');
  }
  if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && isLoopbackHostname(parsed.hostname))) {
    throw new ProbeError('IMAGE_CONFIG_ERROR');
  }
  return value;
}

function readServerConfiguration({ envFilePath, loadEnvLocalImpl }) {
  const localEnv = {};
  let loaded = false;
  try {
    loaded = loadEnvLocalImpl({ filePath: envFilePath, env: localEnv });
  } catch {
    throw new ProbeError('IMAGE_CONFIG_ERROR');
  }
  if (!loaded) throw new ProbeError('IMAGE_CONFIG_ERROR');

  const apiKey = typeof localEnv.AI_GATEWAY_API_KEY === 'string'
    ? localEnv.AI_GATEWAY_API_KEY.trim()
    : '';
  const baseUrl = typeof localEnv.MEDIA_BASE_URL === 'string'
    ? localEnv.MEDIA_BASE_URL.trim()
    : '';
  if (!apiKey || !baseUrl) throw new ProbeError('IMAGE_CONFIG_ERROR');

  return Object.freeze({
    apiKey,
    baseUrl: validateGatewayUrl(baseUrl),
  });
}

async function validateReferenceImage(referenceImagePath) {
  let stat;
  try {
    stat = await fs.stat(referenceImagePath);
  } catch {
    throw new ProbeError('IMAGE_REFERENCE_ERROR');
  }
  if (!stat.isFile() || stat.size <= 0) throw new ProbeError('IMAGE_REFERENCE_ERROR');

  let signature;
  try {
    const file = await fs.open(referenceImagePath, 'r');
    try {
      signature = Buffer.alloc(8);
      await file.read(signature, 0, signature.length, 0);
    } finally {
      await file.close();
    }
  } catch {
    throw new ProbeError('IMAGE_REFERENCE_ERROR');
  }
  const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (!signature.equals(pngSignature)) throw new ProbeError('IMAGE_REFERENCE_ERROR');
  return stat.size;
}

function safeErrorCode(error) {
  if (error && typeof error.code === 'string' && /^IMAGE_[A-Z0-9_]+$/.test(error.code)) {
    return error.code;
  }
  return 'IMAGE_PROBE_ERROR';
}

function classifyHttpStatus(status) {
  if (!Number.isInteger(status) || status < 100 || status > 599) return 'unknown_status';
  return `${Math.floor(status / 100)}xx`;
}

function createObservedFetch(fetchImpl) {
  if (typeof fetchImpl !== 'function') throw new ProbeError('IMAGE_CONFIG_ERROR');
  let category = 'not_available';
  let calls = 0;
  return Object.freeze({
    async fetch(url, options) {
      calls += 1;
      try {
        const response = await fetchImpl(url, options);
        category = classifyHttpStatus(response && response.status);
        return response;
      } catch (error) {
        category = options && options.signal && options.signal.aborted ? 'timeout' : 'network_error';
        throw error;
      }
    },
    getCategory() {
      return category;
    },
    getCalls() {
      return calls;
    },
  });
}

function httpCategoryForError(code) {
  if (code === 'IMAGE_TIMEOUT') return 'timeout';
  if (code === 'IMAGE_PROVIDER_ERROR') return 'provider_or_network_error';
  if (code === 'IMAGE_RESPONSE_ERROR' || code === 'IMAGE_TOO_LARGE') return 'provider_response_invalid';
  return 'not_available';
}

function safeMessageForCode(code) {
  const messages = {
    IMAGE_PROBE_ARGUMENT_ERROR: '参数无效；只有显式付费确认参数会触发真实请求。',
    IMAGE_CONFIG_ERROR: '服务端 .env.local 配置不完整或不安全。',
    IMAGE_REFERENCE_ERROR: '现场参考图不可用或格式不正确。',
    IMAGE_TIMEOUT: '真实生成在限定时间内未完成。',
    IMAGE_PROVIDER_ERROR: '真实图像服务未完成请求。',
    IMAGE_RESPONSE_ERROR: '图像服务返回的结果未通过安全校验。',
    IMAGE_TOO_LARGE: '图像服务返回的文件超过安全限制。',
    IMAGE_WRITE_ERROR: '生成图片无法写入本地运行目录。',
    IMAGE_FILE_EXISTS: '本次探针输出文件名发生冲突。',
    IMAGE_INPUT_ERROR: '固定演示输入未通过图像网关校验。',
    IMAGE_PROBE_ERROR: '探针遇到未公开的内部错误。',
  };
  return messages[code] || messages.IMAGE_PROBE_ERROR;
}

async function writeReport(reportPath, report) {
  await fs.mkdir(path.dirname(reportPath), { recursive: true });
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2) + '\n', {
    encoding: 'utf8',
    mode: 0o600,
  });
}

function makeBaseReport({ mode, recordedAt, referenceImagePath }) {
  return {
    schemaVersion: '1.0.0',
    probe: 'gpt-image-2-live-probe',
    recordedAt,
    mode,
    paidConfirmationGiven: false,
    paidRequestSent: false,
    attempts: 0,
    success: false,
    status: 'starting',
    elapsedMs: 0,
    httpCategory: 'not_requested',
    safeErrorCode: null,
    safeMessage: null,
    model: LOCKED_MODEL,
    output: {
      absolutePath: null,
      bytes: null,
      format: null,
      width: null,
      height: null,
    },
    references: {
      guardianIp: path.resolve(referenceImagePath),
      style: path.resolve(referenceImagePath),
    },
  };
}

async function runProbe(options = {}) {
  const argv = options.argv || [];
  const projectRoot = path.resolve(options.projectRoot || PROJECT_ROOT);
  const envFilePath = path.resolve(options.envFilePath || ENV_FILE_PATH);
  const referenceImagePath = path.resolve(options.referenceImagePath || REFERENCE_IMAGE_PATH);
  const reportPath = path.resolve(options.reportPath || REPORT_PATH);
  const generateImageImpl = options.generateImageImpl || generateImage;
  const loadEnvLocalImpl = options.loadEnvLocalImpl || loadEnvLocal;
  const providerFetchImpl = options.providerFetchImpl || globalThis.fetch;
  const clock = options.clock || Date.now;
  const recordedAt = options.recordedAt || new Date().toISOString();
  const startedAt = clock();
  let parsed = { confirmPaidGeneration: false };
  let observedFetch = null;
  let report = makeBaseReport({ mode: 'configuration_check', recordedAt, referenceImagePath });

  try {
    parsed = parseArguments(argv);
    report.mode = parsed.confirmPaidGeneration ? 'paid_live_generation' : 'configuration_check';
    report.paidConfirmationGiven = parsed.confirmPaidGeneration;
    const configuration = readServerConfiguration({ envFilePath, loadEnvLocalImpl });
    const referenceBytes = await validateReferenceImage(referenceImagePath);
    report.configuration = {
      envFileLoaded: true,
      gatewayConfigured: true,
      referenceConfigured: true,
      referenceBytes,
      fixedProfile: `${LOCKED_MODEL} ${LOCKED_SIZE} ${LOCKED_QUALITY} ${LOCKED_OUTPUT_FORMAT}`,
    };

    if (!parsed.confirmPaidGeneration) {
      report.success = true;
      report.status = 'configuration_ready_no_request';
    } else {
      observedFetch = createObservedFetch(providerFetchImpl);
      const fileName = `image2-probe-${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}.png`;
      const result = await generateImageImpl({
        safeStoryBrief: createSafeDemoBrief(),
        referenceImages: {
          guardianIp: referenceImagePath,
          style: referenceImagePath,
        },
        apiKey: configuration.apiKey,
        baseUrl: configuration.baseUrl,
        model: LOCKED_MODEL,
        size: LOCKED_SIZE,
        quality: LOCKED_QUALITY,
        outputFormat: LOCKED_OUTPUT_FORMAT,
        fileName,
        fetchImpl: observedFetch.fetch,
      });

      report.paidRequestSent = observedFetch.getCalls() > 0;
      report.attempts = observedFetch.getCalls();
      report.success = true;
      report.status = 'generation_succeeded';
      report.httpCategory = observedFetch.getCategory() === 'not_available'
        ? '2xx'
        : observedFetch.getCategory();
      report.output = {
        absolutePath: path.resolve(projectRoot, result.relativePath),
        bytes: result.bytes,
        format: result.mediaType,
        width: result.width,
        height: result.height,
      };
    }
  } catch (error) {
    const code = safeErrorCode(error);
    if (observedFetch) {
      report.attempts = observedFetch.getCalls();
      report.paidRequestSent = report.attempts > 0;
    }
    report.success = false;
    report.status = parsed.confirmPaidGeneration ? 'generation_failed' : 'configuration_failed';
    const observedCategory = observedFetch ? observedFetch.getCategory() : 'not_available';
    report.httpCategory = report.paidRequestSent
      ? (observedCategory === 'not_available' ? httpCategoryForError(code) : observedCategory)
      : 'not_requested';
    report.safeErrorCode = code;
    report.safeMessage = safeMessageForCode(code);
  }

  report.elapsedMs = Math.max(0, Math.round(clock() - startedAt));
  await writeReport(reportPath, report);
  return Object.freeze(report);
}

function renderConsoleSummary(report, reportPath = REPORT_PATH) {
  const lines = [
    `[image2-probe] ${report.status}`,
    `付费确认已提供: ${report.paidConfirmationGiven ? '是' : '否'}`,
    `付费请求已发送: ${report.paidRequestSent ? '是' : '否'}`,
    `请求次数: ${report.attempts}`,
    `耗时: ${report.elapsedMs} ms`,
    `HTTP 类别: ${report.httpCategory}`,
    `安全错误码: ${report.safeErrorCode || '无'}`,
    `记录文件: ${path.resolve(reportPath)}`,
  ];
  if (report.output.absolutePath) {
    lines.push(`输出文件: ${report.output.absolutePath}`);
    lines.push(`输出规格: ${report.output.width}x${report.output.height} ${report.output.format} ${report.output.bytes} bytes`);
  }
  if (report.safeMessage) lines.push(`说明: ${report.safeMessage}`);
  return lines.join('\n');
}

async function main() {
  const report = await runProbe({ argv: process.argv.slice(2) });
  process.stdout.write(renderConsoleSummary(report) + '\n');
  if (!report.success) process.exitCode = 1;
}

if (require.main === module) {
  main().catch(async () => {
    process.stderr.write('[image2-probe] 探针未能写入安全报告。\n');
    process.exitCode = 1;
  });
}

module.exports = {
  ENV_FILE_PATH,
  PAID_CONFIRMATION_FLAG,
  PROJECT_ROOT,
  REFERENCE_IMAGE_PATH,
  REPORT_PATH,
  createSafeDemoBrief,
  parseArguments,
  readServerConfiguration,
  renderConsoleSummary,
  runProbe,
  safeErrorCode,
};
