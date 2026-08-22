<script setup lang="ts">
interface Props {
  value: string
  label?: string
  disabled?: boolean
  name?: string
}

const props = defineProps<Props>()

const model = defineModel<string>({ default: '' })

function onChange() {
  // 原生 radio 再点已选项不触发 change；程序化派发会触发，手动去重 + disabled 兜底
  if (props.disabled || model.value === props.value) return
  model.value = props.value
}
</script>

<template>
  <label
    class="ai-chat-radio"
    :class="{
      'ai-chat-radio--checked': model === value,
      'ai-chat-radio--disabled': disabled,
    }"
  >
    <input
      class="ai-chat-radio__input"
      type="radio"
      :value="value"
      :name="name"
      :checked="model === value"
      :disabled="disabled"
      @change="onChange"
    />
    <span class="ai-chat-radio__circle" aria-hidden="true">
      <span class="ai-chat-radio__dot"></span>
    </span>
    <span v-if="label" class="ai-chat-radio__label">{{ label }}</span>
  </label>
</template>

<style>
@layer ai-chat-components {
  .ai-chat-radio {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    color: var(--ai-chat-color-text-primary);
    cursor: pointer;
  }

  /* 视觉隐藏但保持可聚焦/可读屏（隐藏原生 input 保留可访问性） */
  .ai-chat-radio__input {
    position: absolute;
    width: 1px;
    height: 1px;
    margin: -1px;
    padding: 0;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
    border: 0;
  }

  .ai-chat-radio__circle {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    flex-shrink: 0;
    border: 1px solid var(--ai-chat-color-input-border);
    border-radius: 50%;
    background: var(--ai-chat-color-input-bg);
    transition:
      border-color var(--ai-chat-duration-fast) var(--ai-chat-easing),
      box-shadow var(--ai-chat-duration-fast) var(--ai-chat-easing);
  }

  .ai-chat-radio__dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--ai-chat-color-accent);
    transform: scale(0);
    transition: transform var(--ai-chat-duration-fast) var(--ai-chat-easing);
  }

  .ai-chat-radio:hover:not(.ai-chat-radio--disabled) .ai-chat-radio__circle {
    border-color: color-mix(
      in srgb,
      var(--ai-chat-color-input-border) 75%,
      var(--ai-chat-color-text-primary)
    );
  }

  /* 键盘聚焦隐藏 input，ring 落到相邻自绘圆环上 */
  .ai-chat-radio__input:focus-visible + .ai-chat-radio__circle {
    border-color: var(--ai-chat-color-accent);
    box-shadow: var(--ai-chat-control-ring);
  }

  .ai-chat-radio--checked .ai-chat-radio__circle {
    border-color: var(--ai-chat-color-accent);
  }

  .ai-chat-radio--checked .ai-chat-radio__dot {
    transform: scale(1);
  }

  .ai-chat-radio--disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .ai-chat-radio__label {
    font-size: inherit;
  }

  @media (prefers-reduced-motion: reduce) {
    .ai-chat-radio__circle,
    .ai-chat-radio__dot {
      transition: none;
    }
  }
}
</style>
