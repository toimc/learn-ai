<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { aiChatI18n } from '../locales'

const { t } = aiChatI18n.global

interface Props {
  /** 受控反馈值（回显历史），null = 无反馈 */
  value?: 'up' | 'down' | null
  /** 点踩后允许展开评论框，默认 true */
  allowComment?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  value: null,
  allowComment: true,
})

const emit = defineEmits<{
  /** toggle 语义：再点同值取消（null） */
  change: [value: 'up' | 'down' | null]
  /** 评论提交（非空才 emit），emit 后本地清空并收起 */
  comment: [text: string]
}>()

const current = ref<'up' | 'down' | null>(props.value)
const showComment = ref(false)
const commentText = ref('')
const commentEl = ref<HTMLTextAreaElement | null>(null)

// 外部受控值变化同步显示（宿主回显历史 / 撤销反馈）
watch(
  () => props.value,
  (v) => {
    current.value = v ?? null
    if (v !== 'down') showComment.value = false
  },
)

watch(showComment, async (open) => {
  if (open) {
    await nextTick()
    commentEl.value?.focus()
  }
})

function toggle(target: 'up' | 'down') {
  const next = current.value === target ? null : target
  current.value = next
  // 离开点踩态（切点赞 / 取消）时收起评论框
  if (next !== 'down') showComment.value = false
  emit('change', next)
}

function submitComment() {
  const text = commentText.value.trim()
  if (!text) return
  emit('comment', text)
  commentText.value = ''
  showComment.value = false
}

function cancelComment() {
  commentText.value = ''
  showComment.value = false
}
</script>

<template>
  <div
    class="ai-chat-message-feedback"
    :class="{ 'ai-chat-message-feedback--rated': !!current }"
  >
    <div class="ai-chat-message-feedback__buttons">
      <button
        type="button"
        class="ai-chat-message-feedback__btn ai-chat-message-feedback__btn--up"
        :class="{ 'is-active': current === 'up' }"
        :aria-label="t('feedback.like')"
        :aria-pressed="current === 'up'"
        @click="toggle('up')"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M7 10v12" />
          <path
            d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z"
          />
        </svg>
      </button>
      <button
        type="button"
        class="ai-chat-message-feedback__btn ai-chat-message-feedback__btn--down"
        :class="{ 'is-active': current === 'down' }"
        :aria-label="t('feedback.dislike')"
        :aria-pressed="current === 'down'"
        @click="toggle('down')"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M17 14V2" />
          <path
            d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88Z"
          />
        </svg>
      </button>
    </div>

    <button
      v-if="allowComment && current === 'down' && !showComment"
      type="button"
      class="ai-chat-message-feedback__hint"
      @click="showComment = true"
    >
      {{ t('feedback.commentHint') }}
      <span class="ai-chat-message-feedback__hint-arrow" aria-hidden="true"
        >→</span
      >
    </button>

    <div
      v-if="allowComment && current === 'down' && showComment"
      class="ai-chat-message-feedback__comment"
    >
      <textarea
        ref="commentEl"
        v-model="commentText"
        rows="3"
        class="ai-chat-message-feedback__comment-input"
        :placeholder="t('feedback.commentPlaceholder')"
        :aria-label="t('feedback.commentPlaceholder')"
      />
      <div class="ai-chat-message-feedback__comment-actions">
        <button
          type="button"
          class="ai-chat-message-feedback__submit"
          :disabled="!commentText.trim()"
          @click="submitComment"
        >
          {{ t('feedback.submit') }}
        </button>
        <button
          type="button"
          class="ai-chat-message-feedback__cancel"
          @click="cancelComment"
        >
          {{ t('feedback.cancel') }}
        </button>
      </div>
    </div>
  </div>
</template>

<!-- scoped 不包 @layer（style-isolation 例外条款，同 MessageAction）：
     未分层的宿主 button reset（padding/color）会打穿层内声明 -->
