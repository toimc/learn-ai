import type { InjectionKey, Ref } from 'vue'
import type { PendingFile } from '../composables/usePendingFiles'

/** PromptInput provide / 子组件 inject 的完整上下文形状 */
export interface PromptInputContext {
  inputText: Ref<string>
  pendingFiles: Ref<PendingFile[]>
  status: Ref<'ready' | 'streaming'>
  disabled: () => boolean
  maxHeight: () => number
  placeholder: () => string
  addFiles: (files: File[] | FileList) => void
  remove: (id: string) => void
  sendKey: () => 'alt-enter' | 'enter'
  multiple: () => boolean
  accept: () => string
  submit: () => Promise<void>
}

export const PROMPT_INPUT_KEY: InjectionKey<PromptInputContext> =
  Symbol('prompt-input')
