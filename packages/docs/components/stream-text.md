# StreamText

流式文本组件，在文本末尾显示闪烁光标。当 `stream` 有值时显示光标，为 `undefined` 时隐藏。

## 基础用法

<script setup>
import { ref } from 'vue'

const streamingText = ref('正在思考中...')
</script>

<DemoContainer>
  <div>
    <StreamText :stream="streamingText" />
    <div style="margin-top: 12px; display: flex; gap: 8px">
      <Button size="small" @click="streamingText += ' AI 是一项伟大的技术。'">追加文本</Button>
      <Button size="small" type="secondary" @click="streamingText = undefined">结束流</Button>
    </div>
  </div>
</DemoContainer>

## API

### Props

| 属性名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| stream | `string` | `undefined` | 流式文本内容，`undefined` 时隐藏光标 |
