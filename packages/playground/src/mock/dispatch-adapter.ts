import type { ChatAdapter, SendMessageOptions, StreamChunk } from '@toimc/core'
import { mockAdapter } from './mock-adapter'
import { createSseAdapter } from './sse-adapter'

/** 分发依据的会话快照：带 model 即真实模型会话，id 透传给服务端做历史归档 */
export interface DispatchConversation {
  id?: string
  model?: string
}

export interface DispatchAdapterOptions {
  /** 每次发送时取当前会话（闭包注入，随切换更新） */
  getConversation: () => DispatchConversation | undefined
}

/**
 * 按当前会话是否绑定 model 分发：
 * 带 model → SSE adapter（POST /api/chat 走真实/服务端模型）；
 * 不带 model 或无会话 → 本地 mockAdapter（行为与未接入前完全一致）。
 * 分发决策在每次 sendMessage 时读取闭包，同一实例随会话切换换路。
 */
export function createDispatchAdapter(
  options: DispatchAdapterOptions,
): ChatAdapter {
  return {
    async *sendMessage(opts: SendMessageOptions): AsyncGenerator<StreamChunk> {
      const conv = options.getConversation()
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
