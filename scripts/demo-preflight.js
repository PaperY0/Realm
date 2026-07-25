'use strict';

const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const port = 43821;
const baseUrl = `http://127.0.0.1:${port}`;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer(url) {
  let lastError;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return response;
    } catch (error) {
      lastError = error;
    }
    await wait(100);
  }
  throw lastError || new Error('Demo server did not become ready');
}

async function run() {
  const html = fs.readFileSync(path.join(root, 'src', 'index.html'), 'utf8');
  const externalRuntimeRefs = [...html.matchAll(/(?:src|href)="(https?:\/\/[^"#]+)"/g)].map((match) => match[1]);
  assert.deepEqual(externalRuntimeRefs, [], '现场 Demo 不得依赖外部脚本、样式或图片');

  const child = spawn(process.execPath, ['server.js'], {
    cwd: root,
    env: { ...process.env, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });

  let stderr = '';
  child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });

  try {
    const response = await waitForServer(baseUrl + '/health');
    const health = await response.json();
    assert.equal(health.ok, true);
    assert.equal(health.service, 'dream-book-world');
    assert.equal(health.stage, 'image2-gateway');
    assert.equal(health.imageModel, 'gpt-image-2');
    assert.equal(typeof health.imageConfigured, 'boolean');
    assert.deepEqual(health.image2, {
      configured: health.imageConfigured,
      model: 'gpt-image-2',
      referenceAsset: 'world-gate-reference.png',
    });

    for (const pathname of ['/', '/styles.css', '/app.js', '/assets/world-gate-reference.png']) {
      const asset = await fetch(baseUrl + pathname);
      assert.equal(asset.status, 200, `${pathname} 必须可离线加载`);
      assert.ok(Number(asset.headers.get('content-length') || 1) > 0, `${pathname} 不得为空`);
    }

    assert.equal(stderr, '');
    console.log('demo preflight passed: offline web assets and local server are ready');
  } finally {
    child.kill('SIGTERM');
    await Promise.race([
      new Promise((resolve) => child.once('exit', resolve)),
      wait(1000),
    ]);
  }
}

run().catch((error) => {
  console.error('demo preflight failed');
  console.error(error);
  process.exitCode = 1;
});
