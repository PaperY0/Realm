# 七章插画并行生成设计

## 目标

在故事包冻结后，为七个章节提交独立图片任务，默认并发 7 个请求，显著缩短整本绘本的等待时间，同时保留逐章失败、校验和后续重做能力。

## 结构

- `src/services/chapter-image-generation.js` 负责七章任务编排、并发上限、逐章状态和 `Promise.allSettled` 结果汇总。
- `src/services/image-generation.js` 保持单图生成职责，并接收每章 `illustrationContract` 生成章节专属提示词。
- `POST /api/images/generate-book` 接收冻结故事包，返回七章插画结果；单章文件直接写入现有生成目录，避免破坏静态资源契约。
- 前端在故事包完成后调用整本接口，展示七章进度；只有七章都成功才允许进入阅读态。

## 失败与安全

每章独立进入 `queued → generating → succeeded/failed`。已成功章节不会因其他章节失败而重做；不自动重试。章节提示词只使用故事包中的安全 `illustrationContract`，不接受原始输入或任意路径。

## 验收

- 七章任务最多同时运行 7 个。
- 七章成功时总结果包含 7 个合法 PNG。
- 单章失败时其余章节仍完成，整体结果明确为部分失败。
- 章节提示词包含各章场景、动作、道具和连续性信息。
- 完整测试和语法检查通过。
