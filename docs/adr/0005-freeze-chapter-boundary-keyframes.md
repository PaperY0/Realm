---
status: superseded
superseded-by: 0032-use-reviewed-illustrations-and-local-2-5d-motion.md
---

# 用统一边界关键帧连接并行生成的章节

> 本决策已由 [ADR 0032](0032-use-reviewed-illustrations-and-local-2-5d-motion.md) 取代。以下内容仅保留为历史背景，不再作为 V0 实现合同。


在七个章节 subagent 并行生成视频之前，系统先根据冻结的故事设定统一生成 K0 至 K7 八张章节边界关键帧；第 N 章负责生成 K(N-1) 到 KN 之间的运动。共享边界帧使相邻章节在角色外形、位置、物件、光线和空间状态上拥有同一个接口，从而兼顾并行速度与跨章连续性。正式章节视频必须把共享起始帧与结束帧同时交给原生支持首尾帧约束的模型，并对成品起止状态再次验收；只支持首帧的模型不得用于七章正式视频。
