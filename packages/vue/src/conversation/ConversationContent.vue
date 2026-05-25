<script setup lang="ts">
import { inject, ref, onMounted, onBeforeUnmount } from 'vue'
import type { ScrollAnchorContext } from '../composables/useScrollAnchor'

const anchor = inject<ScrollAnchorContext>('scrollAnchor')
const autoScroll = inject<boolean>('autoScroll', true)

const scrollEl = ref<HTMLElement | null>(null)
let mutationObserver: MutationObserver | null = null

onMounted(() => {
  if (scrollEl.value && anchor) {
    anchor.bindContainer(scrollEl.value)

    mutationObserver = new MutationObserver(() => {
      if (autoScroll && anchor.isAtBottom.value) {
        anchor.scrollToBottom()
      }
    })
    mutationObserver.observe(scrollEl.value, { childList: true, subtree: true })
  }
})

onBeforeUnmount(() => {
  mutationObserver?.disconnect()
})
</script>

<template>
  <div ref="scrollEl" class="ai-chat-conversation-content ai-chat-scrollbar">
    <div class="ai-chat-conversation-messages">
      <slot />
    </div>
  </div>
</template>

<style>
.ai-chat-conversation-content {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.ai-chat-conversation-messages {
  max-width: var(--ai-chat-content-max-width);
  width: 100%;
  margin: 0 auto;
  padding: 24px 24px 0;
  flex: 1;
}
</style>
