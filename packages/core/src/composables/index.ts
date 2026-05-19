import { reactive, type UnwrapNestedRefs } from 'vue'
import type {
  ChatAdapter,
  ChatOptions,
  ChatState,
  Message,
} from '../types'
import { createUserMessage, createAssistantMessage } from '../utils'

export function useChat(
  adapter: ChatAdapter,
  options?: ChatOptions
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

  async function send(
    content: string,
    attachments?: import('../types').Attachment[]
  ): Promise<void> {
    const userMessage = createUserMessage(content, attachments)
    state.messages.push(userMessage)

    const assistantMessage = createAssistantMessage()
    state.messages.push(assistantMessage)

    state.isStreaming = true
    state.error = null

    currentController = new AbortController()

    try {
      const stream = adapter.sendMessage({
        messages: state.messages.slice(0, -1),
        signal: currentController.signal,
      })

      for await (const chunk of stream) {
        if (chunk.type === 'done') break

        if (chunk.type === 'error') {
          state.error = new Error(chunk.content)
          options?.onError?.(state.error)
          break
        }

        if (chunk.type === 'text') {
          assistantMessage.content += chunk.content
        }

        options?.onResponse?.(chunk)
      }
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        state.error = err
        options?.onError?.(err)
      }
    } finally {
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

  if (options?.maxHistory) {
    const max = options.maxHistory
    const originalPush = state.messages.push.bind(state.messages)
    state.messages.push = function (...items: Message[]) {
      const result = originalPush(...items)
      while (state.messages.length > max) {
        state.messages.shift()
      }
      return result
    }
  }

  return state
}
