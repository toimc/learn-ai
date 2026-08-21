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
@layer ai-chat-components {
  .ai-chat-conversation-content {
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    container-type: inline-size;
  }

  .ai-chat-conversation-messages {
    max-width: var(--ai-chat-content-max-width);
    width: 100%;
    margin: 0 auto;
    padding: 24px;
    flex: 1;
  }

  /* 宽屏：消息区放宽（满足「宽屏显示更宽的消息」）。
   注意：容器查询条件不支持 var()，此处 1280px 为字面量（= --ai-chat-breakpoint-xl 默认）。 */
  @container (min-width: 1280px) {
    .ai-chat-conversation-messages {
      max-width: var(--ai-chat-content-max-width-wide);
    }
  }
}
</style>
