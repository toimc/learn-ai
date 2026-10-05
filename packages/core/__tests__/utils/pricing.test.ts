import { describe, it, expect } from 'vitest'
import {
  formatPerMillion,
  formatTokenCost,
  pricingTier,
} from '../../src/utils/pricing'

// 预期值全部手写：来自 T2 任务卡契约（"$3.00/1M" 式 / <0.01 四位小数 / 未知 '—'
// 与 0/<1/<10/≥10 档位阈值），不调实现自证

describe('formatPerMillion', () => {
  it('整数价格保底 2 位小数', () => {
    expect(formatPerMillion(3)).toBe('$3.00/1M')
  })

  it('常规小数价格补齐 2 位小数', () => {
    expect(formatPerMillion(0.5)).toBe('$0.50/1M')
    expect(formatPerMillion(15)).toBe('$15.00/1M')
  })

  it('小于 0.01 的价格用 4 位小数避免失真', () => {
    expect(formatPerMillion(0.0024)).toBe('$0.0024/1M')
    expect(formatPerMillion(0.0099)).toBe('$0.0099/1M')
  })

  it('0 保持 2 位小数（无信息可保留）', () => {
    expect(formatPerMillion(0)).toBe('$0.00/1M')
  })

  it('千分位按 en-US 分组', () => {
    expect(formatPerMillion(1500)).toBe('$1,500.00/1M')
  })

  it('自定义货币符号替换默认 $', () => {
    expect(formatPerMillion(15, '¥')).toBe('¥15.00/1M')
    expect(formatPerMillion(0.0024, '¥')).toBe('¥0.0024/1M')
  })

  it('未知价格（undefined）返回长破折号', () => {
    expect(formatPerMillion(undefined)).toBe('—')
  })
})

describe('formatTokenCost', () => {
  it('按 1M 单价与 token 用量计算一次对话成本', () => {
    // 3/1M × 1M + 15/1M × 1M = 18
    expect(
      formatTokenCost(
        { inputPerMTokens: 3, outputPerMTokens: 15 },
        1_000_000,
        1_000_000,
      ),
    ).toBe('$18.00')
  })

  it('小成本用 4 位小数', () => {
    // 3/1M × 800 = 0.0024
    expect(formatTokenCost({ inputPerMTokens: 3 }, 800, 0)).toBe('$0.0024')
  })

  it('非整百万用量按比例计价', () => {
    // 3/1M × 1.5M = 4.5
    expect(formatTokenCost({ inputPerMTokens: 3 }, 1_500_000, 0)).toBe('$4.50')
  })

  it('缺省侧价格视为未知不参与计算', () => {
    expect(
      formatTokenCost({ outputPerMTokens: 15 }, 1_000_000, 1_000_000),
    ).toBe('$15.00')
  })

  it('两侧价格均未知返回长破折号', () => {
    expect(formatTokenCost({}, 1_000_000, 1_000_000)).toBe('—')
  })

  it('零用量且价格已知返回 $0.00', () => {
    expect(
      formatTokenCost({ inputPerMTokens: 3, outputPerMTokens: 15 }, 0, 0),
    ).toBe('$0.00')
  })

  it('货币符号取 pricing.currency', () => {
    expect(
      formatTokenCost(
        { inputPerMTokens: 3, outputPerMTokens: 15, currency: '¥' },
        1_000_000,
        1_000_000,
      ),
    ).toBe('¥18.00')
  })
})

describe('pricingTier', () => {
  it('均价为 0 归 free', () => {
    expect(pricingTier({ inputPerMTokens: 0, outputPerMTokens: 0 })).toBe(
      'free',
    )
    expect(pricingTier({ inputPerMTokens: 0 })).toBe('free')
  })

  it('均价小于 1 归 economy', () => {
    // (0.2 + 0.4) / 2 = 0.3
    expect(pricingTier({ inputPerMTokens: 0.2, outputPerMTokens: 0.4 })).toBe(
      'economy',
    )
  })

  it('均价恰为 1 归 standard（economy 上开区间）', () => {
    // (0.5 + 1.5) / 2 = 1
    expect(pricingTier({ inputPerMTokens: 0.5, outputPerMTokens: 1.5 })).toBe(
      'standard',
    )
    expect(pricingTier({ inputPerMTokens: 5 })).toBe('standard')
  })

  it('均价恰为 10 归 premium（standard 上开区间）', () => {
    expect(pricingTier({ inputPerMTokens: 10, outputPerMTokens: 10 })).toBe(
      'premium',
    )
    expect(pricingTier({ inputPerMTokens: 12 })).toBe('premium')
  })

  it('单侧价格以该侧为均价', () => {
    expect(pricingTier({ outputPerMTokens: 9.99 })).toBe('standard')
    expect(pricingTier({ outputPerMTokens: 0.5 })).toBe('economy')
  })

  it('价格全未知返回中性 standard（不误标 free）', () => {
    expect(pricingTier({})).toBe('standard')
  })
})
