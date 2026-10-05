import { describe, expect, it } from 'vitest'
import { buildReply, scenarioNames } from '../../src/mock/scenarios'

function types(input: string) {
  return buildReply(input).map((s) => s.chunk.type)
}

describe('buildReply 场景选择', () => {
  it('命中思考场景：thinking 在前 text 在后，done 收尾', () => {
    const types_ = types('帮我思考一下流式安全方案')
    expect(types_[0]).toBe('thinking')
    expect(types_).toContain('text')
    expect(types_[types_.length - 1]).toBe('done')
  })

  it('思考场景 thinking 块全部先于 text 块（流式过程连贯）', () => {
    const seq = types('thinking demo')
    const firstText = seq.indexOf('text')
    const lastThinking = seq.lastIndexOf('thinking')
    expect(firstText).toBeGreaterThan(lastThinking)
  })

  it('命中工具场景：tool_call 与 tool_result 的 toolCallId 一致', () => {
    const script = buildReply('查一下北京天气，调用工具')
    const call = script.find((s) => s.chunk.type === 'tool_call')
    const result = script.find((s) => s.chunk.type === 'tool_result')
    expect(call).toBeDefined()
    expect(result).toBeDefined()
    expect(result!.chunk.metadata?.toolCallId).toBe(
      call!.chunk.metadata?.toolCallId,
    )
    expect(String(call!.chunk.metadata?.toolArguments?.city)).toBe('北京')
  })

  it('工具剧本的 toolResult 附带 weather-card GenUI schema', () => {
    const script = buildReply('查一下北京天气，调用工具')
    const result = script.find((s) => s.chunk.type === 'tool_result')
    const ui = (result!.chunk.metadata?.toolResult as { ui?: unknown }).ui
    expect(ui).toEqual({
      type: 'weather-card',
      props: { city: '北京', temperatureC: 28, description: '多云转晴' },
    })
  })

  it('命中错误场景：包含 error 块且其后无正文', () => {
    const seq = types('触发一次错误')
    const errorIdx = seq.indexOf('error')
    expect(errorIdx).toBeGreaterThan(-1)
    expect(seq.slice(errorIdx)).toEqual(['error', 'done'])
  })

  it('命中慢速场景：正文块延迟不低于 450ms', () => {
    const script = buildReply('slow 模式演示')
    const textDelays = script
      .filter((s) => s.chunk.type === 'text')
      .map((s) => s.delayMs)
    expect(textDelays.length).toBeGreaterThan(0)
    for (const d of textDelays) expect(d).toBeGreaterThanOrEqual(450)
  })

  it('命中 markdown 场景：正文包含表格与代码块标记', () => {
    const content = buildReply('markdown 渲染示例')
      .map((s) => s.chunk.content)
      .join('')
    expect(content).toContain('| --- |')
    expect(content).toContain('```')
  })

  it('问好命中 greeting：不包含 thinking / tool_call', () => {
    const seq = types('你好')
    expect(seq).not.toContain('thinking')
    expect(seq).not.toContain('tool_call')
  })

  it('无关键词走默认场景：正文引用输入片段并以 done 收尾', () => {
    const script = buildReply('Vue 3 的 defineModel 怎么用')
    const content = script.map((s) => s.chunk.content).join('')
    expect(content).toContain('defineModel')
    expect(script[script.length - 1].chunk.type).toBe('done')
  })

  it('空输入也有兜底回复', () => {
    const script = buildReply('')
    expect(script.length).toBeGreaterThan(2)
    expect(script[script.length - 1].chunk.type).toBe('done')
  })

  it('所有剧本的延迟为非负数', () => {
    for (const name of [
      '思考',
      '工具 tool',
      '错误 error',
      '慢速 slow',
      'markdown',
      '你好',
      '任意问题',
    ]) {
      for (const { delayMs } of buildReply(name)) {
        expect(delayMs).toBeGreaterThanOrEqual(0)
      }
    }
    expect(scenarioNames).toContain('thinking')
  })
})
