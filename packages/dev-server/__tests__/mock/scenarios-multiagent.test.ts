import { describe, expect, it } from 'vitest'
import { buildReply, scenarioNames } from '../../src/mock/scenarios'

/** 预置问题（spec 16 §3.6）：演示页在原文前拼接形态前缀作为发送文本 */
const DELEGATE_INPUT =
  '【委托】PromptInput 的 Enter 键行为是什么？Shift+Enter 又是什么？'
const PARALLEL_INPUT = '【并行】主题定制有哪些方式？CSS 变量覆盖和预设怎么选？'
const PIPELINE_INPUT = '【流水线】多会话管理的数据存在哪里？怎么持久化？'

/** 折叠连续同类型帧：compile 按 token 粒度拆分 text/thinking，折叠后看剧本骨架 */
function collapseTypes(input: string): string[] {
  const out: string[] = []
  for (const { chunk } of buildReply(input)) {
    if (chunk.type !== out[out.length - 1]) out.push(chunk.type)
  }
  return out
}

function chunkOf(input: string, type: 'tool_call' | 'tool_result') {
  const hit = buildReply(input).find((s) => s.chunk.type === type)
  expect(hit).toBeDefined()
  return hit!.chunk
}

/** 同一次 buildReply 内取 tool_call / tool_result：每次构建生成新 toolCallId，跨构建比较无意义 */
function callPair(input: string) {
  const script = buildReply(input)
  const call = script.find((s) => s.chunk.type === 'tool_call')
  const result = script.find((s) => s.chunk.type === 'tool_result')
  expect(call).toBeDefined()
  expect(result).toBeDefined()
  return { call: call!.chunk, result: result!.chunk }
}

function toolResultOf(input: string) {
  const chunk = chunkOf(input, 'tool_result')
  return chunk.metadata!.toolResult as {
    pattern: string
    task: string
    stages: Array<{
      role: string
      agentId: string
      status: string
      durationMs: number
      model: string
      usage?: { inputTokens: number; outputTokens: number }
      output?: string
      meta?: { retried?: boolean; verdict?: string }
    }>
    finalDraft: string
  }
}

describe('多 agent 剧本：关键字命中与帧序列', () => {
  it('委托关键字命中 delegate：骨架为 thinking → tool_call → tool_result → text → done', () => {
    expect(collapseTypes(DELEGATE_INPUT)).toEqual([
      'thinking',
      'tool_call',
      'tool_result',
      'text',
      'done',
    ])
  })

  it('并行关键字命中 parallel：帧骨架与委托一致', () => {
    expect(collapseTypes(PARALLEL_INPUT)).toEqual([
      'thinking',
      'tool_call',
      'tool_result',
      'text',
      'done',
    ])
  })

  it('流水线关键字命中 pipeline：帧骨架与委托一致', () => {
    expect(collapseTypes(PIPELINE_INPUT)).toEqual([
      'thinking',
      'tool_call',
      'tool_result',
      'text',
      'done',
    ])
  })

  it('英文关键字同样命中（大小写不敏感）', () => {
    expect(toolResultOf('delegate demo').pattern).toBe('delegate')
    expect(toolResultOf('Parallel demo').pattern).toBe('parallel')
    expect(toolResultOf('PIPELINE demo').pattern).toBe('pipeline')
  })

  it('三个剧本已注册进场景名列表', () => {
    expect(scenarioNames).toContain('delegate')
    expect(scenarioNames).toContain('parallel')
    expect(scenarioNames).toContain('pipeline')
  })

  it('不截走既有场景：含「工具」的普通请求仍走 get_weather', () => {
    expect(
      chunkOf('查一下北京天气，调用工具', 'tool_call').metadata!.toolName,
    ).toBe('get_weather')
  })
})

describe('多 agent 剧本：tool_call 帧', () => {
  it('toolName 为 orchestrate，pattern 对应形态，task 为剥掉形态前缀的问题原文', () => {
    // 预期 task 全部为手写问题原文，不复用实现的剥前缀逻辑
    const expected: Array<[string, string, string]> = [
      [
        DELEGATE_INPUT,
        'delegate',
        'PromptInput 的 Enter 键行为是什么？Shift+Enter 又是什么？',
      ],
      [
        PARALLEL_INPUT,
        'parallel',
        '主题定制有哪些方式？CSS 变量覆盖和预设怎么选？',
      ],
      [PIPELINE_INPUT, 'pipeline', '多会话管理的数据存在哪里？怎么持久化？'],
    ]
    for (const [input, pattern, task] of expected) {
      expect(chunkOf(input, 'tool_call').metadata!.toolArguments).toEqual({
        pattern,
        task,
      })
    }
  })

  it('tool_call 与 tool_result 的 toolCallId 一致', () => {
    for (const input of [DELEGATE_INPUT, PARALLEL_INPUT, PIPELINE_INPUT]) {
      const { call, result } = callPair(input)
      expect(result.metadata!.toolCallId).toBe(call.metadata!.toolCallId)
      expect(result.metadata!.toolCallId).toBeTruthy()
    }
  })

  it('延迟节奏对齐现有工具剧本：tool_call 前 500ms、tool_result 前 900ms', () => {
    for (const input of [DELEGATE_INPUT, PARALLEL_INPUT, PIPELINE_INPUT]) {
      const delays = new Map(
        buildReply(input).map((s) => [s.chunk.type, s.delayMs]),
      )
      expect(delays.get('tool_call')).toBe(500)
      expect(delays.get('tool_result')).toBe(900)
    }
  })
})

