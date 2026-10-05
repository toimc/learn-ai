import { describe, expect, it, vi } from 'vitest'
import type { StreamChunk } from '@toimc/core'
import { createDevApp } from '../../src/app'
import { createWorkflowsRoutes } from '../../src/routes/workflows'
import type { DevServerEnv } from '../../src/env'

/**
 * workflow HTTP 路由测试（hono app.request 直调，不监听端口）。
 * 正常运行路径以 docs-council 端到端覆盖：mock 掉 orchestration/children 的
 * 假 agent（generate 返回固定文本，零网络零真实模型），整条链路
 * HTTP POST → createRun → stream → workflowEventToChunks → SSE 帧确定性可断言。
 * 其余覆盖：列表门控、404/400 可读错误与 app.ts 挂载。
 */

/** 假 agent 的固定产出：writer 步的 text 即 finish finalReport 的预期字面量 */
const FAKE_AGENT_TEXT = '综合报告：组件用法齐全'

vi.mock('../../src/orchestration/children', () => ({
  teamDefinitions: () => [
    { id: 'researcher-agent', name: '检索员' },
    { id: 'writer-agent', name: '起草员' },
    { id: 'reviewer-agent', name: '审查员' },
  ],
  instantiateAgent: () => ({
    generate: async () => ({ text: FAKE_AGENT_TEXT }),
  }),
}))

const MOCK_ENV: DevServerEnv = {
  port: 8787,
  mastra: null,
  embedding: null,
  observability: false,
}
const MASTRA_ENV: DevServerEnv = {
  port: 8787,
  mastra: { model: 'main-model' },
  embedding: null,
  observability: false,
}

function postRun(
  app: ReturnType<typeof createWorkflowsRoutes>,
  id: string,
  body: unknown,
) {
  return app.request(`/${id}/run`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('GET /api/workflows', () => {
  it('未配 MASTRA_MODEL 返回 200 空列表（前端据此落 mock 轨，不报错）', async () => {
    const res = await createWorkflowsRoutes(MOCK_ENV).request('/')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ workflows: [] })
  })

  it('配了 MASTRA_MODEL 返回三项（id 与 description）', async () => {
    const res = await createWorkflowsRoutes(MASTRA_ENV).request('/')
    expect(res.status).toBe(200)
    const { workflows } = (await res.json()) as {
      workflows: { id: string; description: string }[]
    }
    expect(workflows.map((w) => w.id)).toEqual([
      'docs-pipeline-workflow',
      'docs-council-workflow',
      'docs-supervisor-workflow',
    ])
    for (const w of workflows) {
      expect(w.description.length).toBeGreaterThan(0)
    }
  })

  it('挂载进 dev app：纯 mock 模式下 GET /api/workflows 同样返回空列表', async () => {
    const app = await createDevApp(MOCK_ENV)
    const res = await app.request('/api/workflows')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ workflows: [] })
  })
})

describe('POST /api/workflows/:id/run 参数校验', () => {
  it('未知 id 返回 404 可读错误', async () => {
    const res = await postRun(createWorkflowsRoutes(MASTRA_ENV), 'nope', {
      task: 'x',
    })
    expect(res.status).toBe(404)
    const { error } = (await res.json()) as { error: string }
    expect(error).toContain('nope')
  })

  it('纯 mock 模式（未配 MASTRA_MODEL）同样 404，提示配置而非裸报错', async () => {
    const res = await postRun(
      createWorkflowsRoutes(MOCK_ENV),
      'docs-pipeline-workflow',
      { task: 'x' },
    )
    expect(res.status).toBe(404)
    const { error } = (await res.json()) as { error: string }
    expect(error).toContain('MASTRA_MODEL')
  })

  it('空 task 返回 400 可读错误', async () => {
    const res = await postRun(
      createWorkflowsRoutes(MASTRA_ENV),
      'docs-pipeline-workflow',
      { task: '' },
    )
    expect(res.status).toBe(400)
    const { error } = (await res.json()) as { error: string }
    expect(error).toContain('task')
  })

  it('task 缺失（body 为空对象）同样 400', async () => {
    const res = await postRun(
      createWorkflowsRoutes(MASTRA_ENV),
      'docs-pipeline-workflow',
      {},
    )
    expect(res.status).toBe(400)
    expect(((await res.json()) as { error: string }).error).toContain('task')
  })

  it('body 非法 JSON 同样 400（不抛 500）', async () => {
    const app = createWorkflowsRoutes(MASTRA_ENV)
    const res = await app.request('/docs-pipeline-workflow/run', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'not-json',
    })
    expect(res.status).toBe(400)
  })
})

describe('POST /api/workflows/:id/run 端到端（假 agent，零网络）', () => {
  /** 从 SSE 文本里解出全部 chunk 载荷（与前端 sse-adapter 同构的简化解析） */
  function parseChunks(body: string): StreamChunk[] {
    return body.split('\n\n').flatMap((frame) =>
      frame
        .split('\n')
        .filter((line) => line.startsWith('data:'))
        .map((line) => JSON.parse(line.slice(5).trim()) as StreamChunk),
    )
  }

  it('docs-council 全链路：step 帧 + text 帧（=假 agent 产出）+ done 收尾', async () => {
    const res = await postRun(
      createWorkflowsRoutes(MASTRA_ENV),
      'docs-council-workflow',
      { task: 'Conversation 怎么用' },
    )
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/event-stream')

    const body = await res.text()
    expect(body).toContain('event: chunk')
    const chunks = parseChunks(body)

    // docs-council：3 并行 retrieve + 1 synthesize → 4 对 tool 帧 + text + done
    const types = chunks.map((c) => c.type)
    expect(types.filter((t) => t === 'tool_call')).toHaveLength(4)
    expect(types.filter((t) => t === 'tool_result')).toHaveLength(4)

    // toolName 多重集合（并行步顺序不定，不排顺序）
    const toolNames = chunks
      .filter((c) => c.type === 'tool_call')
      .map((c) => c.metadata?.toolName)
      .sort()
    expect(toolNames).toEqual(
      ['retrieve_api', 'retrieve_data', 'retrieve_theme', 'synthesize'].sort(),
    )

    // tool_call / tool_result 按 toolCallId 一一配对
    const callIds = chunks
      .filter((c) => c.type === 'tool_call')
      .map((c) => c.metadata?.toolCallId)
    const resultIds = chunks
      .filter((c) => c.type === 'tool_result')
      .map((c) => c.metadata?.toolCallId)
    expect(resultIds.sort()).toEqual([...callIds].sort())

    // text 帧恰一个：finish 提取 finalReport（假 agent 固定产出），done 收尾
    const textChunks = chunks.filter((c) => c.type === 'text')
    expect(textChunks).toHaveLength(1)
    expect(textChunks[0]?.content).toBe(FAKE_AGENT_TEXT)
    expect(chunks[chunks.length - 1]?.type).toBe('done')
  })
})
