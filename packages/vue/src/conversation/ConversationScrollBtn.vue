<script setup lang="ts">
import { inject } from 'vue'
import type { ScrollAnchorContext } from '../composables/useScrollAnchor'

const anchor = inject<ScrollAnchorContext>('scrollAnchor')
</script>

<template>
  <button
    v-if="anchor"
    class="ai-chat-scroll-btn"
    :style="{ visibility: anchor.isAtBottom.value ? 'hidden' : 'visible' }"
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
  </button>
</template>

<style>
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
</style>
