<script setup lang="ts">
import { computed } from 'vue'
import { useMarkdownRenderer } from '../composables/useMarkdownRenderer'
import ThinkingBlock from '../thinking/ThinkingBlock.vue'
import type { ThinkingInfo } from '@ai-chat/core'

const props = defineProps<{
  content?: string
  thinking?: ThinkingInfo
  streaming?: boolean
}>()

const renderer = useMarkdownRenderer()

// 计算思考内容的props
const thinkingProps = computed(() => {
  if (!props.thinking) return undefined

  return {
    content: props.thinking.content,
    duration: props.thinking.duration,
    showDuration: true,
    streaming: props.streaming,
  }
})
</script>

<template>
  <div class="ai-chat-message-content">
    <!-- 思考过程展示 -->
    <ThinkingBlock v-if="thinkingProps" v-bind="thinkingProps" />

    <!-- 消息内容 -->
    <component
      :is="renderer"
      v-if="renderer && props.content !== undefined"
      :content="props.content"
      :streaming="props.streaming"
    />
    <slot v-else />
  </div>
</template>

<style>
@layer ai-chat-components {
  .ai-chat-message-content {
    font-size: 15px;
    line-height: 1.7;
    color: var(--ai-chat-color-text-primary);
    word-wrap: break-word;
  }

  .ai-chat-message-content p {
    margin-bottom: 12px;
  }

  .ai-chat-message-content p:last-child {
    margin-bottom: 0;
  }

  .ai-chat-message-content code {
    background: var(--ai-chat-color-code-inline-bg);
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 13.5px;
    font-family: var(--ai-chat-font-mono);
  }

  .ai-chat-message-content pre {
    background: var(--ai-chat-color-code-bg);
    border-radius: 10px;
    padding: 16px 20px;
    margin: 12px 0;
    overflow-x: auto;
    border: 1px solid var(--ai-chat-color-border);
  }

  .ai-chat-message-content pre code {
    background: none;
    padding: 0;
    font-size: 13px;
    line-height: 1.6;
  }

  .ai-chat-message-content ul,
  .ai-chat-message-content ol {
    padding-left: 20px;
    margin: 8px 0;
  }

  .ai-chat-message-content li {
    margin: 4px 0;
  }

  .ai-chat-message-content strong {
    font-weight: 600;
  }
}
</style>
