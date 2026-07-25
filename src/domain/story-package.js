'use strict';

const {
  MIANMIAN_UNFINISHED_NAME_TEMPLATE,
  shouldUseMianmianFallback,
  createMianmianFallbackBeats,
} = require('../features/story/mianmian-fallback');

const FIXED_GATEKEEPER = Object.freeze({
  ipId: 'inner-friction-gatekeeper-v1',
  name: '理线人',
  visualReferenceSetId: 'world-gate-reference-v1',
  appearance: '披着苔绿色短斗篷、背着星纹线轴袋的白色小守门人',
});

const RAW_FIELD_PATTERN = /(?:raw|original|verbatim|source)(?:_|-)?(?:input|text|expression|answer|content)/i;

class StoryPackageValidationError extends Error {
  constructor(report) {
    super('StoryPackage validation blocked: ' + report.failedCheckIds.join(', '));
    this.name = 'StoryPackageValidationError';
    this.code = 'STORY_PACKAGE_BLOCKED';
    this.report = report;
  }
}

function clone(value) {
  return structuredClone(value);
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const item of Object.values(value)) deepFreeze(item);
  return Object.freeze(value);
}

function assertSafeBrief(brief) {
  if (!brief || typeof brief !== 'object' || Array.isArray(brief)) {
    throw new TypeError('SafeStoryBrief must be a plain object');
  }
  if (brief.safetyStatus !== 'story_safe') {
    throw new TypeError('SafeStoryBrief must be story_safe');
  }
  for (const key of ['briefId', 'coreTension', 'emotionalDirection']) {
    if (typeof brief[key] !== 'string' || !brief[key].trim()) {
      throw new TypeError('SafeStoryBrief.' + key + ' is required');
    }
  }
  const useMianmianFallback = shouldUseMianmianFallback(brief);
  if (!useMianmianFallback && (typeof brief.desiredDirection !== 'string' || !brief.desiredDirection.trim())) {
    throw new TypeError('SafeStoryBrief.desiredDirection is required');
  }
  return useMianmianFallback;
}

function stableId(prefix, briefId) {
  const normalized = String(briefId).toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
  return prefix + '-' + (normalized || 'brief');
}

