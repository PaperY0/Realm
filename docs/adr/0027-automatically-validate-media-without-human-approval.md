---
status: superseded
superseded-by: 0032-use-reviewed-illustrations-and-local-2-5d-motion.md
---

# 比赛 Demo 使用全自动媒体门禁而不加入人工审批

> 本决策已由 [ADR 0032](0032-use-reviewed-illustrations-and-local-2-5d-motion.md) 取代。以下内容仅保留为历史背景，不再作为 V0 实现合同。


边界关键帧和章节视频必须同时通过确定性技术检查与独立视觉语义检查，硬失败触发既定的一次重试或个性化降级，轻微且不影响角色、叙事、衔接和安全的问题只记录为软警告。为了不把人工操作加入五分钟用户等待链路，媒体通过后自动发布；内部调试页可以展示报告，但不要求演示者逐章点击批准，也不能只依赖一个模型总分决定是否发布。
