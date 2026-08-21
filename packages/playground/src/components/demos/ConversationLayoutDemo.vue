<script setup lang="ts">
import { ref } from 'vue'
import {
  Conversation,
  ConversationContent,
  Message,
  MessageContent,
} from '@toimc/vue'

// 交互演示：stacked（统一靠左）vs im（用户与 AI 分列两侧）+ 用户消息停靠侧
const layout = ref<'stacked' | 'im'>('stacked')
const messageAlign = ref<'left' | 'right'>('right')

const demoMessages = [
  {
    id: '1',
    role: 'user' as const,
    content: '给我一句话解释什么是 Monorepo',
  },
  {
    id: '2',
    role: 'assistant' as const,
    content:
      'Monorepo 是把多个包放进同一个代码仓库管理的工程模式，配合 pnpm workspace 可以共享依赖与构建脚本。',
  },
  {
    id: '3',
    role: 'user' as const,
    content: '它和 Multirepo 的核心区别是什么？',
  },
  {
    id: '4',
    role: 'assistant' as const,
    content:
      '核心区别在于**变更半径**：Monorepo 一次提交可以同时改动多个包并统一版本发布；Multirepo 则需要跨仓库协调，依赖版本容易漂移。',
  },
]
</script>

<template>
  <div class="conv-layout-demo">
    <div class="conv-layout-demo__toolbar">
      <div class="conv-layout-demo__group">
        <button
          v-for="mode in ['stacked', 'im'] as const"
          :key="mode"
          class="conv-layout-demo__btn"
          :class="{ active: layout === mode }"
          @click="layout = mode"
        >
          {{ mode === 'stacked' ? 'stacked（统一靠左）' : 'im（分列两侧）' }}
        </button>
      </div>
      <div v-if="layout === 'im'" class="conv-layout-demo__group">
        <button
          v-for="side in ['left', 'right'] as const"
          :key="side"
          class="conv-layout-demo__btn"
          :class="{ active: messageAlign === side }"
          @click="messageAlign = side"
        >
          用户消息靠{{ side === 'left' ? '左' : '右' }}
        </button>
      </div>
    </div>

    <div class="conv-layout-demo__stage">
      <Conversation :layout="layout" :message-align="messageAlign">
        <ConversationContent>
          <Message v-for="msg in demoMessages" :key="msg.id" :from="msg.role">
            <MessageContent
              :content="msg.role === 'assistant' ? msg.content : undefined"
            >
              <template v-if="msg.role !== 'assistant'">{{
                msg.content
              }}</template>
            </MessageContent>
          </Message>
        </ConversationContent>
      </Conversation>
    </div>
  </div>
</template>

<style scoped>
.conv-layout-demo__toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 16px;
}

.conv-layout-demo__group {
  display: inline-flex;
  padding: 3px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  gap: 2px;
}

.conv-layout-demo__btn {
  padding: 5px 12px;
  border: none;
  border-radius: 6px;
  background: transparent;
  font-size: 13px;
  color: var(--vp-c-text-2);
  cursor: pointer;
  transition:
    background-color 0.2s,
    color 0.2s;
}

.conv-layout-demo__btn:hover {
  color: var(--vp-c-text-1);
}

.conv-layout-demo__btn.active {
  background: var(--vp-c-brand-soft);
  color: var(--vp-c-brand-1);
  font-weight: 500;
}

.conv-layout-demo__stage {
  height: 380px;
  overflow: hidden;
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
}
</style>
