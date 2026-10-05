import { describe, expect, it } from 'vitest'
import type { AgentCall } from '../../src/orchestration/patterns'
import {
  runDelegate,
  runParallel,
  runPipeline,
} from '../../src/orchestration/patterns'

/**
 * 双盲分工：本文件只依据 spec 16 §3.3/§4/§5.1/§6 的契约断言，
 * 预期 prompt 与结构均为手写字面量，不引用实现表达式。
 * mock 边界在 AgentCall.run——编排函数唯一的副作用出口。
 */

type AgentKind = 'researcher' | 'writer' | 'reviewer'

interface Usage {
  inputTokens: number
  outputTokens: number
}

interface Reply {
  text: string
  usage?: Usage
}

const AGENT_IDS: Record<AgentKind, string> = {
  researcher: 'researcher-agent',
  writer: 'writer-agent',
  reviewer: 'reviewer-agent',
}

const AGENT_MODELS: Record<AgentKind, string> = {
  researcher: 'sub-model',
  writer: 'main-model',
  reviewer: 'main-model',
}

/** 记录跨 agent 调用顺序与各自 prompt 的 AgentCall 工厂 */
function createHarness() {
  const order: string[] = []
  function agent(
    kind: AgentKind,
    reply: (prompt: string) => Reply | Promise<Reply | never>,
  ): { call: AgentCall; prompts: string[] } {
    const prompts: string[] = []
    return {
      prompts,
      call: {
        agentId: AGENT_IDS[kind],
        model: AGENT_MODELS[kind],
        run: async (prompt: string) => {
          order.push(kind)
          prompts.push(prompt)
          return reply(prompt)
        },
      },
    }
  }
  return { order, agent }
}

/** durationMs 是实测毫秒，只断言类型与非负，不断言具体值 */
function expectNonNegativeDuration(stage: { durationMs: number }): void {
  expect(typeof stage.durationMs).toBe('number')
  expect(stage.durationMs).toBeGreaterThanOrEqual(0)
}

const DELEGATE_TASK =
  'PromptInput 的 Enter 键行为是什么？Shift+Enter 又是什么？'
const RESEARCHER_OUTPUT = '检索到：Enter 发送消息，Shift+Enter 插入换行'
const WRITER_OUTPUT = 'Enter 发送消息，Shift+Enter 插入换行。'
const RESEARCHER_USAGE: Usage = { inputTokens: 11, outputTokens: 7 }
const DELEGATE_WRITER_PROMPT = `任务：PromptInput 的 Enter 键行为是什么？Shift+Enter 又是什么？
检索结果：
检索到：Enter 发送消息，Shift+Enter 插入换行
请基于以上检索结果起草回答。`

