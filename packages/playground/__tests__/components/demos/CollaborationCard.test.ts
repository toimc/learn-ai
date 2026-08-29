import { beforeEach, describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import type { ToolCallInfo } from '@toimc/core'
import { setAiChatLocale } from '@toimc/vue'
import CollaborationCard from '../../../src/components/demos/CollaborationCard.vue'
import type { OrchestrationResult } from '../../../src/components/demos/orchestration-types'

// jsdom 的 navigator.language 为 en-US，断言中文文案前先钉回 zh-CN
beforeEach(() => setAiChatLocale('zh-CN', { persist: false }))

function makeToolCall(
  result: unknown,
  status: ToolCallInfo['status'] = 'completed',
): ToolCallInfo {
  return {
    id: 'tc_orch_1',
    name: 'orchestrate',
    arguments: { pattern: 'pipeline', task: 'InputArea 的 Enter 键行为' },
    result,
    status,
    duration: 2240,
  }
}

/** 手写流水线 fixture：researcher → writer → reviewer(revise) → writer 重写（retried） */
const pipelineFixture: OrchestrationResult = {
  pattern: 'pipeline',
  task: 'InputArea 的 Enter 键行为是什么？',
  stages: [
    {
      role: 'researcher',
      agentId: 'researcher-agent',
      status: 'ok',
      durationMs: 420,
      model: 'glm-4.7-air',
      usage: { inputTokens: 96, outputTokens: 40 },
      output: 'Enter 直接发送；Shift+Enter 换行。',
    },
    {
      role: 'writer',
      agentId: 'writer-agent',
      status: 'ok',
      durationMs: 810,
      model: 'glm-4.7',
      output: '草稿 v1：Enter 发送。',
    },
    {
      role: 'reviewer',
      agentId: 'reviewer-agent',
      status: 'ok',
      durationMs: 350,
      model: 'glm-4.7',
      output: '[revise] 缺少 Shift+Enter 的说明。',
      meta: { verdict: 'revise' },
    },
    {
      role: 'writer',
      agentId: 'writer-agent',
      status: 'ok',
      durationMs: 660,
      model: 'glm-4.7',
      output: '草稿 v2：Enter 发送、Shift+Enter 换行。',
      meta: { retried: true },
    },
  ],
  finalDraft: '草稿 v2：Enter 发送、Shift+Enter 换行。',
}

/** 手写并行 fixture：三路 researcher，其中一路失败 */
const parallelFixture: OrchestrationResult = {
  pattern: 'parallel',
  task: '主题定制有哪些方式？',
  stages: [
    {
      role: 'researcher',
      agentId: 'researcher-agent',
      status: 'ok',
      durationMs: 380,
      model: 'glm-4.7-air',
      output: '角度一：组件用法与 API。',
    },
    {
      role: 'researcher',
      agentId: 'researcher-agent',
      status: 'error',
      durationMs: 120,
      model: 'glm-4.7-air',
      output: '检索超时',
    },
    {
      role: 'researcher',
      agentId: 'researcher-agent',
      status: 'ok',
      durationMs: 405,
      model: 'glm-4.7-air',
      output: '角度三：集成与数据流转。',
    },
  ],
  finalDraft: '',
}

describe('CollaborationCard', () => {
  it('流水线：徽章/任务/子 agent 数/总耗时（420+810+350+660=2240）', () => {
    const w = mount(CollaborationCard, {
      props: { data: makeToolCall(pipelineFixture) },
    })
    expect(w.get('.collab-card__badge').text()).toBe('流水线')
    expect(w.get('.collab-card__task').text()).toContain(
      'InputArea 的 Enter 键行为',
    )
    expect(w.get('.collab-card__meta').text()).toContain('4 个子 Agent')
    expect(w.get('.collab-card__meta').text()).toContain('2240 ms')
  })

  it('流水线：四个阶段行，含角色名/agentId/模型/耗时', () => {
    const w = mount(CollaborationCard, {
      props: { data: makeToolCall(pipelineFixture) },
    })
    const stages = w.findAll('.collab-card__stage')
    expect(stages).toHaveLength(4)
    expect(stages[0].get('.collab-card__stage-role').text()).toBe('检索员')
    expect(stages[1].get('.collab-card__stage-role').text()).toBe('起草员')
    expect(stages[2].get('.collab-card__stage-role').text()).toBe('审查员')
    expect(stages[3].get('.collab-card__stage-role').text()).toBe('起草员')
    expect(stages[0].text()).toContain('researcher-agent')
    expect(stages[0].text()).toContain('glm-4.7-air')
    expect(stages[0].text()).toContain('420 ms')
    // 全部 ok → 无 error 阶段
    expect(w.find(".collab-card__stage[data-status='error']").exists()).toBe(
      false,
    )
  })

  it('流水线：retried 标记与 verdict 结论', () => {
    const w = mount(CollaborationCard, {
      props: { data: makeToolCall(pipelineFixture) },
    })
    expect(w.get('.collab-card__stage-retried').text()).toBe('已打回重写')
    expect(w.get('.collab-card__stage-verdict').text()).toBe('需修订')
    // 通过标记不应出现（verdict = revise）
    expect(w.text()).not.toContain('审查通过')
  })

  it('产出默认收起，点击展开可见内容', async () => {
    const w = mount(CollaborationCard, {
      props: { data: makeToolCall(pipelineFixture) },
    })
    expect(w.find('.collab-card__stage-output').exists()).toBe(false)
    await w.findAll('.collab-card__stage-toggle')[0].trigger('click')
    expect(w.findAll('.collab-card__stage-output')[0].text()).toContain(
      'Enter 直接发送；Shift+Enter 换行。',
    )
  })

  it('verdict=pass 时显示审查通过', () => {
    const passFixture: OrchestrationResult = {
      ...pipelineFixture,
      stages: [
        pipelineFixture.stages[0],
        pipelineFixture.stages[1],
        {
          role: 'reviewer',
          agentId: 'reviewer-agent',
          status: 'ok',
          durationMs: 300,
          model: 'glm-4.7',
          output: '[pass] 草稿已覆盖检索要点。',
          meta: { verdict: 'pass' },
        },
      ],
      finalDraft: '终稿',
    }
    const w = mount(CollaborationCard, {
      props: { data: makeToolCall(passFixture) },
    })
    expect(w.get('.collab-card__stage-verdict').text()).toBe('审查通过')
    expect(w.text()).not.toContain('需修订')
  })

  it('并行：三路并列展示，失败路标记 error', () => {
    const w = mount(CollaborationCard, {
      props: { data: makeToolCall(parallelFixture) },
    })
    expect(w.find('.collab-card__stages--parallel').exists()).toBe(true)
    expect(w.findAll('.collab-card__stage')).toHaveLength(3)
    expect(w.find(".collab-card__stage[data-status='error']").exists()).toBe(
      true,
    )
    expect(w.get('.collab-card__badge').text()).toBe('并行')
  })

  it('结构不符时回退显示原始 JSON', () => {
    const w = mount(CollaborationCard, {
      props: { data: makeToolCall({ foo: 'bar', pattern: 123 }) },
    })
    expect(w.find('.collab-card__fallback').exists()).toBe(true)
    expect(w.get('.collab-card__fallback').text()).toContain('"foo"')
    // 不渲染时间线
    expect(w.find('.collab-card__stage').exists()).toBe(false)
  })

  it('result 缺失（calling 中）显示进行中态', () => {
    const w = mount(CollaborationCard, {
      props: { data: makeToolCall(undefined, 'calling') },
    })
    expect(w.get('.collab-card__pending').text()).toContain('编排进行中')
    expect(w.find('.collab-card__fallback').exists()).toBe(false)
  })
})