function createStoryPackage(safeStoryBrief, options = {}) {
  const useMianmianFallback = assertSafeBrief(safeStoryBrief);
  const safeBrief = clone(safeStoryBrief);
  const bookId = stableId('book', safeBrief.briefId);
  const planId = stableId('plan', safeBrief.briefId);
  const templateVersion = useMianmianFallback
    ? MIANMIAN_UNFINISHED_NAME_TEMPLATE.templateId
    : 'echo-controlled-v1';
  const storyBibleVersion = 'story-bible-v1';
  const styleGuideVersion = 'storybook-style-v1';

  const beats = [
    {
      title: '总也收不完的刻度',
      text: '理线人发现山坡上的刻度藤越长越密，旅人的行囊也跟着变沉。它没有替旅人下结论，只邀请旅人先看清那些不断收紧的线。',
      end: '理线人与旅人辨认出让行囊变重的刻度藤。',
      setting: '黄昏的刻度山坡',
      expression: '警觉而温和',
    },
    {
      title: '线团里的回声',
      text: '理线人从行囊边缘找到一根反复打结的银线。每当旅人想停一停，线结便发出催促的回声；他们决定不再追赶回声，而是沿着线寻找源头。',
      end: '理线人与旅人决定沿银线寻找回声源头。',
      setting: '会回声的针叶林',
      expression: '专注',
    },
    {
      title: '不会熄灭的灯塔',
      text: '理线人带旅人来到一座整夜亮着的灯塔。灯光把每个小缺口都照得巨大，他们发现，真正困住道路的不是缺口，而是不允许灯光暂时变柔。',
      end: '旅人看见灯光可以变柔，而道路不会因此消失。',
      setting: '云海边的旧灯塔',
      expression: '若有所思',
    },
    {
      title: '留白桥',
      text: '理线人在断桥中央放下一段没有打结的白线。旅人第一次没有立刻把空处填满，只听见风从留白里经过，桥面便浮出新的木纹。',
      end: '旅人允许一小段留白存在，桥重新显出纹路。',
      setting: '横跨薄雾的留白桥',
      expression: '安静而坚定',
    },
    {
      title: '慢一拍的钟',
      text: '理线人把一枚走得慢一拍的小钟放在路旁。旅人试着跟随它走完一段坡路，发现身后的星点没有因为放慢而坠落，反而照亮了脚边。',
      end: '旅人验证了放慢一步并不会让星点消失。',
      setting: '星点缓缓升起的坡道',
      expression: '露出轻松',
    },
    {
      title: '把重线分给风',
      text: '理线人与旅人把最沉的线从行囊里取出，分成可以辨认的小束。风接走不必此刻承担的部分，留下的线则被编成一条能够握住的路标。',
      end: '行囊变轻，剩下的线成为清楚可握的路标。',
      setting: '有暖风经过的编线台',
      expression: '踏实',
    },
    {
      title: '灯光里的停留',
      text: '理线人陪旅人在门前停留片刻，没有催促下一段路。旅人把慢一拍的小钟收进口袋，门后的世界记住：停下不是消失，而是给呼吸留一盏灯。',
      end: safeBrief.emotionalDirection,
      setting: '重新亮起暖光的世界门前',
      expression: '温柔而明亮',
    },
  ];

  const selectedBeats = useMianmianFallback ? createMianmianFallbackBeats() : beats;
  const chapterIds = selectedBeats.map((_beat, index) => bookId + '-chapter-' + (index + 1));
  const chapterCards = selectedBeats.map((beat, index) => {
    const chapterNumber = index + 1;
    const chapterId = chapterIds[index];
    const startState = index === 0 ? safeBrief.coreTension : selectedBeats[index - 1].end;
    return {
      identity: {
        schemaVersion: 'chapter-card-v1',
        bookId,
        chapterId,
        chapterNumber,
        storyBibleVersion,
        styleGuideVersion,
        illustrationPlanId: planId,
        templateVersion,
      },
      userVisibleCopy: {
        chapterTitle: beat.title,
        chapterText: beat.text,
        optionalCaption: null,
      },
      narrativeContract: {
        narrativeFunction: beat.narrativeFunction
          || ['显影压力', '追踪机制', '看见放大', '尝试留白', '验证放慢', '重新分配', '形成信物'][index],
        visibleBeat: beat.text,
        startState,
        endState: beat.end,
        factsThatMustNotChange: clone(safeBrief.factsNotToInvent || []),
        ...(beat.spreadNumbers ? { templateSpreadNumbers: clone(beat.spreadNumbers) } : {}),
        ...(beat.templateSpreads ? { templateSpreads: clone(beat.templateSpreads) } : {}),
      },
      illustrationContract: {
        illustrationId: 'I' + chapterNumber,
        ipReferenceSetId: FIXED_GATEKEEPER.visualReferenceSetId,
        narrativeMoment: beat.title,
        protagonistAppearance: FIXED_GATEKEEPER.appearance,
        protagonistExpression: beat.expression,
        setting: beat.setting,
        composition: beat.composition || '竖幅绘本主插画，理线人与旅人共同处于清晰的前中景关系中',
        ...(beat.templateVisualDirections ? { templateVisualDirections: clone(beat.templateVisualDirections) } : {}),
        requiredProps: clone(beat.requiredProps || ['星纹线轴袋', '银线', chapterNumber >= 5 ? '慢一拍的小钟' : '旅人行囊']),
        recurringSymbols: clone(beat.recurringSymbols || ['银线', '星点', '暖灯']),
        palette: clone(beat.palette || ['苔绿', '月白', '暖金']),
        lighting: beat.lighting || (index < 3 ? '冷暖交界的柔光' : '逐章增加的暖光'),
        continuityFromPrevious: index === 0 ? null : chapterIds[index - 1] + ': 延续上一章结束状态与道具位置',
        continuityToNext: index === 6 ? null : chapterIds[index + 1] + ': 保留本章新增的状态变化与信物',
        requiresHumanApproval: true,
      },
    };
  });

  const storyPackage = {
    schemaVersion: 'story-package-v1',
    bookId,
    bookTitle: useMianmianFallback
      ? MIANMIAN_UNFINISHED_NAME_TEMPLATE.title
      : '理线人与旅人的七章童话',
    frozen: true,
    safeStoryBrief: safeBrief,
    storyTemplateMatch: {
      schemaVersion: 'story-template-match-v1',
      route: useMianmianFallback ? 'mianmian-labels-fallback' : 'echo',
      templateVersion,
      reason: useMianmianFallback
        ? 'SafeStoryBrief 的可用事实或关键缺口不足，采用完整标签卷模板，避免擅自补写现实人物、原因与结局。'
        : '以反复催促的回声机制转译持续自我要求与难以停下的拉扯',
      ...(useMianmianFallback ? {
        templateTitle: MIANMIAN_UNFINISHED_NAME_TEMPLATE.title,
        mappedSpreadNumbers: MIANMIAN_UNFINISHED_NAME_TEMPLATE.sevenChapterMapping
          .map((mapping) => clone(mapping.spreadNumbers)),
        templateContent: clone(MIANMIAN_UNFINISHED_NAME_TEMPLATE),
      } : {}),
    },
    storyBible: {
      schemaVersion: storyBibleVersion,
      version: storyBibleVersion,
      bookId,
      protagonist: clone(FIXED_GATEKEEPER),
      storyTruth: {
        openingState: safeBrief.coreTension,
        desiredDirection: safeBrief.desiredDirection || '重新拿回观看自己的权利，并保留尚未被定义的部分',
        finalEmotionalDirection: safeBrief.emotionalDirection,
      },
      recurringSymbols: useMianmianFallback
        ? ['名字抽屉', '纸签', '月亮饰物', '黑纸签风筝', '风向桥']
        : ['银线', '星点', '暖灯', '慢一拍的小钟'],
    },
    storybookStyleGuide: {
      schemaVersion: styleGuideVersion,
      version: styleGuideVersion,
      medium: '手绘童话绘本',
      composition: '9:16 竖幅，纸张纹理，前中后景分明',
      forbidden: ['诊断式文字', '现实身份复刻', '画面内文字与水印'],
    },
    chapterIllustrationPlan: {
      schemaVersion: 'chapter-illustration-plan-v1',
      planId,
      bookId,
      storyBibleVersion,
      styleGuideVersion,
      illustrations: chapterCards.map((card) => ({
        illustrationId: card.illustrationContract.illustrationId,
        chapterId: card.identity.chapterId,
        chapterNumber: card.identity.chapterNumber,
      })),
    },
    chapterCards,
  };

  assertStoryPackage(storyPackage, options);
  return deepFreeze(storyPackage);
}

