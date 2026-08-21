/**
 * 宿主视角集成测试范例（Testing Library 风格）：
 * 用与真实宿主一致的组装方式（参见 playground 的 MockServerDemo）把
 * Conversation / Message / MessageContent / PromptInput 与 @toimc/core
 * 的 useChat 拼成一个内联 ChatFlowDemo，端到端验证
 * 「输入 → 发送 → 流式回复上屏」整条链路。
 *
 * 查询只走用户可感知的信号（role / 文本 / placeholder），
 * 不触碰组件内部实现；交互用 userEvent 模拟真实键盘与鼠标。
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
// setup.ts 在根目录、不在本包 tsconfig 程序内：文件内再引入一次，
// 让 jest-dom matcher 的类型增强对 vue-tsc 可见（运行时幂等）
import '@testing-library/jest-dom/vitest'
import { defineComponent, h } from 'vue'
import { render, screen, cleanup } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { useChat, type ChatAdapter, type StreamChunk } from '@toimc/core'
import Conversation from '../conversation/Conversation.vue'
import ConversationContent from '../conversation/ConversationContent.vue'
import Message from '../message/Message.vue'
import MessageContent from '../message/MessageContent.vue'
import PromptInput from '../prompt-input/PromptInput.vue'
import PromptInputBody from '../prompt-input/PromptInputBody.vue'
import PromptInputTextarea from '../prompt-input/PromptInputTextarea.vue'
import PromptInputFooter from '../prompt-input/PromptInputFooter.vue'
import PromptInputSubmit from '../prompt-input/PromptInputSubmit.vue'
import { setAiChatLocale } from '../locales'

// jsdom 的 navigator.language 是 en-US，i18n 单例据此初始化为英文；
// 断言默认中文文案前需显式切回（与 PromptInput.i18n.test.ts 同约定）
beforeEach(() => setAiChatLocale('zh-CN', { persist: false }))
afterEach(() => setAiChatLocale('zh-CN', { persist: false }))
afterEach(cleanup)

function textChunk(content: string): StreamChunk {
  return { type: 'text', content }
}

/** 流式 mock adapter：按预置顺序 yield chunk，模拟后端 SSE 流 */
function makeAdapter(chunks: StreamChunk[]): ChatAdapter {
  return {
    async *sendMessage() {
      for (const chunk of chunks) yield chunk
    },
  }
}

/**
 * 内联宿主组件：adapter 通过闭包注入（对应真实宿主在 setup 里
 * useChat(adapter) 的写法），错误按宿主契约渲染成 role="alert" 提示条
 */
function createChatFlowDemo(adapter: ChatAdapter) {
  return defineComponent({
    name: 'ChatFlowDemo',
    setup() {
      const chat = useChat(adapter)

      return () =>
        h(Conversation, null, {
          default: () => [
            h(ConversationContent, null, {
              default: () =>
                chat.messages.map((msg) =>
                  h(Message, { key: msg.id, from: msg.role }, () => [
                    // 未注入 markdown renderer 时 MessageContent 回落 slot 渲染纯文本
                    h(
                      MessageContent,
                      { content: msg.content },
                      () => msg.content,
                    ),
                  ]),
                ),
            }),
            chat.error ? h('div', { role: 'alert' }, chat.error.message) : null,
            h(
              PromptInput,
              {
                onSend: (payload: { text: string }) => {
                  void chat.send(payload.text)
                },
              },
              {
                default: () => h(PromptInputBody, () => h(PromptInputTextarea)),
                footer: () =>
                  h(PromptInputFooter, null, {
                    hint: () => h(PromptInputSubmit),
                  }),
              },
            ),
          ],
        })
    },
  })
}

describe('ChatFlow 集成（Conversation + Message + PromptInput + useChat）', () => {
  it('Alt+Enter 发送后，用户消息与流式回复的完整文本依次上屏', async () => {
    const reply = '流式渲染分块到达，最终拼成完整回复'
    const adapter = makeAdapter([
      textChunk('流式渲染'),
      textChunk('分块到达，'),
      textChunk('最终拼成完整回复'),
    ])
    render(createChatFlowDemo(adapter))

    // Arrange：发送前对话区没有任何回复
    expect(screen.queryByText(reply)).not.toBeInTheDocument()

    const user = userEvent.setup()
    await user.type(screen.getByRole('textbox'), '讲讲流式渲染')
    // sendKey 默认 alt-enter：Enter 原生换行，Alt+Enter 才提交
    await user.keyboard('{Alt>}{Enter}{/Alt}')

    // 用户消息立即上屏；助手回复以 chunk 顺序拼接，最终完整可见
    expect(await screen.findByText('讲讲流式渲染')).toBeInTheDocument()
    expect(await screen.findByText(reply)).toBeInTheDocument()
  })

  it('点击发送按钮提交后，输入框恢复为空', async () => {
    const adapter = makeAdapter([textChunk('收到')])
    render(createChatFlowDemo(adapter))

    const user = userEvent.setup()
    // placeholder 走 i18n 默认 zh-CN 文案
    const input = screen.getByPlaceholderText('给 AI Chat UI 发送消息...')
    await user.type(input, '你好')
    await user.click(screen.getByRole('button', { name: '发送' }))

    await screen.findByText('收到')
    expect(screen.getByRole('textbox')).toHaveValue('')
  })

  it('adapter 产出 error chunk 时显示错误提示，已到达的文本保留', async () => {
    const adapter = makeAdapter([
      textChunk('抱歉，'),
      { type: 'error', content: '模型服务暂时不可用' },
    ])
    render(createChatFlowDemo(adapter))

    const user = userEvent.setup()
    await user.type(screen.getByRole('textbox'), '触发错误')
    await user.keyboard('{Alt>}{Enter}{/Alt}')

    // 流在 error chunk 处中断：错误经 ChatState.error 冒给宿主渲染
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('模型服务暂时不可用')
    expect(screen.getByText('抱歉，')).toBeInTheDocument()
  })
})
