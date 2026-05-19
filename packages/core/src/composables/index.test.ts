import { describe, it, expect, vi } from 'vitest'
import { useChat } from '../composables'
import type { ChatAdapter, StreamChunk } from '../types'

function createMockAdapter(
  chunks: StreamChunk[]
): ChatAdapter {
  return {
    async *sendMessage() {
      for (const chunk of chunks) {
        yield chunk
      }
    },
  }
}

describe('useChat', () => {
  it('should initialize with empty messages', () => {
    const adapter = createMockAdapter([])
    const state = useChat(adapter)
    expect(state.messages).toHaveLength(0)
    expect(state.isStreaming).toBe(false)
    expect(state.error).toBeNull()
  })

  it('should initialize with initial messages', () => {
    const adapter = createMockAdapter([])
    const initialMessages = [
      {
        id: '1',
        role: 'user' as const,
        content: 'Hello',
        createdAt: new Date(),
      },
    ]
    const state = useChat(adapter, { initialMessages })
    expect(state.messages).toHaveLength(1)
  })

  it('should send a message and receive streamed response', async () => {
    const adapter = createMockAdapter([
      { type: 'text', content: 'Hello ' },
      { type: 'text', content: 'World' },
      { type: 'done', content: '' },
    ])
    const state = useChat(adapter)

    await state.send('Hi')

    expect(state.messages).toHaveLength(2)
    expect(state.messages[0].role).toBe('user')
    expect(state.messages[0].content).toBe('Hi')
    expect(state.messages[1].role).toBe('assistant')
    expect(state.messages[1].content).toBe('Hello World')
    expect(state.isStreaming).toBe(false)
  })

  it('should handle error chunks', async () => {
    const adapter = createMockAdapter([
      { type: 'text', content: 'partial' },
      { type: 'error', content: 'Something went wrong' },
    ])
    const onError = vi.fn()
    const state = useChat(adapter, { onError })

    await state.send('Hi')

    expect(state.error).toBeInstanceOf(Error)
    expect(state.error!.message).toBe('Something went wrong')
    expect(onError).toHaveBeenCalledOnce()
    expect(state.isStreaming).toBe(false)
  })

  it('should clear messages', async () => {
    const adapter = createMockAdapter([
      { type: 'done', content: '' },
    ])
    const state = useChat(adapter)

    await state.send('Hi')
    expect(state.messages.length).toBeGreaterThan(0)

    state.clear()
    expect(state.messages).toHaveLength(0)
    expect(state.error).toBeNull()
    expect(state.isStreaming).toBe(false)
  })

  it('should call onResponse callback for non-done chunks', async () => {
    const adapter = createMockAdapter([
      { type: 'text', content: 'A' },
      { type: 'text', content: 'B' },
      { type: 'done', content: '' },
    ])
    const onResponse = vi.fn()
    const state = useChat(adapter, { onResponse })

    await state.send('Hi')

    expect(onResponse).toHaveBeenCalledTimes(2)
    expect(onResponse).toHaveBeenCalledWith({ type: 'text', content: 'A' })
    expect(onResponse).toHaveBeenCalledWith({ type: 'text', content: 'B' })
  })
})
