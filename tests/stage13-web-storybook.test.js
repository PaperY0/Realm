'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'src', 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'src', 'app.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'src', 'styles.css'), 'utf8');

function functionSource(source, name) {
  const declaration = new RegExp(`(?:async\\s+)?function\\s+${name}\\s*\\(`);
  const match = declaration.exec(source);
  assert.ok(match, `${name} must exist`);
  const rest = source.slice(match.index + match[0].length);
  const next = /\n(?:async\s+)?function\s+[A-Za-z_$][\w$]*\s*\(/.exec(rest);
  return source.slice(match.index, next ? match.index + match[0].length + next.index : source.length);
}

function storybookScene(source) {
  const marker = source.indexOf('data-scene="storybook"');
  assert.ok(marker >= 0, 'storybook scene must exist');
  const start = source.lastIndexOf('<section', marker);
  const nextScene = source.indexOf('data-scene="', marker + 1);
  const end = nextScene >= 0 ? source.lastIndexOf('<section', nextScene) : source.indexOf('</main>', marker);
  assert.ok(start >= 0 && end > start, 'storybook scene source range must be readable');
  return source.slice(start, end);
}

function balancedBlocks(source, markerPattern) {
  const blocks = [];
  let searchFrom = 0;
  while (searchFrom < source.length) {
    markerPattern.lastIndex = 0;
    const match = markerPattern.exec(source.slice(searchFrom));
    if (!match) break;
    const start = searchFrom + match.index;
    const open = source.indexOf('{', start);
    if (open < 0) break;
    let depth = 0;
    let end = open;
    for (; end < source.length; end += 1) {
      if (source[end] === '{') depth += 1;
      if (source[end] === '}') {
        depth -= 1;
        if (depth === 0) {
          end += 1;
          break;
        }
      }
    }
    blocks.push(source.slice(start, end));
    searchFrom = end;
  }
  return blocks;
}

const scene = storybookScene(html);
const requiredIds = [
  'storybook-title',
  'storybook-status',
  'storybook-book',
  'storybook-chapter-kicker',
  'storybook-chapter-title',
  'storybook-chapter-text',
  'storybook-illustration-state',
  'storybook-prev',
  'storybook-next',
  'storybook-close',
  'storybook-reopen',
  'storybook-archive',
  'storybook-archive-note',
  'storybook-return',
  'storybook-progress',
  'storybook-keepsake',
  'storybook-cover-title',
];

for (const id of requiredIds) {
  assert.match(scene, new RegExp(`id=["']${id}["']`), `storybook scene must include #${id}`);
}
assert.match(scene, /章节插画尚未生成/);
assert.doesNotMatch(scene, /本机纪念页|你已经亲手读完这本书|故事停在第七章。只有你主动选择/);

// Reader state must be available before the application initializes.
const readerScriptIndex = html.search(/<script[^>]+src=["']\/reader-state\.js["']/);
const appScriptIndex = html.search(/<script[^>]+src=["']\/app\.js["']/);
assert.ok(readerScriptIndex >= 0, '/reader-state.js must be loaded');
assert.ok(appScriptIndex >= 0, '/app.js must be loaded');
assert.ok(readerScriptIndex < appScriptIndex, '/reader-state.js must load before /app.js');

// Story generation is a separate, free local path that sends only SafeStoryBrief.
const requestStoryPackage = functionSource(app, 'requestStoryPackage');
assert.match(requestStoryPackage, /fetch\(\s*['"]\/api\/story-package['"]\s*,/);
assert.match(requestStoryPackage, /method\s*:\s*['"]POST['"]/);
assert.match(requestStoryPackage, /['"]Content-Type['"]\s*:\s*['"]application\/json['"]/);
assert.match(
  requestStoryPackage,
  /body\s*:\s*JSON\.stringify\(\s*\{\s*safeStoryBrief\s*:\s*state\.expression\.safeBrief\s*,?\s*\}\s*\)/,
);
assert.doesNotMatch(requestStoryPackage, /rawText|followUpAnswers|userConfirmedSentence\s*:/);
assert.match(requestStoryPackage, /fetch\(\s*['"]\/api\/images\/generate-book['"]\s*,/);
assert.doesNotMatch(requestStoryPackage, /requestRealImage|generatedImage|new\s+Image\s*\(/);

// Story-package and chapter-image failures must keep their own response/payload
// so a 413 or image-generation failure cannot be reported with the story response.
assert.match(app, /function\s+friendlyStoryPackageError\s*\(/);
assert.match(app, /function\s+friendlyStorybookImageError\s*\(/);
assert.match(requestStoryPackage, /let\s+imageResponse\s*=\s*null/);
assert.match(requestStoryPackage, /let\s+imagePayload\s*=\s*null/);
assert.match(requestStoryPackage, /imageResponse\s*=\s*await\s+fetch\(\s*['"]\/api\/images\/generate-book['"]/);
assert.match(requestStoryPackage, /friendlyStorybookImageError\s*\(\s*imagePayload\s*,\s*imageResponse\s*\)/);
assert.match(requestStoryPackage, /friendlyStoryPackageError\s*\(\s*payload\s*,\s*response\s*\)/);
assert.match(app, /friendlyStorybookImageError[\s\S]*response\?\.status\s*===\s*413/);
assert.match(app, /friendlyStorybookImageError[\s\S]*payload\?\.message/);

// Browser wiring must use the strict seven-chapter ReaderState API for new and restored books.
assert.match(app, /window\.DreamBookReader/);
const chapterAdapter = functionSource(app, 'readerChaptersFrom');
assert.match(chapterAdapter, /chapterCards/);
assert.match(chapterAdapter, /\.length\s*!==\s*7/);
assert.match(chapterAdapter, /card\?*\.identity\?*\.chapterNumber|card\.identity\.chapterNumber/);
assert.match(chapterAdapter, /card\?*\.identity\?*\.chapterId|card\.identity\.chapterId/);
assert.match(chapterAdapter, /return\s*\{\s*chapterNumber\s*,\s*chapterId\s*\}/);

const initializeReader = functionSource(app, 'initializeStoryReader');
assert.match(initializeReader, /readerChaptersFrom\s*\(\s*storyPackage\s*\)/);
assert.match(initializeReader, /window\.DreamBookReader\.createReaderState\s*\(\s*\{\s*chapters\s*\}\s*\)/);
assert.match(initializeReader, /window\.DreamBookReader\.restoreReaderState\s*\(\s*\{\s*chapters\s*,\s*snapshot\s*\}\s*\)/);

const restorePreview = functionSource(app, 'restoreStorybookPreview');
assert.match(restorePreview, /JSON\.parse/);
assert.match(restorePreview, /initializeStoryReader\s*\(\s*saved\.storyPackage\s*,\s*saved\.readerSnapshot\s*\)/);
assert.match(restorePreview, /readerSnapshot/);
assert.match(restorePreview, /catch\s*\{/);

// Every page change is an explicit user action; boundary capability methods drive the controls.
const previousChapter = functionSource(app, 'goPreviousChapter');
const nextChapter = functionSource(app, 'goNextChapter');
const closeBook = functionSource(app, 'closeStorybook');
assert.match(previousChapter, /\.previousChapter\s*\(/);
assert.match(nextChapter, /\.nextChapter\s*\(/);
assert.match(closeBook, /\.canCloseBook\s*\(\)/);
assert.match(closeBook, /\.closeBook\s*\(/);
assert.match(app, /storybook(?:Prev|Previous)\.addEventListener\(\s*['"]click['"]\s*,\s*goPreviousChapter\s*\)/);
assert.match(app, /storybookNext\.addEventListener\(\s*['"]click['"]\s*,\s*goNextChapter\s*\)/);
assert.match(app, /storybookClose\.addEventListener\(\s*['"]click['"]\s*,\s*closeStorybook\s*\)/);
assert.match(app, /canGoPrevious\s*\(\)/);
assert.match(app, /canGoNext\s*\(\)/);
assert.match(app, /canCloseBook\s*\(\)/);

assert.match(app, /storybookBook\.dataset\.currentChapter\s*=\s*String\(snapshot\.currentChapter\)/);
assert.match(app, /storybookCoverTitle\.textContent\s*=\s*bookTitle/);
assert.match(app, /storybookArchive\.addEventListener\(\s*['"]click['"]\s*,\s*archiveStorybook\s*\)/);
assert.match(app, /function\s+archiveStorybook\s*\([\s\S]*?saveStorybookSnapshot\s*\(\)/);
assert.match(app, /storybookArchiveNote\.hidden\s*=\s*false/);
assert.match(css, /storybook-keepsake-cover\.png/);

// Animated page turns are single-flight: a rapid second click cannot skip a chapter.
const beginPageTurn = functionSource(app, 'beginStorybookPageTurn');
assert.match(beginPageTurn, /state\.storybook\.turning/);
assert.match(beginPageTurn, /setTimeout/);
assert.match(previousChapter, /beginStorybookPageTurn\s*\(\s*\)/);
assert.match(nextChapter, /beginStorybookPageTurn\s*\(\s*\)/);
assert.match(closeBook, /beginStorybookPageTurn\s*\(\s*\)/);

function runNextChapterHarness() {
  let chapter = 1;
  let timerCount = 0;
  const harness = new Function(
    `
      const STORYBOOK_PAGE_TURN_MS = 560;
      const state = {
        storybook: {
          turning: false,
          turnTimer: null,
          reader: {
            canGoNext: () => chapter < 7,
            nextChapter: () => { chapter += 1; },
          },
        },
      };
      let chapter = 1;
      let timerCount = 0;
      const window = {
        setTimeout: () => { timerCount += 1; return timerCount; },
        clearTimeout: () => {},
      };
      const storybookChapterKicker = { textContent: '' };
      const storybookChapterTitle = { textContent: '' };
      function syncStorybookControls() {}
      function renderStoryChapter() {}
      function announce() {}
      ${beginPageTurn}
      ${nextChapter}
      goNextChapter();
      goNextChapter();
      return { chapter, turning: state.storybook.turning, timerCount };
    `,
  );
  return harness();
}

assert.deepEqual(
  runNextChapterHarness(),
  { chapter: 2, turning: true, timerCount: 1 },
  'animated rapid double-click must advance only one chapter while the lock is active',
);

// Long chapter copy owns an internal scroll area and preserves authored line breaks.
const chapterTextRule = /\.storybook-chapter-text\s*\{([^}]*)\}/.exec(css);
assert.ok(chapterTextRule, '.storybook-chapter-text rule must exist');
assert.match(chapterTextRule[1], /min-height\s*:\s*0\s*;/);
assert.match(chapterTextRule[1], /flex\s*:\s*1\s+1\s+auto\s*;/);
assert.match(chapterTextRule[1], /overflow-y\s*:\s*auto\s*;/);
assert.match(chapterTextRule[1], /white-space\s*:\s*pre-line\s*;/);
const controlsRule = /\.storybook-controls\s*\{([^}]*)\}/.exec(css);
assert.ok(controlsRule, '.storybook-controls rule must exist');
assert.match(controlsRule[1], /flex\s*:\s*0\s+0\s+auto\s*;/);

// The complete local StoryPackage plus plain ReaderState snapshot is persisted for refresh recovery.
assert.match(app, /const\s+STORYBOOK_STORAGE_KEY\s*=\s*['"]dream-book-world\.storybook\.v0['"]/);
const saveSnapshot = functionSource(app, 'saveStorybookSnapshot');
assert.match(saveSnapshot, /storyPackage/);
assert.match(saveSnapshot, /readerSnapshot/);
assert.match(saveSnapshot, /\.snapshot\s*\(\)/);
assert.match(saveSnapshot, /JSON\.stringify/);
assert.match(saveSnapshot, /STORYBOOK_STORAGE_KEY/);

// Real paid Image 2 generation remains available only through its own explicit button.
assert.match(html, /id=["']generate-image["']/);
assert.match(app, /document\.querySelector\(\s*['"]#generate-image['"]\s*\)/);
assert.match(app, /generateImage\.addEventListener\(\s*['"]click['"]\s*,\s*requestRealImage\s*\)/);
assert.match(app, /generateStory\.addEventListener\(\s*['"]click['"]\s*,\s*requestStoryPackage\s*\)/);

// The storybook path must never manufacture an illustration or silently fall back to one.
assert.doesNotMatch(scene, /<img\b|\bsrc\s*=\s*["'][^"']+["']|data:image|base64|https?:\/\//i);
assert.doesNotMatch(scene, /占位图|placeholder\s+image|fallback\s+image/i);
const storybookFunctions = [
  requestStoryPackage,
  initializeReader,
  functionSource(app, 'renderStoryChapter'),
  previousChapter,
  nextChapter,
  closeBook,
  functionSource(app, 'reopenStorybook'),
].join('\n');
assert.doesNotMatch(storybookFunctions, /\/api\/images\/generate(?!-book)|requestRealImage|generatedImage\.src|\.createObjectURL\s*\(|data:image|base64|https?:\/\//i);
assert.match(storybookFunctions, /章节插画尚未生成/);

// The turn layer is a two-sided paper sheet, isolated from ordinary page transforms.
const animatePageTurn = functionSource(app, 'animatePageTurn');
assert.match(animatePageTurn, /function\s+animatePageTurn\s*\(\s*direction\s*,\s*frontPage\s*,\s*backPage\s*\)/);
assert.match(animatePageTurn, /makeFace\(frontPage,\s*'storybook-turn-sheet__front'\)/);
assert.match(animatePageTurn, /makeFace\(backPage,\s*'storybook-turn-sheet__back'\)/);
assert.doesNotMatch(animatePageTurn, /storybook-page--copy/);
assert.match(css, /\.storybook-turn-sheet\s*\{/);
assert.match(css, /\.storybook-turn-sheet__front\s*,\s*\n?\s*\.storybook-turn-sheet__back\s*\{/);
assert.match(css, /\.storybook-turn-shadow\s*\{/);
assert.match(css, /@keyframes\s+storybook-turn-next\s*\{[\s\S]*?14%[\s\S]*?54%[\s\S]*?100%/);
assert.match(css, /@keyframes\s+storybook-turn-previous\s*\{[\s\S]*?14%[\s\S]*?54%[\s\S]*?100%/);
assert.match(css, /\.storybook-turn-sheet\.is-active\s*\{[\s\S]*?animation-duration\s*:\s*840ms\s*;/);
assert.match(css, /\.storybook-turn-sheet--next\s*\{[\s\S]*?transform-origin\s*:\s*left\s+center/);
assert.match(css, /\.storybook-turn-sheet--previous\s*\{[\s\S]*?transform-origin\s*:\s*right\s+center/);
assert.match(css, /\.storybook-turn-sheet__front\.storybook-page\s*,[\s\S]*?\.storybook-turn-sheet__back\.storybook-page\s*\{[\s\S]*?transform\s*:\s*none/);

// The product intentionally has one consistent motion language; no reduced-motion mode is exposed.
assert.doesNotMatch(css, /prefers-reduced-motion|body\.reduce-motion|motion-toggle/);

const syntax = spawnSync(process.execPath, ['--check', path.join(root, 'src', 'app.js')], { encoding: 'utf8' });
assert.equal(syntax.status, 0, syntax.stderr || syntax.stdout);

console.log('stage13 web storybook tests passed');
