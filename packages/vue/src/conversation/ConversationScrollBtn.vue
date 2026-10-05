<script setup lang="ts">
import { inject, computed } from 'vue'
import { aiChatI18n } from '../locales'
import type { ScrollAnchorContext } from '../composables/useScrollAnchor'

const props = defineProps<{
  /** 显示未读角标；缺省走 inject 的 unreadCount */
  badge?: number
}>()

const anchor = inject<ScrollAnchorContext>('scrollAnchor')
const { t } = aiChatI18n.global

const badgeCount = computed(() => props.badge ?? anchor?.unreadCount.value ?? 0)
const badgeLabel = computed(() =>
  t('conversation.scrollUnread', { count: badgeCount.value }),
)
</script>

<template>
  <button
    v-if="anchor"
    class="ai-chat-scroll-btn"
    :style="{ visibility: anchor.isAtBottom.value ? 'hidden' : 'visible' }"
    :aria-label="badgeCount > 0 ? badgeLabel : undefined"
    @click="anchor.scrollToBottom()"
  >
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
    <span v-if="badgeCount > 0" class="ai-chat-scroll-btn__badge">{{
      badgeCount
    }}</span>
  </button>
</template>

<style>
@layer ai-chat-components {
  .ai-chat-scroll-btn {
    position: absolute;
    bottom: 16px;
    right: 24px;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    border: 1px solid var(--ai-chat-color-border);
    background: var(--ai-chat-color-bg-primary);
    color: var(--ai-chat-color-text-secondary);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    transition:
      background var(--ai-chat-duration-fast) var(--ai-chat-easing),
      color var(--ai-chat-duration-fast) var(--ai-chat-easing);
    z-index: 5;
  }

  .ai-chat-scroll-btn:hover {
    background: var(--ai-chat-hover-neutral);
    color: var(--ai-chat-color-text-primary);
  }

  .ai-chat-scroll-btn__badge {
    position: absolute;
    top: -5px;
    right: -5px;
    min-width: 16px;
    height: 16px;
    padding: 0 4px;
    border-radius: 8px;
    background: var(--ai-chat-color-danger-500);
    color: var(--ai-chat-color-text-on-accent);
    font-size: 10px;
    font-weight: 600;
    line-height: 16px;
    text-align: center;
  }
}
</style>
