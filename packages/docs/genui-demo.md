---
layout: GenUIDemoPage
title: 生成式 UI 演示
---

工具回复直接渲染为**真实组件**：天气卡片、方案采纳按钮组。概念、安全红线（组件白名单 / props 消毒）与注册表 API 见[生成式 UI 指南](/guide/genui)与 [GenUIRenderer 组件文档](/components/genui-renderer)。

## 两个演示区

**静态演示（无需服务）**：`PlanActions` 的 schema → 注册表 → 真实组件链路，点击「采纳」观察 `adopt` 事件上抛——组件只上报采纳了哪个方案，执行什么业务由宿主决定。

**实时聊天（需 dev-server）**：发送「北京天气怎么样」，`get_weather` 工具的返回值附 `weather-card` UI schema，经 `MessageContent` 的 `toolCalls` prop（opt-in 接线）自动渲染为天气卡片：

- 配 `MASTRA_MODEL`：真实 agent 调 wttr.in，卡片显示实时数据
- 未配（mock 剧本回放）：剧本的 `tool_result` 同样附 `weather-card` schema，渲染固定数据的天气卡片
- dev-server 离线：顶部状态条提示启动方式，静态演示不受影响

降级路径的现场演示：实时区把服务端 `ui.type` 换成未注册的类型（或删掉 `ui` 字段）再发一次消息，消息会落回 `ToolCall` 面板——校验不通过与未注册的降级行为见[生成式 UI 指南](/guide/genui#降级链)。

## 本页用到的接线模式

```ts
// 入口三行注册（白名单由宿主决定）
registerGenuiComponent('weather-card', WeatherCard)
registerGenuiComponent('plan-actions', PlanActions)
```

```vue
<!-- 消息级：MessageContent toolCalls（GenUI 优先，ToolCall 面板兜底） -->
<MessageContent :content="msg.content" :tool-calls="msg.toolCalls" />

<!-- 需要接组件自定义事件（如 adopt）时手写渲染器 -->
<GenUIRenderer :schema="planSchema" @adopt="onAdopt" />
```
