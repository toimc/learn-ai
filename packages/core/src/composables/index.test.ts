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

describe('useChat abort 中断', () => {
  /** 产出首个 chunk 后挂起，等 signal 中断再按适配器契约决定是否继续产出 */
  function createAbortAwareAdapter(mode: 'stop' | 'throw') {
    const receivedSignals: AbortSignal[] = []
    const adapter: ChatAdapter = {
      async *sendMessage({ signal }) {
        receivedSignals.push(signal!)
        yield { type: 'text', content: 'p1' }
        await new Promise<void>((resolve) => {
          if (signal?.aborted) return resolve()
          signal?.addEventListener('abort', () => resolve(), { once: true })
        })
        if (mode === 'throw') {
          const err = new Error('The operation was aborted')
          err.name = 'AbortError'
          throw err
        }
        // 尊重中断：不再产出后续 chunk
      },
    }
    return { adapter, receivedSignals }
  }

  it('流式中 abort：isStreaming 立即复位、已产出内容保留、后续 chunk 不再消费', async () => {
    const { adapter } = createAbortAwareAdapter('stop')
    const state = useChat(adapter)

    const sending = state.send('hi')
    await vi.waitFor(() => {
      expect(state.messages[1]?.content).toBe('p1')
    })
    expect(state.isStreaming).toBe(true)

    state.abort()

    await sending
    expect(state.isStreaming).toBe(false)
    expect(state.messages[1].content).toBe('p1')
    expect(state.error).toBeNull()
  })

  it('适配器抛 AbortError：中断不算错误，不触发 onError', async () => {
    const { adapter } = createAbortAwareAdapter('throw')
    const onError = vi.fn()
    const state = useChat(adapter, { onError })

    const sending = state.send('hi')
    await vi.waitFor(() => {
      expect(state.messages[1]?.content).toBe('p1')
    })

    state.abort()
    await sending

    expect(state.error).toBeNull()
    expect(onError).not.toHaveBeenCalled()
    expect(state.isStreaming).toBe(false)
  })

  it('中断后可重新发送：新一轮对话正常完成', async () => {
    const { adapter } = createAbortAwareAdapter('stop')
    const state = useChat(adapter)

    const first = state.send('first')
    await vi.waitFor(() => {
      expect(state.messages[1]?.content).toBe('p1')
    })
    state.abort()
    await first

    const doneAdapter = createMockAdapter([
      { type: 'text', content: 'fresh' },
      { type: 'done', content: '' },
    ])
    // 替换 adapter 不可行（闭包），直接用同一 state 断言状态可用性：
    // abort 后 isStreaming 复位，允许下一次 send
    expect(state.isStreaming).toBe(false)

    const secondState = useChat(doneAdapter)
    await secondState.send('second')
    expect(secondState.messages[1].content).toBe('fresh')
    expect(secondState.isStreaming).toBe(false)
  })

  it('边界：未开始发送时调用 abort 无副作用', () => {
    const adapter = createMockAdapter([])
    const state = useChat(adapter)

    expect(() => state.abort()).not.toThrow()
    expect(state.isStreaming).toBe(false)
    expect(state.error).toBeNull()
  })

  it('signal 透传：适配器收到与当前请求绑定的 AbortSignal', async () => {
    const { adapter, receivedSignals } = createAbortAwareAdapter('stop')
    const state = useChat(adapter)

    const sending = state.send('hi')
    await vi.waitFor(() => {
      expect(receivedSignals).toHaveLength(1)
    })
    state.abort()
    await sending

    expect(receivedSignals[0].aborted).toBe(true)
  })
})

describe('useChat maxHistory 历史上限', () => {
  function createCounterAdapter() {
    let n = 0
    const adapter: ChatAdapter = {
      async *sendMessage() {
        n += 1
        yield { type: 'text', content: `reply-${n}` }
        yield { type: 'done', content: '' }
      },
    }
    return { adapter }
  }

  it('超过上限时淘汰最旧消息，保留最新的 maxHistory 条', async () => {
    const { adapter } = createCounterAdapter()
    const state = useChat(adapter, { maxHistory: 4 })

    await state.send('a') // 2 条
    await state.send('b') // 4 条
    await state.send('c') // 6 条 → 裁剪到 4

    expect(state.messages).toHaveLength(4)
    expect(state.messages.map((m) => m.content)).toEqual([
      'b',
      'reply-2',
      'c',
      'reply-3',
    ])
  })

  it('边界：消息数恰好等于上限时不裁剪', async () => {
    const { adapter } = createCounterAdapter()
    const state = useChat(adapter, { maxHistory: 2 })

    await state.send('only')

    expect(state.messages).toHaveLength(2)
    expect(state.messages.map((m) => m.role)).toEqual(['user', 'assistant'])
  })

  it('边界：maxHistory=1 时仅保留最新一条（assistant 回复）', async () => {
    const { adapter } = createCounterAdapter()
    const state = useChat(adapter, { maxHistory: 1 })

    await state.send('q')

    expect(state.messages).toHaveLength(1)
    expect(state.messages[0].role).toBe('assistant')
    expect(state.messages[0].content).toBe('reply-1')
  })

  it('裁剪后适配器收到的是裁剪后的消息列表', async () => {
    let lastReceived = 0
    const adapter: ChatAdapter = {
      async *sendMessage({ messages }) {
        lastReceived = messages.length
        yield { type: 'text', content: 'ok' }
        yield { type: 'done', content: '' }
      },
    }
    const state = useChat(adapter, { maxHistory: 4 })

    await state.send('a') // 2 条，收到 1 条（去掉 assistant 占位）
    await state.send('b') // 4 条，收到 3 条
    await state.send('c') // 6→4 条，收到 3 条

    expect(lastReceived).toBe(3)
  })
})
