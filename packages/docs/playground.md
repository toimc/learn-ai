---
layout: PlaygroundPage
title: Playground
---

下方是完整的交互式 Playground，覆盖发送/中止消息、多会话管理与主题切换。

## 功能演示

> 💡 想体验**真实 HTTP + SSE 流式**（会话数据来自本地 mock 服务端，token 粒度逐字输出）？前往 [Mock 服务端演示](/mock-server-demo)（聊天区自适应占满视口剩余高度，场景触发词已做成输入区快捷 chip 按钮，发送按钮流式中自动切换为停止）；docs-agent 语义检索升级的双路对比（关键词 vs 向量混合，口语化查询立见高下）见 [向量检索演示](/vector-search-demo)；多 agent 委托/并行/流水线编排（分别对应 16-03 的 Supervisor/Council/Workflow 模式）与协作卡片见 [多 Agent 协作演示](/multi-agent-demo)；原生 Mastra Workflow（输入即 task，step 过程工具卡片呈现）见 [Workflow 演示](/workflow-demo)；接口清单与在线执行见 [接口文档](/mock-api)。以上演示入口已合并进顶栏「演示」下拉。

### 🧠 思考过程展示
- **触发方式**：选择「✨ 思考过程演示」会话查看静态效果；发送包含"思考"、"thinking"关键词的消息体验流式思考
- **展示效果**（对标 Claude / ChatGPT）：
  - 完成后折叠为「已思考 X 秒」一行小字，低调不抢焦点
  - 思考流式中显示「正在思考…」，图标呼吸动画、内容实时展开、细光标闪烁
  - 点击触发器展开，内容以左侧细线引用式排版展示完整思考步骤
- **技术特点**：
  - 流式更新思考内容，`useChat` 在首个正文/工具帧到达时收尾思考并计算耗时（不把正文流式时间计入「已思考 X 秒」）
  - 文案走 i18n（`thinking.thoughtFor` / `thinking.thinking`）
  - 动画尊重 `prefers-reduced-motion`

### 基础功能
- **发送 / 中止**：输入框 **Enter 直接发送**、Shift+Enter 换行（问答场景对齐主流 AI 聊天习惯；`PromptInput` 组件默认 `alt-enter` 键位，本页按场景传 `send-key="enter"`）；发送按钮在输入区右下（Footer 右侧），流式输出中可中止。
- **多模态附件**：工具栏「上传图片 / 上传附件」按钮选择文件，也可直接在输入框**粘贴**（⌘V/Ctrl+V）或**拖拽**文件进来；发送前经 mock 上传（模拟 800ms 延迟），附件随消息一并展示。超限（数量/大小）会 Toast 提示拒绝原因。输入行由 `PromptInputBody` 包裹（Textarea 占满宽度、弹性增高、发送按钮靠右）。
- **多会话**：侧边栏新建 / 切换 / 重命名 / 删除会话；移动端为抽屉式。
- **⌘K / Ctrl+K**：新建对话（已接入全局快捷键，捕获阶段拦截避免被站点搜索抢占）。
- **明暗主题**：顶部 ☀/🌙 切换，由 [`useTheme`](/composables/use-theme) 驱动，状态持久化。
- **消息布局**：顶部布局按钮在「统一对齐」与「IM 左右分列」（用户右、AI 左）间切换；宽屏消息区自动放宽，由 [`useLayoutConfig`](/composables/use-layout-config) 驱动。

### 高级演示
- **工具调用**：发送包含"tool"或"工具"的消息，展示工具调用面板（含参数、结果、耗时）
- **错误处理**：发送包含"error"或"错误"的消息，展示错误场景处理
- **A/B 偏好对比**：选择「⚖️ A/B 回复对比」会话，[`ComparisonMessage`](/components/comparison-message) 双列展示两个候选回复；点「喜欢这个」后选中内容原地固化为普通 AI 消息，状态随会话保留（切走再切回不丢失）。

### 消息操作与上下文窗口

消息列表支持三个基础操作（消息 hover 后底部图标）：

| 操作 | 适用消息 | 行为 |
|---|---|---|
| 复制 | 用户 / AI | 复制 Markdown 原文到剪贴板 |
| 重新生成 | AI（任意位置） | 删除该回复及其后所有消息，以完整前置历史重发 |
| 编辑 | 用户 | 消息变为编辑框，确认后覆盖原消息、删除其后回复并重发 |

三条路径发送的均为「窗口内完整历史」（一次性发送，非增量）。

**上下文窗口截断**：模型下拉中每个模型项右侧的齿轮可配置 `maxContextTokens`（token 数，0 = 不限制）。超出窗口时发送请求自动省略最旧消息——仅影响发送内容，聊天记录完整保留，消息列表顶部会出现省略提示。token 计量以 done 帧回传的真实 `usage` 优先（mock 剧本与 Mastra 链路均回传），无 usage 时前端估算兜底。

