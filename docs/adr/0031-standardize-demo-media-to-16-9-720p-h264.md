---
status: superseded
superseded-by: 0032-use-reviewed-illustrations-and-local-2-5d-motion.md
---

# Demo 媒体统一为 16:9 720p H.264

> 本决策已由 [ADR 0032](0032-use-reviewed-illustrations-and-local-2-5d-motion.md) 取代。以下内容仅保留为历史背景，不再作为 V0 实现合同。


Windows 比赛 Demo 以 1920×1080 的 Chrome/Edge 全屏为唯一正式视觉验收环境，关键帧与章节视频统一为 16:9、1280×720，视频由服务端 FFmpeg 标准化为 24 fps 的 MP4 / H.264 / yuv420p 并移除音轨。统一媒体合同会牺牲移动端专项适配和更高分辨率，但能让正式视频与网页降级共享稳定容器，减少供应商输出差异、播放兼容问题和比赛现场布局风险。
