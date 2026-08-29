import type { StreamChunk } from '@toimc/core'

/**
 * Mastra 1.60 workflow 流事件 → @toimc/core StreamChunk 线协议的映射。
 * 事件形态以 2026-08 真实运行捕获为准：官方 .d.ts 的 WorkflowStreamEvent
 * 落后于运行时（缺 stepName/startedAt/endedAt/error 等实测字段），故此处以
 * 宽容结构接收（payload: unknown，函数内收窄），未知事件类型一律不发包。
 * 前端零协议改动：step 起止复用 tool_call/tool_result 渲染，finish 的
 * finalDraft/finalReport 走 text 帧，失败走 error 帧收尾。
 */
export interface WorkflowEventLike {
  type: string
  payload?: unknown
}

/**
 * 单个 workflow 事件映射为零到多帧 StreamChunk（finish 会拆成两帧，
 * start 与未登记事件返回空数组）。
 */
export function workflowEventToChunks(event: WorkflowEventLike): StreamChunk[] {
  const payload = asRecord(event.payload)
  switch (event.type) {
    case 'workflow-step-start':
      return [
        {
          type: 'tool_call',
          content: '',
          metadata: {
            toolCallId: str(payload.stepCallId),
            toolName: str(payload.stepName),
            toolArguments: asRecord(payload.payload),
          },
        },
      ]
    case 'workflow-step-result':
      return [stepResultChunk(payload)]
    case 'workflow-finish':
      return finishChunks(payload)
    default:
      // workflow-start 与 step-output/suspended/progress 等中间事件不发包
      return []
  }
}

/** step 结果帧：success 带 toolResult，failed 带 toolError（output 缺失的宽容形态） */
function stepResultChunk(payload: Record<string, unknown>): StreamChunk {
  const metadata: NonNullable<StreamChunk['metadata']> = {
    toolCallId: str(payload.stepCallId),
    toolName: str(payload.stepName),
  }
  if (payload.output !== undefined) {
    metadata.toolResult = payload.output
  }
  if (payload.status === 'failed') {
    metadata.toolError = readableError(payload.error)
  }
  const duration = durationOf(payload)
  if (duration !== undefined) {
    metadata.duration = duration
  }
  return { type: 'tool_result', content: '', metadata }
}

/** finish 收尾帧：success 拆 text + done；其余状态以 error 帧单帧收尾（对齐 chat.ts） */
function finishChunks(payload: Record<string, unknown>): StreamChunk[] {
  if (payload.workflowStatus !== 'success') {
    return [
      {
        type: 'error',
        content: `工作流执行失败：${String(payload.workflowStatus)}`,
      },
    ]
  }
  // 依次找 finalDraft / finalReport（string 才用），都没有则回退 json 代码块
  const final = payload.finalWorkflowResult
  const picked =
    pickString(final, 'finalDraft') ?? pickString(final, 'finalReport')
  const content =
    picked ??
    '```json\n' + (JSON.stringify(final, null, 2) ?? String(final)) + '\n```'
  return [
    { type: 'text', content },
    { type: 'done', content: '' },
  ]
}

/** error 的可读化：Error 取 message，字符串原样，其余 JSON 序列化 */
function readableError(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return JSON.stringify(error) ?? String(error)
}

/** duration 仅在 startedAt/endedAt 都为数字时计算 */
function durationOf(payload: Record<string, unknown>): number | undefined {
  const { startedAt, endedAt } = payload
  if (typeof startedAt !== 'number' || typeof endedAt !== 'number')
    return undefined
  return endedAt - startedAt
}

/** 从 unknown 里按 key 取 string（非字符串视为无值） */
function pickString(source: unknown, key: string): string | null {
  const value = asRecord(source)[key]
  return typeof value === 'string' ? value : null
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}
