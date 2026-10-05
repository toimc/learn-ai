# Shimmer

微光扫过动画组件，常用于等待态或加载占位。

## 代码演示

<script setup lang="ts">
import { ref } from 'vue'
import { Button, Shimmer } from '@toimc/vue'

const loading = ref(true)
</script>

切换加载态，观察占位文本的微光动画；加载完成后占位被真实内容替换：

<DemoContainer>
  <div style="display: flex; flex-direction: column; gap: 8px">
    <template v-if="loading">
      <Shimmer as="div" style="height: 16px; width: 60%">正在思考...</Shimmer>
      <Shimmer as="div" style="height: 16px; width: 80%">加载中</Shimmer>
    </template>
    <p v-else style="margin: 0; font-size: 14px">
      回复已就绪：Shimmer 在等待态给用户「正在工作」的感知，替代空白。
    </p>
  </div>
  <div style="margin-top: 12px">
    <Button type="secondary" size="small" @click="loading = !loading">
      {{ loading ? '模拟加载完成' : '回到加载态' }}
    </Button>
  </div>
</DemoContainer>

### 慢速扫光

`duration` 控制单次扫光周期（毫秒，默认 `2000`），适合长耗时操作，用更慢的节奏降低等待焦躁感：

<DemoContainer>
  <Shimmer as="div" :duration="3500" style="height: 16px; width: 70%">
    检索知识库中（慢速扫光 3.5s）...
  </Shimmer>
</DemoContainer>

## 基础用法

```vue
<Shimmer as="div" style="height: 16px; width: 60%">正在思考...</Shimmer>
```

## API

### Props

| 属性名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| as | `string` | `'span'` | 渲染的 HTML 标签名 |
| duration | `number` | `2000` | 单次扫光动画周期（ms） |

### Slots

| 插槽名 | 说明 |
|--------|------|
| default | 占位内容（加载完成后被真实内容替换的那段文本） |

### CSS 变量

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| --ai-chat-color-accent | `#6366f1` | 微光渐变色 |
