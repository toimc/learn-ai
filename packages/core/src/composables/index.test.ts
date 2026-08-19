import { describe, it, expect, vi } from 'vitest'
import { watchEffect } from 'vue'
import { useChat } from '../composables'
import type { ChatAdapter, StreamChunk } from '../types'

function createMockAdapter(chunks: StreamChunk[]): ChatAdapter {
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
    const adapter = createMockAdapter([{ type: 'done', content: '' }])
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

  it('should handle tool_call and tool_result chunks', async () => {
    const adapter = createMockAdapter([
      { type: 'text', content: 'Checking... ' },
      {
        type: 'tool_call',
        content: '',
        metadata: {
          toolCallId: 'call_1',
          toolName: 'get_weather',
          toolArguments: { city: 'Beijing' },
        },
      },
      {
        type: 'tool_result',
        content: '',
        metadata: {
          toolCallId: 'call_1',
          toolName: 'get_weather',
          toolResult: { temp: 22 },
          duration: 100,
        },
      },
      { type: 'done', content: '' },
    ])
    const state = useChat(adapter)

    await state.send('What is the weather?')

    const assistant = state.messages[1]
    expect(assistant.toolCalls).toHaveLength(1)
    expect(assistant.toolCalls![0]).toEqual({
      id: 'call_1',
      name: 'get_weather',
      arguments: { city: 'Beijing' },
      result: { temp: 22 },
      status: 'completed',
      duration: 100,
      error: undefined,
    })
  })

  it('should handle tool_result with error', async () => {
    const adapter = createMockAdapter([
      {
        type: 'tool_call',
        content: '',
        metadata: {
          toolCallId: 'call_e',
          toolName: 'fail_tool',
          toolArguments: {},
        },
      },
      {
        type: 'tool_result',
        content: '',
        metadata: {
          toolCallId: 'call_e',
          toolName: 'fail_tool',
          toolError: 'timeout',
          duration: 50,
        },
      },
      { type: 'done', content: '' },
    ])
    const state = useChat(adapter)

    await state.send('test')

    const tc = state.messages[1].toolCalls![0]
    expect(tc.status).toBe('error')
    expect(tc.error).toBe('timeout')
  })
})

describe('useChat 流式响应性（回归：raw 对象 mutation 不触发更新）', () => {
  it('流式过程中消息内容变化应实时触发响应式更新', async () => {
    const adapter: ChatAdapter = {
      async *sendMessage() {
        yield { type: 'text', content: '你' }
        yield { type: 'text', content: '好' }
        yield { type: 'done', content: '' }
      },
    }
    const state = useChat(adapter)

    // 收集每次响应式触发时的最新内容快照
    const seen: string[] = []
    const unwatch = watchEffect(() => {
      const content = state.messages[1]?.content
      if (content !== undefined) seen.push(content)
    })

    await state.send('hi')
    unwatch()

    // 每个文本块到达时都应触发更新（而非流结束才一次性渲染）；
    // 首帧 '' 是 assistant 占位消息入列时的触发
    expect(seen).toEqual(['', '你', '你好'])
  })

  it('thinking 内容流式追加同样保持响应性', async () => {
    const adapter: ChatAdapter = {
      async *sendMessage() {
        yield { type: 'thinking', content: '步骤一' }
        yield { type: 'thinking', content: '；步骤二' }
        yield { type: 'text', content: '结论' }
        yield { type: 'done', content: '' }
      },
    }
    const state = useChat(adapter)

    const seen: string[] = []
    const unwatch = watchEffect(() => {
      const t = state.messages[1]?.thinking?.content
      if (t !== undefined) seen.push(t)
    })

    await state.send('q')
    unwatch()

    expect(seen).toEqual(['步骤一', '步骤一；步骤二'])
    expect(state.messages[1].thinking?.duration).toBeGreaterThanOrEqual(0)
  })
})
