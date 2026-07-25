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

function normalizeStorySignal(value, fallback, maxLength = 72) {
  const source = Array.isArray(value)
    ? value.filter((item) => typeof item === 'string').join('、')
    : (typeof value === 'string' ? value : '');
  const normalized = source
    .normalize('NFC')
    .replace(/[\u0000-\u001f\u007f<>`{}\[\]\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return (normalized || fallback).slice(0, maxLength);
}

function selectStruggleProfile(signal) {
  if (/表达|开口|说不出|误解|连接|距离|沉默|藏.*话/.test(signal)) {
    return {
      key: 'voice',
      title: '藏起的声音',
      echo: '回声瓶',
      weight: '沉默的重线',
      setting: '挂满回声瓶的林间小径',
      opening: '每当旅人想开口，瓶中的声音便先缩成一团，担心抵达别人那里时会变成另一种意思',
      discovery: '沉默不是没有话，而是许多话挤在同一扇窄门前',
    };
  }
  if (/思念|失去|记忆|纪念|告别|想念/.test(signal)) {
    return {
      key: 'memory',
      title: '没有褪尽的回忆',
      echo: '旧日回声',
      weight: '记忆的重线',
      setting: '会收藏余光的潮汐书库',
      opening: '旅人越怕珍贵的片段被时间冲淡，越把每一点余光都紧紧收进行囊',
      discovery: '记住不等于把时间停住，珍惜也不必把所有重量独自背走',
    };
  }
  if (/选择|方向|决定|道路|未来|犹豫|迷茫/.test(signal)) {
    return {
      key: 'choice',
      title: '岔路上的雾',
      echo: '风向回声',
      weight: '犹豫的重线',
      setting: '路牌会随风转动的岔路坡',
      opening: '每块路牌都催旅人立刻选定唯一方向，雾却让每条路只显出眼前的一小段',
      discovery: '暂时看不见终点，不等于眼前一步没有方向',
    };
  }
  if (/评价|标签|命名|看法|比较|认可|否定/.test(signal)) {
    return {
      key: 'identity',
      title: '借来的名字',
      echo: '纸签回声',
      weight: '评价的重线',
      setting: '纸签像叶片飘落的名字长廊',
      opening: '别人留下的称呼一层层贴上行囊，旅人渐渐分不清哪些只是一个瞬间的看法',
      discovery: '一个角度可以是真的，却不能替任何人写完全部名字',
    };
  }
  if (/疲惫|完美|不够好|停下|休息|自我要求|催促|努力|压力/.test(signal)) {
    return {
      key: 'overload',
      title: '过满的刻度',
      echo: '催促回声',
      weight: '过重的刻度线',
      setting: '刻度藤爬满山坡的黄昏',
      opening: '每完成一格，刻度藤便悄悄多长一格，旅人的行囊也因此越来越沉',
      discovery: '真正困住脚步的不是努力，而是永远不准刻度停在此刻',
    };
  }
  return {
    key: 'unresolved',
    title: '尚未解开的结',
    echo: '未名回声',
    weight: '尚未辨认的重线',
    setting: '薄雾覆盖的理线坡',
    opening: '旅人带来的线索还没有现成名字，线结却已经真实地压在行囊一角',
    discovery: '不知道全部答案时，也可以先辨认眼前最需要被照亮的一根线',
  };
}

function selectDirectionProfile(signal) {
  if (/表达|开口|说出|连接|沟通|靠近|被听见/.test(signal)) {
    return {
      key: 'connection',
      title: '让声音抵达',
      trial: '先说出一句具体而不必完美的话，再给对方和自己一点听见它的时间',
      result: '声音不再被要求一次解释全部，它只需要诚实地抵达下一小段距离',
      finalTitle: '声音抵达的灯火',
    };
  }
  if (/保存|记住|纪念|留住|珍惜|告别/.test(signal)) {
    return {
      key: 'preserve',
      title: '把余光温柔收好',
      trial: '选择一个能够承载记忆的小片段，而不是逼自己守住每一秒钟',
      result: '被珍惜的部分有了位置，未能留下的部分也不再被判作遗失',
      finalTitle: '余光仍在的清晨',
    };
  }
  if (/选择|方向|决定|尝试|前进|行动|自己的路/.test(signal)) {
    return {
      key: 'agency',
      title: '走出自己的下一步',
      trial: '只为眼前一步选择方向，并允许走过之后重新看见和调整',
      result: '道路不必一次证明正确，脚步已经能够为下一次选择留下经验',
      finalTitle: '下一步有了方向',
    };
  }
  if (/命名|边界|权利|评价|看见自己/.test(signal)) {
    return {
      key: 'self-position',
      title: '拿回自己的位置',
      trial: '把别人的看法放到可以看见却不会贴住身体的距离，再写下今天愿意怎样称呼自己',
      result: '外界的声音仍然存在，但观看自己的位置重新回到旅人手中',
      finalTitle: '名字仍可以继续写',
    };
  }
  if (/休息|放慢|喘息|留白|停留|松开|不必急/.test(signal)) {
    return {
      key: 'rest',
      title: '为呼吸留一盏慢灯',
      trial: '在不否定已经付出的努力时，主动留下一小段不被任务占满的时间',
      result: '放慢没有让星点坠落，反而让旅人重新看见脚边能够站稳的地方',
      finalTitle: '慢灯照着停留',
    };
  }
  return {
    key: 'gentle-change',
    title: '靠近新的方向',
    trial: '把期待拆成今天能够尝试的一小步，不要求这一小步立刻回答全部问题',
    result: '新的方向从抽象愿望变成一个可以继续观察的行动',
    finalTitle: '门前的新方向',
  };
}

function selectSymbolProfile(signal) {
  if (/纸船|河|水流|溪|海/.test(signal)) {
    return {
      key: 'paper-boat',
      title: '纸船与回声河',
      object: '一只沿回声河缓缓前行的纸船',
      behavior: '纸船每接住一句被压低的话，船头便亮起一点柔蓝的光',
      props: ['星纹线轴袋', '纸船', '回声河水'],
      recurring: ['纸船', '回声河', '柔蓝微光'],
      palette: ['苔绿', '河蓝', '纸白', '暖金'],
    };
  }
  if (/月亮|月光|钟|时钟|慢钟/.test(signal)) {
    return {
      key: 'moon-clock',
      title: '月亮慢钟',
      object: '一枚表盘盛着月光的慢钟',
      behavior: '慢钟每走一格，月光便在旅人脚边留出一小块可以呼吸的空地',
      props: ['星纹线轴袋', '月亮慢钟', '月光刻度'],
      recurring: ['月亮慢钟', '月光', '银线'],
      palette: ['苔绿', '月白', '雾蓝', '暖金'],
    };
  }
  if (/种子|树|森林|花|叶/.test(signal)) {
    return {
      key: 'seed',
      title: '会等候的种子',
      object: '一颗只在合适时刻发芽的星纹种子',
      behavior: '种子不因催促提前破土，只在被好好安放后长出一片新叶',
      props: ['星纹线轴袋', '星纹种子', '新叶'],
      recurring: ['星纹种子', '新叶', '土壤微光'],
      palette: ['苔绿', '土褐', '嫩芽绿', '暖金'],
    };
  }
  if (/风筝|风|羽毛|天空|云/.test(signal)) {
    return {
      key: 'kite',
      title: '风里的线筝',
      object: '一只用旧线结缝成的轻风筝',
      behavior: '风筝没有带走来过的线结，只把它们送到不再压住肩膀的距离',
      props: ['星纹线轴袋', '线结风筝', '风向旗'],
      recurring: ['线结风筝', '风', '长线'],
      palette: ['苔绿', '天青', '纸白', '暖金'],
    };
  }
  if (/灯|线|星|烛|火/.test(signal)) {
    return {
      key: 'thread-lamp',
      title: '银线暖灯',
      object: '一盏由银线护住的小小暖灯',
      behavior: '暖灯不会替旅人选路，只把脚边真正存在的一步照清楚',
      props: ['星纹线轴袋', '银线暖灯', '星点'],
      recurring: ['银线', '暖灯', '星点'],
      palette: ['苔绿', '月白', '暖金'],
    };
  }

  const customTitle = normalizeStorySignal(signal, '银线暖灯', 14);
  return {
    key: 'custom-safe-symbol',
    title: customTitle,
    object: '一件由旅人选定、被理线人称作“' + customTitle + '”的安全信物',
    behavior: '这件信物只承载已经进入安全故事摘要的象征，不补写现实人物、原因或结局',
    props: ['星纹线轴袋', customTitle, '银线'],
    recurring: [customTitle, '银线', '暖光'],
    palette: ['苔绿', '月白', '暖金'],
  };
}

function createEchoBeats(safeBrief) {
  const coreSignal = normalizeStorySignal(
    safeBrief.coreStruggle || safeBrief.coreTension,
    '一份尚未解开的拉扯',
  );
  const directionSignal = normalizeStorySignal(
    safeBrief.desiredDirection,
    '希望靠近一个更可呼吸的方向',
  );
  const symbolSignal = normalizeStorySignal(
    safeBrief.symbolicPreference,
    '银线与暖灯',
    40,
  );
  const struggle = selectStruggleProfile(coreSignal);
  const direction = selectDirectionProfile(directionSignal);
  const symbol = selectSymbolProfile(symbolSignal);
  const recurringSymbols = symbol.recurring;

  return [
    {
      title: struggle.title + '里的' + symbol.title,
      text: '理线人在' + struggle.setting + '遇见旅人。' + struggle.opening + '。旅人没有被要求重述现实细节；理线人只把安全线索“' + coreSignal + '”系在' + symbol.object + '旁，请它先替这份拉扯发出可以被看见的微光。',
      end: '理线人与旅人借' + symbol.title + '看见了“' + struggle.title + '”正在怎样收紧脚步。',
      setting: struggle.setting,
      expression: '警觉而温和',
      narrativeFunction: '个性化显影核心拉扯',
      requiredProps: symbol.props,
      recurringSymbols,
      palette: symbol.palette,
    },
    {
      title: symbol.title + '听见的' + struggle.echo,
      text: '理线人沿着信物边缘找到一根反复打结的银线。' + symbol.behavior + '。当' + struggle.echo + '再次出现，他们不再立刻服从，而是分辨它究竟在保护什么、又让什么变得越来越窄。',
      end: '理线人与旅人确认' + struggle.echo + '只是机制的回声，不是旅人全部的名字。',
      setting: '通往' + struggle.setting + '深处的回声小径',
      expression: '专注',
      narrativeFunction: '追踪个性化反复机制',
      requiredProps: symbol.props,
      recurringSymbols,
      palette: symbol.palette,
    },
    {
      title: struggle.discovery,
      text: '理线人把银线举到柔光下，让旅人同时看见它想保护的部分和它造成的重量。原来，' + struggle.discovery + '。' + symbol.object + '没有给出评判，只让这份发现保持在能够靠近、也能够退后一步的位置。',
      end: '旅人不再把' + struggle.title + '误认成唯一真相，并为下一次尝试留出位置。',
      setting: '能把线结投成双重影子的旧灯塔',
      expression: '若有所思',
      narrativeFunction: '理解核心拉扯的双面作用',
      requiredProps: symbol.props,
      recurringSymbols,
      palette: symbol.palette,
    },
    {
      title: direction.title + '之桥',
      text: '桥面只在旅人说出愿意靠近的方向时显出下一块木纹。理线人没有把愿望改写成命令，而是把安全方向“' + directionSignal + '”转成一次小小尝试：' + direction.trial + '。桥没有立刻变得笔直，却出现了可以踩稳的一步。',
      end: '旅人把“' + direction.title + '”从远方答案变成眼前一次可观察的尝试。',
      setting: '随着选择浮现木纹的留白桥',
      expression: '安静而坚定',
      narrativeFunction: '把期待方向转成安全小步',
      requiredProps: symbol.props,
      recurringSymbols,
      palette: symbol.palette,
    },
    {
      title: symbol.title + '的第一次回应',
      text: '理线人陪旅人真正做了一次刚才约定的小尝试。' + symbol.behavior + '，也记录下身体、脚步与周围光线的细小变化。' + direction.result + '。这不是胜利宣言，而是一份能够继续验证的新经验。',
      end: '旅人从' + symbol.title + '的回应中获得一条属于自己的新证据。',
      setting: '星点缓缓升起的试行坡道',
      expression: '露出一点轻松',
      narrativeFunction: '验证个性化方向并形成新经验',
      requiredProps: symbol.props,
      recurringSymbols,
      palette: symbol.palette,
    },
    {
      title: '把' + struggle.weight + '重新分线',
      text: '理线人与旅人把' + struggle.weight + '从行囊里取出，分成“此刻需要照看”“可以以后再问”和“本来就不必独自承担”三束。' + symbol.object + '守在一旁，让每束线都有位置，却不再同时压在旅人身上。',
      end: '旅人重新安排了' + struggle.weight + '的距离，并把新证据编成可握住的路标。',
      setting: '有暖风经过的三格编线台',
      expression: '踏实',
      narrativeFunction: '重新分配核心拉扯的重量',
      requiredProps: symbol.props,
      recurringSymbols,
      palette: symbol.palette,
    },
    {
      title: direction.finalTitle,
      text: '理线人陪旅人带着' + symbol.title + '回到世界门前。' + struggle.echo + '没有彻底消失，桥也仍会随风轻轻摇晃；但旅人已经知道下一次可以怎样回应。它把“' + directionSignal + '”收进自己的路标，向' + direction.title + '迈出一步，而不是等待所有声音先变得安静。',
      end: safeBrief.emotionalDirection,
      setting: '由' + symbol.title + '照亮的世界门前',
      expression: '温柔而明亮',
      narrativeFunction: '形成个性化信物与开放结尾',
      requiredProps: symbol.props,
      recurringSymbols,
      palette: symbol.palette,
    },
  ];
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
  const echoCoreSignal = normalizeStorySignal(
    safeBrief.coreStruggle || safeBrief.coreTension,
    safeBrief.coreTension,
  );
  const echoDirectionSignal = normalizeStorySignal(
    safeBrief.desiredDirection,
    '希望靠近一个更可呼吸的方向',
  );
  const echoSymbolSignal = normalizeStorySignal(
    safeBrief.symbolicPreference,
    '银线与暖灯',
    40,
  );
  const echoStruggleProfile = selectStruggleProfile(echoCoreSignal);
  const echoDirectionProfile = selectDirectionProfile(echoDirectionSignal);
  const echoSymbolProfile = selectSymbolProfile(echoSymbolSignal);
  const storyOpeningState = useMianmianFallback ? safeBrief.coreTension : echoCoreSignal;
  const beats = createEchoBeats(safeBrief);

  const selectedBeats = useMianmianFallback ? createMianmianFallbackBeats() : beats;
  const chapterIds = selectedBeats.map((_beat, index) => bookId + '-chapter-' + (index + 1));
  const chapterCards = selectedBeats.map((beat, index) => {
    const chapterNumber = index + 1;
    const chapterId = chapterIds[index];
    const startState = index === 0 ? storyOpeningState : selectedBeats[index - 1].end;
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
      : '《理线人与' + echoSymbolProfile.title + '》',
    frozen: true,
    safeStoryBrief: safeBrief,
    storyTemplateMatch: {
      schemaVersion: 'story-template-match-v1',
      route: useMianmianFallback ? 'mianmian-labels-fallback' : 'echo',
      templateVersion,
      reason: useMianmianFallback
        ? 'SafeStoryBrief 的可用事实或关键缺口不足，采用完整标签卷模板，避免擅自补写现实人物、原因与结局。'
        : '以“' + echoStruggleProfile.title + '”转译核心拉扯，用“' + echoSymbolProfile.title
          + '”承载反复意象，并把结尾导向“' + echoDirectionProfile.title + '”。',
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
        openingState: storyOpeningState,
        desiredDirection: safeBrief.desiredDirection || '重新拿回观看自己的权利，并保留尚未被定义的部分',
        finalEmotionalDirection: safeBrief.emotionalDirection,
      },
      recurringSymbols: useMianmianFallback
        ? ['名字抽屉', '纸签', '月亮饰物', '黑纸签风筝', '风向桥']
        : clone(echoSymbolProfile.recurring),
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
