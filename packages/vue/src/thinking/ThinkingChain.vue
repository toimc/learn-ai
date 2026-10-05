<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { ThinkingStep } from '@toimc/core'
import { formatDuration } from '../utils/format'
import { aiChatI18n } from '../locales'

const { t } = aiChatI18n.global

interface Props {
  steps: ThinkingStep[]
  /** 头部标题，默认 i18n thinking.title */
  title?: string
  /** 总耗时 ms；缺省时自动求和各步骤 duration */
  totalDuration?: number
  /** 步骤间连接线样式，默认 'solid' */
  line?: 'solid' | 'dashed' | 'none'
  /** 流式标志：复用 ThinkingBlock 的自动开合状态机（开始展开/结束折叠/用户接管） */
  streaming?: boolean
  /** 外层默认展开态；流式时缺省为 true */
  defaultExpanded?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  line: 'solid',
  streaming: false,
  // 显式 undefined 取消 Vue 对缺省 Boolean prop 的隐式 false 转型，
  // 否则 `defaultExpanded ?? streaming` 无法区分"未传"与"传了 false"
  defaultExpanded: undefined,
})

// 展开态跟随流式起止（开始自动展开，结束自动折叠）；
// 用户点击后状态完全归用户——流式中折叠必须立即生效，不能被 streaming 压制。
// 初始值由 defaultExpanded 决定，未传时流式缺省展开（照搬 ThinkingBlock 状态机）
const isExpanded = ref(props.defaultExpanded ?? props.streaming)
let userTouched = false

watch(
  () => props.streaming,
  (val) => {
    if (!userTouched) isExpanded.value = val
  },
)

function toggleExpand() {
  userTouched = true
  isExpanded.value = !isExpanded.value
}

// 头部文案：流式 → 正在思考…；否则标题（props 优先，i18n 兜底）
const headerLabel = computed(() =>
  props.streaming
    ? t('thinking.thinking')
    : (props.title ?? t('thinking.title')),
)

const totalMs = computed(
  () =>
    props.totalDuration ??
    props.steps.reduce((sum, step) => sum + (step.duration ?? 0), 0),
)
const formattedTotal = computed(() =>
  totalMs.value > 0 ? formatDuration(totalMs.value) : '',
)
const stepCountLabel = computed(() =>
  t('thinking.stepCount', { count: props.steps.length }),
)

// 步骤级展开：与外层开合相互独立，逐 id 记录
const openSteps = ref(new Set<string>())

function toggleStep(step: ThinkingStep) {
  const next = new Set(openSteps.value)
  if (next.has(step.id)) next.delete(step.id)
  else next.add(step.id)
  openSteps.value = next
}

// 步骤状态映射：穷举 ThinkingStep['status']（pending/active/complete/error）
const STEP_ICON: Record<ThinkingStep['status'], string> = {
  pending: '○',
  active: '●',
  complete: '✓',
  error: '✗',
}
const STEP_LABEL_KEY: Record<ThinkingStep['status'], string> = {
  pending: 'thinking.stepPending',
  active: 'thinking.stepActive',
  complete: 'thinking.stepComplete',
  error: 'thinking.stepError',
}
</script>

