# Select

原生下拉选择基础件，`v-model` 双向绑定，`<option>` 经默认插槽透传——无自定义 listbox，弹出列表即浏览器原生行为。

Input、Select、Radio、Button 是 `@toimc/vue` 的四个基础表单原语——构建表单与设置类界面的原子件。视觉语言对齐原子 CSS 体系的设计（subtle 边框、focus ring、统一控件高度、快速 transition），但全部以本库 `--ai-chat-*` 设计令牌实现，未引入任何原子 CSS 框架，暗色主题随语义令牌自动适配。

## 基础用法

<script setup lang="ts">
import { ref } from 'vue'
import { Select } from '@toimc/vue'

const model = ref('gpt-4o-mini')
</script>

`v-model` 绑定选中项的 `value`，选项写在默认插槽里：

<DemoContainer>
  <div style="display: flex; flex-direction: column; gap: 12px; max-width: 320px">
    <Select v-model="model">
      <option value="gpt-4o-mini">GPT-4o mini</option>
      <option value="gpt-4o">GPT-4o</option>
      <option value="glm-4.6">GLM-4.6</option>
    </Select>
    <span style="font-size: 13px; color: var(--ai-chat-color-text-secondary)">model = {{ model || '（空）' }}</span>
  </div>
</DemoContainer>

在宿主应用中：

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { Select } from '@toimc/vue'

const model = ref('gpt-4o-mini')
</script>

<template>
  <Select v-model="model">
    <option value="gpt-4o-mini">GPT-4o mini</option>
    <option value="gpt-4o">GPT-4o</option>
  </Select>
</template>
```

组件不提供 placeholder prop：需要占位项时用原生写法放一个 `disabled` 的空值 `<option>` 即可：

```vue
<Select v-model="model">
  <option value="" disabled>请选择模型</option>
  <option value="gpt-4o">GPT-4o</option>
</Select>
```

## 校验失败态与禁用

`invalid` 在 `select` 元素上渲染 error 色边框与 `aria-invalid="true"`；`disabled` 降低透明度且切换不更新 `v-model`：

<DemoContainer>
  <div style="display: flex; flex-direction: column; gap: 12px; max-width: 320px">
    <Select invalid model-value="">
      <option value="" disabled>请选择（invalid 态）</option>
      <option value="a">选项 A</option>
    </Select>
    <Select disabled model-value="a">
      <option value="a">禁用状态</option>
    </Select>
  </div>
</DemoContainer>

## 尺寸

`size="sm"`（32px）用于紧凑区，默认 `md`（36px），与 [Input](/components/input) 同一高度体系：

<DemoContainer>
  <div style="display: flex; flex-direction: column; gap: 12px; max-width: 320px">
    <Select size="sm" model-value="a">
      <option value="a">小尺寸 sm（32px）</option>
    </Select>
    <Select model-value="a">
      <option value="a">默认 md（36px）</option>
    </Select>
  </div>
</DemoContainer>

## 自绘 chevron 行为

- 原生下拉箭头经 `appearance: none` 移除，替换为组件内联 SVG chevron，右侧绝对定位（`pointer-events: none`，不拦截点击）
- chevron 用 `currentColor` 并取 `--ai-chat-color-text-secondary` 令牌——明暗主题自动变色，无需两套图标
- chevron 标注 `aria-hidden="true"`，对读屏隐藏（下拉语义由原生 `select` 提供）

## 视觉要点

- **统一控件高度**：`--ai-chat-control-height-md`（36px）/ `--ai-chat-control-height-sm`（32px）
- **focus ring**：聚焦（`:focus-visible`）时 accent 边框 + `--ai-chat-control-ring`（3px 低透明度 accent 阴影）；hover 时边框加深
- **invalid 态**：`--ai-chat-color-status-error` 边框，聚焦时 ring 同步变 error 色
- **暗色自动适配**：背景/边框/文字全部引用语义令牌，`[data-theme='dark']` 翻转语义层即生效
- **样式为 scoped（抗宿主 reset）**：宿主未分层表单元素 reset（Tailwind preflight / modern-normalize 的 `border: 0` + `padding: 0`）会压过 `@layer` 内的库样式，scoped 属性选择器凭特异性免疫
- **transition**：边框/阴影/透明度统一走 `--ai-chat-duration-fast`（0.12s），`prefers-reduced-motion` 时关闭

## API

### Props

| 属性名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| v-model | `string` | `''` | 选中值（对应 option 的 value），双向绑定 |
| disabled | `boolean` | `false` | 禁用（切换不更新 v-model） |
| invalid | `boolean` | `false` | 校验失败态：error 边框 + `aria-invalid="true"` |
| size | `'sm' \| 'md'` | `'md'` | 控件高度 |

### Events

| 事件名 | 参数 | 说明 |
|--------|------|------|
| update:modelValue | `(value: string)` | `v-model` 更新事件（原生 change 时发出） |

### Slots

| 插槽名 | 说明 |
|--------|------|
| default | `<option>` 列表透传到原生 select |
