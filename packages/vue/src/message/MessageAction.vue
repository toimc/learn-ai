<script setup lang="ts">
defineProps<{
  label?: string
  tooltip?: string
  disabled?: boolean
}>()

defineEmits<{ click: [] }>()
</script>

<template>
  <button
    class="ai-chat-message-action"
    :title="tooltip || label"
    :disabled="disabled"
    @click="$emit('click')"
  >
    <slot>
      <span v-if="label" class="ai-chat-message-action__label">{{
        label
      }}</span>
    </slot>
  </button>
</template>

<!-- scoped 不包 @layer（style-isolation 例外条款）：未分层的宿主 button reset
     （padding:0 / color:inherit）优先级高于所有层，会打穿层内的 color 声明 -->
<style scoped>
.ai-chat-message-action {
  width: 30px;
  height: 30px;
  border: none;
  background: transparent;
  color: var(--ai-chat-color-text-muted);
  cursor: pointer;
  border-radius: var(--ai-chat-radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  transition:
    background var(--ai-chat-duration-fast) var(--ai-chat-easing),
    color var(--ai-chat-duration-fast) var(--ai-chat-easing);
}

.ai-chat-message-action:hover:not(:disabled) {
  background: var(--ai-chat-hover-neutral);
  color: var(--ai-chat-color-text-primary);
}

.ai-chat-message-action:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

/* svg 来自宿主 slot 内容，不带本组件 data-v，需 :deep 穿透 */
.ai-chat-message-action :deep(svg) {
  width: 15px;
  height: 15px;
}

.ai-chat-message-action__label {
  display: none;
}
</style>
