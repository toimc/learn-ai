<script setup lang="ts">
interface Props {
  disabled?: boolean
  invalid?: boolean
  size?: 'sm' | 'md'
}

const props = withDefaults(defineProps<Props>(), {
  size: 'md',
})

const model = defineModel<string>({ default: '' })

function onChange(e: Event) {
  // 程序化派发（jsdom/测试）会绕过原生 disabled 拦截，手动兜底
  if (props.disabled) return
  model.value = (e.target as HTMLSelectElement).value
}
</script>

<template>
  <div
    class="ai-chat-select"
    :class="[`ai-chat-select--${size}`, { 'ai-chat-select--invalid': invalid }]"
  >
    <select
      class="ai-chat-select__control"
      :value="model"
      :disabled="disabled"
      :aria-invalid="invalid ? 'true' : undefined"
      @change="onChange"
    >
      <slot />
    </select>
    <svg
      class="ai-chat-select__chevron"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M4 6l4 4 4-4"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  </div>
</template>

<style>
@layer ai-chat-components {
  .ai-chat-select {
    position: relative;
    display: inline-flex;
    width: 100%;
  }

  .ai-chat-select__control {
    width: 100%;
    height: var(--ai-chat-control-height-md);
    padding: 0 30px 0 12px;
    border: 1px solid var(--ai-chat-color-input-border);
    border-radius: var(--ai-chat-radius-md);
    background: var(--ai-chat-color-input-bg);
    color: var(--ai-chat-color-text-primary);
    font: inherit;
    appearance: none;
    -webkit-appearance: none;
    cursor: pointer;
    transition:
      border-color var(--ai-chat-duration-fast) var(--ai-chat-easing),
      box-shadow var(--ai-chat-duration-fast) var(--ai-chat-easing),
      opacity var(--ai-chat-duration-fast) var(--ai-chat-easing);
  }

  .ai-chat-select__control:hover:not(:disabled) {
    border-color: color-mix(
      in srgb,
      var(--ai-chat-color-input-border) 75%,
      var(--ai-chat-color-text-primary)
    );
  }

  .ai-chat-select__control:focus-visible {
    outline: none;
    border-color: var(--ai-chat-color-input-focus-border);
    box-shadow: var(--ai-chat-control-ring);
  }

  .ai-chat-select__control:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  /* currentColor 跟随 color 令牌，明暗主题自动变色 */
  .ai-chat-select__chevron {
    position: absolute;
    top: 50%;
    right: 10px;
    width: 14px;
    height: 14px;
    transform: translateY(-50%);
    color: var(--ai-chat-color-text-secondary);
    pointer-events: none;
  }

  .ai-chat-select--sm .ai-chat-select__control {
    height: var(--ai-chat-control-height-sm);
    padding-left: 10px;
  }

  .ai-chat-select--invalid .ai-chat-select__control {
    border-color: var(--ai-chat-color-status-error);
  }

  .ai-chat-select--invalid .ai-chat-select__control:focus-visible {
    border-color: var(--ai-chat-color-status-error);
    box-shadow: 0 0 0 3px
      color-mix(in srgb, var(--ai-chat-color-status-error) 20%, transparent);
  }

  @media (prefers-reduced-motion: reduce) {
    .ai-chat-select__control {
      transition: none;
    }
  }
}
</style>
