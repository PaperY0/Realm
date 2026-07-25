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

function assertPngDimensions(buffer, expectedWidth, expectedHeight, label) {
  const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  assert.ok(buffer.length >= 24, label + ' must contain a complete PNG header');
  assert.deepEqual(buffer.subarray(0, 8), pngSignature, label + ' must have a valid PNG signature');
  assert.equal(buffer.subarray(12, 16).toString('ascii'), 'IHDR', label + ' must begin with an IHDR chunk');
  assert.equal(buffer.readUInt32BE(16), expectedWidth, label + ' must preserve the approved width');
  assert.equal(buffer.readUInt32BE(20), expectedHeight, label + ' must preserve the approved height');
}

function cssRuleBodiesForSelector(selector) {
  const bodies = [];
  for (const match of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selectors = match[1].split(',').map((value) => value.trim().replace(/\s+/g, ' '));
    if (selectors.includes(selector)) bodies.push(match[2]);
  }
  return bodies;
}

function functionSource(source, name) {
  const start = source.indexOf('function ' + name + '(');
  if (start === -1) return '';
  const next = source.indexOf('\nfunction ', start + 1);
  return source.slice(start, next === -1 ? source.length : next);
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

  // Reference-scene contract: reproduce the approved composition from a local image without cropping it.
  const referencePicture = html.match(
    /<picture\b[^>]*class="[^"]*\breference[\w-]*\b[^"]*"[^>]*>[\s\S]*?<\/picture>/i,
  );
  assert.ok(referencePicture, 'homepage must include a reference-scene <picture>');

  const referenceImageTag = referencePicture[0].match(/<img\b[^>]*>/i)?.[0];
  assert.ok(referenceImageTag, 'reference-scene <picture> must contain an <img>');
  const referenceSource = referenceImageTag.match(/\bsrc="([^"]+)"/i)?.[1];
  assert.ok(referenceSource, 'reference scene image must declare src');
  assert.doesNotMatch(referenceSource, /^(?:https?:)?\/\//i, 'reference scene image must not be remote');
  assert.doesNotMatch(referenceSource, /^data:/i, 'reference scene image must be a local file, not an embedded data URL');

  const relativeReferenceSource = referenceSource.replace(/^\.\//, '').replace(/^\//, '');
  assert.ok(!relativeReferenceSource.split('/').includes('..'), 'reference scene image path must not traverse directories');
  const referenceImagePath = path.resolve(root, 'src', relativeReferenceSource);
  const sourceRoot = path.resolve(root, 'src') + path.sep;
  assert.ok(referenceImagePath.startsWith(sourceRoot), 'reference scene image must live under src');
  assert.equal(fs.existsSync(referenceImagePath), true, 'reference scene image file must exist locally');
  assertPngDimensions(fs.readFileSync(referenceImagePath), 2048, 1152, 'local reference artwork');

  assert.match(
    css,
    /(?:\.reference[\w-]*\s+img|\.reference-scene-image)\s*\{[^}]*object-fit\s*:\s*contain\s*;/i,
    'reference scene image must use object-fit: contain',
  );
  assert.doesNotMatch(
    css,
    /(?:\.reference[\w-]*\s+img|\.reference-scene-image)\s*\{[^}]*object-fit\s*:\s*cover/i,
    'reference scene image must not crop the approved composition',
  );

  // The reference image owns the door viewport; chrome must be removed from layout, not merely transparent.
  for (const selector of [
    'body[data-stage="door"] .world-header',
    'body[data-stage="door"] .world-footer',
  ]) {
    const ruleBodies = cssRuleBodiesForSelector(selector);
    assert.ok(ruleBodies.length > 0, selector + ' must have a door-scene CSS rule');
    assert.ok(
      ruleBodies.some((body) => /display\s*:\s*none\b/i.test(body)),
      selector + ' must use display: none so it exits the door layout',
    );
  }

  // Preserve 1:1 artwork registration: move only overlays/hotspots, never the complete reference bitmap.
  for (const selector of ['.reference-stage', '.reference-art']) {
    for (const ruleBody of cssRuleBodiesForSelector(selector)) {
      assert.doesNotMatch(
        ruleBody,
        /transform\s*:[^;]*var\(\s*--(?:far|mid|near)-(?:x|y)/i,
        selector + ' must not translate the complete artwork for parallax',
      );
      assert.doesNotMatch(
        ruleBody,
        /transform\s*:[^;]*scale[^;]*--door-open/i,
        selector + ' must not scale the complete artwork while the door opens',
      );
    }
  }

  const doorHotspotTag = html.match(/<button\b[^>]*class="[^"]*\bdoor-hotspot\b[^"]*"[^>]*>/i)?.[0];
  assert.ok(doorHotspotTag, 'door interaction must expose a button hotspot');
  assert.match(doorHotspotTag, /role="slider"/i, 'door hotspot must remain an accessible slider');
  assert.match(doorHotspotTag, /aria-valuemin="0"/i);
  assert.match(doorHotspotTag, /aria-valuemax="100"/i);
  assert.match(doorHotspotTag, /aria-valuenow="0"/i);

  // Drag travel must respect the remaining viewport space, or carry an explicit 320px completion contract.
  const pointerMoveSource = functionSource(app, 'handleDoorPointerMove');
  assert.ok(pointerMoveSource, 'door pointer movement handler must exist');
  assert.doesNotMatch(
    pointerMoveSource,
    /Math\.max\(\s*220\b/,
    'door drag travel must not use the fixed 220px minimum that blocks 320px touch screens',
  );
  const hasAvailableSpaceContract =
    /(?:available|remaining)[A-Za-z]*(?:Travel|Distance|Space)/i.test(app)
    && /(?:window\.innerWidth|document\.documentElement\.clientWidth|\.right)\s*-\s*(?:state\.)?dragStartX/i.test(app)
    && /Math\.min\([^;]*(?:available|remaining)/i.test(app);
  const hasExplicit320Contract =
    /(?:MIN|SMALLEST|SUPPORTED)[A-Z0-9_]*(?:VIEWPORT|WIDTH)[A-Z0-9_]*\s*=\s*320\b/.test(app)
    && /(?:drag|travel)[^;]*(?:320|VIEWPORT|WIDTH)/i.test(app);
  assert.ok(
    hasAvailableSpaceContract || hasExplicit320Contract,
    'door drag distance must be capped by available space or explicitly guarantee completion at 320px',
  );

  // Automatic and pointer-release opening must share one cleanup path for every drag visual/state flag.
  const functionNames = [...app.matchAll(/^function\s+([A-Za-z_$][\w$]*)\s*\(/gm)].map((match) => match[1]);
  const cleanupFunctionName = functionNames.find((name) => {
    if (['finishOpeningDoor', 'stopDoorDrag', 'resetEntry'].includes(name)) return false;
    const source = functionSource(app, name);
    return /state\.draggingDoor\s*=\s*false/.test(source)
      && /classList\.remove\(['"]is-dragging['"]\)/.test(source)
      && /classList\.remove\(['"]is-engaged['"]\)/.test(source);
  });
  assert.ok(cleanupFunctionName, 'door drag flags and classes must be cleared by one reusable cleanup function');
  const cleanupCall = new RegExp('\\b' + cleanupFunctionName + '\\s*\\(');
  assert.match(functionSource(app, 'finishOpeningDoor'), cleanupCall, 'automatic opening must run the shared drag cleanup');
  assert.match(functionSource(app, 'stopDoorDrag'), cleanupCall, 'pointer release must run the shared drag cleanup');

  assert.match(html, /id="traveler-name"/);
  assert.match(html, /id="skip-profile"/);
  assert.match(html, /id="brand-home"/);
  assert.equal(countMatches(html, /class="mark-option"/g), 5);
  assert.match(html, /风铃入口/);
  assert.match(html, /本步骤不收集或保存任何心事内容/);

  // Accessibility and reduced-motion contracts are explicit, not animation-only.
  assert.match(html, /id="reduce-motion"/);
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
    assert.equal(health.ok, true);
    assert.equal(health.service, 'dream-book-world');
    assert.equal(health.stage, 'image2-gateway');
    assert.equal(health.imageConfigured, false);
    assert.equal(health.imageModel, 'gpt-image-2');
    assert.deepEqual(health.image2, {
      configured: false,
      model: 'gpt-image-2',
      referenceAsset: 'world-gate-reference.png',
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

    const referenceUrl = new URL(referenceSource, baseUrl + '/');
    assert.equal(referenceUrl.origin, baseUrl, 'reference artwork HTTP request must stay on the local server');
    const referenceResponse = await fetch(referenceUrl);
    assert.equal(referenceResponse.status, 200, referenceSource);
    assert.match(referenceResponse.headers.get('content-type'), /image\/png/);
    const servedReferenceBuffer = Buffer.from(await referenceResponse.arrayBuffer());
    assertPngDimensions(servedReferenceBuffer, 2048, 1152, 'served reference artwork');

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
