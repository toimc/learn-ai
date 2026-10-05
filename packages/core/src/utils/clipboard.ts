// 剪贴板复制降级链：安全上下文优先 navigator.clipboard，
// 失败/不可用时降级 textarea + execCommand（逻辑源自 toimc-sub2api useClipboard，
// 去掉 toast/store 耦合后的纯函数部分；vue 侧响应式包装见 useClipboard composable）。

function isClipboardApiSupported(): boolean {
  return !!(navigator.clipboard && window.isSecureContext)
}

/** 降级方案：textarea 而非 input，以正确处理多行文本 */
function fallbackCopy(text: string): boolean {
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.style.cssText = 'position:fixed;left:-9999px;top:-9999px'
  document.body.appendChild(textarea)
  textarea.select()
  try {
    // execCommand 已废弃，但仍是旧环境（iOS Safari 等）最广泛的降级路径
    return document.execCommand('copy')
  } catch {
    return false
  } finally {
    document.body.removeChild(textarea)
  }
}

/** 复制文本到剪贴板；空串/非浏览器环境/全链路失败返回 false，不抛异常 */
export async function copyText(text: string): Promise<boolean> {
  if (!text) return false
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return false
  }
  if (isClipboardApiSupported()) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      // 落入降级链
    }
  }
  return fallbackCopy(text)
}
