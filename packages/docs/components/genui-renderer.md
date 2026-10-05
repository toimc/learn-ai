---
title: GenUIRenderer 生成式 UI 渲染器
---

# GenUIRenderer 生成式 UI 渲染器

把工具 `tool_result` 携带的 `UISchema` 渲染为真实组件。概念、安全红线与 props 消毒规则详见 [生成式 UI 指南](../guide/genui.md)。

```vue
<script setup lang="ts">
import { GenUIRenderer, WeatherCard, PlanActions, registerGenuiComponent } from '@toimc/vue'

registerGenuiComponent('weather-card', WeatherCard)
registerGenuiComponent('action-group', PlanActions)
</script>

<template>
  <GenUIRenderer :schema="msg.toolCalls?.[0]?.result?.ui" @adopt="onAdopt">
    <template #fallback>
      <!-- 校验失败 / 未注册 type 时的降级，通常换 ToolCall 系列面板 -->
      <ToolCall v-for="tc in msg.toolCalls" :key="tc.id" :data="tc" />
    </template>
  </GenUIRenderer>
</template>
```

## GenUIRenderer

渲染管线：`isUISchema` 校验 → 注册表查 type → `sanitizeGenuiProps` 消毒 → `<component :is>` 动态渲染。

### Props

| Prop | 类型 | 默认 | 说明 |
|---|---|---|---|
| schema | `unknown` | — | 待渲染的 schema，通常取自 `message.toolCalls[i].result.ui`；非法值走 fallback |

### Slots

| Slot | 说明 |
|---|---|
| fallback | 校验失败或 type 未注册时的降级内容；不提供时渲染默认降级提示（未注册文案带出 type 名） |

### 事件透传

渲染的 GenUI 组件自定义事件（如 `adopt`）经 attrs fallthrough 自动透传，直接在 `GenUIRenderer` 上监听：`<GenUIRenderer :schema="s" @adopt="onAdopt" />`。

## WeatherCard

天气卡片示例组件（type: `weather-card`）。

### Props

| Prop | 类型 | 默认 | 说明 |
|---|---|---|---|
| city | `string` | — | 城市名 |
| temperatureC | `number` | — | 温度（摄氏度） |
| description | `string` | — | 天气描述 |

### Events

| Event | 参数 | 说明 |
|---|---|---|
| detail | `city: string` | 点击卡片 |

## PlanActions

推荐方案 + 采纳按钮示例组件（type: `action-group`）。组件只上报"用户采纳了哪个方案"，执行什么业务由宿主决定。

### Props

| Prop | 类型 | 默认 | 说明 |
|---|---|---|---|
| plans | `GenuiPlan[]` | — | `{ id, title, summary }` 列表；`GenuiPlan` 从 `@toimc/vue` 导出 |

### Events

| Event | 参数 | 说明 |
|---|---|---|
| adopt | `planId: string` | 点击某行的"采纳"按钮；纯数字 id 会被消毒收窄为 number，建议用 `'plan-1'` 形态 |
