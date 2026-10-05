import { ref, onScopeDispose, getCurrentScope, type Ref } from 'vue'
import { copyText } from '@toimc/core'

/** copyText 的响应式包装：复制成功后 copied 置 true，resetDelay 毫秒后自动复位 */
export function useClipboard(resetDelay = 1500): {
  copied: Ref<boolean>
  copy: (text: string) => Promise<boolean>
} {
  const copied = ref(false)
  let resetTimer: ReturnType<typeof setTimeout> | null = null

  function clearResetTimer() {
    if (resetTimer !== null) {
      clearTimeout(resetTimer)
      resetTimer = null
    }
  }

  async function copy(text: string): Promise<boolean> {
    // core 契约是不抛异常；此处兜底意外 reject，保证 copied 状态不被悬挂
    let success: boolean
    try {
      success = await copyText(text)
    } catch {
      success = false
    }
    if (success) {
      copied.value = true
      clearResetTimer()
      resetTimer = setTimeout(() => {
        copied.value = false
        resetTimer = null
      }, resetDelay)
    }
    return success
  }

  // 无活跃 effect scope（组件外裸调用）时静默跳过，避免 Vue 告警
  if (getCurrentScope()) {
    onScopeDispose(clearResetTimer)
  }

  return { copied, copy }
}
