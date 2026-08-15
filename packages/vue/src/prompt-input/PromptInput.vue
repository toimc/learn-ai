<script setup lang="ts">
import { ref, provide } from 'vue'
import type { Attachment } from '@ai-chat/core'
import { usePendingFiles } from '../composables/usePendingFiles'
import Toast from '../shared/Toast.vue'
import { PROMPT_INPUT_KEY } from './context'

const props = withDefaults(
  defineProps<{
    disabled?: boolean
    placeholder?: string
    maxHeight?: number
    accept?: string
    multiple?: boolean
    maxFiles?: number
    maxSize?: number
    sendKey?: 'alt-enter' | 'enter'
    beforeSend?: (files: File[]) => Promise<Attachment[]>
  }>(),
  {
    disabled: false,
    placeholder: '给 AI Chat UI 发送消息...',
    maxHeight: 200,
    accept: '',
    multiple: false,
    maxFiles: 5,
    maxSize: undefined,
    sendKey: 'alt-enter',
    beforeSend: undefined,
  },
)

const emit = defineEmits<{
  send: [payload: { text: string; files?: File[]; attachments?: Attachment[] }]
  abort: []
  error: [payload: { files: File[]; reason: string }]
}>()

const inputText = ref('')
const status = ref<'ready' | 'streaming'>('ready')
const toastMessage = ref('')

const pf = usePendingFiles({
  accept: props.accept,
  maxFiles: props.maxFiles,
  maxSize: props.maxSize,
})

function addFilesAndNotify(files: Parameters<typeof pf.addFiles>[0]) {
  const { rejected } = pf.addFiles(files)
  if (!rejected.length) return
  const message =
    rejected.length > 1
      ? `${rejected[0].reason} 等 ${rejected.length} 个文件被拒绝`
      : rejected[0].reason
  toastMessage.value = message
  emit('error', {
    files: rejected.map((r) => r.file),
    reason: rejected[0].reason,
  })
}

provide(PROMPT_INPUT_KEY, {
  inputText,
  pendingFiles: pf.pendingFiles,
  status,
  disabled: () => props.disabled,
  maxHeight: () => props.maxHeight,
  placeholder: () => props.placeholder,
  addFiles: addFilesAndNotify,
  remove: pf.remove,
  sendKey: () => props.sendKey,
  multiple: () => props.multiple,
  accept: () => props.accept,
  submit,
})

async function submit() {
  const rawText = inputText.value
  const text = rawText.trim()
  // 快照必须是拷贝：pf.addFiles 原地 push，await 期间新增的文件不能进入本次上传/移除集合
  const pending = [...pf.pendingFiles.value]
  if ((!text && !pending.length) || props.disabled) return
  if (pending.some((p) => p.status === 'uploading')) return

  if (props.beforeSend && pending.length > 0) {
    const files = pending.map((p) => p.file)
    pending.forEach((p) => pf.setStatus(p.id, 'uploading'))
    try {
      const attachments = await props.beforeSend(files)
      emit('send', {
        text,
        attachments: attachments.length ? attachments : undefined,
      })
      // 上传窗口内用户可能继续输入或追加文件：只清仍等于快照的文本，
      // 文件按 id 移除已上传项，窗口内新增的文件保留
      if (inputText.value === rawText) inputText.value = ''
      pending.forEach((p) => pf.remove(p.id))
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      pending.forEach((p) => pf.setStatus(p.id, 'error', message))
      toastMessage.value = `附件上传失败：${message}`
    }
    return
  }

  emit('send', {
    text,
    files: pending.length ? pending.map((p) => p.file) : undefined,
  })
  inputText.value = ''
  pf.clear()
}

function handleAbort() {
  emit('abort')
}

provide('promptSubmit', submit)
provide('promptAbort', handleAbort)
</script>

<template>
  <div class="ai-chat-prompt-input">
    <div class="ai-chat-prompt-input__wrapper">
      <slot />
    </div>
    <p class="ai-chat-prompt-input__disclaimer">
      <slot name="disclaimer"
        >AI Chat UI 可能会产生不准确的信息，请注意甄别内容的准确性</slot
      >
    </p>
    <Toast
      v-if="toastMessage"
      :message="toastMessage"
      type="error"
      @close="toastMessage = ''"
    />
  </div>
</template>

<style>
@layer ai-chat-components {
  .ai-chat-prompt-input {
    max-width: var(--ai-chat-content-max-width);
    width: 100%;
    margin: 0 auto;
    padding: 0 24px 20px;
    container-type: inline-size;
  }

  .ai-chat-prompt-input__wrapper {
    position: relative;
    background: var(--ai-chat-color-input-bg);
    border-radius: var(--ai-chat-radius-xl);
    border: 1px solid var(--ai-chat-color-input-border);
    transition:
      border-color var(--ai-chat-duration-normal) var(--ai-chat-easing),
      box-shadow var(--ai-chat-duration-normal) var(--ai-chat-easing);
  }

  .ai-chat-prompt-input__wrapper:focus-within {
    border-color: var(--ai-chat-color-input-focus-border);
    box-shadow: 0 0 0 2px var(--ai-chat-color-accent-dim);
  }

  .ai-chat-prompt-input__disclaimer {
    text-align: center;
    font-size: 12px;
    color: var(--ai-chat-color-text-muted);
    padding: 8px 24px 0;
  }

  /* 窄屏（移动端）：降低 padding、隐藏 disclaimer。
   容器查询条件不支持 var()，640px 为字面量（= --ai-chat-breakpoint-md 默认）。 */
  @container (max-width: 640px) {
    .ai-chat-prompt-input {
      padding: 0 12px 12px;
    }
    .ai-chat-prompt-input__disclaimer {
      display: none;
    }
  }
}
</style>
