'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  PAID_CONFIRMATION_FLAG,
  createSafeDemoBrief,
  parseArguments,
  renderConsoleSummary,
  runProbe,
} = require('../scripts/image2-live-probe');

function writeEnvFile(filePath, key = 'stage9-secret-key', baseUrl = 'https://media.example.test/v1') {
  fs.writeFileSync(filePath, [
    `AI_GATEWAY_API_KEY=${key}`,
    `MEDIA_BASE_URL=${baseUrl}`,
    '',
  ].join('\n'));
}

function makeClock(start, end) {
  const values = [start, end];
  return () => values.shift() ?? end;
}

async function run() {
  const projectRoot = path.resolve(__dirname, '..');
  const referenceImagePath = path.join(projectRoot, 'src', 'assets', 'world-gate-reference.png');
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'realm-stage9-probe-'));
  const envFilePath = path.join(tempRoot, '.env.local');
  const reportPath = path.join(tempRoot, 'runtime', 'probe', 'latest.json');
  const secretKey = 'STAGE9_KEY_MUST_NOT_LEAK';
  const providerSecret = 'STAGE9_VENDOR_BODY_MUST_NOT_LEAK';
  writeEnvFile(envFilePath, secretKey);

  try {
    assert.deepEqual(parseArguments([]), { confirmPaidGeneration: false });
    assert.deepEqual(parseArguments([PAID_CONFIRMATION_FLAG]), { confirmPaidGeneration: true });
    assert.throws(() => parseArguments(['--yes']), (error) => error.code === 'IMAGE_PROBE_ARGUMENT_ERROR');
    assert.equal(createSafeDemoBrief().safetyStatus, 'story_safe');
    assert.equal(createSafeDemoBrief().userConfirmedSentence, null);

    let unpaidCalls = 0;
    const configurationReport = await runProbe({
      argv: [],
      envFilePath,
      referenceImagePath,
      reportPath,
      projectRoot,
      clock: makeClock(1_000, 1_025),
      recordedAt: '2026-07-25T00:00:00.000Z',
      generateImageImpl: async () => {
        unpaidCalls += 1;
        throw new Error('must never be called without paid confirmation');
      },
    });
    assert.equal(unpaidCalls, 0, 'default probe must never call the paid generator');
    assert.equal(configurationReport.success, true);
    assert.equal(configurationReport.status, 'configuration_ready_no_request');
    assert.equal(configurationReport.paidConfirmationGiven, false);
    assert.equal(configurationReport.paidRequestSent, false);
    assert.equal(configurationReport.attempts, 0);
    assert.equal(configurationReport.httpCategory, 'not_requested');
    assert.equal(configurationReport.elapsedMs, 25);

    let paidCalls = 0;
    let receivedOptions;
    const paidReport = await runProbe({
      argv: [PAID_CONFIRMATION_FLAG],
      envFilePath,
      referenceImagePath,
      reportPath,
      projectRoot,
      clock: makeClock(2_000, 2_640),
      recordedAt: '2026-07-25T00:01:00.000Z',
      providerFetchImpl: async () => ({ status: 201 }),
      generateImageImpl: async (options) => {
        paidCalls += 1;
        receivedOptions = options;
        await options.fetchImpl('https://media.example.test/v1/images/edits', {});
        return {
          relativePath: 'runtime/generated/stage9-live.png',
          bytes: 456789,
          mediaType: 'image/png',
          width: 720,
          height: 1280,
        };
      },
    });
    assert.equal(paidCalls, 1, 'confirmed probe must issue exactly one generation call');
    assert.equal(receivedOptions.apiKey, secretKey);
    assert.equal(receivedOptions.baseUrl, 'https://media.example.test/v1');
    assert.equal(receivedOptions.model, 'gpt-image-2');
    assert.equal(receivedOptions.size, '720x1280');
    assert.equal(receivedOptions.quality, 'medium');
    assert.equal(receivedOptions.outputFormat, 'png');
    assert.equal(receivedOptions.referenceImages.guardianIp, referenceImagePath);
    assert.equal(receivedOptions.referenceImages.style, referenceImagePath);
    assert.equal(receivedOptions.safeStoryBrief.safetyStatus, 'story_safe');
    assert.equal(paidReport.success, true);
    assert.equal(paidReport.paidConfirmationGiven, true);
    assert.equal(paidReport.paidRequestSent, true);
    assert.equal(paidReport.attempts, 1);
    assert.equal(paidReport.httpCategory, '2xx');
    assert.equal(paidReport.elapsedMs, 640);
    assert.equal(paidReport.output.absolutePath, path.join(projectRoot, 'runtime', 'generated', 'stage9-live.png'));
    assert.equal(paidReport.output.bytes, 456789);
    assert.equal(paidReport.output.format, 'image/png');
    assert.equal(paidReport.output.width, 720);
    assert.equal(paidReport.output.height, 1280);

    let failedCalls = 0;
    const failureReport = await runProbe({
      argv: [PAID_CONFIRMATION_FLAG],
      envFilePath,
      referenceImagePath,
      reportPath,
      projectRoot,
      clock: makeClock(3_000, 3_150),
      recordedAt: '2026-07-25T00:02:00.000Z',
      providerFetchImpl: async () => ({ status: 429 }),
      generateImageImpl: async (options) => {
        failedCalls += 1;
        await options.fetchImpl('https://media.example.test/v1/images/edits', {});
        const error = new Error(`${providerSecret} prompt=${createSafeDemoBrief().coreTension} key=${secretKey}`);
        error.code = 'IMAGE_PROVIDER_ERROR';
        throw error;
      },
    });
    assert.equal(failedCalls, 1, 'failed live probe must not retry or fall back');
    assert.equal(failureReport.success, false);
    assert.equal(failureReport.paidRequestSent, true);
    assert.equal(failureReport.attempts, 1);
    assert.equal(failureReport.httpCategory, '4xx');
    assert.equal(failureReport.safeErrorCode, 'IMAGE_PROVIDER_ERROR');

    const storedReport = fs.readFileSync(reportPath, 'utf8');
    const consoleSummary = renderConsoleSummary(failureReport, reportPath);
    for (const forbidden of [secretKey, providerSecret, createSafeDemoBrief().coreTension]) {
      assert.doesNotMatch(storedReport, new RegExp(forbidden.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
      assert.doesNotMatch(consoleSummary, new RegExp(forbidden.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    }

    let localFailureCalls = 0;
    const localFailureReport = await runProbe({
      argv: [PAID_CONFIRMATION_FLAG],
      envFilePath: path.join(tempRoot, 'missing.env.local'),
      referenceImagePath,
      reportPath,
      projectRoot,
      clock: makeClock(3_500, 3_501),
      generateImageImpl: async () => { localFailureCalls += 1; },
    });
    assert.equal(localFailureCalls, 0);
    assert.equal(localFailureReport.paidConfirmationGiven, true);
    assert.equal(localFailureReport.paidRequestSent, false);
    assert.equal(localFailureReport.attempts, 0);
    assert.equal(localFailureReport.httpCategory, 'not_requested');
    assert.equal(localFailureReport.safeErrorCode, 'IMAGE_CONFIG_ERROR');

    let invalidArgumentCalls = 0;
    const invalidArgumentReport = await runProbe({
      argv: ['--yes'],
      envFilePath,
      referenceImagePath,
      reportPath,
      projectRoot,
      clock: makeClock(4_000, 4_001),
      generateImageImpl: async () => { invalidArgumentCalls += 1; },
    });
    assert.equal(invalidArgumentCalls, 0);
    assert.equal(invalidArgumentReport.safeErrorCode, 'IMAGE_PROBE_ARGUMENT_ERROR');
    assert.equal(invalidArgumentReport.paidRequestSent, false);

    console.log('stage9 image probe tests passed');
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