describe('多 agent 剧本：tool_result 的 OrchestrationResult 结构（委托）', () => {
  // 结果在各用例内获取（而非 describe 顶层），保证剧本缺失时逐条用例红灯
  const getResult = () => toolResultOf(DELEGATE_INPUT)

  it('pattern/task 正确，stages 为 researcher → writer 两步', () => {
    const result = getResult()
    expect(result.pattern).toBe('delegate')
    expect(result.task).toBe(
      'PromptInput 的 Enter 键行为是什么？Shift+Enter 又是什么？',
    )
    expect(result.stages.map((s) => s.role)).toEqual(['researcher', 'writer'])
    expect(result.stages.map((s) => s.agentId)).toEqual([
      'researcher-agent',
      'writer-agent',
    ])
  })

  it('全部阶段成功，researcher 带 usage 且检索到组件文档语境', () => {
    const result = getResult()
    expect(result.stages.every((s) => s.status === 'ok')).toBe(true)
    const researcher = result.stages[0]
    expect(researcher.usage).toEqual({ inputTokens: 386, outputTokens: 118 })
    expect(researcher.output).toContain('PromptInputTextarea')
    expect(researcher.output).toContain('Shift+Enter')
    expect(typeof researcher.durationMs).toBe('number')
  })

  it('finalDraft 即 writer 起草稿（委托形态的终稿）', () => {
    const result = getResult()
    expect(result.finalDraft).toBe(result.stages[1].output)
    expect(result.finalDraft).toContain('Enter')
  })

  it('tool_result metadata.duration 为手写编排总耗时（两阶段之和）', () => {
    expect(chunkOf(DELEGATE_INPUT, 'tool_result').metadata!.duration).toBe(4460)
  })
})

describe('多 agent 剧本：tool_result 的 OrchestrationResult 结构（并行）', () => {
  const getResult = () => toolResultOf(PARALLEL_INPUT)

  it('三路并列全为 researcher，各带不同检索角度的产出', () => {
    const result = getResult()
    expect(result.stages).toHaveLength(3)
    expect(result.stages.every((s) => s.role === 'researcher')).toBe(true)
    expect(result.stages.every((s) => s.agentId === 'researcher-agent')).toBe(
      true,
    )
    // 三个角度：组件用法与 API / 配置与主题定制 / 集成与数据流转
    expect(result.stages[0].output).toContain('CSS 变量')
    expect(result.stages[1].output).toContain('useThemePreset')
    expect(result.stages[2].output).toContain(':root')
  })

  it('模型两样：一路用副模型语境名体现按角色选模型', () => {
    const result = getResult()
    const models = new Set(result.stages.map((s) => s.model))
    expect(models).toContain('zhipu/glm-4-flash')
    expect(models).toContain('deepseek/deepseek-chat')
    expect(models.size).toBe(2)
  })

  it('finalDraft 为空串（并行结果并列在 stages，综合交给编排者汇报）', () => {
    const result = getResult()
    expect(result.finalDraft).toBe('')
  })

  it('tool_result metadata.duration 取最长一路（并行不等同串行求和）', () => {
    expect(chunkOf(PARALLEL_INPUT, 'tool_result').metadata!.duration).toBe(2320)
  })
})

describe('多 agent 剧本：tool_result 的 OrchestrationResult 结构（流水线）', () => {
  const getResult = () => toolResultOf(PIPELINE_INPUT)

  it('四阶段角色序列为 researcher → writer → reviewer → writer（打回重写）', () => {
    const result = getResult()
    expect(result.stages.map((s) => s.role)).toEqual([
      'researcher',
      'writer',
      'reviewer',
      'writer',
    ])
    expect(result.stages[2].agentId).toBe('reviewer-agent')
  })

  it('审查结论为 revise，重写的那次 writer 带 retried 标记', () => {
    const result = getResult()
    expect(result.stages[2].meta?.verdict).toBe('revise')
    expect(result.stages[3].meta?.retried).toBe(true)
    expect(result.stages[1].meta?.retried).toBeUndefined()
  })

  it('finalDraft 为重写稿而非首版草稿', () => {
    const result = getResult()
    expect(result.finalDraft).toBe(result.stages[3].output)
    expect(result.finalDraft).not.toBe(result.stages[1].output)
    expect(result.finalDraft).toContain('localStorage')
  })

  it('tool_result metadata.duration 为四阶段串行总耗时', () => {
    expect(chunkOf(PIPELINE_INPUT, 'tool_result').metadata!.duration).toBe(8070)
  })
})

describe('多 agent 剧本：thinking 与汇报正文', () => {
  it('thinking 块全部先于 tool_call（先想清楚再编排）', () => {
    for (const input of [DELEGATE_INPUT, PARALLEL_INPUT, PIPELINE_INPUT]) {
      const seq = collapseTypes(input)
      expect(seq.indexOf('thinking')).toBe(0)
      expect(seq.lastIndexOf('thinking')).toBeLessThan(seq.indexOf('tool_call'))
    }
  })

  it('汇报正文在 tool_result 之后、done 之前，含形态关键词', () => {
    const delegate = buildReply(DELEGATE_INPUT)
      .map((s) => s.chunk.content)
      .join('')
    expect(delegate).toContain('检索')
    const pipeline = buildReply(PIPELINE_INPUT)
      .map((s) => s.chunk.content)
      .join('')
    expect(pipeline).toContain('重写')
  })

  it('所有帧延迟为非负数', () => {
    for (const input of [DELEGATE_INPUT, PARALLEL_INPUT, PIPELINE_INPUT]) {
      for (const { delayMs } of buildReply(input)) {
        expect(delayMs).toBeGreaterThanOrEqual(0)
      }
    }
  })
})
