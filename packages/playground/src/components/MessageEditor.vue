<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { aiChatI18n } from '@toimc/vue'

const props = defineProps<{ content: string }>()
const emit = defineEmits<{ confirm: [content: string]; cancel: [] }>()
const { t } = aiChatI18n.global

const draft = ref(props.content)
const textareaRef = ref<HTMLTextAreaElement>()

function autoResize() {
  const el = textareaRef.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${el.scrollHeight}px`
}

onMounted(() => {
  autoResize()
  textareaRef.value?.focus()
})

function submit() {
  const value = draft.value.trim()
  if (!value) return
  emit('confirm', value)
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    submit()
  } else if (e.key === 'Escape') {
    emit('cancel')
  }
}
</script>

<template>
  <div class="pg-message-editor">
    <textarea
      ref="textareaRef"
      v-model="draft"
      rows="1"
      class="pg-message-editor__textarea"
      @keydown="onKeydown"
      @input="autoResize"
    />
    <div class="pg-message-editor__actions">
      <button class="pg-message-editor__btn" @click="emit('cancel')">
        {{ t('pg.actions.cancelEdit') }}
      </button>
      <button
        class="pg-message-editor__btn pg-message-editor__btn--primary"
        :disabled="!draft.trim()"
        @click="submit"
      >
        {{ t('pg.actions.confirmEdit') }}
      </button>
    </div>
  </div>
</template>
