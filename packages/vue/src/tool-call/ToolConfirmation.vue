<script setup lang="ts">
import { computed } from 'vue'
import { aiChatI18n } from '../locales'

const { t } = aiChatI18n.global

interface Props {
  toolName: string
  /** 参数摘要展示（JSON 格式化，只读） */
  arguments?: Record<string, unknown>
  /** 审批说明（为何需要确认），默认 i18n confirmation.description */
  reason?: string
  /** denied 后组件转为只读「已拒绝」态 */
  status: 'awaiting-approval' | 'denied'
}

// prop 名 arguments 是接口契约；仅在 props.arguments 形态下访问，禁止解构/裸引用
const props = defineProps<Props>()

const emit = defineEmits<{
  approve: []
  reject: []
}>()

const isDenied = computed(() => props.status === 'denied')
const reasonText = computed(() => props.reason ?? t('confirmation.description'))
const hasArguments = computed(() => props.arguments !== undefined)
const argsJson = computed(() => {
  if (props.arguments === undefined) return ''
  // 循环引用等不可序列化入参兜底为 String()，避免渲染抛错
  try {
    return JSON.stringify(props.arguments, null, 2) ?? '{}'
  } catch {
    return String(props.arguments)
  }
})
</script>

<template>
  <div
    class="ai-chat-tool-confirmation"
    :class="{ 'ai-chat-tool-confirmation--denied': isDenied }"
  >
    <div class="ai-chat-tool-confirmation__head">
      <span class="ai-chat-tool-confirmation__icon" aria-hidden="true">⛨</span>
      <span class="ai-chat-tool-confirmation__title">{{
        t('confirmation.title')
      }}</span>
    </div>
    <p class="ai-chat-tool-confirmation__desc">{{ reasonText }}</p>
    <div class="ai-chat-tool-confirmation__tool">
      <span class="ai-chat-tool-confirmation__tool-name">{{ toolName }}</span>
    </div>
    <!-- 插值即 textContent 渲染（无 v-html），参数内容不可信也不进 HTML 管道 -->
    <pre v-if="hasArguments" class="ai-chat-tool-confirmation__args">{{
      argsJson
    }}</pre>
    <div
      v-if="!isDenied"
      class="ai-chat-tool-confirmation__actions"
      role="group"
    >
      <button
        type="button"
        class="ai-chat-tool-confirmation__btn ai-chat-tool-confirmation__btn--reject"
        @click="emit('reject')"
      >
        {{ t('confirmation.reject') }}
      </button>
      <button
        type="button"
        class="ai-chat-tool-confirmation__btn ai-chat-tool-confirmation__btn--approve"
        @click="emit('approve')"
      >
        {{ t('confirmation.approve') }}
      </button>
    </div>
    <p v-else class="ai-chat-tool-confirmation__denied">
      {{ t('confirmation.denied') }}
    </p>
  </div>
</template>

<!-- scoped 不包 @layer（style-isolation 例外条款）：data-v 属性选择器天然限定子树 -->
<style scoped>
.ai-chat-tool-confirmation {
  margin: 8px 0;
  padding: 12px;
  border: 1px solid var(--ai-chat-color-status-warning, #f59e0b);
  border-radius: var(--ai-chat-radius-lg);
  background: var(--ai-chat-color-bg-primary);
  font-size: 13px;
}

.ai-chat-tool-confirmation--denied {
  border-color: var(--ai-chat-color-border);
  opacity: 0.85;
}

.ai-chat-tool-confirmation__head {
  display: flex;
  align-items: center;
  gap: 6px;
}

.ai-chat-tool-confirmation__icon {
  font-size: 13px;
  color: var(--ai-chat-color-status-warning, #f59e0b);
}

.ai-chat-tool-confirmation--denied .ai-chat-tool-confirmation__icon {
  color: var(--ai-chat-color-text-muted);
}

.ai-chat-tool-confirmation__title {
  font-weight: 600;
  color: var(--ai-chat-color-text-primary);
}

.ai-chat-tool-confirmation__desc {
  margin: 8px 0;
  color: var(--ai-chat-color-text-secondary);
  line-height: 1.5;
}

.ai-chat-tool-confirmation__tool {
  margin-bottom: 8px;
}

.ai-chat-tool-confirmation__tool-name {
  font-family: var(--ai-chat-font-mono, ui-monospace, monospace);
  font-size: 12.5px;
  padding: 2px 8px;
  border-radius: var(--ai-chat-radius-sm);
  background: var(--ai-chat-color-bg-secondary);
  color: var(--ai-chat-color-text-primary);
}

.ai-chat-tool-confirmation__args {
  margin: 0 0 10px;
  padding: 10px;
  border: 1px solid var(--ai-chat-color-border);
  border-radius: var(--ai-chat-radius-sm);
  background: var(--ai-chat-color-bg-secondary);
  font-family: var(--ai-chat-font-mono, ui-monospace, monospace);
  font-size: 12px;
  line-height: 1.5;
  color: var(--ai-chat-color-text-secondary);
  white-space: pre-wrap;
  word-break: break-word;
}

.ai-chat-tool-confirmation__actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.ai-chat-tool-confirmation__btn {
  padding: 5px 14px;
  border-radius: var(--ai-chat-radius-sm);
  font: inherit;
  font-size: 12.5px;
  cursor: pointer;
  transition:
    background-color var(--ai-chat-duration-fast) var(--ai-chat-easing),
    border-color var(--ai-chat-duration-fast) var(--ai-chat-easing),
    color var(--ai-chat-duration-fast) var(--ai-chat-easing);
}

.ai-chat-tool-confirmation__btn:focus-visible {
  outline: 2px solid var(--ai-chat-color-accent);
  outline-offset: 1px;
}

.ai-chat-tool-confirmation__btn--reject {
  border: 1px solid var(--ai-chat-color-border);
  background: transparent;
  color: var(--ai-chat-color-text-secondary);
}

.ai-chat-tool-confirmation__btn--reject:hover {
  background: rgba(128, 128, 128, 0.15);
}

.ai-chat-tool-confirmation__btn--approve {
  border: 1px solid var(--ai-chat-color-accent);
  background: var(--ai-chat-color-accent);
  color: var(--ai-chat-color-bg-primary);
}

.ai-chat-tool-confirmation__btn--approve:hover {
  opacity: 0.9;
}

.ai-chat-tool-confirmation__denied {
  margin: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12.5px;
  color: var(--ai-chat-color-text-muted);
}
</style>
