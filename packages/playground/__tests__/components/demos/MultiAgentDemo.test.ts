import { beforeEach, describe, it, expect } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import { setAiChatLocale } from '@toimc/vue'
import MultiAgentDemo from '../../../src/components/demos/MultiAgentDemo.vue'
import CollaborationCard from '../../../src/components/demos/CollaborationCard.vue'
import type { OrchestrationResult } from '../../../src/components/demos/orchestration-types'

// jsdom 的 navigator.language 为 en-US，断言中文文案前先钉回 zh-CN
beforeEach(() => setAiChatLocale('zh-CN', { persist: false }))

/** dev-server 不在线（fetch 全部失败 → offline），不影响发送前的指令注入断言 */
async function mountDemo() {
  const w = mount(MultiAgentDemo)
  await flushPromises()
  return w
}

async function submit(w: Awaited<ReturnType<typeof mountDemo>>, text: string) {
  await w.get('textarea').setValue(text)
  await w.get('textarea').trigger('keydown', { key: 'Enter', altKey: true })
  await flushPromises()
  await nextTick()
}

const PRESET_1 = 'InputArea 的 Enter 键行为是什么？Shift+Enter 又是什么？'
const PRESET_2 = '主题定制有哪些方式？CSS 变量覆盖和预设怎么选？'

/** 最小合法委托结果：两阶段 */
const delegateResult: OrchestrationResult = {
  pattern: 'delegate',
  task: PRESET_1,
  stages: [
    {
      role: 'researcher',
      agentId: 'researcher-agent',
      status: 'ok',
      durationMs: 300,
      model: 'glm-4.7-air',
      output: '检索到 Enter/Shift+Enter 说明',
    },
    {
      role: 'writer',
      agentId: 'writer-agent',
      status: 'ok',
      durationMs: 500,
      model: 'glm-4.7',
      output: 'Enter 发送，Shift+Enter 换行',
    },
  ],
  finalDraft: 'Enter 发送，Shift+Enter 换行',
}

describe('MultiAgentDemo', () => {
  it('默认委托形态：发送后消息最前是委托指令 system 消息，用户问题带【委托】前缀', async () => {
    const w = await mountDemo()
    await submit(w, PRESET_1)
    expect(w.text()).toContain('本次使用委托模式编排任务')
    expect(w.text()).toContain(`【委托】${PRESET_1}`)
    // 指令消息渲染为独立的 directive 行
    expect(w.findAll('.ma-demo__directive')).toHaveLength(1)
  })

  it('切换到流水线：指令字符串与问题前缀同步更新', async () => {
    const w = await mountDemo()
    await w.findAll('.ma-demo__pattern-btn')[2].trigger('click')
    await submit(w, PRESET_2)
    expect(w.text()).toContain('本次使用流水线模式编排任务')
    expect(w.text()).toContain(`【流水线】${PRESET_2}`)
  })

  it('再切回委托：指令原位更新为唯一一条，不残留旧形态指令', async () => {
    const w = await mountDemo()
    await submit(w, PRESET_1)
    await w.findAll('.ma-demo__pattern-btn')[2].trigger('click')
    await submit(w, PRESET_2)
    await w.findAll('.ma-demo__pattern-btn')[0].trigger('click')
    await submit(w, PRESET_2)
    expect(w.text()).toContain('本次使用委托模式编排任务')
    expect(w.text()).not.toContain('本次使用流水线模式编排任务')
    expect(w.findAll('.ma-demo__directive')).toHaveLength(1)
  })

  it('点击示例问题填入输入框（不直接发送）', async () => {
    const w = await mountDemo()
    await w.findAll('.ma-demo__preset')[0].trigger('click')
    expect(w.get('textarea').element.value).toBe(PRESET_1)
    // 未发送：无指令消息
    expect(w.find('.ma-demo__directive').exists()).toBe(false)
  })

  it('形态切换更新当前形态说明', async () => {
    const w = await mountDemo()
    expect(w.get('.ma-demo__pattern-desc').text()).toContain('researcher')
    await w.findAll('.ma-demo__pattern-btn')[1].trigger('click')
    expect(w.get('.ma-demo__pattern-desc').text()).toContain('并行')
  })

  it('orchestrate 工具调用渲染 CollaborationCard，其他工具渲染 ToolCall', async () => {
    const w = await mountDemo()
    w.vm.chat.messages.push({
      id: 'm_scripted',
      role: 'assistant',
      content: '编排完成，汇报如下。',
      createdAt: new Date(),
      toolCalls: [
        {
          id: 't_orch',
          name: 'orchestrate',
          arguments: { pattern: 'delegate', task: PRESET_1 },
          status: 'completed',
          result: delegateResult,
          duration: 800,
        },
        {
          id: 't_other',
          name: 'search_docs',
          arguments: { query: 'Enter' },
          status: 'completed',
          result: { hits: [] },
          duration: 120,
        },
      ],
    })
    await nextTick()
    expect(w.findComponent(CollaborationCard).exists()).toBe(true)
    expect(w.find('.collab-card').exists()).toBe(true)
    expect(w.find('.ai-chat-tool-call').exists()).toBe(true)
    expect(w.findAll('.collab-card__stage')).toHaveLength(2)
  })
})
