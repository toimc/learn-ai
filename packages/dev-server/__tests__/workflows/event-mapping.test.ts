import { describe, expect, it } from 'vitest'
import { workflowEventToChunks } from '../../src/workflows/event-mapping'

/**
 * workflow 流事件 → StreamChunk 线协议的映射测试（2026-08 实测契约）。
 * 输入事件与预期输出全部为手写字面量（事件形态来自 Mastra 1.60 真实运行捕获，
 * duration/JSON 串等预期值手工计算），映射偏离契约即红。
 */

const WORKFLOW_START_EVENT = {
  type: 'workflow-start',
  runId: 'run_probe',
  payload: { workflowId: 'probe' },
}

const STEP_START_EVENT = {
  type: 'workflow-step-start',
  payload: {
    stepName: 'alpha',
    id: 'alpha',
    stepCallId: 'step-call-1',
    payload: { task: 'ping' },
    startedAt: 1788000751146,
    status: 'running',
  },
}

const STEP_RESULT_SUCCESS_EVENT = {
  type: 'workflow-step-result',
  payload: {
    stepName: 'alpha',
    stepCallId: 'step-call-1',
    payload: { task: 'ping' },
    startedAt: 1788000751146,
    status: 'success',
    output: { task: 'ping', note: 'A done' },
    endedAt: 1788000751147,
  },
}

/** failed 实测形态：output 缺失、带 error 字段（此处为对象形态） */
const STEP_RESULT_FAILED_EVENT = {
  type: 'workflow-step-result',
  payload: {
    stepName: 'alpha',
    stepCallId: 'step-call-2',
    payload: { task: 'ping' },
    startedAt: 1788000751146,
    status: 'failed',
    error: { message: '模型超时' },
    endedAt: 1788000752246,
  },
}

/** workflow-finish success 骨架（finalWorkflowResult 逐用例注入） */
function finishEvent(finalWorkflowResult: unknown) {
  return {
    type: 'workflow-finish',
    payload: {
      workflowStatus: 'success',
      metadata: {},
      output: { usage: { inputTokens: 12, outputTokens: 8, totalTokens: 20 } },
      finalWorkflowResult,
    },
  }
}

describe('workflowEventToChunks：起点与未知事件', () => {
  it('workflow-start 不发包', () => {
    expect(workflowEventToChunks(WORKFLOW_START_EVENT)).toEqual([])
  })

  it('未知事件类型不发包', () => {
    expect(
      workflowEventToChunks({
        type: 'workflow-step-output',
        payload: { id: 'alpha' },
      }),
    ).toEqual([])
  })

  it('无 payload 的事件宽容处理为不发包', () => {
    expect(workflowEventToChunks({ type: 'workflow-canceled' })).toEqual([])
  })
})