describe('runDelegate 委托编排', () => {
  it('两步顺序：researcher 先于 writer，researcher 收任务原文，writer 稿即 finalDraft', async () => {
    const h = createHarness()
    const researcher = h.agent('researcher', () => ({
      text: RESEARCHER_OUTPUT,
      usage: RESEARCHER_USAGE,
    }))
    const writer = h.agent('writer', () => ({ text: WRITER_OUTPUT }))

    const result = await runDelegate(DELEGATE_TASK, {
      researcher: researcher.call,
      writer: writer.call,
    })

    expect(h.order).toEqual(['researcher', 'writer'])
    expect(researcher.prompts).toEqual([DELEGATE_TASK])
    expect(writer.prompts).toEqual([DELEGATE_WRITER_PROMPT])
    expect(result.pattern).toBe('delegate')
    expect(result.task).toBe(DELEGATE_TASK)
    expect(result.stages.map((s) => s.role)).toEqual(['researcher', 'writer'])
    expect(result.finalDraft).toBe(WRITER_OUTPUT)
  })

  it('stage 装配：agentId/model 透传，usage 透传且缺省省略，durationMs 非负', async () => {
    const h = createHarness()
    const researcher = h.agent('researcher', () => ({
      text: RESEARCHER_OUTPUT,
      usage: RESEARCHER_USAGE,
    }))
    const writer = h.agent('writer', () => ({ text: WRITER_OUTPUT }))

    const result = await runDelegate(DELEGATE_TASK, {
      researcher: researcher.call,
      writer: writer.call,
    })

    const [researcherStage, writerStage] = result.stages
    expect(researcherStage.agentId).toBe('researcher-agent')
    expect(researcherStage.model).toBe('sub-model')
    expect(researcherStage.status).toBe('ok')
    expect(researcherStage.output).toBe(RESEARCHER_OUTPUT)
    expect(researcherStage.usage).toEqual({ inputTokens: 11, outputTokens: 7 })
    expectNonNegativeDuration(researcherStage)
    expect(writerStage.agentId).toBe('writer-agent')
    expect(writerStage.model).toBe('main-model')
    expect(writerStage.status).toBe('ok')
    expect(writerStage.usage).toBeUndefined()
    expectNonNegativeDuration(writerStage)
  })

  it('researcher 抛错：中止后续 writer 不执行，stages 仅 [researcher(error)]，finalDraft 空串', async () => {
    const h = createHarness()
    const researcher = h.agent('researcher', async () => {
      throw new Error('boom')
    })
    const writer = h.agent('writer', () => ({ text: WRITER_OUTPUT }))

    const result = await runDelegate(DELEGATE_TASK, {
      researcher: researcher.call,
      writer: writer.call,
    })

    expect(h.order).toEqual(['researcher'])
    expect(result.stages.map((s) => s.role)).toEqual(['researcher'])
    expect(result.stages[0].status).toBe('error')
    expect(result.stages[0].output).toContain('boom')
    expect(result.finalDraft).toBe('')
  })

  it('writer 抛错：researcher 阶段保留、writer stage error，finalDraft 空串', async () => {
    const h = createHarness()
    const researcher = h.agent('researcher', () => ({
      text: RESEARCHER_OUTPUT,
    }))
    const writer = h.agent('writer', async () => {
      throw new Error('boom')
    })

    const result = await runDelegate(DELEGATE_TASK, {
      researcher: researcher.call,
      writer: writer.call,
    })

    expect(h.order).toEqual(['researcher', 'writer'])
    expect(result.stages.map((s) => s.role)).toEqual(['researcher', 'writer'])
    expect(result.stages[0].status).toBe('ok')
    expect(result.stages[0].output).toBe(RESEARCHER_OUTPUT)
    expect(result.stages[1].status).toBe('error')
    expect(result.stages[1].output).toContain('boom')
    expect(result.finalDraft).toBe('')
  })
})

const PARALLEL_TASK = '主题定制有哪些方式？CSS 变量覆盖和预设怎么选？'
const PARALLEL_PROMPT_API = `主题定制有哪些方式？CSS 变量覆盖和预设怎么选？
检索角度：组件用法与 API`
const PARALLEL_PROMPT_THEME = `主题定制有哪些方式？CSS 变量覆盖和预设怎么选？
检索角度：配置与主题定制`
const PARALLEL_PROMPT_INTEGRATION = `主题定制有哪些方式？CSS 变量覆盖和预设怎么选？
检索角度：集成与数据流转`

describe('runParallel 并行编排', () => {
  it('三路全 researcher：prompt 分别带三个内置检索角度字面量，finalDraft 空串', async () => {
    const h = createHarness()
    const researcher = h.agent('researcher', (prompt) => {
      if (prompt.includes('组件用法与 API')) return { text: '组件用法检索结果' }
      if (prompt.includes('配置与主题定制'))
        return { text: '配置与主题检索结果' }
      return { text: '集成与数据检索结果' }
    })

    const result = await runParallel(PARALLEL_TASK, researcher.call)

    expect(result.pattern).toBe('parallel')
    expect(result.task).toBe(PARALLEL_TASK)
    expect(result.finalDraft).toBe('')
    expect(result.stages).toHaveLength(3)
    expect(researcher.prompts).toHaveLength(3)
    expect(researcher.prompts).toContain(PARALLEL_PROMPT_API)
    expect(researcher.prompts).toContain(PARALLEL_PROMPT_THEME)
    expect(researcher.prompts).toContain(PARALLEL_PROMPT_INTEGRATION)
    for (const stage of result.stages) {
      expect(stage.role).toBe('researcher')
      expect(stage.agentId).toBe('researcher-agent')
      expect(stage.status).toBe('ok')
      expectNonNegativeDuration(stage)
    }
    const outputs = result.stages.map((s) => s.output)
    expect(outputs).toContain('组件用法检索结果')
    expect(outputs).toContain('配置与主题检索结果')
    expect(outputs).toContain('集成与数据检索结果')
  })

  it('单路抛错：该 stage error、其余两路 ok（allSettled 语义），finalDraft 仍空串', async () => {
    const h = createHarness()
    const researcher = h.agent('researcher', (prompt) => {
      if (prompt.includes('配置与主题定制')) {
        throw new Error('boom')
      }
      if (prompt.includes('组件用法与 API')) return { text: '组件用法检索结果' }
      return { text: '集成与数据检索结果' }
    })

    const result = await runParallel(PARALLEL_TASK, researcher.call)

    expect(result.stages).toHaveLength(3)
    const errors = result.stages.filter((s) => s.status === 'error')
    expect(errors).toHaveLength(1)
    expect(errors[0].role).toBe('researcher')
    expect(errors[0].output).toContain('boom')
    expect(result.stages.filter((s) => s.status === 'ok')).toHaveLength(2)
    expect(result.finalDraft).toBe('')
  })
})

