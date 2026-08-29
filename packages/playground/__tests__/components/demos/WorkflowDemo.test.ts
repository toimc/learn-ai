import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import { setAiChatLocale } from '@toimc/vue'
import WorkflowDemo from '../../../src/components/demos/WorkflowDemo.vue'

// jsdom 的 navigator.language 为 en-US，断言中文文案前先钉回 zh-CN
beforeEach(() => setAiChatLocale('zh-CN', { persist: false }))

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function sseResponse(frames: string[]): Response {
  const encoder = new TextEncoder()
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const frame of frames) controller.enqueue(encoder.encode(frame))
      controller.close()
    },
  })
  return new Response(body, {
    status: 200,
    headers: { 'content-type': 'text/event-stream' },
  })
}

const WORKFLOW_LIST = {
  workflows: [
    {
      id: 'docs-pipeline-workflow',
      description: 'retrieve → draft → review → report',
    },
    { id: 'docs-council-workflow', description: '三路并行检索 → synthesize' },
    { id: 'docs-supervisor-workflow', description: '主管决策循环 → report' },
  ],
}

/** GET /api/workflows + POST run/chat 双端点 fetch stub */
function stubFetch(
  getResponse: Response | Error,
  runResponse = sseResponse(['data: {"type":"done","content":""}\n\n']),
) {
  return vi.fn(async (url: string, init?: RequestInit) => {
    if (url.endsWith('/api/workflows')) {
      if (getResponse instanceof Error) throw getResponse
      return getResponse
    }
    void init
    return runResponse
  })
}

async function mountDemo(fetchMock: ReturnType<typeof stubFetch>) {
  vi.stubGlobal('fetch', fetchMock)
  const w = mount(WorkflowDemo)
  await flushPromises()
  return w
}

async function submit(w: Awaited<ReturnType<typeof mountDemo>>, text: string) {
  await w.get('textarea').setValue(text)
  await w.get('textarea').trigger('keydown', { key: 'Enter', altKey: true })
  await flushPromises()
  await nextTick()
}

const TASK = 'InputArea 的 Enter 键行为是什么？'

describe('WorkflowDemo 轨道逻辑', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('GET 返回空列表 → mock 轨：显示 mock 徽章与近似说明，发送打 /api/chat 并带【流水线】前缀', async () => {
    const fetchMock = stubFetch(jsonResponse({ workflows: [] }))
    const w = await mountDemo(fetchMock)

    // mock 轨徽章与近似说明可见
    expect(w.get('.wf-demo__mode').text()).toBe('mock 剧本近似')
    expect(w.text()).toContain('近似剧本')

    await submit(w, TASK)

    const run = fetchMock.mock.calls.find((c) => c[0].includes('/run'))
    const chat = fetchMock.mock.calls.find((c) => c[0].endsWith('/api/chat'))
    expect(run).toBeUndefined()
    expect(chat).toBeDefined()
    const payload = JSON.parse(chat![1].body)
    const last = payload.messages.at(-1)
    expect(last.role).toBe('user')
    expect(last.content).toBe(`【流水线】${TASK}`)
  })

  it('GET 返回三项 → 真实轨：徽章标原生运行，发送 POST /api/workflows/<选中id>/run 且 body 是 { task }', async () => {
    const fetchMock = stubFetch(jsonResponse(WORKFLOW_LIST))
    const w = await mountDemo(fetchMock)

    expect(w.text()).toContain('原生 Workflow 运行')
    // 服务端 description 展示（真实轨取服务端数据）
    expect(w.text()).toContain('retrieve → draft → review → report')

    await submit(w, TASK)

    const run = fetchMock.mock.calls.find((c) => c[0].includes('/run'))
    expect(run).toBeDefined()
    expect(run![0]).toBe(
      'http://localhost:8787/api/workflows/docs-pipeline-workflow/run',
    )
    expect(run![1].method).toBe('POST')
    expect(JSON.parse(run![1].body)).toEqual({ task: TASK })
  })

  it('真实轨切换 workflow：发送打到新选中的 council 端点', async () => {
    const fetchMock = stubFetch(jsonResponse(WORKFLOW_LIST))
    const w = await mountDemo(fetchMock)

    await w.findAll('.wf-demo__pattern-btn')[1].trigger('click')
    await submit(w, TASK)

    const run = fetchMock.mock.calls.find((c) => c[0].includes('/run'))
    expect(run![0]).toBe(
      'http://localhost:8787/api/workflows/docs-council-workflow/run',
    )
  })

  it('GET 失败 → 离线提示 + 重试按钮，重试再次发起探活', async () => {
    const fetchMock = stubFetch(new TypeError('fetch failed'))
    const w = await mountDemo(fetchMock)

    expect(w.text()).toContain('未连接')
    expect(w.text()).toContain('无法连接 dev-server')
    expect(fetchMock).toHaveBeenCalledTimes(1)

    await w.get('.wf-demo__status button').trigger('click')
    await flushPromises()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('消息流里的 workflow step（toolCalls）渲染为 ToolCall 分支', async () => {
    const fetchMock = stubFetch(jsonResponse(WORKFLOW_LIST))
    const w = await mountDemo(fetchMock)

    w.vm.chat.messages.push({
      id: 'm_scripted',
      role: 'assistant',
      content: '报告完成。',
      createdAt: new Date(),
      toolCalls: [
        {
          id: 'step_retrieve',
          name: 'retrieve',
          arguments: { query: TASK },
          status: 'completed',
          result: { hits: 2 },
          duration: 300,
        },
        {
          id: 'step_report',
          name: 'report',
          arguments: {},
          status: 'completed',
          result: { markdown: '# 报告' },
          duration: 120,
        },
      ],
    })
    await nextTick()

    expect(w.findAll('.ai-chat-tool-call')).toHaveLength(2)
    expect(w.text()).toContain('retrieve')
    expect(w.text()).toContain('report')
  })
})