<style scoped>
.ai-chat-message-feedback {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  column-gap: 6px;
  row-gap: 4px;
}

.ai-chat-message-feedback__buttons {
  display: flex;
  gap: 2px;
}

/* 未反馈时按钮 hover/focus 才显（visibility 保布局不跳动，遵循库样式经验）；
   已反馈常显 */
.ai-chat-message-feedback:not(.ai-chat-message-feedback--rated)
  .ai-chat-message-feedback__buttons {
  visibility: hidden;
}

.ai-chat-message-feedback:hover .ai-chat-message-feedback__buttons,
.ai-chat-message-feedback:focus-within .ai-chat-message-feedback__buttons {
  visibility: visible;
}

/* 外层已负责显隐的场景（如动作行内）：透传 data-always-visible 常显 */
.ai-chat-message-feedback[data-always-visible]
  .ai-chat-message-feedback__buttons {
  visibility: visible;
}

.ai-chat-message-feedback__btn {
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
  transition: color var(--ai-chat-duration-fast) var(--ai-chat-easing);
}

.ai-chat-message-feedback__btn svg {
  width: 15px;
  height: 15px;
}

.ai-chat-message-feedback__btn--up:hover {
  color: var(--ai-chat-color-text-primary);
}

.ai-chat-message-feedback__btn--up.is-active {
  color: var(--ai-chat-color-accent);
}

.ai-chat-message-feedback__btn--down:hover,
.ai-chat-message-feedback__btn--down.is-active {
  color: var(--ai-chat-color-status-warning);
}

.ai-chat-message-feedback__hint {
  border: none;
  background: transparent;
  padding: 0;
  font-size: 12px;
  line-height: 30px;
  color: var(--ai-chat-color-text-muted);
  cursor: pointer;
  transition: color var(--ai-chat-duration-fast) var(--ai-chat-easing);
}

.ai-chat-message-feedback__hint:hover {
  color: var(--ai-chat-color-accent);
}

.ai-chat-message-feedback__hint-arrow {
  margin-left: 2px;
}

.ai-chat-message-feedback__comment {
  flex-basis: 100%;
  max-width: 320px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.ai-chat-message-feedback__comment-input {
  width: 100%;
  resize: none;
  font-size: 12px;
  font-family: inherit;
  line-height: 1.5;
  padding: 8px;
  border: 1px solid var(--ai-chat-color-border);
  border-radius: var(--ai-chat-radius-sm);
  background: var(--ai-chat-color-bg-primary);
  color: var(--ai-chat-color-text-primary);
  outline: none;
}

.ai-chat-message-feedback__comment-input:focus {
  border-color: var(--ai-chat-color-accent);
  box-shadow: var(--ai-chat-control-ring);
}

.ai-chat-message-feedback__comment-actions {
  display: flex;
  gap: 8px;
}

.ai-chat-message-feedback__submit {
  border: none;
  border-radius: var(--ai-chat-radius-sm);
  padding: 4px 10px;
  font-size: 12px;
  background: var(--ai-chat-color-accent);
  color: var(--ai-chat-color-text-on-accent);
  cursor: pointer;
  transition: background var(--ai-chat-duration-fast) var(--ai-chat-easing);
}

.ai-chat-message-feedback__submit:hover:not(:disabled) {
  background: var(--ai-chat-color-accent-hover);
}

.ai-chat-message-feedback__submit:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.ai-chat-message-feedback__cancel {
  border: none;
  background: transparent;
  padding: 4px 10px;
  font-size: 12px;
  color: var(--ai-chat-color-text-secondary);
  cursor: pointer;
  border-radius: var(--ai-chat-radius-sm);
  transition: color var(--ai-chat-duration-fast) var(--ai-chat-easing);
}

.ai-chat-message-feedback__cancel:hover {
  color: var(--ai-chat-color-text-primary);
}
</style>
