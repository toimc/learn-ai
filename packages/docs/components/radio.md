# Radio

单选基础件：原生 input 视觉隐藏（保留可访问性）+ 自绘圆环，`v-model` 持有组内选中值，选中即 emit 自身 `value`。

Input、Select、Radio、Button 是 `@toimc/vue` 的四个基础表单原语——构建表单与设置类界面的原子件。视觉语言对齐原子 CSS 体系的设计（subtle 边框、focus ring、统一控件高度、快速 transition），但全部以本库 `--ai-chat-*` 设计令牌实现，未引入任何原子 CSS 框架，暗色主题随语义令牌自动适配。

## 基础用法

<script setup lang="ts">
import { ref } from 'vue'
import { Radio } from '@toimc/vue'

const providerType = ref('openai-compat')
</script>

分组用法：多枚 Radio 绑定**同一个** `v-model`，各自传不同的 `value` 与相同的 `name`：

<DemoContainer>
  <div style="display: flex; flex-direction: column; gap: 12px">
    <div style="display: flex; gap: 24px; align-items: center">
      <Radio v-model="providerType" value="openai-compat" label="OpenAI 兼容" name="demo-provider-type" />
      <Radio v-model="providerType" value="anthropic" label="Anthropic" name="demo-provider-type" />
    </div>
    <span style="font-size: 13px; color: var(--ai-chat-color-text-secondary)">providerType = {{ providerType || '（空）' }}</span>
  </div>
</DemoContainer>

在宿主应用中（配合 `fieldset` / `legend` 提供分组语义）：

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { Radio } from '@toimc/vue'

const providerType = ref('openai-compat')
</script>

<template>
  <fieldset>
    <legend>服务类型</legend>
    <Radio v-model="providerType" value="openai-compat" label="OpenAI 兼容" name="provider-type" />
    <Radio v-model="providerType" value="anthropic" label="Anthropic" name="provider-type" />
  </fieldset>
</template>
```

## modelValue / value / name 的分工

| prop | 作用 |
|------|------|
| `v-model`（modelValue） | 组内当前选中值，多枚 Radio 绑定同一个 ref |
| `value` | 本枚选项的取值，选中时 emit 的载荷即它 |
| `name` | 透传原生 radio 的 name：同组多枚传相同值，浏览器据此用方向键在组内移动焦点 |

选中行为：change 时 emit `update:modelValue` 载荷为**自身 value** 的字符串；再点已选中的项不重复 emit（对齐原生 radio 行为）。

## 键盘可达

- 原生 `<input type="radio">` 仅视觉隐藏（1px 裁剪），**保留 Tab 聚焦与读屏语义**，不是 `display: none`
- 键盘聚焦（`:focus-visible`）时 ring 落在**相邻的自绘圆环**上：accent 边框 + `--ai-chat-control-ring`（3px 低透明度阴影）
- 同组传相同 `name` 后，方向键在组内切换选项（原生行为，零 JS）

用 Tab 移入、方向键切换试试：

<DemoContainer>
  <div style="display: flex; gap: 24px; align-items: center">
    <Radio v-model="providerType" value="openai-compat" label="OpenAI 兼容" name="demo-provider-type" />
    <Radio v-model="providerType" value="anthropic" label="Anthropic" name="demo-provider-type" />
  </div>
</DemoContainer>

## 无 label 与禁用

不传 `label` 时只渲染圆环（可配合外部文本布局）；`disabled` 降低整枚透明度且 change 不更新 `v-model`：

<DemoContainer>
  <div style="display: flex; gap: 24px; align-items: center">
    <Radio v-model="providerType" value="openai-compat" name="demo-provider-type" />
    <span style="font-size: 13px; color: var(--ai-chat-color-text-secondary)">← 无 label</span>
    <Radio v-model="providerType" value="anthropic" label="禁用项" name="demo-provider-type" disabled />
  </div>
</DemoContainer>

## 视觉要点

- **选中态**：圆环边框变 accent，内部 8px 实心 accent 圆点以 `scale` 过渡弹出
- **focus ring**：落在自绘圆环上（accent 边框 + `--ai-chat-control-ring`），与 [Input](/components/input)、[Button](/components/button) 的聚焦语言一致
- **暗色自动适配**：圆环/圆点/文字全部引用语义令牌，`[data-theme='dark']` 翻转语义层即生效
- **样式为 scoped（抗宿主 reset）**：宿主未分层表单元素 reset（Tailwind preflight / modern-normalize 的 `border: 0` + `padding: 0`）会压过 `@layer` 内的库样式，scoped 属性选择器凭特异性免疫
- **transition**：边框/阴影/圆点缩放统一走 `--ai-chat-duration-fast`（0.12s），`prefers-reduced-motion` 时关闭

## API

### Props

| 属性名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| v-model | `string` | `''` | 组内当前选中值（等于某枚的 value 即选中） |
| value | `string` | **必填** | 本枚选项的取值，选中时 emit 的载荷 |
| label | `string` | — | 右侧文本，不传则只渲染圆环 |
| disabled | `boolean` | `false` | 禁用（change 不更新 v-model） |
| name | `string` | — | 透传原生 radio name，同组传相同值以支持方向键导航 |

### Events

| 事件名 | 参数 | 说明 |
|--------|------|------|
| update:modelValue | `(value: string)` | 选中时发出，载荷为自身 `value`；再点已选项不重复发出 |