<template>
  <div
    v-if="steps.length"
    class="ai-chat-thinking-chain"
    :class="[
      `ai-chat-thinking-chain--line-${line}`,
      {
        'ai-chat-thinking-chain--expanded': isExpanded,
        'ai-chat-thinking-chain--streaming': streaming,
      },
    ]"
  >
    <button
      type="button"
      class="ai-chat-thinking-chain__header"
      :aria-expanded="isExpanded"
      @click="toggleExpand"
    >
      <svg
        class="ai-chat-thinking-chain__header-icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path
          d="M12 3l1.9 5.8a2 2 0 0 0 1.3 1.3L21 12l-5.8 1.9a2 2 0 0 0-1.3 1.3L12 21l-1.9-5.8a2 2 0 0 0-1.3-1.3L3 12l5.8-1.9a2 2 0 0 0 1.3-1.3L12 3z"
        />
      </svg>
      <span class="ai-chat-thinking-chain__header-title">{{
        headerLabel
      }}</span>
      <span class="ai-chat-thinking-chain__header-meta">
        <span
          v-if="formattedTotal"
          class="ai-chat-thinking-chain__header-duration"
        >
          {{ formattedTotal }}
        </span>
        <span class="ai-chat-thinking-chain__header-count">{{
          stepCountLabel
        }}</span>
      </span>
      <svg
        class="ai-chat-thinking-chain__header-chevron"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </button>

    <transition name="ai-chat-thinking-chain">
      <div v-if="isExpanded" class="ai-chat-thinking-chain__body">
        <div
          v-for="step in steps"
          :key="step.id"
          class="ai-chat-thinking-chain__step"
          :class="`ai-chat-thinking-chain__step--${step.status}`"
        >
          <button
            type="button"
            class="ai-chat-thinking-chain__step-row"
            :aria-expanded="openSteps.has(step.id)"
            @click="toggleStep(step)"
          >
            <span class="ai-chat-thinking-chain__step-icon">
              {{ STEP_ICON[step.status] }}
            </span>
            <span class="ai-chat-thinking-chain__step-title">{{
              step.title
            }}</span>
            <span class="ai-chat-thinking-chain__step-status">
              {{ t(STEP_LABEL_KEY[step.status]) }}
            </span>
            <span
              v-if="step.duration && step.duration > 0"
              class="ai-chat-thinking-chain__step-duration"
            >
              {{ formatDuration(step.duration) }}
            </span>
            <svg
              v-if="step.content"
              class="ai-chat-thinking-chain__step-chevron"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          <div
            v-if="openSteps.has(step.id) && step.content"
            class="ai-chat-thinking-chain__step-content"
          >
            {{ step.content }}
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<!-- scoped 不包 @layer（style-isolation 例外条款）：宿主全局 reset 的未分层规则
     优先级高于所有层，会打穿层内声明；scoped 的 data-v 属性选择器在未分层域内
     比特异性，天然免疫 -->
<style scoped>
.ai-chat-thinking-chain {
  margin-bottom: 10px;
}

/* 外层头部：与 ThinkingBlock 触发器同视觉语言（低调行内按钮，hover 才有背景） */
.ai-chat-thinking-chain__header {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 100%;
  padding: 3px 8px 3px 6px;
  margin-left: -6px;
  border: none;
  border-radius: 6px;
  background: transparent;
  font: inherit;
  font-size: 12.5px;
  line-height: 1;
  color: var(--ai-chat-color-text-muted);
  cursor: pointer;
  user-select: none;
  transition:
    background-color var(--ai-chat-duration-fast) var(--ai-chat-easing),
    color var(--ai-chat-duration-fast) var(--ai-chat-easing);
}

.ai-chat-thinking-chain__header:hover {
  background: rgba(128, 128, 128, 0.15);
  color: var(--ai-chat-color-text-secondary);
}

.ai-chat-thinking-chain__header:focus-visible {
  outline: 2px solid var(--ai-chat-color-accent);
  outline-offset: 1px;
}

.ai-chat-thinking-chain__header-icon {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
}

/* 流式中头部图标：accent 色 + 轻呼吸（同 ThinkingBlock streaming 态） */
.ai-chat-thinking-chain--streaming .ai-chat-thinking-chain__header-icon {
  color: var(--ai-chat-color-accent);
  animation: ai-chat-thinking-chain-breathe 2s ease-in-out infinite;
}

@keyframes ai-chat-thinking-chain-breathe {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.45;
  }
}