const PIPELINE_TASK = '多会话管理的数据存在哪里？怎么持久化？'
const PIPELINE_RESEARCH = '检索到：会话数据存 localStorage，deep watch 自动保存'
const PIPELINE_DRAFT =
  '会话数据存放在 localStorage，通过 deep watch 自动持久化。'
const PIPELINE_REWRITE =
  '会话数据存放在 localStorage，通过 deep watch 自动持久化，上限 maxHistory 条。'
const REVIEW_PASS = '[pass]\n草稿与检索结果一致，无需修改'
const REVIEW_REVISE = '[revise]\n需要补充会话数量上限的说明'
const REVIEW_OPINION = '需要补充会话数量上限的说明'
const PIPELINE_WRITER_PROMPT = `任务：多会话管理的数据存在哪里？怎么持久化？
检索结果：
检索到：会话数据存 localStorage，deep watch 自动保存
请基于以上检索结果起草回答。`
const PIPELINE_REVIEWER_PROMPT = `任务：多会话管理的数据存在哪里？怎么持久化？
检索结果：
检索到：会话数据存 localStorage，deep watch 自动保存
草稿：
会话数据存放在 localStorage，通过 deep watch 自动持久化。
审查以上草稿：首行输出 [pass] 或 [revise]，随后给出意见。`

