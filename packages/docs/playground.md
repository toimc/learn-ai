---
layout: PlaygroundPage
title: Playground
---

下方是完整的交互式 Playground，覆盖发送/中止消息、多会话管理与主题切换。

- **发送 / 中止**：输入框 Enter 发送、Shift+Enter 换行；流式输出中可中止。
- **多会话**：侧边栏新建 / 切换 / 重命名 / 删除会话；移动端为抽屉式。
- **⌘K / Ctrl+K**：新建对话（已接入全局快捷键，捕获阶段拦截避免被站点搜索抢占）。
- **明暗主题**：顶部 ☀/🌙 切换，由 [`useTheme`](/composables/use-theme) 驱动，状态持久化。
- **消息布局**：顶部布局按钮在「统一对齐」与「IM 左右分列」（用户右、AI 左）间切换；宽屏消息区自动放宽，由 [`useLayoutConfig`](/composables/use-layout-config) 驱动。
- **A/B 偏好对比**：消息流底部 [`ComparisonMessage`](/components/comparison-message) 双列展示两个候选回复，点「我更喜欢这个回复」收集偏好。
- 想可视化调整令牌并导出 CSS？前往 [主题配置器](/theme-builder)。
