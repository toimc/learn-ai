/**
 * ProviderSettingsDialog 盲测（双盲分工）
 *
 * 仅依据 docs/superpowers/spec/11-运行时Provider注册与真实模型会话-20260822.md §2.1
 * 与 packages/vue/src/provider/types.ts 编写，未读组件实现源码与既有测试。
 *
 * DOM 定位策略（spec 未规定 DOM 结构，采用最小假设，失败即报告为 spec 歧义）：
 * - 对话框弹层经 Teleport 渲染到 body，测试统一 stub teleport 使内容落回 wrapper 子树
 * - 文本输入：排除 radio/password 后，按 spec §2.1 字段序 name → baseURL → model
 * - apiKey：spec 明确「password 型输入框」，按 type=password 定位
 * - provider 单选：spec 明确「类型单选」，按 radio 的 value 属性定位
 * - 提交：spec 称「表单」，触发 <form> 的 submit 事件
 * - 删除按钮：表单之外、且位于表单之后的按钮（spec：列表区每项一个删除按钮，
 *   列表区与表单区是两个区域，header 关闭类按钮位于表单之前）
 */
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import type { VueWrapper, DOMWrapper } from '@vue/test-utils'
import { ProviderSettingsDialog } from '../../src/index'
import type { ProviderOption } from '../../src/index'

const twoProviders: ProviderOption[] = [
  {
    id: 'custom-1',
    name: 'DeepSeek 主力',
    provider: 'openai-compat',
    model: 'deepseek-chat',
  },
  {
    id: 'custom-2',
    name: '官方 Claude',
    provider: 'anthropic',
    model: 'claude-sonnet-4-5',
  },
]

function mountDialog(providers: ProviderOption[] = twoProviders) {
  return mount(ProviderSettingsDialog, {
    props: { providers, open: true },
    global: { stubs: { teleport: true } },
  })
}

/** 排除 radio/password/checkbox/hidden 后的文本类输入（spec 字段序：name → baseURL → model） */
function textFields(wrapper: VueWrapper): DOMWrapper<HTMLInputElement>[] {
  return wrapper.findAll('input').filter((el) => {
    const type = (el.attributes('type') ?? 'text').toLowerCase()
    return !['radio', 'password', 'checkbox', 'hidden'].includes(type)
  })
}

function apiKeyField(wrapper: VueWrapper) {
  return wrapper.find('input[type=password]')
}

async function pickProvider(
  wrapper: VueWrapper,
  value: 'openai-compat' | 'anthropic',
) {
  const radios = wrapper.findAll('input[type=radio]')
  const hit = radios.find((r) => r.attributes('value') === value)
  const target = hit ?? radios[radios.length - 1]
  await target.setValue(true)
}

async function submitForm(wrapper: VueWrapper) {
  await wrapper.find('form').trigger('submit')
}

/** 表单区域之外、位于表单之后的按钮 = 已注册列表区每项的删除按钮 */
function deleteButtons(wrapper: VueWrapper): DOMWrapper<HTMLButtonElement>[] {
  const form = wrapper.find('form').element
  return wrapper.findAll('button').filter((b) => {
    if (b.element.closest('form') !== null) return false
    const pos = b.element.compareDocumentPosition(form)
    return (pos & Node.DOCUMENT_POSITION_FOLLOWING) === 0
  })
}

describe('ProviderSettingsDialog 盲测（spec §2.1）', () => {
  it('open 时渲染已注册列表项的 name/provider/model 文本', () => {
    // Arrange
    const wrapper = mountDialog()
    // Act
    const text = wrapper.text()
    // Assert
    expect(text).toContain('DeepSeek 主力')
    expect(text).toContain('openai-compat')
    expect(text).toContain('deepseek-chat')
    expect(text).toContain('官方 Claude')
    expect(text).toContain('anthropic')
    expect(text).toContain('claude-sonnet-4-5')
  })

  it('填写 openai-compat 表单提交后 emit create，载荷逐字段等于手写字面量', async () => {
    // Arrange
    const wrapper = mountDialog()
    const fields = textFields(wrapper)
    // Act：name → baseURL → apiKey → model
    await fields[0].setValue('DeepSeek 盲测')
    await fields[1].setValue('https://api.deepseek.com/v1')
    await apiKeyField(wrapper).setValue('sk-blind-vue-key-001')
    await fields[2].setValue('deepseek-chat')
    await submitForm(wrapper)
    // Assert
    const createEvents = wrapper.emitted('create')
    expect(createEvents).toHaveLength(1)
    expect(createEvents![0]).toEqual([
      {
        name: 'DeepSeek 盲测',
        provider: 'openai-compat',
        baseURL: 'https://api.deepseek.com/v1',
        apiKey: 'sk-blind-vue-key-001',
        model: 'deepseek-chat',
        persist: true,
      },
    ])
  })

  it('provider 选 anthropic 且 baseURL 留空提交，载荷中 baseURL 键缺失', async () => {
    // Arrange
    const wrapper = mountDialog()
    // Act：切 anthropic 后重新定位字段；若 baseURL 输入仍渲染则显式清空
    await pickProvider(wrapper, 'anthropic')
    const fields = textFields(wrapper)
    await fields[0].setValue('官方盲测')
    if (fields.length >= 3) await fields[1].setValue('')
    await fields[fields.length - 1].setValue('claude-sonnet-4-5')
    await apiKeyField(wrapper).setValue('sk-blind-vue-key-002')
    await submitForm(wrapper)
    // Assert
    const createEvents = wrapper.emitted('create')
    expect(createEvents).toHaveLength(1)
    const payload = createEvents![0][0] as Record<string, unknown>
    expect('baseURL' in payload).toBe(false)
    expect(payload).toEqual({
      name: '官方盲测',
      provider: 'anthropic',
      apiKey: 'sk-blind-vue-key-002',
      model: 'claude-sonnet-4-5',
      persist: true,
    })
  })

  it('必填项为空时不 emit create（name/apiKey/model 空、openai-compat 时 baseURL 空）', async () => {
    // Arrange：fresh 挂载，所有字段保持空（baseURL 若被预设预填则清空）
    const wrapper = mountDialog([])
    // Act
    for (const field of textFields(wrapper)) {
      await field.setValue('')
    }
    await submitForm(wrapper)
    // Assert
    expect(wrapper.emitted('create')).toBeUndefined()
  })

  it('点击列表项删除按钮 emit remove，参数为该项 id 字面量', async () => {
    // Arrange
    const wrapper = mountDialog()
    const buttons = deleteButtons(wrapper)
    // spec：已注册列表区每项一个删除按钮 → 数量等于 providers 数
    expect(buttons).toHaveLength(twoProviders.length)
    // Act：列表首项（providers[0]，id 'custom-1'）的删除按钮
    await buttons[0].trigger('click')
    // Assert
    expect(wrapper.emitted('remove')).toEqual([['custom-1']])
  })
})
