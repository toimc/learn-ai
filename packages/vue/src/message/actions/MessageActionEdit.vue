<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { aiChatI18n } from '../../locales'
import MessageAction from '../MessageAction.vue'

const { t } = aiChatI18n.global

interface Props {
  /** 进入编辑时的初始文本（一般为消息当前内容） */
  initialText: string
  /** 编辑态占位，默认 i18n messageActions.editPlaceholder */
  placeholder?: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  /** 确认保存并重发（trim 后非空才 emit） */
  edit: [text: string]
  /** 取消编辑 */
  cancel: []
}>()

const editing = ref(false)
const draft = ref('')
const inputEl = ref<HTMLTextAreaElement | null>(null)

const placeholder = computed(
  () => props.placeholder ?? t('messageActions.editPlaceholder'),
)

// 每次进入编辑从 initialText 重新起稿（半稿/上一次的稿不残留）
watch(editing, async (open) => {
  if (open) {
    draft.value = props.initialText
    await nextTick()
    inputEl.value?.focus()
  }
})

function startEdit() {
  editing.value = true
}

function saveEdit() {
  const text = draft.value.trim()
  if (!text) return
  emit('edit', text)
  editing.value = false
}

function cancelEdit() {
  emit('cancel')
  editing.value = false
}
</script>

<template>
  <MessageAction
    v-if="!editing"
    :tooltip="t('messageActions.edit')"
    @click="startEdit"
  >
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
      <path d="m15 5 4 4" />
    </svg>
  </MessageAction>

  <div v-else class="ai-chat-message-action-edit">
    <textarea
      ref="inputEl"
      v-model="draft"
      rows="3"
      class="ai-chat-message-action-edit__input"
      :placeholder="placeholder"
      :aria-label="t('messageActions.edit')"
    />
    <div class="ai-chat-message-action-edit__actions">
      <button
        type="button"
        class="ai-chat-message-action-edit__save"
        :disabled="!draft.trim()"
        @click="saveEdit"
      >
        {{ t('messageActions.saveEdit') }}
      </button>
      <button
        type="button"
        class="ai-chat-message-action-edit__cancel"
        @click="cancelEdit"
      >
        {{ t('messageActions.cancelEdit') }}
      </button>
    </div>
  </div>
</template>

<!-- scoped 不包 @layer（style-isolation 例外条款，同 MessageAction） -->
<style scoped>
.ai-chat-message-action-edit {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: min(360px, 100%);
}

.ai-chat-message-action-edit__input {
  width: 100%;
  resize: none;
  font-size: 13px;
  font-family: inherit;
  line-height: 1.5;
  padding: 8px 10px;
  border: 1px solid
    var(--ai-chat-color-input-border, var(--ai-chat-color-border));
  border-radius: var(--ai-chat-radius-sm);
  background: var(--ai-chat-color-bg-primary);
  color: var(--ai-chat-color-text-primary);
  outline: none;
}

.ai-chat-message-action-edit__input:focus {
  border-color: var(--ai-chat-color-accent);
  box-shadow: var(--ai-chat-control-ring);
}

.ai-chat-message-action-edit__actions {
  display: flex;
  gap: 8px;
}

.ai-chat-message-action-edit__save {
  border: none;
  border-radius: var(--ai-chat-radius-sm);
  padding: 4px 10px;
  font-size: 12px;
  background: var(--ai-chat-color-accent);
  color: var(--ai-chat-color-text-on-accent);
  cursor: pointer;
  transition: background var(--ai-chat-duration-fast) var(--ai-chat-easing);
}

.ai-chat-message-action-edit__save:hover:not(:disabled) {
  background: var(--ai-chat-color-accent-hover);
}

.ai-chat-message-action-edit__save:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.ai-chat-message-action-edit__cancel {
  border: none;
  background: transparent;
  padding: 4px 10px;
  font-size: 12px;
  color: var(--ai-chat-color-text-secondary);
  cursor: pointer;
  border-radius: var(--ai-chat-radius-sm);
  transition: color var(--ai-chat-duration-fast) var(--ai-chat-easing);
}

.ai-chat-message-action-edit__cancel:hover {
  color: var(--ai-chat-color-text-primary);
}
</style>
