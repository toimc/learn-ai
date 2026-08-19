import { Hono } from 'hono'
import { createConversationStore, nextId } from '../data/conversations'
import type {
  ChatMessageDTO,
  ConversationDetail,
  ConversationSummary,
  CreateConversationBody,
} from '../types'

function toSummary(conv: ConversationDetail): ConversationSummary {
  const { messages, ...summary } = conv
  return { ...summary, messageCount: messages.length }
}

function touch(conv: ConversationDetail) {
  conv.updatedAt = new Date().toISOString()
}

/**
 * 会话路由：内存存储（种子数据 + 运行期增改），重启即还原。
 * store 挂在 app 实例上，测试可各建独立 app 互不污染。
 */
export function createConversationsRoutes() {
  const store = createConversationStore()
  const app = new Hono()

  app.get('/', (c) => {
    const list = [...store.values()]
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map(toSummary)
    return c.json({ conversations: list })
  })

  app.post('/', async (c) => {
    const body = (await c.req
      .json<CreateConversationBody>()
      .catch(() => ({}))) as CreateConversationBody
    const conv: ConversationDetail = {
      id: nextId('conv'),
      title: body.title?.trim() || '新对话',
      description: '',
      updatedAt: new Date().toISOString(),
      messageCount: 0,
      messages: [],
    }
    store.set(conv.id, conv)
    return c.json(conv, 201)
  })

  app.get('/:id/messages', (c) => {
    const conv = store.get(c.req.param('id'))
    if (!conv) return c.json({ error: 'conversation not found' }, 404)
    return c.json({ id: conv.id, messages: conv.messages })
  })

  /** 把一轮对话（用户消息 + 完整助手回复）写回会话历史 */
  function appendExchange(
    conversationId: string,
    userText: string,
    assistant: ChatMessageDTO,
  ) {
    const conv = store.get(conversationId)
    if (!conv) return
    conv.messages.push(
      {
        id: nextId('m'),
        role: 'user',
        content: userText,
        createdAt: new Date().toISOString(),
      },
      assistant,
    )
    touch(conv)
  }

  function ensureConversation(
    conversationId?: string,
  ): ConversationDetail | null {
    return conversationId ? (store.get(conversationId) ?? null) : null
  }

  return { app, store, appendExchange, ensureConversation }
}

export type ConversationsService = ReturnType<typeof createConversationsRoutes>