.ai-chat-thinking-chain__header-title {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ai-chat-thinking-chain__header-meta {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11.5px;
  white-space: nowrap;
}

.ai-chat-thinking-chain__header-chevron {
  width: 12px;
  height: 12px;
  flex-shrink: 0;
  margin-left: auto;
  transition: transform 0.2s var(--ai-chat-easing);
}

.ai-chat-thinking-chain--expanded .ai-chat-thinking-chain__header-chevron {
  transform: rotate(180deg);
}

/* 步骤列表：左侧细线引用式排版（同 ThinkingBlock body 视觉） */
.ai-chat-thinking-chain__body {
  margin: 6px 0 2px;
  padding-left: 12px;
  border-left: 2px solid var(--ai-chat-color-border);
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.ai-chat-thinking-chain__step {
  position: relative;
  font-size: 12.5px;
}

/* 相邻步骤间的连接线（line 样式 prop 控制实/虚/无） */
.ai-chat-thinking-chain--line-solid
  .ai-chat-thinking-chain__step
  + .ai-chat-thinking-chain__step::before,
.ai-chat-thinking-chain--line-dashed
  .ai-chat-thinking-chain__step
  + .ai-chat-thinking-chain__step::before {
  content: '';
  position: absolute;
  top: -6px;
  left: 6px;
  height: 6px;
  border-left: 1px solid var(--ai-chat-color-border);
}

.ai-chat-thinking-chain--line-dashed
  .ai-chat-thinking-chain__step
  + .ai-chat-thinking-chain__step::before {
  border-left-style: dashed;
}

.ai-chat-thinking-chain__step-row {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 2px 6px 2px 0;
  border: none;
  border-radius: 6px;
  background: transparent;
  font: inherit;
  font-size: 12.5px;
  line-height: 1.5;
  color: var(--ai-chat-color-text-secondary);
  cursor: pointer;
  text-align: left;
  transition: background-color var(--ai-chat-duration-fast)
    var(--ai-chat-easing);
}

.ai-chat-thinking-chain__step-row:hover {
  background: rgba(128, 128, 128, 0.15);
}

.ai-chat-thinking-chain__step-row:focus-visible {
  outline: 2px solid var(--ai-chat-color-accent);
  outline-offset: 1px;
}

.ai-chat-thinking-chain__step-icon {
  width: 14px;
  flex-shrink: 0;
  font-size: 11px;
  line-height: 1;
  text-align: center;
  color: var(--ai-chat-color-text-muted);
}

/* active 步骤：accent 色 + 呼吸动画（prefers-reduced-motion 下关闭） */
.ai-chat-thinking-chain__step--active .ai-chat-thinking-chain__step-icon {
  color: var(--ai-chat-color-accent);
  animation: ai-chat-thinking-chain-breathe 2s ease-in-out infinite;
}

.ai-chat-thinking-chain__step--complete .ai-chat-thinking-chain__step-icon {
  color: var(--ai-chat-color-status-success);
}

.ai-chat-thinking-chain__step--error .ai-chat-thinking-chain__step-icon {
  color: var(--ai-chat-color-status-error);
}

.ai-chat-thinking-chain__step-title {
  font-weight: 500;
  color: var(--ai-chat-color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ai-chat-thinking-chain__step-status {
  flex-shrink: 0;
  font-size: 11px;
  color: var(--ai-chat-color-text-muted);
}

.ai-chat-thinking-chain__step--error .ai-chat-thinking-chain__step-status {
  color: var(--ai-chat-color-status-error);
}

.ai-chat-thinking-chain__step-duration {
  flex-shrink: 0;
  font-size: 11px;
  color: var(--ai-chat-color-text-muted);
}

.ai-chat-thinking-chain__step-chevron {
  width: 11px;
  height: 11px;
  flex-shrink: 0;
  margin-left: auto;
  color: var(--ai-chat-color-text-muted);
  transition: transform 0.2s var(--ai-chat-easing);
}

/* 步骤内容：引用式缩进，纯文本（textContent 渲染） */
.ai-chat-thinking-chain__step-content {
  padding: 2px 0 4px 20px;
  font-size: 12.5px;
  line-height: 1.65;
  color: var(--ai-chat-color-text-secondary);
  white-space: pre-wrap;
  word-break: break-word;
}

/* 展开/收起：fade + 微位移 */
.ai-chat-thinking-chain-enter-active {
  transition:
    opacity 0.25s var(--ai-chat-easing),
    transform 0.25s var(--ai-chat-easing);
}

.ai-chat-thinking-chain-leave-active {
  transition:
    opacity 0.18s var(--ai-chat-easing),
    transform 0.18s var(--ai-chat-easing);
}

.ai-chat-thinking-chain-enter-from,
.ai-chat-thinking-chain-leave-to {
  opacity: 0;
  transform: translateY(-3px);
}

@media (prefers-reduced-motion: reduce) {
  .ai-chat-thinking-chain__header-icon,
  .ai-chat-thinking-chain__step-icon {
    animation: none;
  }

  .ai-chat-thinking-chain__header-chevron,
  .ai-chat-thinking-chain__header,
  .ai-chat-thinking-chain__step-row,
  .ai-chat-thinking-chain__step-chevron {
    transition: none;
  }
}
</style>
