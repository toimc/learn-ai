<!-- eslint-disable vue/multi-word-component-names -->
<script setup lang="ts">
defineProps<{
  type?: 'primary' | 'secondary' | 'danger'
  /** 原生 button type，默认 'button'（表单内防浏览器原生 submit 双发，对齐 native-type 惯例） */
  nativeType?: 'button' | 'submit' | 'reset'
  size?: 'small' | 'medium' | 'large'
  disabled?: boolean
}>()

defineEmits<{
  click: [event: Event]
}>()
</script>

<template>
  <button
    class="ai-chat-btn"
    :class="[
      type ? `ai-chat-btn--${type}` : 'ai-chat-btn--primary',
      size ? `ai-chat-btn--${size}` : 'ai-chat-btn--medium',
    ]"
    :type="nativeType ?? 'button'"
    :disabled="disabled"
    @click="$emit('click', $event)"
  >
    <slot />
  </button>
</template>

<!-- 样式为 scoped（style-isolation.md §2 例外条款）：宿主未分层 button reset
     （Tailwind preflight / modern-normalize 的 border:0 + background:transparent）
     无条件压过一切 @layer，唯 scoped 属性选择器可赢；宿主定制走 --ai-chat-btn-* 变量钩子 -->
<style scoped>
.ai-chat-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  box-sizing: border-box;
  border: 1px solid transparent;
  border-radius: var(--ai-chat-btn-radius, var(--ai-chat-radius-sm));
  font-weight: 500;
  cursor: pointer;
  transition:
    background var(--ai-chat-duration-fast) var(--ai-chat-easing),
    border-color var(--ai-chat-duration-fast) var(--ai-chat-easing),
    box-shadow var(--ai-chat-duration-fast) var(--ai-chat-easing),
    transform var(--ai-chat-duration-fast) var(--ai-chat-easing),
    opacity var(--ai-chat-duration-fast) var(--ai-chat-easing);
}

.ai-chat-btn:focus-visible {
  outline: none;
  box-shadow: var(--ai-chat-control-ring);
}

.ai-chat-btn:active:not(:disabled) {
  transform: translateY(1px);
}

.ai-chat-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* sizes：高度对齐控件令牌 small=32 / medium=36 / large=40 */
.ai-chat-btn--small {
  height: var(--ai-chat-control-height-sm);
  padding: 0 12px;
  font-size: 12px;
}

.ai-chat-btn--medium {
  height: var(--ai-chat-control-height-md);
  padding: 0 16px;
  font-size: 14px;
}

.ai-chat-btn--large {
  height: calc(var(--ai-chat-control-height-md) + 4px);
  padding: 0 20px;
  font-size: 16px;
}

/* types */
.ai-chat-btn--primary {
  background: var(--ai-chat-btn-primary-bg, var(--ai-chat-color-accent));
  color: var(--ai-chat-btn-primary-color, var(--ai-chat-color-text-on-accent));
}

.ai-chat-btn--primary:hover:not(:disabled) {
  background: var(
    --ai-chat-btn-primary-hover-bg,
    var(--ai-chat-color-accent-600)
  );
}

.ai-chat-btn--secondary {
  border-color: var(
    --ai-chat-btn-secondary-border,
    var(--ai-chat-color-border)
  );
  background: var(--ai-chat-btn-secondary-bg, var(--ai-chat-color-bg-primary));
  color: var(--ai-chat-btn-secondary-color, var(--ai-chat-color-text-primary));
}

.ai-chat-btn--secondary:hover:not(:disabled) {
  background: var(
    --ai-chat-btn-secondary-hover-bg,
    var(--ai-chat-color-bg-secondary)
  );
}

.ai-chat-btn--danger {
  background: var(--ai-chat-btn-danger-bg, var(--ai-chat-color-danger-500));
  color: var(--ai-chat-btn-danger-color, var(--ai-chat-color-text-on-accent));
}

.ai-chat-btn--danger:hover:not(:disabled) {
  background: var(
    --ai-chat-btn-danger-hover-bg,
    color-mix(
      in srgb,
      var(--ai-chat-color-danger-500) 85%,
      var(--ai-chat-neutral-950)
    )
  );
}

@media (prefers-reduced-motion: reduce) {
  .ai-chat-btn {
    transition: none;
  }

  .ai-chat-btn:active:not(:disabled) {
    transform: none;
  }
}
</style>
