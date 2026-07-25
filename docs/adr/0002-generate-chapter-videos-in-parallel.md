---
status: superseded
superseded-by: 0032-use-reviewed-illustrations-and-local-2-5d-motion.md
---

# 并行生成七章视频

> 本决策已由 [ADR 0032](0032-use-reviewed-illustrations-and-local-2-5d-motion.md) 取代。以下内容仅保留为历史背景，不再作为 V0 实现合同。


系统在总故事规划器冻结完整故事设定、七章大纲和章节卡后，将各章任务分发给不同的生成 subagent 并行生产视频，再把通过校验的结果组合到网页绘本中。总故事规划器是故事事实的唯一所有者；章节 subagent 只是分镜与媒体执行者，可以优化景别、镜头运动和动作表现，但不得修改主角、故事事实、象征物、章节功能或章节开始与结束状态。并行方案用于缩短整册等待时间，但会放大跨章不一致风险，因此任务失败时 subagent 必须返回结构化失败或降级结果，不能自行改写剧情迁就模型。
