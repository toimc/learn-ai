<script setup lang="ts">
import { componentTheme } from '../composables/useTheme'

defineProps<{
  height?: string
}>()
</script>

<template>
  <!-- target='component' 时 data-theme 挂组件根，暗色变量只作用于组件子树 -->
  <div
    class="ai-chat-window"
    :style="{ height: height || '100%' }"
    :data-theme="componentTheme"
  >
    <div class="ai-chat-window__body">
      <slot />
    </div>
    <div class="ai-chat-window__footer">
      <slot name="footer" />
    </div>
  </div>
</template>

<style>
@layer ai-chat-components {
  .ai-chat-window {
    display: flex;
    flex-direction: column;
    border: 1px solid var(--ai-chat-color-border, #e5e7eb);
    border-radius: var(--ai-chat-radius, 8px);
    overflow: hidden;
    background: var(--ai-chat-color-bg-primary, #ffffff);
  }

  .ai-chat-window__body {
    flex: 1;
    overflow-y: auto;
    padding: var(--ai-chat-padding, 16px);
  }

  .ai-chat-window__footer {
    border-top: 1px solid var(--ai-chat-color-border, #e5e7eb);
    padding: var(--ai-chat-padding, 16px);
  }
}
</style>
