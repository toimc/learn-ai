<script setup lang="ts">
import { ref, computed } from 'vue'
import type { Message as ChatMessage } from '@toimc/core'
import { generateId } from '@toimc/core'
import {
  Message,
  MessageContent,
  MessageActions,
  MessageAction,
  ComparisonMessage,
  aiChatI18n,
} from '@toimc/vue'
import { comparisonMock } from '../../mock/mock-comparison'
import '../../locales' // 副作用：合并 pg 字典

const { t } = aiChatI18n.global

// 交互演示：消息流中携带 comparison 载荷的消息 → 选中后原地固化
// 与 Playground 行为一致：状态存于消息对象本身，不依赖外部标志位
const messages = ref<ChatMessage[]>([
  {
    id: generateId(),
    role: 'user',
    content: comparisonMock.question,
    createdAt: new Date(),
  },
  {
    id: generateId(),
    role: 'assistant',
    content: '',
    comparison: {
      left: comparisonMock.left,
      right: comparisonMock.right,
      leftLabel: comparisonMock.leftLabel,
      rightLabel: comparisonMock.rightLabel,
    },
    createdAt: new Date(),
  },
])

const pendingComparison = computed(() =>
  messages.value.find((m) => m.comparison),
)

function onPrefer(
  msg: ChatMessage,
  p: { chosen: 'A' | 'B'; left: string; right: string },
) {
  msg.content = p.chosen === 'A' ? p.left : p.right
  msg.comparison = undefined
}

function reset() {
  messages.value = [
    {
      id: generateId(),
      role: 'user',
      content: comparisonMock.question,
      createdAt: new Date(),
    },
    {
      id: generateId(),
      role: 'assistant',
      content: '',
      comparison: {
        left: comparisonMock.left,
        right: comparisonMock.right,
        leftLabel: comparisonMock.leftLabel,
        rightLabel: comparisonMock.rightLabel,
      },
      createdAt: new Date(),
    },
  ]
}
</script>

<template>
  <div class="comparison-flow-demo">
    <div class="comparison-flow-demo__toolbar">
      <span v-if="pendingComparison" class="comparison-flow-demo__hint">
        assistant 消息携带 comparison 载荷 → 渲染对比卡，点「{{
          t('comparison.buttonLabel')
        }}」试试
      </span>
      <span v-else class="comparison-flow-demo__hint">
        已固化：content = 选中内容，comparison 已清除（变为普通 AI 消息）
      </span>
      <button
        v-if="!pendingComparison"
        class="comparison-flow-demo__btn"
        @click="reset"
      >
        重置演示
      </button>
    </div>

    <Message v-for="msg in messages" :key="msg.id" :from="msg.role">
      <ComparisonMessage
        v-if="msg.comparison"
        :left="msg.comparison.left"
        :right="msg.comparison.right"
        :left-label="msg.comparison.leftLabel"
        :right-label="msg.comparison.rightLabel"
        @prefer="(p) => onPrefer(msg, p)"
      />

      <template v-else>
        <MessageContent
          v-if="msg.role === 'assistant'"
          :content="msg.content"
        />
        <MessageContent v-else>{{ msg.content }}</MessageContent>

        <MessageActions v-if="msg.role === 'assistant'">
          <MessageAction :title="t('pg.actions.copy')">
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path
                d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"
              />
            </svg>
          </MessageAction>
        </MessageActions>
      </template>
    </Message>
  </div>
</template>

<style scoped>
.comparison-flow-demo__toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.comparison-flow-demo__hint {
  font-size: 12.5px;
  color: var(--vp-c-text-3);
}

.comparison-flow-demo__btn {
  padding: 4px 12px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  background: transparent;
  color: var(--vp-c-text-2);
  font-size: 12.5px;
  cursor: pointer;
  transition:
    color 0.2s,
    border-color 0.2s;
}

.comparison-flow-demo__btn:hover {
  color: var(--vp-c-text-1);
  border-color: var(--vp-c-text-3);
}
</style>
