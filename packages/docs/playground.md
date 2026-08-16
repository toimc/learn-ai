---
layout: PlaygroundPage
title: Playground
---

下方是完整的交互式 Playground，覆盖发送/中止消息、多会话管理与主题切换。

- **发送 / 中止**：输入框 Enter 换行、Alt+Enter 发送；发送按钮在输入区右下（Footer 右侧），流式输出中可中止。
- **多模态附件**：工具栏「上传图片 / 上传附件」按钮选择文件，也可直接在输入框**粘贴**（⌘V/Ctrl+V）或**拖拽**文件进来；发送前经 mock 上传（模拟 800ms 延迟），附件随消息一并展示。超限（数量/大小）会 Toast 提示拒绝原因。输入行由 `PromptInputBody` 包裹（Textarea 占满宽度、弹性增高、发送按钮靠右）。
- **多会话**：侧边栏新建 / 切换 / 重命名 / 删除会话；移动端为抽屉式。
- **⌘K / Ctrl+K**：新建对话（已接入全局快捷键，捕获阶段拦截避免被站点搜索抢占）。
- **明暗主题**：顶部 ☀/🌙 切换，由 [`useTheme`](/composables/use-theme) 驱动，状态持久化。
- **消息布局**：顶部布局按钮在「统一对齐」与「IM 左右分列」（用户右、AI 左）间切换；宽屏消息区自动放宽，由 [`useLayoutConfig`](/composables/use-layout-config) 驱动。
- **A/B 偏好对比**：消息流里 [`ComparisonMessage`](/components/comparison-message) 双列展示两个候选回复（mock 场景：用户提问 + 双角度回答），点「喜欢这个」后对比卡移除，选中的回复固化为消息流中的一条 AI 消息。
- 想可视化调整令牌并导出 CSS？前往 [主题配置器](/theme-builder)；「原始·断点」组内置 Bootstrap 式 sm/md/lg/xl 四档矩形示意，数值跟随滑块实时变化。
