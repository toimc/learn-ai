# Input

单行文本输入基础件，`v-model` 双向绑定，自带校验失败态（`invalid` + `aria-invalid`）与原生 `blur` 事件透传。

Input、Select、Radio、Button 是 `@toimc/vue` 的四个基础表单原语——构建表单与设置类界面的原子件。视觉语言对齐原子 CSS 体系的设计（subtle 边框、focus ring、统一控件高度、快速 transition），但全部以本库 `--ai-chat-*` 设计令牌实现，未引入任何原子 CSS 框架，暗色主题随语义令牌自动适配。

## 基础用法

<script setup lang="ts">
import { ref } from 'vue'
import { Input } from '@toimc/vue'

const name = ref('')
const apiKey = ref('')
const touched = ref(false)
</script>

`v-model` 双向绑定，输入即更新：

<DemoContainer>
  <div style="display: flex; flex-direction: column; gap: 12px; max-width: 320px">
    <Input v-model="name" placeholder="请输入模型名称" />
    <span style="font-size: 13px; color: var(--ai-chat-color-text-secondary)">name = {{ name || '（空）' }}</span>
  </div>
</DemoContainer>

在宿主应用中：

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { Input } from '@toimc/vue'

const name = ref('')
</script>

<template>
  <Input v-model="name" placeholder="请输入模型名称" />
</template>
```

## 密码输入

`type="password"` 渲染密码框，`autocomplete` 透传原生属性（注册新密钥场景建议 `new-password`，避免浏览器误回填）：

<DemoContainer>
  <div style="max-width: 320px">
    <Input v-model="apiKey" type="password" placeholder="API Key" autocomplete="new-password" />
  </div>
</DemoContainer>

## 校验失败态与失焦事件

`invalid` 会同时渲染 error 色边框和 `aria-invalid="true"`（未设置时不输出该属性）；`blur` 透传原生失焦事件，适合「失焦后 touched 才显示错误」的校验模式：

<DemoContainer>
  <div style="display: flex; flex-direction: column; gap: 8px; max-width: 320px">
    <Input
      v-model="name"
      placeholder="失焦后为空则报错"
      :invalid="touched && !name.trim()"
      @blur="touched = true"
    />
    <span
      v-if="touched && !name.trim()"
      style="font-size: 13px; color: var(--ai-chat-color-status-error)"
    >名称不能为空</span>
    <button
      v-if="touched"
      style="font-size: 12px; border: none; background: none; padding: 0; cursor: pointer; color: var(--ai-chat-color-text-secondary)"
      @click="touched = false"
    >重置 touched</button>
  </div>
</DemoContainer>

## 尺寸与禁用

`size="sm"`（32px）用于工具栏等紧凑区，默认 `md`（36px）；`disabled` 降低透明度且输入不更新 `v-model`：

<DemoContainer>
  <div style="display: flex; flex-direction: column; gap: 12px; max-width: 320px">
    <Input size="sm" placeholder="小尺寸 sm（32px）" />
    <Input placeholder="默认 md（36px）" />
    <Input disabled placeholder="禁用状态" />
  </div>
</DemoContainer>

## 视觉要点

- **统一控件高度**：`--ai-chat-control-height-md`（36px）/ `--ai-chat-control-height-sm`（32px），与 [Select](/components/select)、[Button](/components/button) 同一高度体系
- **focus ring**：聚焦（`:focus-visible`）时 accent 边框 + `--ai-chat-control-ring`（3px 低透明度 accent 阴影）；hover 时边框加深
- **invalid 态**：`--ai-chat-color-status-error` 边框，聚焦时 ring 同步变 error 色
- **暗色自动适配**：背景/边框/文字/placeholder 全部引用语义令牌，`[data-theme='dark']` 翻转语义层即生效
- **transition**：边框/阴影/透明度统一走 `--ai-chat-duration-fast`（0.12s），`prefers-reduced-motion` 时关闭

## API

### Props

| 属性名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| v-model | `string` | `''` | 输入值，双向绑定 |
| type | `'text' \| 'password'` | `'text'` | 原生输入类型 |
| placeholder | `string` | — | 占位文案 |
| disabled | `boolean` | `false` | 禁用（输入不更新 v-model） |
| invalid | `boolean` | `false` | 校验失败态：error 边框 + `aria-invalid="true"` |
| size | `'sm' \| 'md'` | `'md'` | 控件高度 |
| autocomplete | `string` | — | 透传原生 autocomplete（如 `new-password`） |

### Events

| 事件名 | 参数 | 说明 |
|--------|------|------|
| update:modelValue | `(value: string)` | `v-model` 更新事件 |
| blur | `(event: Event)` | 原生失焦事件透传，适合 touched 校验时机 |
