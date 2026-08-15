import { onScopeDispose, ref } from 'vue'
import { generateId } from '@ai-chat/core'

export interface PendingFile {
  id: string
  file: File
  /** 图片的 objectURL 预览；非图片为空串（走图标） */
  previewUrl: string
  status: 'ready' | 'uploading' | 'error'
  error?: string
}

export interface RejectedFile {
  file: File
  reason: string
}

export interface UsePendingFilesOptions {
  accept?: string
  maxFiles?: number
  /** 单文件字节上限，缺省不限 */
  maxSize?: number
}

function matchesAccept(file: File, accept?: string): boolean {
  if (!accept || !accept.trim()) return true
  return accept.split(',').some((token) => {
    const t = token.trim().toLowerCase()
    if (!t) return false
    if (t.startsWith('.')) return file.name.toLowerCase().endsWith(t)
    if (t.endsWith('/*')) return file.type.startsWith(t.slice(0, -1))
    return file.type === t
  })
}

export function usePendingFiles(options: UsePendingFilesOptions = {}) {
  const pendingFiles = ref<PendingFile[]>([])
  const objectUrls: string[] = []

  function addFiles(files: File[] | FileList) {
    const list = Array.from(files)
    const accepted: PendingFile[] = []
    const rejected: RejectedFile[] = []
    const maxFiles = options.maxFiles ?? Infinity

    for (const file of list) {
      if (!matchesAccept(file, options.accept)) {
        rejected.push({ file, reason: `不支持的文件类型：${file.name}` })
        continue
      }
      if (options.maxSize && file.size > options.maxSize) {
        rejected.push({ file, reason: `文件超过大小上限：${file.name}` })
        continue
      }
      if (pendingFiles.value.length + accepted.length >= maxFiles) {
        rejected.push({
          file,
          reason: `附件数量已达上限（${options.maxFiles} 个）：${file.name}`,
        })
        continue
      }
      const previewUrl =
        file.type.startsWith('image/') &&
        typeof URL.createObjectURL === 'function'
          ? URL.createObjectURL(file)
          : ''
      if (previewUrl) objectUrls.push(previewUrl)
      accepted.push({ id: generateId(), file, previewUrl, status: 'ready' })
    }

    pendingFiles.value.push(...accepted)
    return { accepted, rejected }
  }

  function revoke(url: string) {
    const i = objectUrls.indexOf(url)
    if (i >= 0) objectUrls.splice(i, 1)
    URL.revokeObjectURL(url)
  }

  function remove(id: string) {
    const item = pendingFiles.value.find((p) => p.id === id)
    if (!item) return
    if (item.previewUrl) revoke(item.previewUrl)
    pendingFiles.value = pendingFiles.value.filter((p) => p.id !== id)
  }

  function clear() {
    for (const p of pendingFiles.value) if (p.previewUrl) revoke(p.previewUrl)
    pendingFiles.value = []
  }

  function setStatus(
    id: string,
    status: PendingFile['status'],
    error?: string,
  ) {
    const item = pendingFiles.value.find((p) => p.id === id)
    if (!item) return
    item.status = status
    item.error = error
  }

  onScopeDispose(() => {
    for (const url of [...objectUrls]) URL.revokeObjectURL(url)
    objectUrls.length = 0
  })

  return { pendingFiles, addFiles, remove, clear, setStatus }
}
