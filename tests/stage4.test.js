'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'src', 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'src', 'styles.css'), 'utf8');
const app = fs.readFileSync(path.join(root, 'src', 'app.js'), 'utf8');

function countMatches(value, pattern) {
  return [...value.matchAll(pattern)].length;
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function waitForServer(url, attempts = 60) {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return response;
    } catch (error) {
      lastError = error;
    }
    await wait(50);
  }
  throw lastError || new Error('server did not become ready');
}

async function run() {
  // Static product contract: one world door and a fixed route to the wind-chime entry.
  assert.equal(countMatches(html, /data-world-door=/g), 1);
  assert.match(html, /内耗之门/);
  assert.match(html, /data-scene="door"/);
  assert.match(html, /data-scene="traveler"/);
  assert.match(html, /data-scene="foyer"/);
  assert.match(html, /data-scene="expression"/);
  assert.match(html, /id="traveler-name"/);
  assert.match(html, /id="skip-profile"/);
  assert.match(html, /id="brand-home"/);
  assert.equal(countMatches(html, /class="mark-option"/g), 5);
  assert.match(html, /风铃入口/);
  assert.match(html, /本步骤不收集或保存任何心事内容/);

  // Accessibility and reduced-motion contracts are explicit, not animation-only.
  assert.match(html, /role="slider"/);
  assert.match(html, /aria-valuemin="0"/);
  assert.match(app, /ArrowRight/);
  assert.match(app, /Enter/);
  assert.match(app, /prefers-reduced-motion/);
  assert.match(app, /updateProfileUI\(\{ syncInput: false \}\)/);
  assert.match(app, /brandHome\.addEventListener\('click'/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /body\.reduce-motion/);

  const syntax = spawnSync(process.execPath, ['--check', path.join(root, 'src', 'app.js')], {
    encoding: 'utf8',
  });
  assert.equal(syntax.status, 0, syntax.stderr || syntax.stdout);

  // Real HTTP check: the local server must serve every Stage 4 browser asset.
  const port = 43000 + Math.floor(Math.random() * 1000);
  const child = spawn(process.execPath, ['server.js'], {
    cwd: root,
    env: { ...process.env, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stderr = '';
  child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });

  try {
    const baseUrl = 'http://127.0.0.1:' + port;
    const healthResponse = await waitForServer(baseUrl + '/health');
    const health = await healthResponse.json();
    assert.deepEqual(health, {
      ok: true,
      service: 'dream-book-world',
      stage: 'world-entry',
    });

    for (const [pathname, contentType] of [
      ['/', 'text/html'],
      ['/styles.css', 'text/css'],
      ['/app.js', 'text/javascript'],
    ]) {
      const response = await fetch(baseUrl + pathname);
      assert.equal(response.status, 200, pathname);
      assert.match(response.headers.get('content-type'), new RegExp(contentType));
      assert.ok((await response.text()).length > 100, pathname + ' must not be empty');
    }

    const missing = await fetch(baseUrl + '/other-world');
    assert.equal(missing.status, 404);
  } finally {
    child.kill('SIGTERM');
    await Promise.race([
      new Promise((resolve) => child.once('exit', resolve)),
      wait(1000),
    ]);
  }

  assert.equal(stderr, '');
  console.log('stage4 tests passed');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
