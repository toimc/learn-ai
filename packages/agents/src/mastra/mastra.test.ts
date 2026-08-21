import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Mock } from 'vitest'
import type { Agent } from '@mastra/core/agent'
import type { StreamChunk } from '@toimc/core'
import type { ChatMessage, ChatRequest } from '../types'
import { MastraAdapter, createMastraModel } from './index'

/** agent.stream 第二参的最小形态（映射规格约定：abortSignal + memory + 可选 modelSettings） */
interface StreamOpts {
  abortSignal?: AbortSignal
  memory?: { thread?: string; resource?: string }
  modelSettings?: { temperature?: number }
}

type StreamFn = (
  messages: ChatMessage[],
  opts?: StreamOpts,
) => Promise<{ fullStream: AsyncGenerator<unknown, void, unknown> }>

type GenerateFn = (
  messages: ChatMessage[],
  opts?: StreamOpts,
) => Promise<unknown>

function fakeAgent(
  parts: unknown[],
  generateResult?: unknown,
): { agent: Agent; stream: Mock<StreamFn>; generate: Mock<GenerateFn> } {
  const stream = vi.fn<StreamFn>(async () => ({
    fullStream: (async function* () {
      for (const part of parts) yield part
    })(),
  }))
  const generate = vi.fn<GenerateFn>(async () => generateResult ?? { text: '' })
  return { agent: { stream, generate } as unknown as Agent, stream, generate }
}

const textDelta = (text: string) => ({
  type: 'text-delta',
  payload: { id: 't1', text },
})

const reasoningDelta = (text: string) => ({
  type: 'reasoning-delta',
  payload: { id: 'r1', text },
})

const toolStart = (toolCallId: string, toolName: string) => ({
  type: 'tool-call-input-streaming-start',
  payload: { toolCallId, toolName },
})

const toolDelta = (toolCallId: string, argsTextDelta: string) => ({
  type: 'tool-call-delta',
  payload: { toolCallId, argsTextDelta },
})

const toolEnd = (toolCallId: string) => ({
  type: 'tool-call-input-streaming-end',
  payload: { toolCallId },
})

const toolCall = (
  toolCallId: string,
  toolName: string,
  args: Record<string, unknown>,
) => ({
  type: 'tool-call',
  payload: { toolCallId, toolName, args },
})

const toolResult = (
  toolCallId: string,
  toolName: string,
  result: unknown,
  isError = false,
) => ({
  type: 'tool-result',
  payload: isError
    ? { toolCallId, toolName, result, isError }
    : { toolCallId, toolName, result },
})

const toolError = (toolCallId: string, toolName: string, error: unknown) => ({
  type: 'tool-error',
  payload: { toolCallId, toolName, error },
})

const errorEvent = (error: unknown) => ({
  type: 'error',
  payload: { error },
})

function request(overrides: Partial<ChatRequest> = {}): ChatRequest {
  return { messages: [{ role: 'user', content: '北京天气' }], ...overrides }
}

