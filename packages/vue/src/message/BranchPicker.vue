<script setup lang="ts">
import { computed } from 'vue'
import { aiChatI18n } from '../locales'

const { t } = aiChatI18n.global

interface Props {
  /** 分支总数 */
  branchCount: number
  /** 当前分支（0-based） */
  activeBranch: number
  /** 是否显示分支标签文本（n/total），默认 true */
  showLabel?: boolean
}

const props = withDefaults(defineProps<Props>(), { showLabel: true })

const emit = defineEmits<{ change: [index: number] }>()

/** 越界钳制：宿主状态异常时不渲染 6/3 之类的标签、不 emit 越界索引 */
const safeIndex = computed(() =>
  Math.min(Math.max(props.activeBranch, 0), Math.max(props.branchCount - 1, 0)),
)

const label = computed(() =>
  t('branchPicker.label', {
    current: safeIndex.value + 1,
    total: props.branchCount,
  }),
)

const prevDisabled = computed(() => safeIndex.value <= 0)
const nextDisabled = computed(() => safeIndex.value >= props.branchCount - 1)

function goPrev() {
  if (prevDisabled.value) return
  emit('change', safeIndex.value - 1)
}

function goNext() {
  if (nextDisabled.value) return
  emit('change', safeIndex.value + 1)
}
</script>

<template>
  <!-- branchCount<=1 时整体不渲染（单分支无需翻页；宿主也可自行 v-if） -->
  <div v-if="branchCount > 1" class="ai-chat-branch-picker">
    <div class="ai-chat-branch-picker__bar">
      <button
        type="button"
        class="ai-chat-branch-picker__btn ai-chat-branch-picker__btn--prev"
        :disabled="prevDisabled"
        :aria-label="t('branchPicker.prev')"
        :title="t('branchPicker.prev')"
        @click="goPrev"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="m15 18-6-6 6-6" />
        </svg>
      </button>
      <span v-if="showLabel" class="ai-chat-branch-picker__label">{{
        label
      }}</span>
      <button
        type="button"
        class="ai-chat-branch-picker__btn ai-chat-branch-picker__btn--next"
        :disabled="nextDisabled"
        :aria-label="t('branchPicker.next')"
        :title="t('branchPicker.next')"
        @click="goNext"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="m9 18 6-6-6-6" />
        </svg>
      </button>
    </div>
    <div class="ai-chat-branch-picker__content">
      <slot />
    </div>
  </div>
</template>

<!-- scoped 不包 @layer（style-isolation 例外条款，同 MessageAction） -->
<style scoped>
.ai-chat-branch-picker {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.ai-chat-branch-picker__bar {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.ai-chat-branch-picker__btn {
  width: 24px;
  height: 24px;
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

.ai-chat-branch-picker__btn svg {
  width: 14px;
  height: 14px;
}

.ai-chat-branch-picker__btn:hover:not(:disabled) {
  background: var(--ai-chat-hover-neutral);
  color: var(--ai-chat-color-text-primary);
}

.ai-chat-branch-picker__btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.ai-chat-branch-picker__label {
  font-size: 12px;
  color: var(--ai-chat-color-text-muted);
  min-width: 4em;
  text-align: center;
  font-variant-numeric: tabular-nums;
}

.ai-chat-branch-picker__content {
  min-width: 0;
}
</style>
