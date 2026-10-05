# StreamText

流式文本组件，在文本末尾显示呼吸光标（柔和 opacity 渐变，替代硬闪烁，与 MarkdownRenderer 流式光标同一节奏）。当 `stream` 有值时显示光标，为 `undefined` 时隐藏。

## 代码演示

<script setup lang="ts">
import { onUnmounted, ref } from 'vue'
import { Button, StreamText } from '@toimc/vue'

const FULL_TEXT = '流式输出时每个 chunk 到达即触发重渲染，StreamText 在文本末尾挂上呼吸光标，完成后置 undefined 收起。'

const streamText = ref<string | undefined>(undefined)
const typing = ref(false)
let timer: ReturnType<typeof setInterval> | undefined
let endTimer: ReturnType<typeof setTimeout> | undefined

function cleanup() {
  if (timer) clearInterval(timer)
  if (endTimer) clearTimeout(endTimer)
  timer = undefined
  endTimer = undefined
}

function replay() {
  cleanup()
  typing.value = true
  streamText.value = ''
  let i = 0
  timer = setInterval(() => {
    i++
    streamText.value = FULL_TEXT.slice(0, i)
    if (i >= FULL_TEXT.length) {
      cleanup()
      // 停留片刻后结束流：stream 置 undefined，文本保留、光标收起
      endTimer = setTimeout(() => {
        streamText.value = undefined
        typing.value = false
      }, 800)
    }
  }, 40)
}

onUnmounted(cleanup)
</script>

点击重放，观察逐字输出与末尾呼吸光标；输出结束时光标收起：

<DemoContainer>
  <StreamText :stream="streamText" />
  <div style="margin-top: 12px">
    <Button size="small" :disabled="typing" @click="replay">
      {{ typing ? '输出中...' : '重放流式输出' }}
    </Button>
  </div>
</DemoContainer>

## API

### Props

| 属性名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| stream | `string` | `undefined` | 流式文本内容，`undefined` 时隐藏光标 |
