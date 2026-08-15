import { describe, it, expect, vi, beforeEach } from 'vitest'
import { effectScope } from 'vue'
import { usePendingFiles } from './usePendingFiles'

function png(name = 'a.png', size = 1024) {
  return new File([new ArrayBuffer(size)], name, { type: 'image/png' })
}
function pdf(name = 'b.pdf', size = 2048) {
  return new File([new ArrayBuffer(size)], name, { type: 'application/pdf' })
}

describe('usePendingFiles', () => {
  beforeEach(() => {
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => 'blob:mock'),
      revokeObjectURL: vi.fn(),
    })
  })

  it('addFiles 接收文件并生成 PendingFile', () => {
    const { pendingFiles, addFiles } = usePendingFiles({})
    const { accepted } = addFiles([png()])
    expect(accepted).toHaveLength(1)
    expect(pendingFiles.value[0].status).toBe('ready')
    expect(pendingFiles.value[0].previewUrl).toBe('blob:mock')
  })

  it('非图片文件 previewUrl 为空串', () => {
    const { pendingFiles, addFiles } = usePendingFiles({})
    addFiles([pdf()])
    expect(pendingFiles.value[0].previewUrl).toBe('')
  })

  it('accept 拒绝不匹配类型并返回原因', () => {
    const { addFiles } = usePendingFiles({ accept: 'image/*' })
    const { accepted, rejected } = addFiles([png(), pdf()])
    expect(accepted).toHaveLength(1)
    expect(rejected[0].file).toBeInstanceOf(File)
    expect(rejected[0].reason).toContain('类型')
  })

  it('accept 支持 .ext 扩展名写法', () => {
    const { addFiles } = usePendingFiles({ accept: '.png,.pdf' })
    const { accepted } = addFiles([png(), pdf()])
    expect(accepted).toHaveLength(2)
  })

  it('maxSize 拒绝超限文件', () => {
    const { addFiles } = usePendingFiles({ maxSize: 1024 })
    const { rejected } = addFiles([pdf()])
    expect(rejected[0].reason).toContain('大小')
  })

  it('maxFiles 截断超量文件', () => {
    const { pendingFiles, addFiles } = usePendingFiles({ maxFiles: 2 })
    const { accepted, rejected } = addFiles([
      png('1.png'),
      png('2.png'),
      png('3.png'),
    ])
    expect(accepted).toHaveLength(2)
    expect(rejected[0].reason).toContain('数量')
    expect(pendingFiles.value).toHaveLength(2)
  })

  it('remove 按 id 移除并 revoke', () => {
    const { pendingFiles, addFiles, remove } = usePendingFiles({})
    addFiles([png()])
    remove(pendingFiles.value[0].id)
    expect(pendingFiles.value).toHaveLength(0)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock')
  })

  it('clear 清空全部', () => {
    const { pendingFiles, addFiles, clear } = usePendingFiles({})
    addFiles([png('1.png'), png('2.png')])
    clear()
    expect(pendingFiles.value).toHaveLength(0)
  })

  it('setStatus 更新状态', () => {
    const { pendingFiles, addFiles, setStatus } = usePendingFiles({})
    addFiles([png()])
    const id = pendingFiles.value[0].id
    setStatus(id, 'uploading')
    expect(pendingFiles.value[0].status).toBe('uploading')
    setStatus(id, 'error', '网络错误')
    expect(pendingFiles.value[0].error).toBe('网络错误')
  })

  it('作用域销毁时统一 revoke objectURL', () => {
    const scope = effectScope()
    scope.run(() => {
      const { addFiles } = usePendingFiles({})
      addFiles([png()])
    })
    scope.stop()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock')
  })
})
