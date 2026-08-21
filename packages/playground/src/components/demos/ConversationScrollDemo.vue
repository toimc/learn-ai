<script setup lang="ts">
import { ref, nextTick } from 'vue'
import {
  Conversation,
  ConversationContent,
  ConversationScrollBtn,
  Message,
  MessageContent,
} from '@toimc/vue'

// 交互演示：长列表滚动 + isAtBottom 检测 + ConversationScrollBtn 回到底部
const scrollRef = ref<HTMLElement>()
const isAtBottom = ref(true)

const longMessages = Array.from({ length: 18 }, (_, i) => ({
  id: `m${i}`,
  role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
  content:
    i % 2 === 0
      ? `第 ${i + 1} 条：Vue 3 组合式函数的最佳实践 ${i === 0 ? '（向上滚动后，右下角会出现回到底部按钮）' : ''}`
      : `第 ${i + 1} 条回复：组合式函数以 use 开头，输入响应式数据、输出响应式结果，且不依赖组件实例，可在 setup 外独立测试。`,
}))

function handleScroll() {
  const el = scrollRef.value
  if (!el) return
  isAtBottom.value = el.scrollHeight - el.scrollTop - el.clientHeight < 50
}

function scrollToBottom() {
  nextTick(() => {
    if (scrollRef.value) {
      scrollRef.value.scrollTop = scrollRef.value.scrollHeight
      isAtBottom.value = true
    }
  })
}
</script>

<template>
  <div class="conv-scroll-demo">
    <Conversation>
      <ConversationContent ref="scrollRef" @scroll="handleScroll">
        <Message v-for="msg in longMessages" :key="msg.id" :from="msg.role">
          <MessageContent
            :content="msg.role === 'assistant' ? msg.content : undefined"
          >
            <template v-if="msg.role !== 'assistant'">{{
              msg.content
            }}</template>
          </MessageContent>
        </Message>
      </ConversationContent>

      <ConversationScrollBtn v-if="!isAtBottom" @click="scrollToBottom" />
    </Conversation>
  </div>
</template>

<style scoped>
.conv-scroll-demo {
  height: 400px;
  overflow: hidden;
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
}
</style>
