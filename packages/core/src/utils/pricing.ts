// 模型定价格式化：口径 $/1M token，保底 2 位小数，<0.01 用 4 位避免失真。
// core 无 i18n——固定 en-US 数字格式（千分位分组），档位标签的本地化翻译由 vue 层消费方做。

export interface ModelPricing {
  /** $/1M input tokens（缺省视为未知，不参与计算） */
  inputPerMTokens?: number
  /** $/1M output tokens */
  outputPerMTokens?: number
  /** 货币符号，默认 '$' */
  currency?: string
}

const PER_MILLION = 1_000_000
const UNKNOWN = '—'

function formatAmount(value: number, currency: string): string {
  const abs = Math.abs(value)
  const decimals = abs > 0 && abs < 0.01 ? 4 : 2
  const num = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)
  return `${currency}${num}`
}

/** "$3.00/1M" 式格式化；<0.01 用 4 位小数；未知返回 '—' */
export function formatPerMillion(
  price: number | undefined,
  currency = '$',
): string {
  if (price == null) return UNKNOWN
  return `${formatAmount(price, currency)}/1M`
}

/** 按 token 用量计一次对话成本，如 "$0.0024"；缺省侧价格不参与计算，两侧全未知返回 '—' */
export function formatTokenCost(
  pricing: ModelPricing,
  inputTokens: number,
  outputTokens: number,
): string {
  const parts: number[] = []
  if (pricing.inputPerMTokens != null) {
    parts.push((inputTokens / PER_MILLION) * pricing.inputPerMTokens)
  }
  if (pricing.outputPerMTokens != null) {
    parts.push((outputTokens / PER_MILLION) * pricing.outputPerMTokens)
  }
  if (parts.length === 0) return UNKNOWN
  return formatAmount(
    parts.reduce((sum, v) => sum + v, 0),
    pricing.currency ?? '$',
  )
}

/** 价格档位标签：按 input/output 已知价的均价划档，阈值 0 / <1 / <10 / ≥10 $/1M */
export function pricingTier(
  pricing: ModelPricing,
): 'free' | 'economy' | 'standard' | 'premium' {
  const known = [pricing.inputPerMTokens, pricing.outputPerMTokens].filter(
    (v): v is number => v != null,
  )
  // 价格全未知：中性 standard 兜底，不误标 free
  if (known.length === 0) return 'standard'
  const avg = Math.max(known.reduce((sum, v) => sum + v, 0) / known.length, 0)
  if (avg === 0) return 'free'
  if (avg < 1) return 'economy'
  if (avg < 10) return 'standard'
  return 'premium'
}
