# Toast

轻量提示组件，fixed 定位悬浮于视口，用于操作反馈、错误提示等短暂通知。默认顶部居中弹出，可通过 `placement` 配置为上/下居中或四角；到时自动关闭，`duration` 设为 `0` 则常驻，由宿主控制关闭时机。

## 代码演示

用 `v-if` 控制显示，在 `@close` 中清理状态（自动关闭时组件会发出 `close` 事件）：

<script setup lang="ts">
import { ref } from 'vue'

const basicVisible = ref(false)

type ToastType = 'info' | 'success' | 'error' | 'warning'
const typeVisible = ref(false)
const currentType = ref<ToastType>('info')
const typeMessage = ref('')

function showToast(type: ToastType) {
  const messages: Record<ToastType, string> = {
    info: '这是一条信息提示',
    success: '消息已复制到剪贴板',
    error: '发送失败，请稍后重试',
    warning: '内容超过最大长度限制',
  }
  currentType.value = type
  typeMessage.value = messages[type]
  typeVisible.value = true
}

type ToastPlacement =
  | 'top'
  | 'top-left'
  | 'top-right'
  | 'bottom'
  | 'bottom-left'
  | 'bottom-right'
const placementVisible = ref(false)
const currentPlacement = ref<ToastPlacement>('top')

function showPlacementToast(placement: ToastPlacement) {
  currentPlacement.value = placement
  placementVisible.value = true
}
</script>

### 基础显示

点击按钮弹出，3 秒后自动关闭（`@close` 清理 `v-if` 状态）：

<DemoContainer>
  <div>
    <Button size="small" @click="basicVisible = true">显示 Toast</Button>
    <Toast v-if="basicVisible" message="消息已复制到剪贴板" @close="basicVisible = false" />
  </div>
</DemoContainer>

### Info 信息提示

中性配色，适合与错误无关的状态告知（如「已切换模型」）：

<DemoContainer>
  <Button size="small" @click="showToast('info')">Info</Button>
  <Toast v-if="typeVisible && currentType === 'info'" :message="typeMessage" type="info" @close="typeVisible = false" />
</DemoContainer>

### Success 操作成功

success 配色，适合复制、保存、发送等操作的正向反馈：

<DemoContainer>
  <Button size="small" @click="showToast('success')">Success</Button>
  <Toast v-if="typeVisible && currentType === 'success'" :message="typeMessage" type="success" @close="typeVisible = false" />
</DemoContainer>

### Error 操作失败

error 配色且 `role="alert"` 立即播报，适合失败提示引导重试：

<DemoContainer>
  <Button size="small" @click="showToast('error')">Error</Button>
  <Toast v-if="typeVisible && currentType === 'error'" :message="typeMessage" type="error" @close="typeVisible = false" />
</DemoContainer>

### Warning 风险提醒

warning 配色，适合越限、不可逆操作前的提醒：

<DemoContainer>
  <Button size="small" @click="showToast('warning')">Warning</Button>
  <Toast v-if="typeVisible && currentType === 'warning'" :message="typeMessage" type="warning" @close="typeVisible = false" />
</DemoContainer>

### 弹出位置

`placement` 控制弹出位置，默认 `top`（顶部居中）；下方位置从下往上入场，四角紧贴对应角落（16px 边距）：

<DemoContainer>
  <div style="display: flex; gap: 8px; flex-wrap: wrap">
    <Button size="small" @click="showPlacementToast('top')">top</Button>
    <Button size="small" @click="showPlacementToast('top-left')">top-left</Button>
    <Button size="small" @click="showPlacementToast('top-right')">top-right</Button>
    <Button size="small" @click="showPlacementToast('bottom')">bottom</Button>
    <Button size="small" @click="showPlacementToast('bottom-left')">bottom-left</Button>
    <Button size="small" @click="showPlacementToast('bottom-right')">bottom-right</Button>
  </div>
  <Toast
    v-if="placementVisible"
    :message="`从 ${currentPlacement} 位置弹出`"
    :placement="currentPlacement"
    @close="placementVisible = false"
  />
</DemoContainer>

## 在宿主应用中使用

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { Toast } from '@toimc/vue'

const visible = ref(false)
</script>

<template>
  <Button @click="visible = true">复制</Button>
  <Toast v-if="visible" message="消息已复制到剪贴板" @close="visible = false" />
</template>
```

```vue
<!-- 右下角弹出，类似系统通知 -->
<Toast v-if="visible" message="下载已完成" placement="bottom-right" @close="visible = false" />
```

## 自动关闭时长

`duration` 控制自动关闭的延时（毫秒），默认 `3000`（3 秒）；设为 `0` 时不自动关闭，需宿主在合适的时机（如用户确认后）移除组件：

```vue
<!-- 5 秒后自动关闭 -->
<Toast v-if="visible" message="已保存草稿" :duration="5000" @close="visible = false" />

<!-- 常驻，需宿主手动关闭 -->
<Toast v-if="visible" message="会话即将过期" :duration="0" @close="visible = false" />
```

## 无障碍

- `type="error"` 时组件使用 `role="alert"`，屏幕阅读器会立即播报；其余类型使用 `role="status"`，作为礼貌性状态更新播报
- 进场动画遵守 `prefers-reduced-motion`，用户开启「减弱动态效果」时跳过动画

## API

### Props

| 属性名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| message | `string` | — | 提示内容（必填） |
| type | `'info' \| 'success' \| 'error' \| 'warning'` | `'info'` | 提示类型 |
| duration | `number` | `3000` | 自动关闭延时（ms），`0` 表示不自动关闭 |
| placement | `'top' \| 'top-left' \| 'top-right' \| 'bottom' \| 'bottom-left' \| 'bottom-right'` | `'top'` | 弹出位置 |

### Events

| 事件名 | 参数 | 说明 |
|--------|------|------|
| close | — | Toast 关闭时触发（自动到时或宿主移除时），父组件据此清理 `v-if` 状态 |

### CSS 变量

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| --ai-chat-z-toast | `1000` | Toast 层级（布局令牌），避免与宿主弹层打架 |
