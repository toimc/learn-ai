import type { ChatRequest, ChatResponse, IModelAdapter } from '@toimc/agents'
import type { StreamChunk } from '@toimc/core'
import { estimateTokens } from '@toimc/core'
import { buildReply, type ScriptedChunk } from './scenarios'

/** 三档演示模型的差异化因子 */
type MockVariant = 'pro' | 'flash' | 'thinking'

interface VariantSpec {
  /** 延迟倍率（flash 更快） */
  speedFactor: number
  /** 无 thinking 剧本时前置的思考片段 */
  thinkingLead?: ScriptedChunk[]
}

const VARIANT_SPECS: Record<MockVariant, VariantSpec> = {
  pro: { speedFactor: 1 },
  flash: { speedFactor: 0.4 },
  thinking: {
    speedFactor: 1,
    thinkingLead: [
      {
        chunk: {
          type: 'thinking',
          content: '（思考模型）先拆解问题，再组织答案。\n',
        },
        delayMs: 300,
      },
    ],
  },
}

function sleep(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve) => {
    if (ms <= 0 || signal?.aborted) return resolve()
    const t = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    const onAbort = () => {
      clearTimeout(t)
      resolve()
    }
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

/**
 * 剧本引擎包装为 IModelAdapter：网关侧与真实模型适配器同构接入。
 * passthrough.speed 为速度倍率（1 正常，<1 加速，0 立即），供测试提速。
 */
export function createMockAdapter(variant: MockVariant = 'pro'): IModelAdapter {
  const spec = VARIANT_SPECS[variant]

  async function* run(request: ChatRequest): AsyncGenerator<StreamChunk> {
    const lastUser = [...request.messages]
      .reverse()
      .find((m) => m.role === 'user')
    // 边界防御：非字符串内容按空输入处理，走默认剧本
    const input = typeof lastUser?.content === 'string' ? lastUser.content : ''
    const script = [...buildReply(input)]
    if (spec.thinkingLead && !script.some((s) => s.chunk.type === 'thinking')) {
      script.unshift(...spec.thinkingLead)
    }

    // 模拟真实 API 的 usage 回传：剧本收尾时按 core 同款估算器计算
    let outputText = ''
    const speed = Math.max(0, Number(request.passthrough?.speed ?? 1))
    for (const { chunk, delayMs } of script) {
      if (request.signal?.aborted) return
      await sleep(
        Math.round(delayMs * spec.speedFactor * speed),
        request.signal,
      )
      if (request.signal?.aborted) return
      if (chunk.type === 'text') outputText += chunk.content
      if (chunk.type === 'done') {
        yield {
          ...chunk,
          metadata: {
            ...chunk.metadata,
            usage: {
              inputTokens: request.messages.reduce(
                (sum, m) => sum + estimateTokens(String(m.content ?? '')),
                0,
              ),
              outputTokens: estimateTokens(outputText),
            },
          },
        }
        continue
      }
      yield chunk
    }
  }

  return {
    async chat(request: ChatRequest): Promise<ChatResponse> {
      let content = ''
      for await (const chunk of run(request)) {
        if (chunk.type === 'text') content += chunk.content
      }
      return { content, model: 'mock' }
    },
    chatStream: run,
  }
}