async function collect(
  gen: AsyncGenerator<StreamChunk>,
): Promise<StreamChunk[]> {
  const chunks: StreamChunk[] = []
  for await (const chunk of gen) chunks.push(chunk)
  return chunks
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('MastraAdapter.chatStream 流事件映射', () => {
  it('text-delta 依次映射为 text chunk，流自然耗尽不补发 done', async () => {
    const { agent } = fakeAgent([textDelta('你'), textDelta('好')])
    const chunks = await collect(new MastraAdapter(agent).chatStream(request()))
    expect(chunks).toEqual([
      { type: 'text', content: '你' },
      { type: 'text', content: '好' },
    ])
  })

  it('reasoning-delta 映射为 thinking chunk', async () => {
    const { agent } = fakeAgent([reasoningDelta('先查一下天气')])
    const chunks = await collect(new MastraAdapter(agent).chatStream(request()))
    expect(chunks).toEqual([{ type: 'thinking', content: '先查一下天气' }])
  })

  it('流式工具链：start 发无参 tool_call，end 发完整 toolArguments，delta 阶段无输出', async () => {
    const { agent } = fakeAgent([
      toolStart('call_1', 'get_weather'),
      toolDelta('call_1', '{"city"'),
      toolDelta('call_1', ':"Beijing"}'),
      toolEnd('call_1'),
    ])
    const chunks = await collect(new MastraAdapter(agent).chatStream(request()))
    expect(chunks).toEqual([
      {
        type: 'tool_call',
        content: '',
        metadata: { toolCallId: 'call_1', toolName: 'get_weather' },
      },
      {
        type: 'tool_call',
        content: '',
        metadata: {
          toolCallId: 'call_1',
          toolName: 'get_weather',
          toolArguments: { city: 'Beijing' },
        },
      },
    ])
  })

  it('分片 JSON 拼不出合法对象时 toolArguments 退为 { raw: 原始字符串 }', async () => {
    const { agent } = fakeAgent([
      toolStart('call_9', 'search'),
      toolDelta('call_9', '{"q":'),
      toolDelta('call_9', ' broken}'),
      toolEnd('call_9'),
    ])
    const chunks = await collect(new MastraAdapter(agent).chatStream(request()))
    expect(chunks).toEqual([
      {
        type: 'tool_call',
        content: '',
        metadata: { toolCallId: 'call_9', toolName: 'search' },
      },
      {
        type: 'tool_call',
        content: '',
        metadata: {
          toolCallId: 'call_9',
          toolName: 'search',
          toolArguments: { raw: '{"q": broken}' },
        },
      },
    ])
  })

  it('非流式 tool-call 完整事件映射为单个含 args 的 tool_call', async () => {
    const { agent } = fakeAgent([toolCall('call_2', 'get_time', { tz: 'UTC' })])
    const chunks = await collect(new MastraAdapter(agent).chatStream(request()))
    expect(chunks).toEqual([
      {
        type: 'tool_call',
        content: '',
        metadata: {
          toolCallId: 'call_2',
          toolName: 'get_time',
          toolArguments: { tz: 'UTC' },
        },
      },
    ])
  })

  it('同 toolCallId 已走流式路径后，后续 tool-call 完整事件去重不发包', async () => {
    const { agent } = fakeAgent([
      toolStart('call_1', 'get_weather'),
      toolDelta('call_1', '{"city"'),
      toolDelta('call_1', ':"Beijing"}'),
      toolEnd('call_1'),
      toolCall('call_1', 'get_weather', { city: 'Beijing' }),
    ])
    const chunks = await collect(new MastraAdapter(agent).chatStream(request()))
    expect(chunks).toEqual([
      {
        type: 'tool_call',
        content: '',
        metadata: { toolCallId: 'call_1', toolName: 'get_weather' },
      },
      {
        type: 'tool_call',
        content: '',
        metadata: {
          toolCallId: 'call_1',
          toolName: 'get_weather',
          toolArguments: { city: 'Beijing' },
        },
      },
    ])
  })

  it('tool-result 正常结果映射 toolResult', async () => {
    const { agent } = fakeAgent([
      toolResult('call_1', 'get_weather', { temp: 25, cond: '晴' }),
    ])
    const chunks = await collect(new MastraAdapter(agent).chatStream(request()))
    expect(chunks).toEqual([
      {
        type: 'tool_result',
        content: '',
        metadata: {
          toolCallId: 'call_1',
          toolName: 'get_weather',
          toolResult: { temp: 25, cond: '晴' },
        },
      },
    ])
  })

  it('tool-result isError 时映射 toolError：Error 取 message，其余字符串化', async () => {
    const { agent } = fakeAgent([
      toolResult('call_e1', 'get_weather', new Error('boom'), true),
      toolResult('call_e2', 'get_time', '上游限流', true),
    ])
    const chunks = await collect(new MastraAdapter(agent).chatStream(request()))
    expect(chunks).toEqual([
      {
        type: 'tool_result',
        content: '',
        metadata: {
          toolCallId: 'call_e1',
          toolName: 'get_weather',
          toolError: 'boom',
        },
      },
      {
        type: 'tool_result',
        content: '',
        metadata: {
          toolCallId: 'call_e2',
          toolName: 'get_time',
          toolError: '上游限流',
        },
      },
    ])
  })

  it('tool-error 事件映射为 tool_result 的 toolError', async () => {
    const { agent } = fakeAgent([
      toolError('call_3', 'search', new Error('network down')),
    ])
    const chunks = await collect(new MastraAdapter(agent).chatStream(request()))
    expect(chunks).toEqual([
      {
        type: 'tool_result',
        content: '',
        metadata: {
          toolCallId: 'call_3',
          toolName: 'search',
          toolError: 'network down',
        },
      },
    ])
  })

  it('error 事件映射 error chunk 并终止生成器，后续输入事件不再产出', async () => {
    const { agent } = fakeAgent([
      errorEvent(new Error('上游超时')),
      textDelta('不应出现'),
    ])
    const chunks = await collect(new MastraAdapter(agent).chatStream(request()))
    expect(chunks).toEqual([{ type: 'error', content: '上游超时' }])
  })

  it('未约定的 type（step-start/text-end）不产出任何 chunk', async () => {
    const { agent } = fakeAgent([
      { type: 'step-start', payload: {} },
      { type: 'text-end', payload: { id: 't1' } },
    ])
    const chunks = await collect(new MastraAdapter(agent).chatStream(request()))
    expect(chunks).toEqual([])
  })
})

describe('MastraAdapter.chatStream 请求参数映射', () => {
  it('conversationId 存在时 memory.thread 用该值，signal 与 messages 原样透传，resource 默认 ai-chat', async () => {
    const { agent, stream } = fakeAgent([textDelta('ok')])
    const controller = new AbortController()
    await collect(
      new MastraAdapter(agent).chatStream(
        request({
          signal: controller.signal,
          passthrough: { conversationId: 'conv-123' },
        }),
      ),
    )
    expect(stream).toHaveBeenCalledTimes(1)
    const [messages, opts] = stream.mock.calls[0]
    expect(messages).toEqual([{ role: 'user', content: '北京天气' }])
    expect(opts?.abortSignal).toBe(controller.signal)
    expect(opts?.memory?.thread).toBe('conv-123')
    expect(opts?.memory?.resource).toBe('ai-chat')
  })

  it('无 conversationId 时 thread 为 mastra_thread_ 前缀的非空生成 id', async () => {
    const { agent, stream } = fakeAgent([textDelta('ok')])
    await collect(new MastraAdapter(agent).chatStream(request()))
    const thread = stream.mock.calls[0][1]?.memory?.thread
    expect(typeof thread).toBe('string')
    expect((thread ?? '').startsWith('mastra_thread_')).toBe(true)
    expect((thread ?? '').length).toBeGreaterThan('mastra_thread_'.length)
  })

  it('options.resource 覆盖默认 resource', async () => {
    const { agent, stream } = fakeAgent([textDelta('ok')])
    await collect(
      new MastraAdapter(agent, { resource: 'x' }).chatStream(request()),
    )
    expect(stream.mock.calls[0][1]?.memory?.resource).toBe('x')
  })

  it('temperature 透传 modelSettings，未传时第二参无 modelSettings 字段', async () => {
    const hot = fakeAgent([textDelta('ok')])
    await collect(
      new MastraAdapter(hot.agent).chatStream(request({ temperature: 0.5 })),
    )
    expect(hot.stream.mock.calls[0][1]?.modelSettings).toEqual({
      temperature: 0.5,
    })

    const plain = fakeAgent([textDelta('ok')])
    await collect(new MastraAdapter(plain.agent).chatStream(request()))
    expect('modelSettings' in (plain.stream.mock.calls[0][1] ?? {})).toBe(false)
  })
})

describe('MastraAdapter.chat', () => {
  it('generate 结果映射 ChatResponse：text 进 content，usage 双字段换名，model 非空', async () => {
    const { agent, generate } = fakeAgent([], {
      text: '答案',
      usage: { inputTokens: 10, outputTokens: 5 },
    })
    const response = await new MastraAdapter(agent).chat(request())
    expect(generate).toHaveBeenCalledTimes(1)
    expect(response.content).toBe('答案')
    expect(response.usage).toEqual({ promptTokens: 10, completionTokens: 5 })
    expect(typeof response.model).toBe('string')
    expect(response.model.length).toBeGreaterThan(0)
  })

  it('usage 缺失或无数字 token 字段时为 undefined', async () => {
    const missing = fakeAgent([], { text: 'hi' })
    const withoutUsage = await new MastraAdapter(missing.agent).chat(request())
    expect(withoutUsage.usage).toBeUndefined()

    const empty = fakeAgent([], { text: 'hi', usage: {} })
    const emptyUsage = await new MastraAdapter(empty.agent).chat(request())
    expect(emptyUsage.usage).toBeUndefined()
  })
})

describe('createMastraModel', () => {
  it('name/description 缺省回退 id 与空串，provider 固定 mastra，adapter 为 MastraAdapter 实例', () => {
    const model = createMastraModel({ id: 'demo', model: 'mock/mock-model' })
    expect(model.info.name).toBe('demo')
    expect(model.info.description).toBe('')
    expect(model.info.provider).toBe('mastra')
    expect(model.adapter instanceof MastraAdapter).toBe(true)
  })

  it('显式 name/description 优先，agent 字段携带可 stream/generate 的 Mastra Agent', () => {
    const model = createMastraModel({
      id: 'demo',
      name: '演示模型',
      description: 'Mastra 演示服务',
      model: 'mock/mock-model',
    })
    expect(model.info.name).toBe('演示模型')
    expect(model.info.description).toBe('Mastra 演示服务')
    const agent = model.agent as unknown as Record<string, unknown>
    expect(typeof agent).toBe('object')
    expect(agent).not.toBeNull()
    expect(typeof agent.stream).toBe('function')
    expect(typeof agent.generate).toBe('function')
  })
})
