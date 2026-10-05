import { describe, it, expect } from 'vitest'
import { splitSentences } from '../../src/composables/useSpeechOutput'

// 双盲测试：预期值全部来自 packages/docs/guide/speech.md 的示例与契约的手工推导字面量，
// 不调用 splitSentences 自身计算预期，不复用实现的切分表达式。

describe('splitSentences 流式缓冲切句', () => {
  it('正常：句号与问号各切一句，标点保留句尾，尾部残句留 rest', () => {
    const result = splitSentences('你好。今天天气怎么样？我')

    expect(result.complete).toEqual(['你好。', '今天天气怎么样？'])
    expect(result.rest).toBe('我')
  })

  it('正常：感叹号也是句末标点', () => {
    const result = splitSentences('太好了！继续说')

    expect(result.complete).toEqual(['太好了！'])
    expect(result.rest).toBe('继续说')
  })

  // 以下两例按类型注释语义断言："已凑满句末标点的完整句…空白句已剔除"进 complete，
  // rest 仅存"尾部未凑满句末标点的剩余文本"。若实现把最后一段无条件当作 rest，此处应红——
  // 属契约与实现的分歧点，见盲测报告，不放宽断言。
  it('正常：整段恰好以句末标点收尾时全部进 complete，rest 为空', () => {
    const result = splitSentences('你好。今天天气怎么样？')

    expect(result.complete).toEqual(['你好。', '今天天气怎么样？'])
    expect(result.rest).toBe('')
  })

  it('边界：无句末标点时整段留在缓冲，complete 为空', () => {
    const result = splitSentences('这句话还没说完')

    expect(result.complete).toEqual([])
    expect(result.rest).toBe('这句话还没说完')
  })

  it('边界：空字符串返回空结果', () => {
    const result = splitSentences('')

    expect(result.complete).toEqual([])
    expect(result.rest).toBe('')
  })

  it('边界：连续换行独立成空白句被剔除，换行后的文本留 rest', () => {
    const result = splitSentences('第一段。\n\n第二段还没说完')

    expect(result.complete).toEqual(['第一段。'])
    expect(result.rest).toBe('第二段还没说完')
  })

  it('边界：尾部换行独立成空白句被剔除', () => {
    const result = splitSentences('你好。\n')

    expect(result.complete).toEqual(['你好。'])
    expect(result.rest).toBe('')
  })

  it('边界：单个换行是切分点且换行保留在句尾', () => {
    const result = splitSentences('第一行\n第二行')

    expect(result.complete).toEqual(['第一行\n'])
    expect(result.rest).toBe('第二行')
  })

  it('边界：英文句点不切分，只有中文句号生效', () => {
    const result = splitSentences('3.14 是圆周率。约等于 3.14159')

    expect(result.complete).toEqual(['3.14 是圆周率。'])
    expect(result.rest).toBe('约等于 3.14159')
  })
})
