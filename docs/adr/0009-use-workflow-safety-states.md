---
status: accepted
---

# 使用工作流安全状态而不是临床风险等级

隐藏理解结果不再使用 `normal | elevated | crisis`，改为 `story_safe | safety_check_required | crisis_route`。歧义表达进入安全确认，暂停动画和童话隐喻并直接确认用户当前是否安全；只有明确排除当前危险后才可返回故事流程。明确或无法排除的紧急风险直接进入危机路径，停止故事规划与媒体生成。该命名描述产品下一步行为，不把系统输出包装成临床风险评估。
