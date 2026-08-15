<script setup lang="ts">
import { provide, computed } from 'vue'
import { useMessageLayout } from '../composables/layout-types'

const props = defineProps<{
  from: 'user' | 'assistant' | 'system'
}>()

provide('messageFrom', props.from)

const layoutCtx = useMessageLayout()

const layoutClass = computed<string[]>(() => {
  const ctx = layoutCtx?.value
  if (!ctx || ctx.layout === 'stacked') {
    return ['ai-chat-message--layout-stacked']
  }
  return [
    'ai-chat-message--layout-im',
    `ai-chat-message--user-side-${ctx.messageAlign}`,
  ]
})
</script>

<template>
  <div
    class="ai-chat-message ai-chat-animate-fade-in-up"
    :class="[`ai-chat-message--${from}`, ...layoutClass]"
  >
    <div class="ai-chat-message__avatar">
      <slot name="avatar">
        <div v-if="from === 'user'" class="ai-chat-avatar ai-chat-avatar--user">
          <slot name="avatar-text">U</slot>
        </div>
        <div v-else class="ai-chat-avatar ai-chat-avatar--assistant">
          <slot name="avatar-icon">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
          </slot>
        </div>
      </slot>
    </div>
    <div class="ai-chat-message__body">
      <div class="ai-chat-message__role">
        <slot name="role">{{ from === 'user' ? '你' : 'AI Chat UI' }}</slot>
      </div>
      <slot />
    </div>
  </div>
</template>

<style>
@layer ai-chat-components {
  .ai-chat-message {
    display: flex;
    gap: var(--ai-chat-msg-gap);
    padding: var(--ai-chat-msg-padding-y) 0;
  }

  .ai-chat-message__avatar {
    flex-shrink: 0;
    width: var(--ai-chat-avatar-size);
    height: var(--ai-chat-avatar-size);
    margin-top: 2px;
  }

  .ai-chat-avatar {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 13px;
    font-weight: 600;
  }

  .ai-chat-avatar--user {
    background: linear-gradient(135deg, #6366f1, #a78bfa);
    color: #fff;
  }

  .ai-chat-avatar--assistant {
    background: transparent;
    color: var(--ai-chat-color-accent);
  }

  .ai-chat-avatar--assistant svg {
    width: 26px;
    height: 26px;
  }

  .ai-chat-message__body {
    flex: 1;
    min-width: 0;
  }

  .ai-chat-message__role {
    font-size: 13px;
    font-weight: 600;
    margin-bottom: 6px;
    color: var(--ai-chat-color-text-primary);
  }

  /* 用户消息气泡：启用 msg-user-bg / bubble-radius 令牌
   （此前为死令牌——Message 未引用，用户消息无背景，叠在浅色容器上呈"白色"） */
  .ai-chat-message--user .ai-chat-message-content {
    display: inline-block;
    max-width: 100%;
    padding: 10px 14px;
    background: var(--ai-chat-color-msg-user-bg);
    border-radius: var(--ai-chat-bubble-radius);
  }

  /* ===== IM 模式：用户与 AI 分列两侧（stacked 保持现状不动） ===== */
  .ai-chat-message--layout-im .ai-chat-message__body {
    flex: 0 1 auto;
    max-width: var(--ai-chat-message-max-width, 480px);
    display: flex;
    flex-direction: column;
  }

  /* user 在右侧 → user 消息整组靠右（头像右） */
  .ai-chat-message--layout-im.ai-chat-message--user-side-right.ai-chat-message--user {
    flex-direction: row-reverse;
  }
  .ai-chat-message--layout-im.ai-chat-message--user-side-right.ai-chat-message--user
    .ai-chat-message__body {
    align-items: flex-end;
  }

  /* user 在左侧 → assistant 消息整组靠右（头像右），user 保持左 */
  .ai-chat-message--layout-im.ai-chat-message--user-side-left.ai-chat-message--assistant {
    flex-direction: row-reverse;
  }
  .ai-chat-message--layout-im.ai-chat-message--user-side-left.ai-chat-message--assistant
    .ai-chat-message__body {
    align-items: flex-end;
  }
}
</style>
