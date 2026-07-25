'use strict';

const { MIANMIAN_UNFINISHED_NAME_TEMPLATE } = require('./mianmian-unfinished-name-template');

function nonEmptyStrings(value) {
  return Array.isArray(value)
    ? value.filter((item) => typeof item === 'string' && item.trim())
    : [];
}

function shouldUseMianmianFallback(safeStoryBrief) {
  const usableFacts = nonEmptyStrings(safeStoryBrief?.storyUsableFacts);
  const missingInformation = nonEmptyStrings(safeStoryBrief?.missingStoryInformation);

  // Only sanitized SafeStoryBrief fields may select the route. One unresolved
  // detail can remain intentional ambiguity; two gaps, or fewer than two usable
  // facts, require the fixed template rather than invented real-world details.
  return usableFacts.length < 2 || missingInformation.length >= 2;
}

const CHAPTER_PRESENTATION = Object.freeze([
  Object.freeze({
    title: '写满名字的小镇',
    end: '绾线与绵绵看见，轻柔和刺痛的纸签正在一起贴满她的羊毛。',
    setting: '纸签如雪飘落的名字抽屉小镇',
    expression: '担心而温和',
    requiredProps: Object.freeze(['星纹线轴袋', '名字抽屉', '月亮饰物', '写有评价的纸签']),
    recurringSymbols: Object.freeze(['纸签', '名字抽屉', '月亮饰物']),
    palette: Object.freeze(['月白', '羊毛奶白', '旧纸米色', '苔绿']),
    lighting: '温柔日光中藏着逐渐收紧的阴影',
  }),
  Object.freeze({
    title: '成为纸签上的绵绵',
    end: '绵绵被互相矛盾的纸签包住，月亮饰物也失去光亮。',
    setting: '被无字纸签与矛盾评价填满的房间',
    expression: '心疼而专注',
    requiredProps: Object.freeze(['星纹线轴袋', '无字纸签', '熄暗的月亮饰物', '纸签牵引线']),
    recurringSymbols: Object.freeze(['无字纸签', '月亮饰物', '牵引线']),
    palette: Object.freeze(['褪色月白', '灰蓝', '旧纸米色', '苔绿']),
    lighting: '随他人笔尖忽明忽暗的月光',
  }),
  Object.freeze({
    title: '比石头更重的纸',
    end: '绵绵穿上由好标签叠成的纸盔甲，停在风向桥前。',
    setting: '悬在深色山谷或河流之上的风向桥入口',
    expression: '警觉而不替绵绵下结论',
    requiredProps: Object.freeze(['星纹线轴袋', '风向旗', '总让人失望的纸签', '厚重纸盔甲']),
    recurringSymbols: Object.freeze(['风向桥', '纸签', '被遮住的月亮']),
    palette: Object.freeze(['深河蓝', '纸白', '墨灰', '苔绿']),
    lighting: '风暴前压低的冷光',
  }),
  Object.freeze({
    title: '风把所有字吹黑',
    end: '绵绵站在黑纸签风暴中央，第一次把问题从纸签转回自己。',
    setting: '被黑纸签鸟群遮蔽的风向桥中央',
    expression: '沉着守望',
    requiredProps: Object.freeze(['星纹线轴袋', '黑纸签鸟群', '摇晃的桥', '露出银光的月亮饰物']),
    recurringSymbols: Object.freeze(['黑纸签', '风向桥', '月亮银光']),
    palette: Object.freeze(['墨黑', '雨蓝', '银白', '苔绿']),
    lighting: '风暴裂缝中落下一线月光',
  }),
  Object.freeze({
    title: '没有一扇窗能框住月亮',
    end: '绵绵明白局部观看可以真实，却不能写完完整的自己。',
    setting: '风暴停歇后的月光河岸与桥洞',
    expression: '安静而明亮',
    requiredProps: Object.freeze(['星纹线轴袋', '水中碎月', '树枝弯月', '桥洞小月', '小甲虫']),
    recurringSymbols: Object.freeze(['完整月亮', '局部月影', '月亮饰物']),
    palette: Object.freeze(['深夜蓝', '银白', '柔水绿', '苔绿']),
    lighting: '全卷最安静的澄澈月光',
  }),
  Object.freeze({
    title: '把标签放到风里',
    end: '黑纸签飞到合适的距离，绵绵为尚未被定义的自己留出明亮抽屉。',
    setting: '晨风里的缝线台与重新整理的名字抽屉',
    expression: '温柔陪伴',
    requiredProps: Object.freeze(['星纹线轴袋', '黑纸签风筝', '羊毛缝线', '三只新抽屉', '无字纸签']),
    recurringSymbols: Object.freeze(['黑纸签风筝', '无字纸签', '月亮抽屉']),
    palette: Object.freeze(['晨雾蓝', '暖纸白', '月银', '苔绿']),
    lighting: '风暴后逐渐升起的暖光',
  }),
  Object.freeze({
    title: '没有写完的名字',
    end: '绵绵拿回观看和称呼自己的位置，带着尚未写完的名字继续向前。',
    setting: '晨光与残月同时出现的风向桥另一端',
    expression: '欣慰而克制',
    requiredProps: Object.freeze(['星纹线轴袋', '黑纸签风筝', '写有当下描述的纸签', '发亮的月亮饰物']),
    recurringSymbols: Object.freeze(['风向桥', '黑纸签风筝', '完整月亮', '无字纸签']),
    palette: Object.freeze(['晨光金', '残月银', '天空蓝', '苔绿']),
    lighting: '晨光与尚未退去的月光共同照亮前路',
  }),
]);

function copySpread(spread) {
  return {
    ...spread,
    body: [...spread.body],
  };
}

function formatSpread(spread) {
  const label = spread.sectionLabel || `跨页${spread.number}`;
  return `${label}｜${spread.title}\n${spread.body.join('\n')}`;
}

function createMianmianFallbackBeats() {
  return MIANMIAN_UNFINISHED_NAME_TEMPLATE.sevenChapterMapping.map((mapping, index) => {
    const presentation = CHAPTER_PRESENTATION[index];
    const templateSpreads = mapping.spreadNumbers.map((spreadNumber) => {
      const spread = MIANMIAN_UNFINISHED_NAME_TEMPLATE.spreads.find((item) => item.number === spreadNumber);
      if (!spread) throw new Error(`Mianmian template spread ${spreadNumber} is missing`);
      return copySpread(spread);
    });
    const templateVisualDirections = templateSpreads.map((spread) => ({
      spreadNumber: spread.number,
      title: spread.title,
      visualDirection: spread.visualDirection,
    }));

    return {
      ...presentation,
      text: [
        `绾线轻轻翻开${MIANMIAN_UNFINISHED_NAME_TEMPLATE.title}，不替绵绵解释，只陪她把这一章完整读下去。`,
        ...templateSpreads.map(formatSpread),
      ].join('\n\n'),
      composition: templateVisualDirections
        .map((item) => `跨页${item.spreadNumber}《${item.title}》：${item.visualDirection}`)
        .join('\n'),
      requiredProps: [...presentation.requiredProps],
      recurringSymbols: [...presentation.recurringSymbols],
      palette: [...presentation.palette],
      spreadNumbers: [...mapping.spreadNumbers],
      narrativeFunction: mapping.narrativeFunction,
      templateSpreads,
      templateVisualDirections,
    };
  });
}

module.exports = {
  MIANMIAN_UNFINISHED_NAME_TEMPLATE,
  shouldUseMianmianFallback,
  createMianmianFallbackBeats,
};