function walk(value, visitor, path = '') {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => walk(item, visitor, path + '/' + index));
    return;
  }
  for (const [key, item] of Object.entries(value)) {
    visitor(key, item, path + '/' + key);
    walk(item, visitor, path + '/' + key);
  }
}

function validateStoryPackage(value, options = {}) {
  const failed = [];
  const evidence = [];
  const fail = (checkId, artifactType, artifactId, jsonPointer) => {
    if (!failed.includes(checkId)) failed.push(checkId);
    evidence.push({ checkId, artifactType, artifactId: artifactId || 'unknown', jsonPointer });
  };

  const cards = value && Array.isArray(value.chapterCards) ? value.chapterCards : [];
  if (cards.length !== 7) fail('structure.chapter_count', 'ChapterCard', value?.bookId, '/chapterCards');

  const expectedNumbers = [1, 2, 3, 4, 5, 6, 7];
  const numbers = cards.map((card) => card?.identity?.chapterNumber);
  const ids = cards.map((card) => card?.identity?.chapterId);
  if (numbers.length !== 7 || numbers.some((number, index) => number !== expectedNumbers[index]) || new Set(ids).size !== ids.length) {
    fail('structure.chapter_sequence', 'ChapterCard', value?.bookId, '/chapterCards');
  }

  const plan = value?.chapterIllustrationPlan;
  const referencesValid = Boolean(value?.bookId && plan?.planId && plan?.bookId === value.bookId)
    && cards.every((card, index) => card?.identity?.bookId === value.bookId
      && card?.identity?.illustrationPlanId === plan.planId
      && card?.illustrationContract?.illustrationId === 'I' + (index + 1))
    && Array.isArray(plan?.illustrations)
    && plan.illustrations.length === 7
    && plan.illustrations.every((item, index) => item.illustrationId === 'I' + (index + 1)
      && item.chapterId === cards[index]?.identity?.chapterId);
  if (!referencesValid) fail('structure.cross_references', 'ChapterCard', value?.bookId, '/chapterCards');

  let rawFieldFound = false;
  walk(value, (key, _item, pointer) => {
    if (RAW_FIELD_PATTERN.test(key)) {
      rawFieldFound = true;
      if (!failed.includes('semantic.raw_input_fields')) {
        fail('semantic.raw_input_fields', 'ChapterCard', value?.bookId, pointer);
      }
    }
  });
  if (!rawFieldFound && value && Object.prototype.hasOwnProperty.call(value, 'rawInput')) {
    fail('semantic.raw_input_fields', 'ChapterCard', value?.bookId, '/rawInput');
  }

  const serialized = (() => {
    try { return JSON.stringify(value); } catch { return ''; }
  })();
  const forbiddenTexts = Array.isArray(options.forbiddenSourceTexts)
    ? options.forbiddenSourceTexts.filter((item) => typeof item === 'string' && item.length > 0)
    : [];
  if (forbiddenTexts.some((text) => serialized.includes(text))) {
    fail('semantic.source_text_leakage', 'ChapterCard', value?.bookId, '/chapterCards');
  }

  if (cards.length === 7) {
    for (let index = 1; index < cards.length; index += 1) {
      if (cards[index]?.narrativeContract?.startState !== cards[index - 1]?.narrativeContract?.endState) {
        fail('semantic.causal_continuity', 'ChapterCard', cards[index]?.identity?.chapterId, '/narrativeContract/startState');
        break;
      }
    }
  }

  const structuralIds = ['structure.chapter_count', 'structure.chapter_sequence', 'structure.cross_references'];
  const semanticIds = ['semantic.raw_input_fields', 'semantic.source_text_leakage', 'semantic.causal_continuity'];
  const makeCheck = (checkId) => ({
    checkId,
    result: failed.includes(checkId) ? 'fail' : 'pass',
    severity: 'blocking',
    summary: failed.includes(checkId) ? '检查未通过，冻结故事包不得进入媒体生成。' : '检查通过。',
  });

  return {
    schemaVersion: 'story-package-validation-report-v1',
    validationVersion: 'controlled-gate-v1',
    reportId: stableId('report', value?.bookId || 'unknown'),
    bookId: typeof value?.bookId === 'string' ? value.bookId : 'unknown-book',
    attemptNumber: 1,
    overallResult: failed.length ? 'blocked' : 'pass',
    structuralChecks: structuralIds.map(makeCheck),
    narrativeChecks: semanticIds.map(makeCheck),
    failedCheckIds: failed,
    evidenceLocations: evidence,
    repairInstructions: failed.map((checkId) => ({
      checkId,
      repairScope: checkId.startsWith('structure.') ? 'format_repair' : 'full_replan',
      instruction: '只修复该检查项，不得引入或回显用户原始表达。',
    })),
  };
}

function assertStoryPackage(value, options = {}) {
  const report = validateStoryPackage(value, options);
  if (report.overallResult !== 'pass') throw new StoryPackageValidationError(report);
  return value;
}

module.exports = {
  FIXED_GATEKEEPER,
  StoryPackageValidationError,
  createStoryPackage,
  validateStoryPackage,
  assertStoryPackage,
};
