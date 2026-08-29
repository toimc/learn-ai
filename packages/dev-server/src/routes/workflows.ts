import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { z } from 'zod'
import type { StreamChunk } from '@toimc/core'
import type { DevServerEnv } from '../env'
import { workflowEventToChunks } from '../workflows/event-mapping'
import { buildWorkflowRegistry } from '../workflows/registry'

const runBodySchema = z.object({
  task: z.string().min(1),
})

/**
 * workflow HTTP 路由（挂载在网关 basePath 下，实际路径 /api/workflows）：
 * - GET /：列出注册表（env 未配 MASTRA_MODEL 时返回空列表，前端据此落 mock 轨）
 * - POST /:id/run：zod 校验 → createRun → 逐事件 workflowEventToChunks →
 *   SSE 逐帧输出（event: chunk，与 /api/chat 同线协议，前端零改动复用渲染）。
 * 收尾对齐 chat.ts：客户端断开不算错误（不补帧），异常以 error 帧收尾，
 * 流末无 done 时兜底补帧保持线协议可解析。
 */
export function createWorkflowsRoutes(env: DevServerEnv): Hono {
  const app = new Hono()

  app.get('/', (c) => {
    // 未配 MASTRA_MODEL（纯 mock 模式）不报错：registry 为空即空列表
    const workflows = env.mastra
      ? buildWorkflowRegistry(env.mastra).map(({ id, description }) => ({
          id,
          description,
        }))
      : []
    return c.json({ workflows })
  })

  app.post('/:id/run', async (c) => {
    const id = c.req.param('id')
    const entry = env.mastra
      ? buildWorkflowRegistry(env.mastra).find((w) => w.id === id)
      : undefined
    if (!entry) {
      return c.json(
        {
          error: env.mastra
            ? `未找到工作流：${id}`
            : '工作流不可用：未配置 MASTRA_MODEL（参照 packages/dev-server/.env.example 配置后重启）',
        },
        404,
      )
    }

    const parsed = runBodySchema.safeParse(await c.req.json().catch(() => null))
    if (!parsed.success) {
      return c.json(
        { error: 'task 不能为空（body 需为 JSON：{ "task": "非空字符串" }）' },
        400,
      )
    }

    return streamSSE(c, async (stream) => {
      let sentDone = false
      try {
        const run = await entry.create().createRun()
        const output = await run.stream({
          inputData: { task: parsed.data.task },
        })
        const reader = output.fullStream.getReader()
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          if (stream.aborted) {
            // 客户端断开不算错误：取消上游读取即返回，不补帧
            await reader.cancel().catch(() => {})
            return
          }
          for (const chunk of workflowEventToChunks(value)) {
            if (chunk.type === 'done') sentDone = true
            await stream.writeSSE({
              event: 'chunk',
              data: JSON.stringify(chunk),
            })
          }
        }
        if (!sentDone) {
          // 流末未见 workflow-finish（如 suspended 中止）：兜底补 done 帧
          const done: StreamChunk = { type: 'done', content: '' }
          await stream.writeSSE({ event: 'chunk', data: JSON.stringify(done) })
        }
      } catch (err) {
        const errorChunk: StreamChunk = {
          type: 'error',
          content: err instanceof Error ? err.message : String(err),
        }
        await stream.writeSSE({
          event: 'chunk',
          data: JSON.stringify(errorChunk),
        })
      }
    })
  })

  return app
}
