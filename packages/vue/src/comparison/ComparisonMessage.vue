<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import MessageContent from '../message/MessageContent.vue'

type Side = 'A' | 'B'

const props = withDefaults(
  defineProps<{
    left: string
    right: string
    leftLabel?: string
    rightLabel?: string
    chosen?: Side | null
    buttonLabel?: string
    stackOnMobile?: boolean
    disabled?: boolean
  }>(),
  {
    leftLabel: '回复 A',
    rightLabel: '回复 B',
    chosen: null,
    buttonLabel: '喜欢这个',
    stackOnMobile: true,
    disabled: false,
  },
)

const emit = defineEmits<{
  prefer: [{ chosen: Side; left: string; right: string }]
}>()

const inner = ref<Side | null>(props.chosen)
watch(
  () => props.chosen,
  (v) => (inner.value = v),
)
const isControlled = computed(() => props.chosen !== null)
const selected = computed<Side | null>(() =>
  isControlled.value ? props.chosen : inner.value,
)

function choose(side: Side) {
  if (props.disabled) return
  if (!isControlled.value) inner.value = side
  emit('prefer', { chosen: side, left: props.left, right: props.right })
}
</script>

<template>
  <div class="ai-chat-comparison" :class="{ 'is-stack-mobile': stackOnMobile }">
    <div
      class="ai-chat-comparison__col"
      :class="{ 'is-selected': selected === 'A' }"
    >
      <div class="ai-chat-comparison__label">{{ leftLabel }}</div>
      <div class="ai-chat-comparison__content">
        <slot name="left" :label="leftLabel">
          <MessageContent :content="left" />
        </slot>
      </div>
      <div class="ai-chat-comparison__action">
        <slot name="action-left">
          <button
            class="ai-chat-comparison__btn"
            :disabled="disabled"
            @click="choose('A')"
          >
            {{ buttonLabel }}
          </button>
        </slot>
      </div>
    </div>

    <div
      class="ai-chat-comparison__col"
      :class="{ 'is-selected': selected === 'B' }"
    >
      <div class="ai-chat-comparison__label">{{ rightLabel }}</div>
      <div class="ai-chat-comparison__content">
        <slot name="right" :label="rightLabel">
          <MessageContent :content="right" />
        </slot>
      </div>
      <div class="ai-chat-comparison__action">
        <slot name="action-right">
          <button
            class="ai-chat-comparison__btn"
            :disabled="disabled"
            @click="choose('B')"
          >
            {{ buttonLabel }}
          </button>
        </slot>
      </div>
    </div>
  </div>
</template>

<style>
.ai-chat-comparison {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--ai-chat-msg-gap);
  /* 给骑底边按钮的下半部分留空间 */
  margin-bottom: 6px;
}

.ai-chat-comparison__col {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 12px 26px;
  border: 1px solid var(--ai-chat-color-border);
  border-radius: var(--ai-chat-radius-lg);
  background: var(--ai-chat-color-msg-assistant-bg);
  transition:
    border-color var(--ai-chat-duration-normal) var(--ai-chat-easing),
    box-shadow var(--ai-chat-duration-normal) var(--ai-chat-easing);
}

.ai-chat-comparison__col.is-selected {
  border-color: var(--ai-chat-color-accent);
  box-shadow: 0 0 0 2px var(--ai-chat-color-accent-dim);
}

.ai-chat-comparison__label {
  font-size: 13px;
  font-weight: 600;
  color: var(--ai-chat-color-text-secondary);
}

.ai-chat-comparison__content {
  flex: 1;
  min-width: 0;
}

/* 操作区：铺在卡片底边，按钮骑边界水平居中 */
.ai-chat-comparison__action {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  justify-content: center;
  pointer-events: none;
}

.ai-chat-comparison__btn {
  transform: translateY(50%);
  pointer-events: auto;
  padding: 6px 16px;
  border: none;
  border-radius: var(--ai-chat-radius-md);
  background: var(--ai-chat-color-accent);
  color: var(--ai-chat-neutral-0, #ffffff);
  font-size: 13px;
  font-family: inherit;
  cursor: pointer;
  white-space: nowrap;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.12);
  transition: background var(--ai-chat-duration-fast) var(--ai-chat-easing);
}

.ai-chat-comparison__btn:hover:not(:disabled) {
  background: var(--ai-chat-color-accent-hover);
}

.ai-chat-comparison__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 窄屏堆叠：容器查询条件不支持 var()，640px 为字面量（= --ai-chat-breakpoint-md 默认）。 */
@container (max-width: 640px) {
  .ai-chat-comparison.is-stack-mobile {
    grid-template-columns: 1fr;
  }
}
</style>
