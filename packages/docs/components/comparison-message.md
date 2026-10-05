# ComparisonMessage 对比组件

A/B 偏好对比组件：左右双列并排展示两个候选回复，每列底部各一个「我更喜欢这个回复」按钮，用于收集用户偏好（如 RLHF 偏好数据）。窄屏（< 640px）自动堆叠为上下排列。

## 代码演示

<script setup lang="ts">
import { ref } from 'vue'
import { ComparisonMessage } from '@toimc/vue'

interface PreferPayload {
  chosen: 'A' | 'B'
  left: string
  right: string
}

const lastChoice = ref('（尚未选择）')

function onPrefer(p: PreferPayload) {
  lastChoice.value = p.chosen
}

const chosen = ref<'A' | 'B' | null>(null)
</script>

### 点击选择

点击任一列骑在底边上的按钮即可选中并高亮该列，`prefer` 事件回传 `{ chosen, left, right }`：

<DemoContainer>
  <div style="display: flex; flex-direction: column; gap: 8px">
    <ComparisonMessage
      left="**回复 A**：一律用 ref，心智模型统一，访问走 .value，解构与整体替换都安全。"
      right="**回复 B**：按场景分工——composable 对外返回 ref，组件内聚合状态用 reactive 减少样板。"
      @prefer="onPrefer"
    />
    <p
      style="
        margin: 0;
        font-size: 12px;
        color: var(--ai-chat-color-text-muted);
      "
    >
      当前偏好：{{ lastChoice }}
    </p>
  </div>
</DemoContainer>

### 受控选中

`chosen` 非 `null` 时高亮由父组件控制（如回放历史偏好数据）；外部按钮可随时切换或清除：

<DemoContainer>
  <div style="display: flex; flex-direction: column; gap: 12px">
    <div style="display: flex; gap: 8px; align-items: center">
      <button
        style="
          padding: 4px 12px;
          font-size: 13px;
          border: 1px solid var(--vp-c-divider);
          border-radius: 6px;
          background: var(--vp-c-bg);
          cursor: pointer;
        "
        @click="chosen = 'A'"
      >
        选中 A
      </button>
      <button
        style="
          padding: 4px 12px;
          font-size: 13px;
          border: 1px solid var(--vp-c-divider);
          border-radius: 6px;
          background: var(--vp-c-bg);
          cursor: pointer;
        "
        @click="chosen = 'B'"
      >
        选中 B
      </button>
      <button
        style="
          padding: 4px 12px;
          font-size: 13px;
          border: 1px solid var(--vp-c-divider);
          border-radius: 6px;
          background: var(--vp-c-bg);
          cursor: pointer;
        "
        @click="chosen = null"
      >
        清除
      </button>
      <span style="font-size: 12px; color: var(--ai-chat-color-text-muted)">
        chosen = {{ chosen === null ? 'null' : `'${chosen}'` }}
      </span>
    </div>
    <ComparisonMessage
      left="**回复 A**：先写实现再补测试，快速验证方向。"
      right="**回复 B**：先写测试锁定行为，再动手实现。"
      :chosen="chosen"
      button-label="喜欢这个"
    />
  </div>
</DemoContainer>

列内容经 `MessageContent` 走 markdown-it 渲染，支持代码高亮、公式等；按钮在消息卡下边界正中、主题色圆角，文案可经 `buttonLabel` 配置（默认「喜欢这个」）。

## 消息类型驱动渲染

服务端响应可直接在 `Message` 上携带 `comparison` 载荷（`ComparisonPayload`），宿主按消息类型决定渲染 `ComparisonMessage` 还是普通消息；用户选中后把选中内容固化回 `content`、清空 `comparison`，状态随消息持久（切换会话再回来依然保留）：

```vue
<template>
  <Message v-for="msg in chat.messages" :key="msg.id" :from="msg.role">
    <ComparisonMessage
      v-if="msg.comparison"
      :left="msg.comparison.left"
      :right="msg.comparison.right"
      :left-label="msg.comparison.leftLabel"
      :right-label="msg.comparison.rightLabel"
      @prefer="(p) => onPrefer(msg, p)"
    />
    <MessageContent v-else :content="msg.content" />
  </Message>
</template>

<script setup lang="ts">
function onPrefer(
  msg: Message,
  p: { chosen: 'A' | 'B'; left: string; right: string },
) {
  msg.content = p.chosen === 'A' ? p.left : p.right
  msg.comparison = undefined
}
</script>
```

## API

### Props

| 属性名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| left | `string` | — | 候选 A 内容（markdown，必填） |
| right | `string` | — | 候选 B 内容（markdown，必填） |
| leftLabel | `string` | `'回复 A'` | 左列标题 |
| rightLabel | `string` | `'回复 B'` | 右列标题 |
| chosen | `'A' \| 'B' \| null` | `null` | 受控选中；非 `null` 时高亮由父控制 |
| buttonLabel | `string` | `'喜欢这个'` | 底部按钮文案 |
| stackOnMobile | `boolean` | `true` | 窄屏（< 640px）堆叠为上下 |
| disabled | `boolean` | `false` | 禁用选择 |

### Events

| 事件名 | 载荷 | 说明 |
|--------|------|------|
| prefer | `{ chosen: 'A' \| 'B'; left: string; right: string }` | 点击任一列按钮时触发 |

### Slots

| 插槽名 | 作用域 | 说明 |
|--------|--------|------|
| left | `{ label: string }` | 自定义左列内容（覆盖 `left`） |
| right | `{ label: string }` | 自定义右列内容（覆盖 `right`） |
| action-left | — | 自定义左列底部按钮 |
| action-right | — | 自定义右列底部按钮 |

> 列内容默认经 `MessageContent` 渲染为 markdown（支持代码高亮、公式等，与消息流一致）。`Message.comparison` 为可选字段（渐进增强），不携带时组件库行为不变，后端无关。
