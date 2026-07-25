'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'src', 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'src', 'styles.css'), 'utf8');
const app = fs.readFileSync(path.join(root, 'src', 'app.js'), 'utf8');

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
    const selectors = match[1]
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split(',')
      .map((value) => value.trim().replace(/\s+/g, ' '));
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

function cssAtRuleBlocks(source, atRulePattern) {
  const blocks = [];
  for (const match of source.matchAll(atRulePattern)) {
    const open = source.indexOf('{', match.index);
    if (open === -1) continue;
    let depth = 0;
    for (let index = open; index < source.length; index += 1) {
      if (source[index] === '{') depth += 1;
      if (source[index] !== '}') continue;
      depth -= 1;
      if (depth === 0) {
        blocks.push(source.slice(match.index, index + 1));
        break;
      }
    }
  }
  return blocks;
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function waitForServer(url, attempts = 60) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return response;
    } catch {
      // Keep polling while the local server starts.
    }
    await wait(50);
  }
  throw new Error('server did not become ready');
}

async function run() {
  assert.match(html, /data-scene="door"/);
  assert.match(html, /data-scene="foyer"/);
  assert.match(html, /data-scene="expression"/);
  assert.doesNotMatch(html, /data-scene="traveler"/);
  assert.doesNotMatch(app, /traveler|pocketMark|PROFILE_KEY/);
  assert.doesNotMatch(css, /data-stage="traveler"|\.scene--traveler|\.traveler-card/);

  const referenceImagePath = path.join(root, 'src', 'assets', 'world-gate-reference.png');
  assert.equal(fs.existsSync(referenceImagePath), true, 'homepage reference artwork must exist locally');
  assertPngDimensions(fs.readFileSync(referenceImagePath), 2048, 1152, 'homepage reference artwork');
  assert.match(html, /src="\/assets\/world-gate-reference\.png"/);
  assert.match(css, /\.reference-stage\s*\{[\s\S]*?inset\s*:\s*0\s*;[\s\S]*?width\s*:\s*100%\s*;[\s\S]*?height\s*:\s*100%\s*;/i);
  assert.match(css, /\.reference-art img\s*\{[^}]*object-fit\s*:\s*cover\s*;/i);

  assert.match(html, /id="world-entry-video"/);
  assert.match(html, /src="\/assets\/world-entry\.mp4"/);
  assert.match(html, /id="door-handle"/);
  assert.match(html, /点击大门，进入藏梦书境/);
  assert.match(app, /doorHandle\.addEventListener\('click', finishOpeningDoor\)/);
  assert.match(app, /worldEntryVideo\.addEventListener\('ended', completeWorldEntry\)/);
  assert.match(app, /worldEntryVideo\.play\(\)/);
  assert.match(app, /goToScene\('foyer'/);
  assert.doesNotMatch(html, /id="reduce-motion"|motion-toggle/);
  assert.doesNotMatch(app, /reduceMotion|MOTION_KEY|prefers-reduced-motion/);
  assert.doesNotMatch(css, /reduce-motion|prefers-reduced-motion|motion-toggle/);
  assert.match(css, /\.scene--door\.is-transitioning[\s\S]*?opacity:\s*0/);
  assert.match(css, /\.world-entry-video[\s\S]*?object-fit:\s*cover/);

  const emotionDoorIds = ['overthinking', 'sadness', 'anxiety', 'anger', 'joy'];
  assert.equal((html.match(/data-emotion-door=/g) || []).length, emotionDoorIds.length);
  emotionDoorIds.forEach((doorId) => assert.match(html, new RegExp('data-emotion-door="' + doorId + '"')));
  ['绾线', '听雨', '息摆', '藏烬', '铃芽'].forEach((name) => assert.match(app, new RegExp(name)));
  assert.match(app, /故事世界还在慢慢长成/);
  assert.match(html, /id="emotion-door-dialogue"/);
  assert.match(html, /id="emotion-door-status"/);
  assert.match(app, /FOYER_DOORS/);
  assert.match(app, /selectEmotionDoor/);
  assert.match(app, /activateEmotionDoor/);
  assert.match(app, /data-emotion-door/);

  // The foyer deliberately exposes one executable world; the other four doors only announce their state.
  const foyerDoorsSource = app.match(/const FOYER_DOORS = Object\.freeze\(\{([\s\S]*?)\n\}\);/)?.[1];
  assert.ok(foyerDoorsSource, 'FOYER_DOORS must remain a readable product contract');
  const expectedDoorOpenStates = {
    overthinking: true,
    sadness: false,
    anxiety: false,
    anger: false,
    joy: false,
  };
  assert.deepEqual(
    [...foyerDoorsSource.matchAll(/^\s{2}(\w+): Object\.freeze\(/gm)].map((match) => match[1]),
    Object.keys(expectedDoorOpenStates),
    'FOYER_DOORS must keep exactly the five foyer doors',
  );
  for (const [doorId, expectedOpen] of Object.entries(expectedDoorOpenStates)) {
    const doorSource = foyerDoorsSource.match(
      new RegExp('\\b' + doorId + ': Object\\.freeze\\(\\{([\\s\\S]*?)\\n\\s*\\}\\)'),
    )?.[1];
    assert.ok(doorSource, 'FOYER_DOORS must define ' + doorId);
    assert.match(doorSource, new RegExp('\\bopen\\s*:\\s*' + expectedOpen + '\\s*,?'));
  }

  const activationSource = functionSource(app, 'activateEmotionDoor');
  assert.ok(activationSource, 'activateEmotionDoor must remain a named route guard');
  assert.match(
    activationSource,
    /if\s*\(!door\.open\)\s*\{[\s\S]*?announce\(door\.status\);[\s\S]*?return;[\s\S]*?\}\s*resetExpressionFlow\(\);[\s\S]*?goToScene\('expression'\)/,
    'closed doors must announce and return before the open-door expression route',
  );

  assert.match(css, /\.emotion-door/);
  assert.equal((html.match(/emotion-door__door-image/g) || []).length, emotionDoorIds.length);
  assert.equal((html.match(/emotion-door__guardian-image/g) || []).length, emotionDoorIds.length);
  assert.match(css, /\.emotion-door__door-image/);
  assert.match(css, /\.emotion-door__guardian-image/);
  assert.match(css, /\.emotion-door__light/);
  assert.match(css, /emotion-door-float/);

  // The hall artwork and all hit targets share one proportional stage. On a 390px-wide phone
  // the stage becomes 1280px wide for a 720px-tall scene instead of stretching 2048:1152.
  assert.match(html, /class="emotion-hall-canvas"/);
  assert.ok(
    cssRuleBodiesForSelector('body[data-stage="foyer"] .scene--foyer.is-active')
      .some((body) => /display\s*:\s*block\s*;/i.test(body)),
    'the active foyer must override .scene.is-active grid layout so its canvas fills the desktop stage',
  );
  const hallArtRules = cssRuleBodiesForSelector('.emotion-hall-background');
  assert.ok(hallArtRules.some((body) => /object-fit\s*:\s*cover\s*;/i.test(body)));
  assert.ok(hallArtRules.every((body) => !/object-fit\s*:\s*fill\s*;/i.test(body)));
  assert.doesNotMatch(html, /emotion-door__label|emotion-door__state/);
  assert.match(css, /\.emotion-door::before/);
  const canvasRules = cssRuleBodiesForSelector('.emotion-hall-canvas');
  assert.ok(
    canvasRules.some((body) => /width\s*:\s*max\(100%,\s*calc\(\(100dvh - 124px\) \* 1\.7777778\)\)\s*;/i.test(body)),
    'mobile hall canvas must preserve its 16:9 width from available viewport height',
  );
  assert.ok(
    cssRuleBodiesForSelector('.scene--foyer').some((body) => /overflow-x\s*:\s*auto\s*;/i.test(body)),
    'narrow hall must allow horizontal browsing rather than squeeze the artwork',
  );
  assert.ok(
    cssRuleBodiesForSelector('.emotion-door-dialogue').some((body) => /top\s*:\s*64px\s*;[\s\S]*bottom\s*:\s*auto\s*;/i.test(body)),
    'mobile dialogue must stay in the clear top margin, not cover a door',
  );
  assert.ok(
    cssAtRuleBlocks(css, /@media\s*\(max-width:\s*820px\)/g).some((block) =>
      /\.emotion-door-dialogue\s*\{[\s\S]*?position\s*:\s*(?:fixed|sticky)\s*;/.test(block),
    ),
    'mobile dialogue must be anchored to the current viewport, not the wide hall canvas',
  );

  // Only the painted layers move. The absolute button remains registered to the background.
  for (const selector of ['.emotion-door:hover', '.emotion-door:focus-visible', '.emotion-door.is-selected']) {
    const bodies = cssRuleBodiesForSelector(selector);
    assert.ok(bodies.length > 0, selector + ' must retain a visual state');
    assert.ok(bodies.every((body) => !/\btransform\s*:/i.test(body)), selector + ' must not move the hotspot');
  }
  assert.ok(
    cssRuleBodiesForSelector('.emotion-door:hover .emotion-door__guardian')
      .some((body) => /\btransform\s*:\s*translateY\(-3px\) scale\(1\.04\)/i.test(body)),
    'the guardian layer must own the selected lift',
  );

  const videoPath = path.join(root, 'src', 'assets', 'world-entry.mp4');
  assert.equal(fs.existsSync(videoPath), true);
  assert.ok(fs.statSync(videoPath).size > 1024 * 1024, 'entry video must be a real local media asset');
  assert.ok(fs.existsSync(path.join(root, 'src', 'assets', 'emotion-hall.png')));
  const paperBoatPath = path.join(root, 'src', 'assets', 'paper-boat.mp4');
  assert.equal(fs.existsSync(paperBoatPath), true);
  assert.ok(fs.statSync(paperBoatPath).size > 1024 * 1024, 'paper boat video must be a real local media asset');
  const hallPath = path.join(root, 'src', 'assets', 'emotion-hall', 'layers', 'background.png');
  assertPngDimensions(fs.readFileSync(hallPath), 1672, 941, 'emotion hall artwork');
  const layerNames = [
    'door-overthinking', 'door-sadness', 'door-anxiety', 'door-anger', 'door-joy',
    'guardian-overthinking', 'guardian-sadness', 'guardian-anxiety', 'guardian-anger', 'guardian-joy',
  ];
  layerNames.forEach((name) => {
    const layerPath = path.join(root, 'src', 'assets', 'emotion-hall', 'layers', name + '.png');
    assert.ok(fs.existsSync(layerPath), name + ' must exist as an independent layer');
    assert.equal(fs.readFileSync(layerPath).subarray(25, 26)[0] & 0x04, 0x04, name + ' must preserve RGBA color type');
  });
  ['wanxian', 'tingyu', 'xibai', 'cangjin', 'lingya'].forEach((guardian) => {
    assert.ok(fs.existsSync(path.join(root, 'src', 'assets', 'guardians', guardian + '.png')));
  });

  const syntax = spawnSync(process.execPath, ['--check', path.join(root, 'src', 'app.js')], {
    encoding: 'utf8',
  });
  assert.equal(syntax.status, 0, syntax.stderr || syntax.stdout);

  const port = 43000 + Math.floor(Math.random() * 1000);
  const child = spawn(process.execPath, ['server.js'], {
    cwd: root,
    env: { ...process.env, PORT: String(port), AI_GATEWAY_API_KEY: '', MEDIA_BASE_URL: '' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

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

    const referenceResponse = await fetch(baseUrl + '/assets/world-gate-reference.png');
    assert.equal(referenceResponse.status, 200);
    assert.match(referenceResponse.headers.get('content-type'), /^image\/png/);
    assertPngDimensions(Buffer.from(await referenceResponse.arrayBuffer()), 2048, 1152, 'served homepage reference artwork');

    const response = await waitForServer(baseUrl + '/assets/world-entry.mp4');
    assert.match(response.headers.get('content-type'), /^video\/mp4/);
    assert.equal(Number(response.headers.get('content-length')), fs.statSync(videoPath).size);
    const paperBoatResponse = await fetch(baseUrl + '/assets/paper-boat.mp4');
    assert.equal(paperBoatResponse.status, 200);
    assert.match(paperBoatResponse.headers.get('content-type'), /^video\/mp4/);
    assert.equal(Number(paperBoatResponse.headers.get('content-length')), fs.statSync(paperBoatPath).size);
    const hallResponse = await fetch(baseUrl + '/assets/emotion-hall.png');
    assert.equal(hallResponse.status, 200);
    assert.match(hallResponse.headers.get('content-type'), /^image\/png/);
    for (const name of layerNames) {
      const layerResponse = await fetch(baseUrl + '/assets/emotion-hall/layers/' + name + '.png');
      assert.equal(layerResponse.status, 200, name + ' asset route');
      assert.match(layerResponse.headers.get('content-type'), /^image\/png/);
    }
    const wanxianResponse = await fetch(baseUrl + '/assets/guardians/wanxian.png');
    assert.equal(wanxianResponse.status, 200);
    assert.match(wanxianResponse.headers.get('content-type'), /^image\/png/);
    const missing = await fetch(baseUrl + '/other-world');
    assert.equal(missing.status, 404);
    console.log('stage4 tests passed');
  } finally {
    child.kill();
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
