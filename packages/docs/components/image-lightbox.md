# ImageLightbox

内置图片大图预览（灯箱）组件，Teleport 到 `body` 全屏遮罩展示附件图片。支持左右方向键/按钮切换多图（首尾回绕）、Esc 或点击遮罩/关闭按钮退出，层级由 `--ai-chat-z-popup` 令牌控制。

## 代码演示

<script setup lang="ts">
import { ref } from 'vue'
import type { Attachment } from '@toimc/core'
import { ImageLightbox } from '@toimc/vue'

// 缩略图用内联 SVG data URI，离线可见
function svgThumb(bg: string, label: string) {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='96' height='96'><rect width='96' height='96' rx='10' fill='${bg}'/><text x='48' y='42' font-size='12' fill='white' text-anchor='middle' font-family='sans-serif'>ai-chat-ui</text><text x='48' y='60' font-size='10' fill='white' text-anchor='middle' font-family='sans-serif'>${label}</text></svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

const images: Attachment[] = [
  { id: 'a1', url: svgThumb('%236366f1', '架构图'), name: 'architecture.png', mediaType: 'image/png' },
  { id: 'a2', url: svgThumb('%238b5cf6', '令牌表'), name: 'theme-tokens.png', mediaType: 'image/png' },
  { id: 'a3', url: svgThumb('%230891b2', '流程图'), name: 'flow.png', mediaType: 'image/png' },
]

const visible = ref(false)
const currentIndex = ref(0)

function open(i: number) {
  currentIndex.value = i
  visible.value = true
}
</script>

点击任一缩略图打开灯箱（从该图开始），方向键 / 左右按钮切换（首尾回绕），Esc 或点击遮罩空白处退出：

<DemoContainer>
  <div style="display: flex; gap: 12px; flex-wrap: wrap">
    <button
      v-for="(img, i) in images"
      :key="img.id"
      style="
        padding: 0;
        border: none;
        background: none;
        cursor: zoom-in;
        border-radius: 10px;
      "
      :aria-label="`查看 ${img.name}`"
      @click="open(i)"
    >
      <img
        :src="img.url"
        :alt="img.name"
        style="width: 96px; height: 96px; border-radius: 10px; display: block"
      />
    </button>
  </div>
  <ImageLightbox
    v-if="visible"
    :attachments="images"
    :index="currentIndex"
    @close="visible = false"
  />
</DemoContainer>

## 基础用法

`attachments` 传入图片附件数组，`index` 指定初始展示的下标，`@close` 中清理 `v-if` 状态：

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { ImageLightbox } from '@toimc/vue'
import type { Attachment } from '@toimc/core'

const visible = ref(false)
const previewIndex = ref(0)
const images: Attachment[] = [
  { id: 'a1', url: '/cat.png', name: '猫.png', mediaType: 'image/png' },
  { id: 'a2', url: '/dog.png', name: '狗.png', mediaType: 'image/png' },
]
</script>

<template>
  <img :src="images[0].url" alt="" @click="visible = true">
  <ImageLightbox
    v-if="visible"
    :attachments="images"
    :index="previewIndex"
    @close="visible = false"
  />
</template>
```

## 键盘与交互

| 操作 | 行为 |
|------|------|
| `Esc` | 触发 `close` 事件 |
| `→` / 右侧按钮 | 下一张，末尾回绕到第一张 |
| `←` / 左侧按钮 | 上一张，开头回绕到最后一张 |
| 点击遮罩空白处 / 右上角关闭按钮 | 触发 `close` 事件 |

## 无障碍

- 遮罩使用 `role="dialog"` + `aria-modal="true"`，导航与关闭按钮带 `aria-label`
- 打开时焦点移入遮罩（`tabindex="-1"`），关闭/卸载时焦点归还给打开前的元素
- 键盘监听做防御：已 prevented、输入法组合中、或带 Meta/Ctrl/Alt 修饰键的按键不触发翻页/关闭，方向键会 `preventDefault` 避免页面滚动
- 进场动画遵守 `prefers-reduced-motion`，用户开启「减弱动态效果」时跳过动画

## API

### Props

| 属性名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| attachments | `Attachment[]` | — | 图片附件数组（必填），渲染取 `url` 为 `src`、`name` 为 `alt` |
| index | `number` | `0` | 初始展示的附件下标；变化时当前展示跟随更新 |

### Events

| 事件名 | 参数 | 说明 |
|--------|------|------|
| close | — | Esc、点击遮罩空白处或关闭按钮时触发，父组件据此清理 `v-if` 状态 |

### CSS 变量

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| --ai-chat-z-popup | `1000` | 弹层层级（原始·尺寸令牌），与宿主弹层协调时覆盖 |
| --ai-chat-lightbox-mask | `rgba(0, 0, 0, 0.75)` | 遮罩背景色，可用中性黑遮罩变量覆盖 |
