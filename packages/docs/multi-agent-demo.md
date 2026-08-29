---
layout: MultiAgentDemoPage
title: 多 Agent 协作演示
---

本页是通用多 agent 编排演示：同一预置问题在三种协作形态下可复现、可对比——**形态是代码不是提示词**，与现有 wire 协议零改动（协作过程全部经 `tool_call` / `tool_result` 帧呈现）。

## 三种编排形态

| 形态 | 编排语义 | 对应 Mastra 官方模式 | stages |
|---|---|---|---|
| 委托 delegate | researcher 检索 → writer 起草，父 Agent 掌控全程 | **Supervisor**（主 Agent 委派+收回） | [researcher, writer] |
| 并行 parallel | researcher ×3 从「组件用法 / 配置与主题 / 集成与数据」三个角度独立检索（`Promise.allSettled`，单路失败不影响其余路），综合裁决交给 orchestrator | **Council**（多视角独立作答 + 综合） | 3 项并列 |
| 流水线 pipeline | 检索 → 起草 → 审查；审查不过打回重写一次（`retried` 标记，重写后不再复审） | **Workflow**（执行路径代码写死，可预测可审计） | [researcher, writer, reviewer, writer-retry?] |

> 三种演示形态分别对应 16-03 笔记中 Mastra 官方四种协作模式里的三个（区分维度是「控制权在谁手里」）。**Handoffs**（专家直接接管对话）未做演示：它要求前端在不同 agent 人格间切换展示，与现有「一次会话一个模型入口」的 wire 协议形态不同。实现走的是笔记中「手搓 task 工具」路线——`orchestrate` 就是一个普通工具，委派的本质是工具调用；Mastra 原生 supervisor 设施（`agents` 属性 / delegation 三件套 / `isTaskComplete` scorers）是「原理 → 生产」阶梯的下一层。

## 演示要点

- **形态指令协议**：发送前页面在消息数组最前 prepend 一条 system 消息（`本次使用委托/并行/流水线模式编排任务`），用户文本前拼接形态前缀（`【委托】`/`【并行】`/`【流水线】`）；mock 剧本按该关键字分发，真实模式下 orchestrator 同时收到两者，口径一致。
- **协作卡片**：`orchestrate` 工具的 `tool_result`（OrchestrationResult）定制渲染为 `CollaborationCard`——头部为形态徽章 + 任务摘要 + 总耗时 + 子 agent 数，下方为阶段时间线（角色名 / agentId / 模型 / 耗时 / 状态），每阶段产出默认折叠；打回重写显示「已打回重写」标记，审查结论显示「审查通过 / 需修订」；并行形态三路并列展示。结构异常时回退原始 JSON（人话提示在上、技术折叠在下）。
- **双轨后端**：dev-server 配置了 `MASTRA_MODEL` 时模型下拉可见 `orchestrator-agent`，页面自动以真实编排链路发送；未配置时走 mock 剧本回放，协作卡片完整可见（顶部徽章标明当前轨道）。
- **依赖本地 dev-server**（`pnpm dev` 同时启动文档站与 8787 端口 dev 服务），GitHub Pages 构建会剔除本页。

## 原生 Workflow 层（Studio 可视化执行）

聊天演示走的是「手搓 task 工具」路线；同一套子 agent 与 prompt 模板另有**原生 Mastra Workflow** 版本，注册进 Studio（`pnpm dev:studio` 后访问 4111 的 `/workflows`），可直接输入 task 运行并查看逐步执行 trace（每步的输入/输出/耗时）：

| Workflow | 图结构 | 对应形态 |
|---|---|---|
| `docs-pipeline-workflow` | retrieve → draft → review → **branch**（verdict=revise 时走 revise 重写）→ report | 流水线 ≈ Workflow 模式 |
| `docs-council-workflow` | retrieve_api / retrieve_theme / retrieve_data **三路 parallel** → synthesize 综合 | 并行 ≈ Council 模式 |
| `docs-supervisor-workflow` | delegate **dountil 循环**（主管每轮 structuredOutput 决策调检索员/起草员/完成，轮次上限 6）→ report | 委托 ≈ Supervisor 模式 |

两层的关系正是 16-03「手搓 → 原生」教学阶梯的落地：手搓版钉死「委派的本质是工具调用」；原生版把执行图交给框架，换来 Studio 的图渲染与逐步 trace。prompt 模板与 verdict 解析抽在 `orchestration/prompts.ts` 共用——两层行为同源，13 条契约测试钉住模板不漂移。

**supervisor workflow 是三种形态里唯一「控制权交给 LLM」的原生版**：pipeline/council 的执行路径代码写死，而 supervisor 每轮由主 agent 结构化决策（`research` / `draft` / `done`）决定委派谁——同一问题两次运行可能走出不同的委派序列，dountil 循环与 6 轮上限（16-03 的步数预算思想）兜住不确定性。每轮决策与子 agent 产出都在 trace 里逐轮可见。

> 1.60 版本备注：`branch` 元组第二元素是单个 Step（非数组）；branch 后续步骤的输入是按 step id 键控的可选对象，跨步骤取数走 execute 参数里的 `getStepResult`；`dountil` 条件参数自带 `iterationCount`，配合轮次上限防死循环；`generate({ structuredOutput: { schema } })` 取结构化结果。

相关背景见 16 章笔记：单 Agent 三种失败模式、多 Agent 四模式选型（三问决策树）、手搓 task 工具 vs 原生 Supervisor、按角色选模型（`MASTRA_SUB_MODEL` 让 researcher 用便宜模型）。
