<script setup lang="ts">
defineProps<{
  label: string
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
      <span class="ai-chat-message-action__label">{{ label }}</span>
    </slot>
  </button>
</template>

<style>
@layer ai-chat-components {
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

  .ai-chat-message-action svg {
    width: 15px;
    height: 15px;
  }

  .ai-chat-message-action__label {
    display: none;
  }
}
</style>