describe('runPipeline 流水线编排', () => {
  it('pass 路径：stages 顺序 researcher→writer→reviewer，verdict pass，无 retried，finalDraft=writer 稿', async () => {
    const h = createHarness()
    const researcher = h.agent('researcher', () => ({
      text: PIPELINE_RESEARCH,
    }))
    const writer = h.agent('writer', () => ({ text: PIPELINE_DRAFT }))
    const reviewer = h.agent('reviewer', () => ({ text: REVIEW_PASS }))

    const result = await runPipeline(PIPELINE_TASK, {
      researcher: researcher.call,
      writer: writer.call,
      reviewer: reviewer.call,
    })

    expect(result.pattern).toBe('pipeline')
    expect(result.task).toBe(PIPELINE_TASK)
    expect(h.order).toEqual(['researcher', 'writer', 'reviewer'])
    expect(result.stages.map((s) => s.role)).toEqual([
      'researcher',
      'writer',
      'reviewer',
    ])
    expect(result.stages.map((s) => s.status)).toEqual(['ok', 'ok', 'ok'])
    expect(result.stages.filter((s) => s.meta?.retried === true)).toHaveLength(
      0,
    )
    expect(result.stages[2].output).toBe(REVIEW_PASS)
    expect(result.stages[2].meta?.verdict).toBe('pass')
    expect(result.finalDraft).toBe(PIPELINE_DRAFT)
  })

  it('首轮 prompt 契约：researcher 收任务原文，writer 同 delegate 模板，reviewer 收完整审查模板', async () => {
    const h = createHarness()
    const researcher = h.agent('researcher', () => ({
      text: PIPELINE_RESEARCH,
    }))
    const writer = h.agent('writer', () => ({ text: PIPELINE_DRAFT }))
    const reviewer = h.agent('reviewer', () => ({ text: REVIEW_PASS }))

    await runPipeline(PIPELINE_TASK, {
      researcher: researcher.call,
      writer: writer.call,
      reviewer: reviewer.call,
    })

    expect(researcher.prompts).toEqual([PIPELINE_TASK])
    expect(writer.prompts).toEqual([PIPELINE_WRITER_PROMPT])
    expect(reviewer.prompts).toEqual([PIPELINE_REVIEWER_PROMPT])
  })

  it('revise 路径：writer 重写一次（prompt 附上一版草稿与审查意见），stages 4 项、retried 标记，不再复审，finalDraft=重写稿', async () => {
    const h = createHarness()
    const researcher = h.agent('researcher', () => ({
      text: PIPELINE_RESEARCH,
    }))
    const writer = h.agent('writer', (prompt) =>
      prompt.includes(REVIEW_OPINION)
        ? { text: PIPELINE_REWRITE }
        : { text: PIPELINE_DRAFT },
    )
    const reviewer = h.agent('reviewer', () => ({ text: REVIEW_REVISE }))

    const result = await runPipeline(PIPELINE_TASK, {
      researcher: researcher.call,
      writer: writer.call,
      reviewer: reviewer.call,
    })

    expect(result.stages).toHaveLength(4)
    expect(result.stages.map((s) => s.role)).toEqual([
      'researcher',
      'writer',
      'reviewer',
      'writer',
    ])
    expect(result.stages.filter((s) => s.role === 'reviewer')).toHaveLength(1)
    const retryStage = result.stages[3]
    expect(retryStage.meta?.retried).toBe(true)
    expect(retryStage.output).toBe(PIPELINE_REWRITE)
    expect(result.stages[2].meta?.verdict).toBe('revise')
    expect(result.finalDraft).toBe(PIPELINE_REWRITE)
    expect(writer.prompts).toHaveLength(2)
    expect(writer.prompts[0]).toBe(PIPELINE_WRITER_PROMPT)
    expect(writer.prompts[1]).toContain(PIPELINE_DRAFT)
    expect(writer.prompts[1]).toContain(REVIEW_OPINION)
  })

  it('verdict 宽容解析：首行 [PASS] 大写也判 pass，不触发重写', async () => {
    const h = createHarness()
    const researcher = h.agent('researcher', () => ({
      text: PIPELINE_RESEARCH,
    }))
    const writer = h.agent('writer', () => ({ text: PIPELINE_DRAFT }))
    const reviewer = h.agent('reviewer', () => ({
      text: '[PASS]\n整体合格',
    }))

    const result = await runPipeline(PIPELINE_TASK, {
      researcher: researcher.call,
      writer: writer.call,
      reviewer: reviewer.call,
    })

    expect(result.stages).toHaveLength(3)
    expect(result.stages[2].meta?.verdict).toBe('pass')
    expect(result.finalDraft).toBe(PIPELINE_DRAFT)
  })

  it('verdict 宽容解析：首行无法解析默认 pass，不触发重写', async () => {
    const h = createHarness()
    const researcher = h.agent('researcher', () => ({
      text: PIPELINE_RESEARCH,
    }))
    const writer = h.agent('writer', () => ({ text: PIPELINE_DRAFT }))
    const reviewer = h.agent('reviewer', () => ({
      text: '整体不错，直接通过',
    }))

    const result = await runPipeline(PIPELINE_TASK, {
      researcher: researcher.call,
      writer: writer.call,
      reviewer: reviewer.call,
    })

    expect(result.stages).toHaveLength(3)
    expect(result.stages.filter((s) => s.meta?.retried === true)).toHaveLength(
      0,
    )
    expect(result.stages[2].meta?.verdict).toBe('pass')
    expect(result.finalDraft).toBe(PIPELINE_DRAFT)
  })

  it('researcher 抛错：中止后续（writer/reviewer 不执行），stages 仅 error 的 researcher，finalDraft 空串', async () => {
    const h = createHarness()
    const researcher = h.agent('researcher', async () => {
      throw new Error('boom')
    })
    const writer = h.agent('writer', () => ({ text: PIPELINE_DRAFT }))
    const reviewer = h.agent('reviewer', () => ({ text: REVIEW_PASS }))

    const result = await runPipeline(PIPELINE_TASK, {
      researcher: researcher.call,
      writer: writer.call,
      reviewer: reviewer.call,
    })

    expect(h.order).toEqual(['researcher'])
    expect(result.stages.map((s) => s.role)).toEqual(['researcher'])
    expect(result.stages[0].status).toBe('error')
    expect(result.stages[0].output).toContain('boom')
    expect(result.finalDraft).toBe('')
  })

  it('reviewer 抛错：前两阶段保留、草稿在 stage.output 可见，finalDraft 空串', async () => {
    const h = createHarness()
    const researcher = h.agent('researcher', () => ({
      text: PIPELINE_RESEARCH,
    }))
    const writer = h.agent('writer', () => ({ text: PIPELINE_DRAFT }))
    const reviewer = h.agent('reviewer', async () => {
      throw new Error('boom')
    })

    const result = await runPipeline(PIPELINE_TASK, {
      researcher: researcher.call,
      writer: writer.call,
      reviewer: reviewer.call,
    })

    expect(result.stages.map((s) => s.role)).toEqual([
      'researcher',
      'writer',
      'reviewer',
    ])
    expect(result.stages.map((s) => s.status)).toEqual(['ok', 'ok', 'error'])
    expect(result.stages[1].output).toBe(PIPELINE_DRAFT)
    expect(result.stages[2].output).toContain('boom')
    expect(result.finalDraft).toBe('')
  })
})
