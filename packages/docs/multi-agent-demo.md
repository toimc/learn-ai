---
layout: MultiAgentDemoPage
title: 多 Agent 协作演示
---

本页是通用多 agent 编排演示：同一预置问题在三种协作形态下可复现、可对比——**形态是代码不是提示词**，与现有 wire 协议零改动（协作过程全部经 `tool_call` / `tool_result` 帧呈现）。

## 三种编排形态

| 形态 | 编排语义 | stages |
|---|---|---|
| 委托 delegate | researcher 检索 → writer 起草（两步委托，Explorer/Executor 模式） | [researcher, writer] |
| 并行 parallel | researcher ×3 从「组件用法 / 配置与主题 / 集成与数据」三个角度并行检索（`Promise.allSettled`，单路失败不影响其余路），综合汇报交给 orchestrator | 3 项并列 |
| 流水线 pipeline | 检索 → 起草 → 审查；审查不过打回重写一次（`retried` 标记，重写后不再复审） | [researcher, writer, reviewer, writer-retry?] |

## 演示要点

- **形态指令协议**：发送前页面在消息数组最前 prepend 一条 system 消息（`本次使用委托/并行/流水线模式编排任务`），用户文本前拼接形态前缀（`【委托】`/`【并行】`/`【流水线】`）；mock 剧本按该关键字分发，真实模式下 orchestrator 同时收到两者，口径一致。
- **协作卡片**：`orchestrate` 工具的 `tool_result`（OrchestrationResult）定制渲染为 `CollaborationCard`——头部为形态徽章 + 任务摘要 + 总耗时 + 子 agent 数，下方为阶段时间线（角色名 / agentId / 模型 / 耗时 / 状态），每阶段产出默认折叠；打回重写显示「已打回重写」标记，审查结论显示「审查通过 / 需修订」；并行形态三路并列展示。结构异常时回退原始 JSON（人话提示在上、技术折叠在下）。
- **双轨后端**：dev-server 配置了 `MASTRA_MODEL` 时模型下拉可见 `orchestrator-agent`，页面自动以真实编排链路发送；未配置时走 mock 剧本回放，协作卡片完整可见（顶部徽章标明当前轨道）。
- **依赖本地 dev-server**（`pnpm dev` 同时启动文档站与 8787 端口 dev 服务），GitHub Pages 构建会剔除本页。

相关背景见 16 章笔记：Explorer/Executor 委托模式、task 工具是普通工具、按角色选模型（`MASTRA_SUB_MODEL` 让 researcher 用便宜模型）。
