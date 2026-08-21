<script setup lang="ts">
withDefaults(
  defineProps<{
    tooltip?: string
    active?: boolean
    disabled?: boolean
  }>(),
  {
    tooltip: '',
    active: false,
    disabled: false,
  },
)

defineEmits<{ click: [] }>()
</script>

<template>
  <button
    class="ai-chat-prompt-input-btn"
    :class="{ 'ai-chat-prompt-input-btn--active': active }"
    :title="tooltip"
    :disabled="disabled"
    @click="$emit('click')"
  >
    <slot />
  </button>
</template>

<style>
@layer ai-chat-components {
  .ai-chat-prompt-input-btn {
    /* min-width 而非固定 width：图标按钮仍为 32px 方形，
       文字按钮（快捷指令 chip）可按内容自然撑开 */
    min-width: 32px;
    height: 32px;
    padding: 0 8px;
    white-space: nowrap;
    border: none;
    background: transparent;
    color: var(--ai-chat-color-text-muted);
    cursor: pointer;
    border-radius: var(--ai-chat-radius-md);
    display: flex;
    align-items: center;
    justify-content: center;
    transition:
      background var(--ai-chat-duration-fast) var(--ai-chat-easing),
      color var(--ai-chat-duration-fast) var(--ai-chat-easing);
  }

  .ai-chat-prompt-input-btn:hover:not(:disabled) {
    background: var(--ai-chat-hover-neutral);
    color: var(--ai-chat-color-text-primary);
  }

  .ai-chat-prompt-input-btn--active {
    color: var(--ai-chat-color-accent);
  }

  .ai-chat-prompt-input-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .ai-chat-prompt-input-btn svg {
    width: 18px;
    height: 18px;
    /* 部分 icon path 贴 viewBox 边缘（如回形针 x≈1），描边一半出界，
       SVG 默认 overflow:hidden 会裁掉——放行绘制出界 */
    overflow: visible;
  }
}
</style>
