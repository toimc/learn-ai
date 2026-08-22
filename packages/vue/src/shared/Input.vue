<!-- eslint-disable vue/multi-word-component-names -->
<script setup lang="ts">
interface Props {
  type?: 'text' | 'password'
  placeholder?: string
  disabled?: boolean
  invalid?: boolean
  size?: 'sm' | 'md'
  autocomplete?: string
}

const props = withDefaults(defineProps<Props>(), {
  type: 'text',
  size: 'md',
  placeholder: undefined,
  autocomplete: undefined,
})

const emit = defineEmits<{
  blur: [event: Event]
}>()

const model = defineModel<string>({ default: '' })

function onInput(e: Event) {
  // 程序化派发（jsdom/测试）会绕过原生 disabled 拦截，手动兜底
  if (props.disabled) return
  model.value = (e.target as HTMLInputElement).value
}
</script>

<template>
  <input
    class="ai-chat-input"
    :class="[`ai-chat-input--${size}`, { 'ai-chat-input--invalid': invalid }]"
    :type="type"
    :value="model"
    :placeholder="placeholder"
    :disabled="disabled"
    :aria-invalid="invalid ? 'true' : undefined"
    :autocomplete="autocomplete"
    @input="onInput"
    @blur="emit('blur', $event)"
  />
</template>

<style scoped>
.ai-chat-input {
  width: 100%;
  height: var(--ai-chat-control-height-md);
  padding: 0 12px;
  border: 1px solid var(--ai-chat-color-input-border);
  border-radius: var(--ai-chat-radius-md);
  background: var(--ai-chat-color-input-bg);
  color: var(--ai-chat-color-text-primary);
  font: inherit;
  transition:
    border-color var(--ai-chat-duration-fast) var(--ai-chat-easing),
    box-shadow var(--ai-chat-duration-fast) var(--ai-chat-easing),
    opacity var(--ai-chat-duration-fast) var(--ai-chat-easing);
}

.ai-chat-input::placeholder {
  color: var(--ai-chat-color-text-muted);
}

.ai-chat-input:hover:not(:disabled) {
  border-color: color-mix(
    in srgb,
    var(--ai-chat-color-input-border) 75%,
    var(--ai-chat-color-text-primary)
  );
}

/* 文本输入聚焦即 :focus-visible，鼠标/键盘统一 accent 边框 + ring */
.ai-chat-input:focus-visible {
  outline: none;
  border-color: var(--ai-chat-color-input-focus-border);
  box-shadow: var(--ai-chat-control-ring);
}

.ai-chat-input:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.ai-chat-input--sm {
  height: var(--ai-chat-control-height-sm);
  padding: 0 10px;
}

.ai-chat-input--invalid {
  border-color: var(--ai-chat-color-status-error);
}

.ai-chat-input--invalid:focus-visible {
  border-color: var(--ai-chat-color-status-error);
  box-shadow: 0 0 0 3px
    color-mix(in srgb, var(--ai-chat-color-status-error) 20%, transparent);
}

@media (prefers-reduced-motion: reduce) {
  .ai-chat-input {
    transition: none;
  }
}
</style>
