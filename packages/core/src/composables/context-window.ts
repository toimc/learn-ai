import type { Message } from '../types'
import { estimateTokens } from '../utils/estimate-tokens'

export type TokenEstimator = (text: string) => number

/** 消息 token 数：metadata.tokenCount（真实 usage 校准值）优先，否则估算 */
export function resolveTokenCount(
  message: Message,
  estimator: TokenEstimator,
): number {
  const stored = message.metadata?.tokenCount
  if (typeof stored === 'number' && stored >= 0) return stored
  return estimator(message.content ?? '')
}

export interface ContextWindowResult {
  /** 窗口内消息（发给 adapter 的数组） */
  messages: Message[]
  /** 被排除的消息条数 */
  truncatedCount: number
}

/**
 * 上下文窗口截断：从最新往最旧累加 token，超出 maxTokens 的最旧消息排除。
 * 只影响发送数组，不改动传入数组本身（UI 历史完整保留是 spec 决策）。
 * 首条 system 消息始终保留，其 token 已计入预算。
 */
export function truncateContext(
  messages: Message[],
  maxTokens: number | undefined,
  estimator: TokenEstimator = estimateTokens,
): ContextWindowResult {
  if (!maxTokens || maxTokens <= 0 || messages.length === 0) {
    return { messages, truncatedCount: 0 }
  }

  let total = 0
  let cut = 0
  for (let i = messages.length - 1; i >= 0; i--) {
    total += resolveTokenCount(messages[i], estimator)
    if (total > maxTokens) {
      cut = i + 1
      break
    }
  }
  if (cut === 0) return { messages, truncatedCount: 0 }

  if (messages[0].role === 'system') {
    return {
      messages: [messages[0], ...messages.slice(cut)],
      truncatedCount: cut - 1,
    }
  }
  return { messages: messages.slice(cut), truncatedCount: cut }
}
