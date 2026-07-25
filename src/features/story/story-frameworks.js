'use strict';

const { MIANMIAN_UNFINISHED_NAME_TEMPLATE } = require('./mianmian-unfinished-name-template');

const STORY_FRAMEWORKS = Object.freeze({
  label: Object.freeze({
    id: 'label-volume-v1',
    name: '标签卷',
    principle: '外界的评价会贴上名字，但任何一个名字都不能替旅人写完全部身份。',
    chapterArc: Object.freeze([
      '看见外界标签如何落到主角身上',
      '辨认互相矛盾的评价与重量',
      '区分事实、看法和暂时的称呼',
      '把一个外界声音放到安全距离',
      '尝试写下今天愿意使用的自我称呼',
      '让多个可能的名字同时存在',
      '带着未完成的名字走向下一步',
    ]),
    sourceTemplateId: MIANMIAN_UNFINISHED_NAME_TEMPLATE.templateId,
  }),
  echo: Object.freeze({
    id: 'echo-volume-v1',
    name: '回声卷',
    principle: '担忧会通过反复确认放大疑点，旅人可以辨认回声，而不必无限服从它。',
    chapterArc: Object.freeze([
      '显影此刻的核心拉扯',
      '追踪反复出现的回声机制',
      '看见机制想保护什么、又增加了什么重量',
      '把愿望变成眼前可尝试的一小步',
      '验证放慢或留白不会让世界坍塌',
      '把过重的线分给风和信物',
      '带着开放结尾回到下一步',
    ]),
    sourceTemplateId: 'echo-controlled-v1',
  }),
});

function selectStoryFramework(safeBrief, useMianmianFallback = false) {
  if (useMianmianFallback) return STORY_FRAMEWORKS.label;
  const signal = [safeBrief?.coreTension, safeBrief?.coreStruggle, safeBrief?.desiredDirection]
    .filter((item) => typeof item === 'string')
    .join(' ');
  return /评价|标签|命名|名字|看法|比较|认可|否定/.test(signal)
    ? STORY_FRAMEWORKS.label
    : STORY_FRAMEWORKS.echo;
}

function buildFrameworkPrompt(framework) {
  return [
    '内置故事框架：' + framework.name + '（' + framework.id + '）',
    '框架原则：' + framework.principle,
    '七章结构：' + framework.chapterArc.map((item, index) => '第' + (index + 1) + '章：' + item).join('；'),
    '只使用经过安全摘要的用户经历，不补写现实身份、人物关系、诊断、事件原因或结局。',
  ].join('\n');
}

module.exports = {
  STORY_FRAMEWORKS,
  buildFrameworkPrompt,
  selectStoryFramework,
};