```ts
const chat = useChat(adapter, {
  // 支持 getter：配置随选中模型变化时每次发送求值
  maxContextTokens: () => currentModelWindow,
})
await chat.editMessage(userMsg.id, '修改后的提问')  // 覆盖 + 删后续 + 重发
await chat.regenerate(assistantMsg.id)             // 任意位置重新生成
```

### 后端选择器（顶栏左侧下拉）

顶栏左侧下拉选择**消息走哪条链路**（对新建会话生效，已有会话不受影响；旧版三后端的历史选择会自动迁移到对应新选项）：

| 后端 | 说明 | 模型怎么选 |
|---|---|---|
| 本地 Mock | 前端内置剧本，离线可用，零依赖 | 无模型概念（剧本固定） |
| dev-server · 8787 | `@toimc/server` 网关 + SSE 线协议（mock 剧本 + 可选 mastra agents + 运行时注册） | 顶栏模型下拉（`GET /api/models`） |

dev-server 配置 `MASTRA_MODEL` 环境变量后，模型下拉会出现 `chat-agent`（Mastra Agent：工具调用 + 会话记忆，配置方式见[智能体接入](/guide/mastra)）；未配置时是纯 mock 模式。

### 真实模型会话（Provider 设置）

本地 mock 之外，还可以在浏览器里注册**真实大模型**（自带 API Key；密钥只在服务端内存与本地持久化文件间流转，见下方「隐私边界」），整条链路需要 dev-server 在线（`pnpm dev` 同时启动两者）：

- **⚙ 设置按钮**：顶栏右侧 ⚙ 打开 [`ProviderSettingsDialog`](/components/provider-settings-dialog)，选择服务类型（OpenAI 兼容 / Anthropic）、填端点与 API Key、模型名，提交即注册（`POST /api/providers`，注册为带 get_time / get_weather 工具与会话记忆的 Agent 模型）；端点填 base 形态（如 `https://x.com/v1`）或整段粘贴均可，服务端统一归一化。弹层底部的已注册列表支持**编辑**（`PUT /api/providers/:id` 原位更新，id 沿用、 apiKey 留空需重填）与**逐项删除**（`DELETE /api/providers/:id`，删除当前选中的模型会自动回到默认行为）。
- **「记住配置」**：表单内勾选（默认开）。勾选时配置持久化在浏览器（localStorage `ai-chat-playground:saved-providers`）与服务端（`.temp/providers.json`，git 忽略），页面刷新、dev 期 watch 重启、服务重启都不丢——服务端重启恢复沿用原 id，浏览器侧在页面挂载时逐条静默重注册并剔除失效条目；取消勾选则该条仅在本次服务进程内有效。
- **顶栏模型下拉**：dev-server 在线时下拉可用，数据源 `GET /api/models`（Mock 三模型 + env 注册的 `chat-agent` + 运行时注册的 `custom-*` 模型）；切换**即时作用于当前会话**（含已存在的旧会话，编辑重发也走新模型；各会话各自持有模型快照，互不影响），选「默认（本地演示）」当前会话摘除模型、回到本地 mock 行为。服务重启后浏览器持久化的选中 id 若已失效，自动回退默认并清理存储，不会把 unknown model 发给服务端。
- **新建会话即真实模型**：选中模型后「新建会话」（含 ⌘K）会把模型 id 写进该会话，此后会话内发送的消息经 SSE 走真实模型；无模型的会话行为与现状完全一致。
- **工具调用进思考面板**：真实模型会话里，模型调用工具的过程（调了什么工具、拿到什么结果）呈现在思考面板内部，随「正在思考… / 已思考 X 秒」折叠展开，下接整合后的 Markdown 回复——思考、工具、正文共享同一套 StreamChunk 流式协议，无需任何线协议改动。
- **发送失败可见**：真实模型会话中上游报错（密钥错误、端点不通等）时，错误经服务端 `error` chunk 返回，顶部通知条展示「发送失败：<原因>」，下次发送自动清除——错误不写入消息气泡（`useChat` 的设计：`state.error` 与消息内容分离）。
- **离线提示**：8787 端口的 dev-server 未启动时，点击 ⚙ 顶部出现通知条提示启动方式，模型下拉点击无效但保持装饰外观；服务恢复在线后提示自动消失，本地 mock 演示不受影响。
- **隐私边界**：localStorage 有两个 key——`ai-chat-playground:selected-model`（仅模型 id）与 `ai-chat-playground:saved-providers`（勾选「记住配置」时的完整配置，含 apiKey，属 Playground 私有演示包决策；发布组件 `ProviderSettingsDialog` 自身存储中立，不落任何存储，勾选状态经 `payload.persist` 交宿主）。apiKey 不进日志、不进任何 GET 响应（列表只回脱敏视图），服务端落盘文件 `.temp/providers.json` 已被 git 忽略。

### 主题定制
想可视化调整令牌并导出 CSS？前往 [主题配置器](/theme-builder)；「原始·断点」组内置 Bootstrap 式 sm/md/lg/xl 四档矩形示意，数值跟随滑块实时变化。

