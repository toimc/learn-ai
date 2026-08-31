import type { ChatAdapter, SendMessageOptions, StreamChunk } from '@toimc/core'
import { DEV_SERVER_BASE_URL } from './dev-server-url'
import { httpErrorMessage, parseSseStream } from './sse-adapter'

export interface WorkflowSseAdapterOptions {
  baseUrl?: string
  /** 每次发送时取当前选中的 workflow id（闭包注入，随切换更新） */
  getWorkflowId: () => string
}

/** GET /api/workflows 的列表项（未配 MASTRA_MODEL 时服务端返回空数组） */
export interface WorkflowSummary {
  id: string
  description: string
}

const DEFAULT_BASE_URL = DEV_SERVER_BASE_URL

/** 探活 + 列表：dev-server 的原生 Workflow 注册表 */
export async function fetchWorkflows(
  baseUrl = DEFAULT_BASE_URL,
): Promise<WorkflowSummary[]> {
  const res = await fetch(`${baseUrl}/api/workflows`)
  if (!res.ok) throw new Error(await httpErrorMessage(res))
  const data = (await res.json()) as { workflows?: WorkflowSummary[] }
  return Array.isArray(data.workflows) ? data.workflows : []
}

/**
 * 原生 Workflow 运行的 ChatAdapter：POST /api/workflows/:id/run 消费 SSE 流。
 * 帧格式与 /api/chat 完全一致（step 事件已由服务端映射为 tool_call/tool_result）。
 * workflow 不是对话：只取最后一条 user 消息作为 task，不携带历史。
 */
export function createWorkflowSseAdapter(
  options: WorkflowSseAdapterOptions,
): ChatAdapter {
  const baseUrl = options.baseUrl ?? DEFAULT_BASE_URL

  return {
    async *sendMessage(opts: SendMessageOptions): AsyncGenerator<StreamChunk> {
      const signal = opts.signal
      const lastUser = [...opts.messages]
        .reverse()
        .find((m) => m.role === 'user')
      const task = lastUser?.content ?? ''

      let response: Response
      try {
        response = await fetch(
          `${baseUrl}/api/workflows/${options.getWorkflowId()}/run`,
          {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ task }),
            signal,
          },
        )
      } catch (err) {
        // 中断不算错误，直接结束流
        if (signal?.aborted || isAbortError(err)) return
        throw new Error(`dev-server unreachable (${baseUrl})`, { cause: err })
      }

      if (!response.ok) {
        throw new Error(await httpErrorMessage(response))
      }
      if (!response.body) {
        throw new Error('dev-server response has no body')
      }

      yield* parseSseStream(response.body, signal)
    },
  }
}

function isAbortError(err: unknown): boolean {
  return err instanceof Error && err.name === 'AbortError'
}
