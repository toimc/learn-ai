import { reactive, type UnwrapNestedRefs } from 'vue'
import type { ChatAdapter, ChatOptions, ChatState, TokenUsage } from '../types'
import { createUserMessage, createAssistantMessage } from '../utils'
import { estimateTokens } from '../utils/estimate-tokens'
import { truncateContext } from './context-window'

export function useChat(
  adapter: ChatAdapter,
  options?: ChatOptions,
): UnwrapNestedRefs<ChatState> {
  const estimator = options?.tokenEstimator ?? estimateTokens

  const state = reactive<ChatState>({
    messages: options?.initialMessages ? [...options.initialMessages] : [],
    isStreaming: false,
    error: null,
    truncatedCount: 0,
    send,
    regenerate,
    editMessage,
    abort,
    clear,
  })

  let currentController: AbortController | null = null

  // maxContextTokens 支持 getter：宿主的窗口配置常随选中模型变化，发送时求值
  function resolveMaxTokens(): number | undefined {
    const raw = options?.maxContextTokens
    const value = typeof raw === 'function' ? raw() : raw
    return typeof value === 'number' && value > 0 ? value : undefined
  }

  // 显式裁剪而非覆盖 push：Vue reactive 对数组方法做 instrumentation，
  // 覆盖 push 会被 toRaw(this).push 回读，造成无限递归栈溢出
  function trimHistory(): void {
    const max = options?.maxHistory
    if (!max) return
    while (state.messages.length > max) {
      state.messages.shift()
    }
  }

  trimHistory()

  // 流式请求共享路径：调用前 state.messages 末尾须已就位触发消息（user 或被保留的旧消息）。
  // send / regenerate / editMessage 收敛于此，窗口截断与 usage 回填一处维护。
  async function requestAssistant(): Promise<void> {
    // 必须先 reactive 再入列：直接改 raw 对象不会触发依赖更新，
    // 流式追加将完全失去响应性（UI 冻结到流结束才一次性渲染）
    const assistantMessage = reactive(createAssistantMessage())
    state.messages.push(assistantMessage)
    trimHistory()

    // 截断只影响发送数组，不删 state.messages（UI 历史完整保留）
    const contextWindow = truncateContext(
      state.messages.slice(0, -1),
      resolveMaxTokens(),
      estimator,
    )
    state.truncatedCount = contextWindow.truncatedCount

    state.isStreaming = true
    state.error = null

    let thinkingStartTime: number | null = null
    let reportedUsage: TokenUsage | undefined

    const controller = new AbortController()
    currentController = controller

    // 适配器流可能不响应 signal（挂起的生成器、未绑定 signal 的实现）：
    // 与 abort race 保证中断后请求 promise 必然 settle，状态机不被悬空流卡死
    const abortPromise = new Promise<never>((_, reject) => {
      controller.signal.addEventListener(
        'abort',
        () => {
          const err = new Error('The operation was aborted')
          err.name = 'AbortError'
          reject(err)
        },
        { once: true },
      )
    })

    try {
      const stream = adapter.sendMessage({
        messages: contextWindow.messages,
        signal: controller.signal,
      })
      const iterator = stream[Symbol.asyncIterator]()

      while (true) {
        const result = await Promise.race([iterator.next(), abortPromise])
        if (result.done) break
        const chunk = result.value

        if (chunk.type === 'done') {
          reportedUsage = chunk.metadata?.usage as TokenUsage | undefined
          // 计算思考时长
          if (assistantMessage.thinking && thinkingStartTime) {
            assistantMessage.thinking.duration = Date.now() - thinkingStartTime
          }
          break
        }

        if (chunk.type === 'error') {
          state.error = new Error(chunk.content)
          options?.onError?.(state.error)
          break
        }

        if (chunk.type === 'text') {
          assistantMessage.content += chunk.content
        }

        if (chunk.type === 'thinking') {
          if (!assistantMessage.thinking) {
            assistantMessage.thinking = {
              content: '',
              startTime: new Date(),
            }
            thinkingStartTime = Date.now()
          }
          assistantMessage.thinking.content += chunk.content
        }

        if (chunk.type === 'tool_call') {
          if (!assistantMessage.toolCalls) assistantMessage.toolCalls = []
          // 同 toolCallId 可能来多帧（流式起点帧 + 完整参数帧）：命中则原位更新，
          // 避免重复 entry 停在 calling 状态与渲染层重复 key
          const callId = (chunk.metadata?.toolCallId as string) || ''
          const existing = assistantMessage.toolCalls.find(
            (t) => t.id === callId,
          )
          if (existing) {
            if (chunk.metadata?.toolArguments) {
              existing.arguments = chunk.metadata.toolArguments as Record<
                string,
                unknown
              >
            }
            if (chunk.metadata?.toolName) {
              existing.name = chunk.metadata.toolName as string
            }
          } else {
            assistantMessage.toolCalls.push({
              id: callId,
              name: (chunk.metadata?.toolName as string) || 'unknown',
              arguments:
                (chunk.metadata?.toolArguments as Record<string, unknown>) ||
                {},
              status: 'calling',
            })
          }
        }

        if (chunk.type === 'tool_result') {
          const tc = assistantMessage.toolCalls?.find(
            (t) => t.id === chunk.metadata?.toolCallId,
          )
          if (tc) {
            tc.status = chunk.metadata?.toolError ? 'error' : 'completed'
            tc.result = chunk.metadata?.toolResult
            tc.error = chunk.metadata?.toolError as string | undefined
            tc.duration = chunk.metadata?.duration as number | undefined
          }
        }

        options?.onResponse?.(chunk)
      }
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        state.error = err
        options?.onError?.(err)
      }
    } finally {
      // tokenCount 回填：done 帧真实 usage 优先，估算兜底（中断/报错路径也在 finally 兜底）
      if (typeof assistantMessage.metadata?.tokenCount !== 'number') {
        assistantMessage.metadata = {
          ...(assistantMessage.metadata ?? {}),
          tokenCount:
            typeof reportedUsage?.outputTokens === 'number'
              ? reportedUsage.outputTokens
              : estimator(assistantMessage.content),
        }
      }
      // 零产出完成（无文本/思考/工具且非中断非报错）：上游空转收尾（坏 key 的
      // 中转站空回复即此形态），显式置错避免 UI 沉默——否则消息发出石沉大海
      if (
        !state.error &&
        !controller.signal.aborted &&
        !assistantMessage.content &&
        !assistantMessage.thinking &&
        !assistantMessage.toolCalls?.length
      ) {
        state.error = new Error('回复为空：上游未返回内容，请检查模型服务配置')
        options?.onError?.(state.error)
      }
      state.isStreaming = false
      currentController = null
    }
  }

  async function send(
    content: string,
    attachments?: import('../types').Attachment[],
  ): Promise<void> {
    const userMessage = createUserMessage(content, attachments)
    userMessage.metadata = {
      ...userMessage.metadata,
      tokenCount: estimator(content),
    }
    state.messages.push(userMessage)
    await requestAssistant()
  }

  async function regenerate(messageId?: string): Promise<void> {
    if (state.isStreaming) return
    let targetIndex = -1
    if (messageId !== undefined) {
      const idx = state.messages.findIndex((m) => m.id === messageId)
      if (idx !== -1 && state.messages[idx].role === 'assistant') {
        targetIndex = idx
      }
    } else {
      for (let i = state.messages.length - 1; i >= 0; i--) {
        if (state.messages[i].role === 'assistant') {
          targetIndex = i
          break
        }
      }
    }
    if (targetIndex === -1) return
    state.messages.splice(targetIndex)
    await requestAssistant()
  }

  async function editMessage(
    messageId: string,
    content: string,
  ): Promise<void> {
    if (state.isStreaming) return
    const idx = state.messages.findIndex((m) => m.id === messageId)
    if (idx === -1 || state.messages[idx].role !== 'user') return
    const target = state.messages[idx]
    target.content = content
    target.metadata = {
      ...(target.metadata ?? {}),
      tokenCount: estimator(content),
    }
    state.messages.splice(idx + 1)
    await requestAssistant()
  }

  function abort(): void {
    if (currentController) {
      currentController.abort()
      state.isStreaming = false
    }
  }

  function clear(): void {
    state.messages = []
    state.error = null
    state.isStreaming = false
    state.truncatedCount = 0
  }

  return state
}
