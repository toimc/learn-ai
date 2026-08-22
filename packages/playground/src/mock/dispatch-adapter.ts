import type { ChatAdapter, SendMessageOptions, StreamChunk } from '@toimc/core'
import { createMastraAdapter } from '../adapters/mastra-adapter'
import { mockAdapter } from './mock-adapter'
import { createSseAdapter } from './sse-adapter'

/** 分发依据的会话快照：带 model 即真实模型会话，id 透传给服务端做历史归档 */
export interface DispatchConversation {
  id?: string
  model?: string
  /** 会话创建时快照的后端（spec 12）：'mastra' 走 4111 原生端点，其余仍按 model 分发 */
  backend?: 'mock-server' | 'mastra'
}

export interface DispatchAdapterOptions {
  /** 每次发送时取当前会话（闭包注入，随切换更新） */
  getConversation: () => DispatchConversation | undefined
  /** backend=mastra 时运行时模型是否已配置：true → custom-agent 端点（每次发送时读取快照，已开始的流不切换） */
  getMastraCustomModelActive?: () => boolean
}

/**
 * 三路分发（spec 12 §4.2，每次 sendMessage 时读取闭包，同一实例随会话切换换路）：
 * backend=mastra → mastraAdapter（POST 4111 /api/agents/chat-agent/stream，前端转协议；
 *   运行时模型已配置时切 /api/app/agents/custom-agent/stream，快照语义同会话切换）；
 * 带 model → SSE adapter（POST /api/chat 走真实/服务端模型）；
 * 其余 → 本地 mockAdapter（行为与未接入前完全一致）。
 */
export function createDispatchAdapter(
  options: DispatchAdapterOptions,
): ChatAdapter {
  return {
    async *sendMessage(opts: SendMessageOptions): AsyncGenerator<StreamChunk> {
      const conv = options.getConversation()
      if (conv?.backend === 'mastra') {
        const mastra = createMastraAdapter({
          getConversationId: () => conv.id,
          ...(options.getMastraCustomModelActive?.()
            ? { getEndpoint: () => '/api/app/agents/custom-agent/stream' }
            : {}),
        })
        yield* mastra.sendMessage(opts)
        return
      }
      if (conv?.model) {
        const sse = createSseAdapter({
          getConversationId: () => conv.id,
          getModel: () => conv.model,
        })
        yield* sse.sendMessage(opts)
        return
      }
      yield* mockAdapter.sendMessage(opts)
    },
  }
}
