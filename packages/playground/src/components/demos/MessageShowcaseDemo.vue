<script setup lang="ts">
import {
  Message,
  MessageContent,
  MessageActions,
  MessageAction,
  aiChatI18n,
} from '@ai-chat/vue'
import '../../locales' // 副作用：合并 pg 字典

const { t } = aiChatI18n.global

// 演示数据：三种角色 + 携带思考过程的 assistant 消息
const messages = [
  {
    id: '1',
    role: 'user' as const,
    content: '用一句话说明 Composition API 解决了什么问题',
    thinking: undefined,
  },
  {
    id: '2',
    role: 'assistant' as const,
    content:
      'Composition API 让逻辑按**功能**聚合而不是按选项类型分散，解决了大型组件中相关代码被 data/methods/computed 切碎、难以复用的问题。',
    thinking: {
      content:
        '用户要一句话解释，需要压缩到核心痛点：\n\n- Options API 按选项类型组织，同一功能的代码分散多处\n- 跨组件复用只能靠 mixin，命名冲突难追溯\n\n一句话要同时点到「逻辑聚合」和「复用」。',
      duration: 4210,
      startTime: new Date('2026-01-01T00:00:00Z'),
    },
  },
  {
    id: '3',
    role: 'system' as const,
    content: '已切换到简洁回答模式：优先给结论，必要时补充示例。',
    thinking: undefined,
  },
]
</script>

<template>
  <div class="msg-showcase">
    <Message v-for="msg in messages" :key="msg.id" :from="msg.role">
      <MessageContent
        :content="msg.role === 'assistant' ? msg.content : undefined"
        :thinking="msg.thinking"
      >
        <template v-if="msg.role !== 'assistant'">{{ msg.content }}</template>
      </MessageContent>

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
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
        </MessageAction>
        <MessageAction :title="t('pg.actions.regenerate')">
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
            <polyline points="23 4 23 10 17 10" />
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
          </svg>
        </MessageAction>
      </MessageActions>
    </Message>
  </div>
</template>

<style scoped>
.msg-showcase {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
</style>
