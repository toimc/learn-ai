import { describe, expect, it, vi, afterEach } from 'vitest'
import type { Message, StreamChunk } from '@toimc/core'
import {
  createWorkflowSseAdapter,
  fetchWorkflows,
} from '../../src/mock/workflow-adapter'

function sseBody(frames: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  let i = 0
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (i < frames.length) {
        controller.enqueue(encoder.encode(frames[i]))
        i += 1
      } else {
        controller.close()
      }
    },
  })
}

function okSseResponse(frames: string[]): Response {
  return new Response(sseBody(frames), {
    status: 200,
    headers: { 'content-type': 'text/event-stream' },
  })
}

function msg(id: string, role: Message['role'], content: string): Message {
  return { id, role, content, createdAt: new Date() }
}

describe('createWorkflowSseAdapter', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('POST 到选中 workflow 的 /run 端点，body 只含最后一条 user 消息的 task', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        okSseResponse([
          'event: chunk\ndata: {"type":"tool_call","content":"","metadata":{"toolCallId":"s_retrieve","toolName":"retrieve","toolArguments":{"query":"Enter 键"}}}\n\n',
          'event: chunk\ndata: {"type":"tool_result","content":"","metadata":{"toolCallId":"s_retrieve","toolName":"retrieve","toolResult":{"hits":2},"duration":300}}\n\n',
          'event: chunk\ndata: {"type":"text","content":"检索完成，报告如下。"}\n\n',
          'event: chunk\ndata: {"type":"done","content":""}\n\n',
        ]),
      )
    vi.stubGlobal('fetch', fetchMock)

    const workflowId = 'docs-pipeline-workflow'
    const adapter = createWorkflowSseAdapter({
      baseUrl: 'http://localhost:8787',
      getWorkflowId: () => workflowId,
    })
    const chunks: StreamChunk[] = []
    for await (const chunk of adapter.sendMessage({
      messages: [
        msg('m1', 'user', '上一轮的任务'),
        msg('m2', 'assistant', '上一轮的报告'),
        msg('m3', 'user', 'InputArea 的 Enter 键行为是什么？'),
      ],
    })) {
      chunks.push(chunk)
    }

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe(
      'http://localhost:8787/api/workflows/docs-pipeline-workflow/run',
    )
    expect(init.method).toBe('POST')
    expect(init.headers['content-type']).toBe('application/json')
    // workflow 不是对话：只取最后一条 user 消息，不带历史
    expect(JSON.parse(init.body)).toEqual({
      task: 'InputArea 的 Enter 键行为是什么？',
    })

    expect(chunks.map((c) => c.type)).toEqual([
      'tool_call',
      'tool_result',
      'text',
      'done',
    ])
    expect(chunks[0].metadata?.toolName).toBe('retrieve')
    expect(chunks[1].metadata?.toolResult).toEqual({ hits: 2 })
    expect(chunks[2].content).toBe('检索完成，报告如下。')
  })

  it('getWorkflowId 闭包每次发送求值：切换 workflow 后打到新端点', async () => {
    // 每次调用返回新 Response：同一个 Response 的 body 只能被读一次
    const fetchMock = vi
      .fn()
      .mockImplementation(() =>
        Promise.resolve(
          okSseResponse(['data: {"type":"done","content":""}\n\n']),
        ),
      )
    vi.stubGlobal('fetch', fetchMock)

    let workflowId = 'docs-pipeline-workflow'
    const adapter = createWorkflowSseAdapter({
      getWorkflowId: () => workflowId,
    })
    let consumed = 0
    for (const task of ['任务一', '任务二']) {
      for await (const chunk of adapter.sendMessage({
        messages: [msg('a', 'user', task)],
      })) {
        expect(chunk.type).toBe('done')
        consumed += 1
      }
      workflowId = 'docs-supervisor-workflow'
    }
    expect(consumed).toBe(2)

    const urls = fetchMock.mock.calls.map((c) => c[0])
    expect(urls).toEqual([
      'http://localhost:8787/api/workflows/docs-pipeline-workflow/run',
      'http://localhost:8787/api/workflows/docs-supervisor-workflow/run',
    ])
  })

  it('已中断的 signal 静默结束流，不抛错', async () => {
    const fetchMock = vi.fn().mockRejectedValue(
      Object.assign(new Error('The operation was aborted'), {
        name: 'AbortError',
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const controller = new AbortController()
    controller.abort()
    const adapter = createWorkflowSseAdapter({ getWorkflowId: () => 'w' })

    const chunks: StreamChunk[] = []
    // 不抛错即通过（异常路径必须有产出：零 chunk 且无异常泄漏）
    for await (const chunk of adapter.sendMessage({
      messages: [msg('a', 'user', '任务')],
      signal: controller.signal,
    })) {
      chunks.push(chunk)
    }
    expect(chunks).toEqual([])
  })

  it('HTTP 非 2xx 抛出可读错误（带服务端 error 详情）', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: 'workflow not found: x' }), {
          status: 404,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    )
    const adapter = createWorkflowSseAdapter({ getWorkflowId: () => 'x' })
    await expect(
      adapter.sendMessage({ messages: [msg('a', 'user', '任务')] }).next(),
    ).rejects.toThrow('HTTP 404: workflow not found: x')
  })

  it('服务端不可达时抛出可读错误', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new TypeError('fetch failed')),
    )
    const adapter = createWorkflowSseAdapter({ getWorkflowId: () => 'w' })
    await expect(
      adapter.sendMessage({ messages: [msg('a', 'user', '任务')] }).next(),
    ).rejects.toThrow('dev-server unreachable')
  })
})

describe('fetchWorkflows', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('GET /api/workflows 返回 workflow 列表', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          workflows: [
            { id: 'docs-pipeline-workflow', description: '流水线' },
            { id: 'docs-council-workflow', description: '并行' },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    )
    vi.stubGlobal('fetch', fetchMock)

    const list = await fetchWorkflows('http://localhost:8787')
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8787/api/workflows',
    )
    expect(list).toEqual([
      { id: 'docs-pipeline-workflow', description: '流水线' },
      { id: 'docs-council-workflow', description: '并行' },
    ])
  })

  it('未配 MASTRA_MODEL 时返回空数组（workflows: []）', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ workflows: [] }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    )
    expect(await fetchWorkflows()).toEqual([])
  })

  it('响应缺 workflows 字段时回退空数组', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('{}', { status: 200 })),
    )
    expect(await fetchWorkflows()).toEqual([])
  })
})
