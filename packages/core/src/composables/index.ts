import { reactive, type UnwrapNestedRefs } from 'vue'
import type { ChatAdapter, ChatOptions, ChatState } from '../types'
import { createUserMessage, createAssistantMessage } from '../utils'

export function useChat(
  adapter: ChatAdapter,
  options?: ChatOptions,
): UnwrapNestedRefs<ChatState> {
  const state = reactive<ChatState>({
    messages: options?.initialMessages ? [...options.initialMessages] : [],
    isStreaming: false,
    error: null,
    send,
    abort,
    clear,
  })

  let currentController: AbortController | null = null

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

  async function send(
    content: string,
    attachments?: import('../types').Attachment[],
  ): Promise<void> {
    const userMessage = createUserMessage(content, attachments)
    state.messages.push(userMessage)

    // 必须先 reactive 再入列：直接改 raw 对象不会触发依赖更新，
    // 流式追加将完全失去响应性（UI 冻结到流结束才一次性渲染）
    const assistantMessage = reactive(createAssistantMessage())
    state.messages.push(assistantMessage)
    trimHistory()

    state.isStreaming = true
    state.error = null

    let thinkingStartTime: number | null = null

    currentController = new AbortController()

    try {
      const stream = adapter.sendMessage({
        messages: state.messages.slice(0, -1),
        signal: currentController.signal,
      })

      for await (const chunk of stream) {
        if (chunk.type === 'done') {
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
      // 零产出完成（无文本/思考/工具且非中断非报错）：上游空转收尾（坏 key 的
      // 中转站空回复即此形态），显式置错避免 UI 沉默——否则消息发出石沉大海
      if (
        !state.error &&
        !currentController?.signal.aborted &&
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
  }

  return state
}
