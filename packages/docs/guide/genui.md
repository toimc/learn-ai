---
title: 生成式 UI
---

# 生成式 UI（GenUI）

让 AI / 工具的回复直接渲染为**真实组件**而不是文字：天气卡片、推荐方案、可点击的操作按钮组。链路对比：

```
传统：AI 回复 markdown 文本流 → markdown-it 解析 → DOMPurify 消毒 → HTML
GenUI：工具回复结构化 schema（JSON）→ 组件注册表映射 → 真实 Vue 组件
```

公式：**结构化 schema + 组件注册表**。schema 由工具代码确定性生成（模型只决定"要不要调工具"，渲染结构由工程师写在工具里），前端持有 type → 组件的封闭白名单，未注册的类型一律降级。

## UISchema 协议（@toimc/core）

```typescript
import { isUISchema } from '@toimc/core'
import type { UISchema } from '@toimc/core'

interface UISchema {
  type: string                      // 组件类型标识；只有宿主注册过的 type 才可能被渲染
  props: Record<string, unknown>    // 传给目标组件的 props；渲染前必须消毒
}
```

工具在 `tool_result` 的返回值上附加 `ui` 字段即可（渐进增强，协议零改动——`StreamChunk.metadata.toolResult` 是 `unknown`，前端从 `message.toolCalls[i].result.ui` 取 schema）：

```typescript
// 服务端工具返回值
return {
  city,                                   // 原始数据：模型生成后续回复的依据
  temperatureC: 22,
  description: 'Sunny',
  ui: {                                   // 给前端的渲染指令，两者并存互不干扰
    type: 'weather-card',
    props: { city, temperatureC: 22, description },
  },
}
```

`isUISchema(value)` 的判定边界：

- 合法：对象、`type` 为非空字符串、`props` 为非 null 对象
- 拒绝：非对象、`null`、**数组**（schema 本身或 `props` 是数组都不算合法）、`type` 缺失/空串/非字符串、`props` 缺失/为 null/为数组

## 组件注册表：封闭白名单

```typescript
import {
  registerGenuiComponent,
  resolveGenuiComponent,
  unregisterGenuiComponent,
  GenUIRenderer,
  WeatherCard,
  PlanActions,
} from '@toimc/vue'

// 宿主入口三行注册，白名单由宿主决定
registerGenuiComponent('weather-card', WeatherCard)
registerGenuiComponent('action-group', PlanActions)
```

- `registerGenuiComponent(type, component)`：注册；**空白 type 静默忽略**（不注册）
- `resolveGenuiComponent(type)`：解析；未注册返回 `undefined`
- `unregisterGenuiComponent(type)`：注销（测试隔离 / 动态卸载）

注册表放在 `vue` 包而非 `core`：它操作 Vue 组件对象，依赖 Vue 运行时（core 不依赖 Vue 原则的又一次应用）。渲染的组件永远来自宿主的显式 import——**不存在按字符串路径动态加载的通路**，`eval` / `new Function` / 动态 `import()` 均为红线。

## GenUIRenderer：校验 → 查表 → 消毒 → 渲染

```vue
<GenUIRenderer :schema="msg.toolCalls?.[0]?.result?.ui">
  <template #fallback>
    <ToolCall v-for="tc in msg.toolCalls" :key="tc.id" :data="tc" />
  </template>
</GenUIRenderer>
```

渲染器依次做四件事：

1. **校验**：`isUISchema` 不通过 → fallback
2. **查表**：type 未注册 → fallback
3. **消毒**：props 经 `sanitizeGenuiProps` 过滤后才 `v-bind`
4. **渲染**：`<component :is>` 动态渲染注册组件

fallback 语义：提供 `#fallback` 具名 slot（通常换成 [`ToolCall`](/components/tool-call) 系列面板）；不提供时渲染一条低调的降级提示（非法 schema 与未注册 type 文案不同，未注册文案会带出 type 名便于排查）。

**事件透传**：GenUI 组件的自定义事件（如 `PlanActions` 的 `adopt`）经 attrs fallthrough 自动透传，宿主直接在 `GenUIRenderer` 上监听即可：

```vue
<GenUIRenderer :schema="schema" @adopt="onAdopt" />
```

