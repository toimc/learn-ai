<script setup lang="ts">
import { provide } from 'vue'
import {
  useScrollAnchor,
  type ScrollAnchorContext,
} from '../composables/useScrollAnchor'

const props = withDefaults(defineProps<{ autoScroll?: boolean }>(), {
  autoScroll: true,
})

const anchor = useScrollAnchor()

provide<ScrollAnchorContext>('scrollAnchor', anchor)
provide('autoScroll', props.autoScroll)
</script>

<template>
  <div class="ai-chat-conversation">
    <slot />
  </div>
</template>

<style>
.ai-chat-conversation {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  position: relative;
  background: var(--ai-chat-color-bg-chat);
}
</style>
