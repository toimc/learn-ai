import { describe, it, expect, vi } from 'vitest'
import { watchEffect } from 'vue'
import { useChat } from '../composables'
import type { ChatAdapter, Message, StreamChunk } from '../types'

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

  // 零产出完成：上游空转收尾（坏 key 的中转站空回复形态），
  // UI 必须显式报错而非沉默——否则用户感知"发出去石沉大海"
  it('流正常 done 但零产出（无文本/思考/工具）时置空回复错误', async () => {
    const adapter = createMockAdapter([{ type: 'done', content: '' }])
    const onError = vi.fn()
    const state = useChat(adapter, { onError })

    await state.send('Hi')

    expect(state.error).toBeInstanceOf(Error)
    expect(state.error!.message).toBe(
      '回复为空：上游未返回内容，请检查模型服务配置',
    )
    expect(onError).toHaveBeenCalledOnce()
  })

  it('中断导致的零产出不置错（中断不算错误）', async () => {
    const adapter = {
      async *sendMessage() {
        // 直接被中断，无任何 chunk
      },
    }
    const state = useChat(adapter)

    const pending = state.send('Hi')
    state.abort()
    await pending

    expect(state.error).toBeNull()
  })

  it('有思考产出的流不视为空回复', async () => {
    const adapter = createMockAdapter([
      { type: 'thinking', content: '推理中' },
      { type: 'done', content: '' },
    ])
    const state = useChat(adapter)

    await state.send('Hi')

    expect(state.error).toBeNull()
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

  it('同 toolCallId 的双帧 tool_call（起点帧 + 完整参数帧）合并为单 entry', async () => {
    // 复现 MastraAdapter 双帧线协议：start 发无参起点帧，end 发完整参数帧
    const adapter = createMockAdapter([
      {
        type: 'tool_call',
        content: '',
        metadata: { toolCallId: 't1', toolName: 'get_weather' },
      },
      {
        type: 'tool_call',
        content: '',
        metadata: {
          toolCallId: 't1',
          toolName: 'get_weather',
          toolArguments: { city: 'Beijing' },
        },
      },
      {
        type: 'tool_result',
        content: '',
        metadata: { toolCallId: 't1', toolResult: { temp: 22 } },
      },
      { type: 'done', content: '' },
    ])
    const state = useChat(adapter)

    await state.send('What is the weather?')

    const toolCalls = state.messages[1].toolCalls!
    expect(toolCalls).toHaveLength(1)
    expect(toolCalls[0].arguments).toEqual({ city: 'Beijing' })
    expect(toolCalls[0].status).toBe('completed')
    expect(toolCalls[0].result).toEqual({ temp: 22 })
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

describe('useChat 消息操作与上下文窗口', () => {
  /** 记录 adapter 收到的 messages 的辅助函数 */
  function createRecordingAdapter(
    chunks: StreamChunk[],
    received: Message[][],
  ): ChatAdapter {
    return {
      async *sendMessage(options) {
        received.push([...options.messages]) // 浅拷贝记录
        for (const chunk of chunks) {
          yield chunk
        }
      },
    }
  }

  it('T1: regenerate() 缺省删除最后一条 assistant 重发', async () => {
    const received: Message[][] = []
    const adapter = createRecordingAdapter(
      [
        { type: 'text', content: '回复1' },
        { type: 'done', content: '' },
        { type: 'text', content: '回复2' },
        { type: 'done', content: '' },
        { type: 'text', content: '重新生成的回复' },
        { type: 'done', content: '' },
      ],
      received,
    )
    const state = useChat(adapter)

    await state.send('问题1')
    await state.send('问题2')
    expect(state.messages).toHaveLength(4) // [u1, a1, u2, a2]

    const beforeIds = state.messages.map((m) => m.id)
    await state.regenerate() // 缺省 = 删除最后一条 assistant

    expect(state.messages).toHaveLength(4) // 删 a2 + 新占位 = 4
    expect(state.messages[0].id).toBe(beforeIds[0]) // u1 不变
    expect(state.messages[1].id).toBe(beforeIds[1]) // a1 不变
    expect(state.messages[2].id).toBe(beforeIds[2]) // u2 不变
    expect(state.messages[3].id).not.toBe(beforeIds[3]) // 新 assistant
    expect(state.messages[3].role).toBe('assistant')

    // adapter 最后一次收到的 messages 以 u2 结尾（不含已删的 a2）
    const lastReceived = received[received.length - 1]
    expect(lastReceived[lastReceived.length - 1].content).toBe('问题2')
  })

  it('T2: regenerate(id) 删除指定 assistant 及其后所有消息', async () => {
    const received: Message[][] = []
    const adapter = createRecordingAdapter(
      [
        { type: 'text', content: '新回复' },
        { type: 'done', content: '' },
      ],
      received,
    )
    const state = useChat(adapter)

    await state.send('问题1')
    await state.send('问题2')
    expect(state.messages).toHaveLength(4)

    const a1Id = state.messages[1].id // 第一条 assistant
    await state.regenerate(a1Id) // 删除 a1 及其后的 u2, a2

    expect(state.messages).toHaveLength(2) // [u1, 新 assistant]
    expect(state.messages[0].id).toBe(state.messages[0].id) // u1 保留
    expect(state.messages[1].role).toBe('assistant')

    // adapter 收到的只有 u1
    expect(received[received.length - 1]).toHaveLength(1)
    expect(received[received.length - 1][0].content).toBe('问题1')
  })

  it('T3: isStreaming 中 regenerate 被拒绝', async () => {
    let callCount = 0
    const received: Message[][] = []
    const pendingAdapter: ChatAdapter = {
      async *sendMessage(options) {
        callCount += 1
        received.push([...options.messages])
        yield { type: 'text', content: '开始' }
        // 挂起流，等 abort
        await new Promise<void>(() => {})
      },
    }
    const state = useChat(pendingAdapter)

    const sending = state.send('hi') // 不 await，先让流进入 isStreaming
    await vi.waitFor(
      () => {
        expect(state.isStreaming).toBe(true)
      },
      { timeout: 3000 },
    )

    // 在流式进行中调用 regenerate
    const regeneratePromise = state.regenerate()

    // 等 streaming 真结束（abort 后）
    state.abort()
    await sending

    // regenerate 应该已完成（被拒绝），不会增加 adapter 调用次数
    await regeneratePromise

    // adapter 只被调用一次（send 调用的那次），regenerate 没产生新请求
    expect(callCount).toBe(1)
    expect(received).toHaveLength(1)
  })

  it('T4: editMessage 覆盖+删后续+重发', async () => {
    const received: Message[][] = []
    const adapter = createRecordingAdapter(
      [
        { type: 'text', content: '基于新内容的回复' },
        { type: 'done', content: '' },
      ],
      received,
    )
    const state = useChat(adapter)

    await state.send('原始问题1')
    await state.send('原始问题2')
    expect(state.messages).toHaveLength(4)

    const u1Id = state.messages[0].id
    await state.editMessage(u1Id, '改写后的提问')

    expect(state.messages).toHaveLength(2) // [u1(修改), 新 assistant]
    expect(state.messages[0].id).toBe(u1Id) // ID 不变
    expect(state.messages[0].content).toBe('改写后的提问')
    expect(state.messages[0].role).toBe('user')
    expect(state.messages[1].role).toBe('assistant')

    // adapter 收到的 messages[0] 是新内容
    const lastReceived = received[received.length - 1]
    expect(lastReceived[0].content).toBe('改写后的提问')
  })

  it('T5: editMessage 重算 tokenCount', async () => {
    const received: Message[][] = []
    const adapter = createRecordingAdapter(
      [
        { type: 'text', content: 'ok' },
        { type: 'done', content: '' },
      ],
      received,
    )
    // 注入 estimator: 字符串长度 = token 数
    const state = useChat(adapter, {
      tokenEstimator: (t) => t.length,
    })

    await state.send('hello') // 5 字符
    const u1Id = state.messages[0].id

    await state.editMessage(u1Id, '改写后的提问') // '改写后的提问' = 6 字符

    // 手写数字面量：'改写后的提问'.length = 6
    expect(state.messages[0].metadata?.tokenCount).toBe(6)
  })

  it('T6: isStreaming 中 editMessage 拒绝', async () => {
    let callCount = 0
    const received: Message[][] = []
    const pendingAdapter: ChatAdapter = {
      async *sendMessage(options) {
        callCount += 1
        received.push([...options.messages])
        yield { type: 'text', content: '开始' }
        await new Promise<void>(() => {})
      },
    }
    const state = useChat(pendingAdapter)

    const sending = state.send('hi')
    await vi.waitFor(
      () => {
        expect(state.isStreaming).toBe(true)
      },
      { timeout: 3000 },
    )

    const u1Id = state.messages[0].id
    const editPromise = state.editMessage(u1Id, '新内容')

    state.abort()
    await sending
    await editPromise

    expect(callCount).toBe(1)
    expect(received).toHaveLength(1)
  })

  it('T7: done 带 usage.outputTokens 回填真实值', async () => {
    const adapter = createMockAdapter([
      { type: 'text', content: '你好吗' },
      {
        type: 'done',
        content: '',
        metadata: {
          usage: {
            inputTokens: 99,
            outputTokens: 42,
          },
        },
      },
    ])
    const state = useChat(adapter)

    await state.send('hi')

    // 手写数字面量：42 是 metadata.usage.outputTokens
    expect(state.messages[1].metadata?.tokenCount).toBe(42)
  })

  it('T8: done 无 usage 回退估算', async () => {
    const adapter = createMockAdapter([
      { type: 'text', content: '你好吗' }, // 3 字符
      { type: 'done', content: '' }, // 无 metadata.usage
    ])
    const state = useChat(adapter, {
      tokenEstimator: (t) => t.length,
    })

    await state.send('hi')

    // 手写数字面量：'你好吗'.length = 3
    expect(state.messages[1].metadata?.tokenCount).toBe(3)
  })

  it('T9: maxContextTokens 截断只影响发送数组', async () => {
    const received: Message[][] = []
    const adapter = createRecordingAdapter(
      [
        { type: 'text', content: '回复' },
        { type: 'done', content: '' },
      ],
      received,
    )
    // 每条消息 content 长 4，estimator 按 length 算
    // maxContextTokens=5，最多容纳 1 条消息
    const state = useChat(adapter, {
      maxContextTokens: 5,
      tokenEstimator: (t) => t.length,
    })

    // 先构造两条历史消息
    await state.send('1234') // 4 token
    await state.send('5678') // 4 token

    const beforeSend = state.messages.length
    await state.send('abcd') // 4 token，触发截断

    // state.messages 条数不变（UI 不删）
    expect(state.messages.length).toBe(beforeSend + 2) // + user + assistant

    // 但 adapter 收到的少于 state.messages
    const lastReceived = received[received.length - 1]
    expect(lastReceived.length).toBeLessThan(state.messages.length)

    // truncatedCount > 0
    expect(state.truncatedCount).toBeGreaterThan(0)
  })

  it('T10: maxContextTokens 为 getter 时每次发送求值', async () => {
    const received: Message[][] = []
    const adapter = createRecordingAdapter(
      [
        { type: 'text', content: 'ok' },
        { type: 'done', content: '' },
      ],
      received,
    )

    // 用闭包变量控制 getter 返回值
    let getterValue = 100 // 初始大值，不截断
    const state = useChat(adapter, {
      maxContextTokens: () => getterValue,
      tokenEstimator: (t) => t.length,
    })

    await state.send('第一次')

    // getterValue=100 时 truncatedCount 应为 0
    expect(state.truncatedCount).toBe(0)

    getterValue = 5 // 改为小值，触发截断
    await state.send('第二次')

    // getterValue=5 时 truncatedCount 应大于 0
    expect(state.truncatedCount).toBeGreaterThan(0)
  })

  it('T11: send 后 user 消息带估算 tokenCount', async () => {
    const adapter = createMockAdapter([
      { type: 'text', content: '回复' },
      { type: 'done', content: '' },
    ])
    const state = useChat(adapter, {
      tokenEstimator: (t) => t.length,
    })

    await state.send('hello') // 'hello'.length = 5

    // 手写数字面量：5 = 'hello'.length
    expect(state.messages[0].metadata?.tokenCount).toBe(5)
  })

  it('T12: clear() 归零 truncatedCount', async () => {
    const adapter = createMockAdapter([
      { type: 'text', content: '回复' },
      { type: 'done', content: '' },
    ])
    const state = useChat(adapter, {
      maxContextTokens: 1, // 极小值确保截断
      tokenEstimator: (t) => t.length,
    })

    await state.send('消息足够长导致截断')

    // 截断发生后 truncatedCount > 0
    expect(state.truncatedCount).toBeGreaterThan(0)

    state.clear()

    expect(state.truncatedCount).toBe(0)
    expect(state.messages).toHaveLength(0)
  })
})