**快捷接线（MessageContent 的 `toolCalls` prop）**：不想手写 `v-for` + `GenUIRenderer` 组装时，直接把 `message.toolCalls` 传给 [`MessageContent`](/components/message)——`completed` 且带合法 `ui` 的工具调用自动走 GenUI 渲染（未注册 type / 非法 schema / 非 completed 一律落回 [`ToolCall`](/components/tool-call) 面板），渲染区位于正文之前。不传该 prop 时 `MessageContent` 行为与旧版完全一致：

```vue
<MessageContent :content="msg.content" :tool-calls="msg.toolCalls" />
```

## props 消毒规则（sanitizeGenuiProps）

纯函数，逐值递归，不修改入参：

| 值形态 | 处理 | 示例 |
|---|---|---|
| function / symbol / undefined | **丢弃该键** | 注入面，直接剔除 |
| NaN / Infinity / -Infinity | **丢弃该键** | 非有限数值不进模板 |
| number（有限）/ boolean / null | 保留 | `22` / `true` / `null` |
| URL 形态字符串（`scheme:...`） | 白名单：仅 `http:` / `https:` / `blob:`；其余协议丢弃 | `javascript:alert(1)` 丢弃 |
| 纯数字字符串（`-?\d+(\.\d+)?`） | `Number()` 收窄为 number | `'22'` → `22`、`'-3.5'` → `-3.5` |
| 普通字符串 | 保留 | `'Sunny'` |
| 数组 | 逐元素消毒，被丢弃的元素剔除 | `[1, () => 1, 'a']` → `[1, 'a']` |
| plain object | 逐键递归消毒 | 嵌套结构同规则 |
| Date / Map / Set / RegExp 等 | **丢弃该键** | 消毒域外 |

注意两点：

- URL 白名单**不含** `data:image`（[附件校验](/components/attachments)允许）——GenUI 渲染面更窄，从严
- 纯数字字符串会被收窄为 number：需要字符串的组件（如展示编号 `007`）请自行 `String()` 处理；纯数字 `id` 建议用 `'plan-1'` 这类非纯数字形态

## 内置示例组件

两件开箱示例，也可作为自定义 GenUI 组件的参照（样式全部走 `--ai-chat-*` 变量）：

### WeatherCard（type: `weather-card`）

```vue
<WeatherCard city="Beijing" :temperatureC="22" description="Sunny" />
```

Props：`city: string` / `temperatureC: number` / `description: string`；点击卡片触发 `detail(city)` 事件。

### PlanActions（type: `action-group`）

```vue
<PlanActions :plans="plans" @adopt="onAdopt" />
```

Props：`plans: { id: string; title: string; summary: string }[]`（`GenuiPlan` 类型从 `@toimc/vue` 导出）；每条方案带"采纳"按钮，点击 `emit('adopt', planId)`——组件只上报"用户采纳了哪个"，执行什么业务由宿主决定。

## 服务端工具接入（dev-server 示例）

```typescript
// packages/dev-server 天气工具 execute 返回值附加 ui 字段
return {
  city,
  temperatureC: Number(current?.temp_C ?? 0) || 0,
  description,
  ui: {
    type: 'weather-card',
    props: { city, temperatureC: Number(temperatureC) || 0, description },
  },
}
```

## 安全红线

| 红线 | 机制 |
|---|---|
| type 白名单 | `:is` 只能命中注册表内组件；封闭集合，无"试加载"路径 |
| 禁止动态执行 | 无 `eval` / `new Function` / 字符串路径 `import()`；组件全部来自显式 import |
| props 消毒 | v-bind 前过滤：函数丢弃、URL 协议白名单、数值收窄 |

对比 markdown 管线的 DOMPurify：markdown 消毒是"HTML 标签白名单"，GenUI 是"组件白名单"——不可信内容只能映射到预定义的安全集合，安全模型一致；区别是粒度，组件级比标签级更粗反而更安全。

## 局限与边界

- **幻觉 schema**：校验失败的降级路径已就位——fallback 不丢功能只是不漂亮
- **宿主未注册**：服务端发了 `chart` 类型但宿主没注册，同样落 fallback
- **移动端适配**：GenUI 组件是一等公民，注册进来的组件不能假设视口宽度（过容器查询这一关）
- **流式时机**：`ui` 随 `tool_result` 一帧完整到达，无流式渲染问题；建议 `completed` 状态才渲染，`calling` 状态显示加载中，避免半成品闪现
