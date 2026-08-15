<script setup lang="ts">
import { computed, inject, ref } from 'vue'
import { PROMPT_INPUT_KEY } from './context'

const props = withDefaults(defineProps<{ kind?: 'image' | 'file' }>(), {
  kind: 'file',
})

const { disabled, multiple, accept, addFiles } = inject(PROMPT_INPUT_KEY)!

const label = computed(() => (props.kind === 'image' ? '上传图片' : '上传附件'))

const fileInput = ref<HTMLInputElement | null>(null)

function pick() {
  fileInput.value?.click()
}

function onChange(e: Event) {
  const input = e.target as HTMLInputElement
  if (input.files?.length) addFiles(input.files)
  input.value = ''
}
</script>

<template>
  <!-- input 必须是 button 的兄弟节点：button 禁止交互式后代，
       且 input 嵌在 button 内时其 click 冒泡回 button 会导致 pick() 双执行 -->
  <input
    ref="fileInput"
    type="file"
    :accept="kind === 'image' ? 'image/*' : accept() || undefined"
    :multiple="multiple()"
    hidden
    @change="onChange"
  />
  <button
    class="ai-chat-prompt-input-btn"
    type="button"
    :title="label"
    :aria-label="label"
    :disabled="disabled()"
    @click="pick"
  >
    <slot>
      <!-- 图片 icon -->
      <svg
        v-if="kind === 'image'"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        aria-hidden="true"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A1.5 1.5 0 0021.75 19.5V4.5A1.5 1.5 0 0020.25 3H3.75A1.5 1.5 0 002.25 4.5v15A1.5 1.5 0 003.75 21zM10.5 8.25h.008v.008H10.5V8.25z"
        />
      </svg>
      <!-- 附件 icon（回形针） -->
      <svg
        v-else
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        aria-hidden="true"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01a5.25 5.25 0 01-7.424-7.424l10.939-10.94"
        />
      </svg>
    </slot>
  </button>
</template>
