# Button

通用按钮组件，三种类型（primary / secondary / danger）× 三种尺寸（small / medium / large）。

Input、Select、Radio、Button 是 `@toimc/vue` 的四个基础表单原语——构建表单与设置类界面的原子件。视觉语言对齐原子 CSS 体系的设计（subtle 边框、focus ring、统一控件高度、快速 transition），但全部以本库 `--ai-chat-*` 设计令牌实现，未引入任何原子 CSS 框架，暗色主题随语义令牌自动适配。

::: tip 本次为视觉升级，API 不变
Props / Events / Slots 与旧版完全一致，存量用法无需任何改动。升级点全在视觉层：颜色全部改走令牌（去掉硬编码 hex）、新增 `:focus-visible` ring、active 轻微下沉、高度对齐控件令牌体系、transition 统一 0.12s。
:::

## 基础用法

<script setup lang="ts">
import { ref } from 'vue'
import { Button } from '@toimc/vue'

const clicks = ref(0)
</script>

type × size 全矩阵：

<DemoContainer>
  <div style="display: flex; flex-direction: column; gap: 12px">
    <div style="display: flex; gap: 12px; align-items: center">
      <span style="width: 52px; font-size: 12px; color: var(--ai-chat-color-text-muted)">small</span>
      <Button type="primary" size="small">主要</Button>
      <Button type="secondary" size="small">次要</Button>
      <Button type="danger" size="small">危险</Button>
    </div>
    <div style="display: flex; gap: 12px; align-items: center">
      <span style="width: 52px; font-size: 12px; color: var(--ai-chat-color-text-muted)">medium</span>
      <Button type="primary">主要</Button>
      <Button type="secondary">次要</Button>
      <Button type="danger">危险</Button>
    </div>
    <div style="display: flex; gap: 12px; align-items: center">
      <span style="width: 52px; font-size: 12px; color: var(--ai-chat-color-text-muted)">large</span>
      <Button type="primary" size="large">主要</Button>
      <Button type="secondary" size="large">次要</Button>
      <Button type="danger" size="large">危险</Button>
    </div>
  </div>
</DemoContainer>

在宿主应用中：

```vue
<script setup lang="ts">
import { Button } from '@toimc/vue'
</script>

<template>
  <Button type="primary" size="medium">发送</Button>
</template>
```

## 点击事件

点击透传原生 `click` 事件（disabled 时按钮禁用、不触发）：

<DemoContainer>
  <div style="display: flex; gap: 12px; align-items: center">
    <Button @click="clicks++">点了 {{ clicks }} 次</Button>
    <span style="font-size: 13px; color: var(--ai-chat-color-text-secondary)">clicks = {{ clicks }}</span>
  </div>
</DemoContainer>

## 禁用状态

<DemoContainer>
  <div style="display: flex; gap: 12px; align-items: center">
    <Button disabled>禁用按钮</Button>
    <Button type="secondary" disabled>禁用按钮</Button>
    <Button type="danger" disabled>禁用按钮</Button>
  </div>
</DemoContainer>

## 视觉要点

- **统一控件高度**：small / medium 分别取 `--ai-chat-control-height-sm`（32px）/ `--ai-chat-control-height-md`（36px），large 为 40px（`calc(md + 4px)`），与 [Input](/components/input)、[Select](/components/select) 同一高度体系
- **focus ring**：`:focus-visible` 时显示 `--ai-chat-control-ring`（3px 低透明度 accent 阴影），键盘可达
- **active 反馈**：按下时 `translateY(1px)` 轻微下沉
- **暗色自动适配**：所有颜色引用语义令牌（accent / danger / bg / text），`[data-theme='dark']` 翻转语义层即生效
- **transition**：背景/边框/阴影/位移统一走 `--ai-chat-duration-fast`（0.12s），`prefers-reduced-motion` 时关闭过渡与下沉
- **样式为 scoped（抗宿主 reset）**：宿主若带未分层的 button 元素 reset（Tailwind preflight / modern-normalize 的 `border: 0` + `background: transparent`），会无条件压过 `@layer` 内的一切库样式——scoped 属性选择器凭特异性免疫这类击穿；宿主定制外观走下方 `--ai-chat-btn-*` 变量钩子，无需 `!important`

## API

### Props

| 属性名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| type | `'primary' \| 'secondary' \| 'danger'` | `'primary'` | 按钮类型 |
| native-type | `'button' \| 'submit' \| 'reset'` | `'button'` | 原生 button type；默认 `button` 以防表单内点击触发浏览器原生 submit 导致双提交，需要原生提交语义时显式传 `submit` |
| size | `'small' \| 'medium' \| 'large'` | `'medium'` | 按钮尺寸 |
| disabled | `boolean` | `false` | 是否禁用 |

### Events

| 事件名 | 参数 | 说明 |
|--------|------|------|
| click | `(event: Event)` | 按钮点击（原生事件透传） |

### Slots

| 插槽名 | 说明 |
|--------|------|
| default | 按钮内容 |

### CSS 变量

覆盖钩子仍保留：设置下列变量即可覆盖对应状态，不设置时回退到主题令牌（默认值列为回退的令牌及亮色取值）：

| 变量名 | 默认值（令牌回退） | 说明 |
|--------|--------|------|
| --ai-chat-btn-radius | `var(--ai-chat-radius-sm)`（6px） | 按钮圆角 |
| --ai-chat-btn-primary-bg | `var(--ai-chat-color-accent)`（#6366f1） | 主要按钮背景 |
| --ai-chat-btn-primary-color | `var(--ai-chat-color-text-on-accent)`（#ffffff） | 主要按钮文字 |
| --ai-chat-btn-primary-hover-bg | `var(--ai-chat-color-accent-600)`（#4f46e5） | 主要按钮悬停背景 |
| --ai-chat-btn-secondary-bg | `var(--ai-chat-color-bg-primary)`（亮 #ffffff / 暗 neutral-900） | 次要按钮背景 |
| --ai-chat-btn-secondary-color | `var(--ai-chat-color-text-primary)` | 次要按钮文字 |
| --ai-chat-btn-secondary-hover-bg | `var(--ai-chat-color-bg-secondary)` | 次要按钮悬停背景 |
| --ai-chat-btn-secondary-border | `var(--ai-chat-color-border)` | 次要按钮边框色（弹层选中态等宿主场景经此钩子着色） |
| --ai-chat-btn-danger-bg | `var(--ai-chat-color-danger-500)`（#ef4444） | 危险按钮背景 |
| --ai-chat-btn-danger-color | `var(--ai-chat-color-text-on-accent)`（#ffffff） | 危险按钮文字 |
| --ai-chat-btn-danger-hover-bg | `color-mix(danger-500 85%, neutral-950)` | 危险按钮悬停背景 |
