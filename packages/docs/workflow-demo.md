---
layout: WorkflowDemoPage
title: Workflow 演示
---

本页直接运行 dev-server 注册的**原生 Mastra Workflow**：输入框的内容就是 task，发送到 `POST /api/workflows/:id/run`；每个 step 的开始/结束映射为 `tool_call` / `tool_result` 帧（`toolName` 即 stepId），最终报告以流式 Markdown 呈现——与聊天共用同一套 SSE 线协议，前端零协议改动。

## 三种 Workflow

| Workflow | 图结构 | 对应形态 |
|---|---|---|
| `docs-pipeline-workflow` | retrieve → draft → review → **branch**（verdict=revise 时走 revise 重写）→ report | 流水线：执行路径代码写死，可预测可审计 |
| `docs-council-workflow` | retrieve_api / retrieve_theme / retrieve_data **三路 parallel**（单路失败不影响其余路）→ synthesize 综合 | 并行评议会：多视角独立检索后综合裁决 |
| `docs-supervisor-workflow` | delegate **dountil 循环**：主管每轮结构化决策调检索员 / 起草员 / 完成（轮次上限 6）→ report | 主管委托：控制权交给 LLM，同一问题两次运行可能走出不同委派序列 |

supervisor 是三者中唯一「控制权交给模型」的：pipeline / council 的执行图在代码里写死，supervisor 每轮由主 agent 决定委派谁——dountil 循环与轮次上限兜住不确定性。

## 双轨说明

- **原生 Workflow 运行**（徽章标明）：dev-server 配置了 `MASTRA_MODEL` 时，`GET /api/workflows` 返回注册表，页面直接把 task 发到对应 `/run` 端点，step 过程实时可见。
- **mock 剧本近似**（徽章标明）：未配置 `MASTRA_MODEL` 时注册表为空，页面回退 `POST /api/chat`，按选中 workflow 拼剧本关键字前缀（`【流水线】`/`【并行】`/`【委托】`）近似回放；supervisor 的真实决策循环需要真实模型，此轨道下为剧本化演示（页面有明确提示）。

## 与 Studio 的关系

聊天演示走的是 HTTP 端点；同一套 Workflow 还注册进了 **Mastra Studio**——`pnpm dev:studio` 后访问 [Studio /workflows](http://localhost:4111/workflows)，可直接输入 task 运行并查看**逐步执行 trace**（每步的输入 / 输出 / 耗时 / 悬挂的执行图）。两个入口执行的是同一批 workflow 定义，本页胜在嵌入聊天 UI（工具卡片 + Markdown 报告），Studio 胜在可视化 trace。

与[多 Agent 协作演示](/multi-agent-demo)是同一套编排语义的两层：那页走「手搓 task 工具」（orchestrate 卡片），本页走原生 Workflow 框架（执行图交给 Mastra）。

> 依赖本地 dev-server（`pnpm dev` 同时启动文档站与 8787 端口 dev 服务），GitHub Pages 构建会剔除本页。