describe('workflowEventToChunks：step 事件映射为 tool 帧', () => {
  it('workflow-step-start 映射为 tool_call（stepCallId/stepName/入参）', () => {
    expect(workflowEventToChunks(STEP_START_EVENT)).toEqual([
      {
        type: 'tool_call',
        content: '',
        metadata: {
          toolCallId: 'step-call-1',
          toolName: 'alpha',
          toolArguments: { task: 'ping' },
        },
      },
    ])
  })

  it('workflow-step-result success 映射为 tool_result，duration = endedAt - startedAt = 1', () => {
    expect(workflowEventToChunks(STEP_RESULT_SUCCESS_EVENT)).toEqual([
      {
        type: 'tool_result',
        content: '',
        metadata: {
          toolCallId: 'step-call-1',
          toolName: 'alpha',
          toolResult: { task: 'ping', note: 'A done' },
          duration: 1,
        },
      },
    ])
  })

  it('workflow-step-result failed 映射为带 toolError 的 tool_result（对象 error 序列化）', () => {
    expect(workflowEventToChunks(STEP_RESULT_FAILED_EVENT)).toEqual([
      {
        type: 'tool_result',
        content: '',
        metadata: {
          toolCallId: 'step-call-2',
          toolName: 'alpha',
          // JSON.stringify({ message: '模型超时' }) 的手写结果
          toolError: '{"message":"模型超时"}',
          duration: 1788000752246 - 1788000751146,
        },
      },
    ])
  })

  it('failed 的 error 为字符串时原样透传', () => {
    const event = {
      type: 'workflow-step-result',
      payload: {
        stepName: 'alpha',
        stepCallId: 'step-call-3',
        status: 'failed',
        error: '上游 429 限流',
      },
    }
    const chunks = workflowEventToChunks(event)
    expect(chunks[0]?.metadata?.toolError).toBe('上游 429 限流')
  })

  it('failed 的 error 为 Error 实例时取 message', () => {
    const event = {
      type: 'workflow-step-result',
      payload: {
        stepName: 'alpha',
        stepCallId: 'step-call-4',
        status: 'failed',
        error: new Error('生成失败'),
      },
    }
    const chunks = workflowEventToChunks(event)
    expect(chunks[0]?.metadata?.toolError).toBe('生成失败')
  })

  it('startedAt/endedAt 缺一时不算 duration', () => {
    const event = {
      type: 'workflow-step-result',
      payload: {
        stepName: 'alpha',
        stepCallId: 'step-call-5',
        status: 'success',
        output: { ok: true },
        startedAt: 1788000751146,
      },
    }
    const metadata = workflowEventToChunks(event)[0]?.metadata
    expect(metadata).toEqual({
      toolCallId: 'step-call-5',
      toolName: 'alpha',
      toolResult: { ok: true },
    })
  })
})

describe('workflowEventToChunks：finish 事件收尾', () => {
  it('success 时提取 finalDraft 为 text 帧并接 done 帧', () => {
    expect(
      workflowEventToChunks(
        finishEvent({ finalDraft: '最终草稿', verdict: 'pass' }),
      ),
    ).toEqual([
      { type: 'text', content: '最终草稿' },
      { type: 'done', content: '' },
    ])
  })

  it('finalDraft 优先于 finalReport（string 才用）', () => {
    const chunks = workflowEventToChunks(
      finishEvent({ finalDraft: '草稿A', finalReport: '报告B' }),
    )
    expect(chunks[0]).toEqual({ type: 'text', content: '草稿A' })
  })

  it('finalDraft 缺失时回退 finalReport', () => {
    const chunks = workflowEventToChunks(
      finishEvent({ finalReport: '报告B', rounds: 3 }),
    )
    expect(chunks[0]).toEqual({ type: 'text', content: '报告B' })
    expect(chunks[1]).toEqual({ type: 'done', content: '' })
  })

  it('finalDraft 非字符串（boolean）时跳过，取 finalReport', () => {
    const chunks = workflowEventToChunks(
      finishEvent({ finalDraft: true, finalReport: '报告B' }),
    )
    expect(chunks[0]).toEqual({ type: 'text', content: '报告B' })
  })

  it('两者都无时回退 json 代码块围栏（手写 stringify 结果）', () => {
    const chunks = workflowEventToChunks(finishEvent({ ok: true }))
    expect(chunks[0]).toEqual({
      type: 'text',
      content: '```json\n{\n  "ok": true\n}\n```',
    })
    expect(chunks[1]).toEqual({ type: 'done', content: '' })
  })

  it('非 success 状态发 error 帧（单帧收尾，不发 text/done）', () => {
    const event = {
      type: 'workflow-finish',
      payload: {
        workflowStatus: 'failed',
        metadata: {},
        output: { usage: { inputTokens: 1, outputTokens: 0, totalTokens: 1 } },
      },
    }
    expect(workflowEventToChunks(event)).toEqual([
      { type: 'error', content: '工作流执行失败：failed' },
    ])
  })
})
