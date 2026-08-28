import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import ProviderSettingsDialog from '../../src/provider/ProviderSettingsDialog.vue'
import type {
  ProviderFormPayload,
  ProviderOption,
} from '../../src/provider/types'
import { setAiChatLocale } from '../../src/locales'

beforeEach(() => setAiChatLocale('zh-CN', { persist: false }))
afterEach(() => setAiChatLocale('zh-CN', { persist: false }))

const registered: ProviderOption[] = [
  {
    id: 'custom-1',
    name: 'My DeepSeek',
    provider: 'openai-compat',
    model: 'deepseek-chat',
  },
]

function mountDialog(
  props: { open?: boolean; providers?: ProviderOption[] } = {},
) {
  return mount(ProviderSettingsDialog, {
    props: {
      open: props.open ?? true,
      providers: props.providers ?? [],
    },
    global: { stubs: { teleport: true } },
  })
}

function fieldInput(w: ReturnType<typeof mountDialog>, field: string) {
  return w.get(`.ai-chat-provider-dialog__field--${field} input`)
}

async function fillField(
  w: ReturnType<typeof mountDialog>,
  field: string,
  value: string,
) {
  await fieldInput(w, field).setValue(value)
}

async function selectProviderType(
  w: ReturnType<typeof mountDialog>,
  value: 'openai-compat' | 'anthropic',
) {
  const radio = w.get(`input[value="${value}"]`)
  ;(radio.element as HTMLInputElement).checked = true
  await radio.trigger('change')
}

describe('ProviderSettingsDialog 渲染', () => {
  it('open=true 渲染弹层与已注册列表（name/provider/model）', () => {
    const w = mountDialog({ providers: registered })
    expect(w.find('.ai-chat-provider-dialog__overlay').exists()).toBe(true)
    const row = w.get('.ai-chat-provider-dialog__item')
    expect(row.text()).toContain('My DeepSeek')
    expect(row.text()).toContain('openai-compat')
    expect(row.text()).toContain('deepseek-chat')
  })

  it('open=false 不渲染弹层', () => {
    const w = mountDialog({ open: false })
    expect(w.find('.ai-chat-provider-dialog__overlay').exists()).toBe(false)
  })

  it('providers 空列表显示空态文案', () => {
    const w = mountDialog({ providers: [] })
    expect(w.text()).toContain('暂无已注册模型')
  })
})

describe('ProviderSettingsDialog 类型与预设', () => {
  it('默认选中 openai-compat，点击 DeepSeek 预设填入 baseURL', async () => {
    const w = mountDialog()
    const openaiRadio = w.get('input[value="openai-compat"]')
      .element as HTMLInputElement
    expect(openaiRadio.checked).toBe(true)

    await w.get('.ai-chat-provider-dialog__preset--deepseek').trigger('click')
    expect((fieldInput(w, 'baseURL').element as HTMLInputElement).value).toBe(
      'https://api.deepseek.com/v1',
    )
  })

  it('切换 anthropic 后 baseURL 清空且不再必填', async () => {
    const w = mountDialog()
    await w.get('.ai-chat-provider-dialog__preset--glm').trigger('click')
    await selectProviderType(w, 'anthropic')
    expect((fieldInput(w, 'baseURL').element as HTMLInputElement).value).toBe(
      '',
    )

    await fillField(w, 'name', 'My Claude')
    await fillField(w, 'apiKey', 'sk-ant-1')
    await fillField(w, 'model', 'claude-sonnet-4-5')
    await fieldInput(w, 'baseURL').trigger('blur')
    expect(w.find('.ai-chat-provider-dialog__error').exists()).toBe(false)
    expect(
      w.get('.ai-chat-provider-dialog__submit').attributes('disabled'),
    ).toBeUndefined()
  })
})

describe('ProviderSettingsDialog 表单提交', () => {
  it('填表提交 emit create，载荷逐字段断言', async () => {
    const w = mountDialog()
    await w.get('.ai-chat-provider-dialog__preset--deepseek').trigger('click')
    await fillField(w, 'name', 'My DeepSeek')
    await fillField(w, 'apiKey', 'sk-test-123')
    await fillField(w, 'model', 'deepseek-chat')
    await w.get('.ai-chat-provider-dialog__submit').trigger('click')

    expect(w.emitted('create')).toHaveLength(1)
    expect(w.emitted('create')![0][0]).toEqual({
      name: 'My DeepSeek',
      provider: 'openai-compat',
      baseURL: 'https://api.deepseek.com/v1',
      apiKey: 'sk-test-123',
      model: 'deepseek-chat',
      persist: true,
    })
  })

  it('默认勾选「记住配置」：载荷带 persist: true', async () => {
    const w = mountDialog()
    await w.get('.ai-chat-provider-dialog__preset--deepseek').trigger('click')
    await fillField(w, 'name', 'My DeepSeek')
    await fillField(w, 'apiKey', 'sk-test-123')
    await fillField(w, 'model', 'deepseek-chat')
    expect(
      (
        w.get('.ai-chat-provider-dialog__remember-input')
          .element as HTMLInputElement
      ).checked,
    ).toBe(true)
    await w.get('.ai-chat-provider-dialog__submit').trigger('click')

    expect((w.emitted('create')![0][0] as ProviderFormPayload).persist).toBe(
      true,
    )
  })

  it('取消「记住配置」后提交：载荷 persist: false（宿主不落 localStorage）', async () => {
    const w = mountDialog()
    await w.get('.ai-chat-provider-dialog__preset--deepseek').trigger('click')
    await fillField(w, 'name', 'My DeepSeek')
    await fillField(w, 'apiKey', 'sk-test-123')
    await fillField(w, 'model', 'deepseek-chat')
    await w.get('.ai-chat-provider-dialog__remember-input').setValue(false)
    await w.get('.ai-chat-provider-dialog__submit').trigger('click')

    expect((w.emitted('create')![0][0] as ProviderFormPayload).persist).toBe(
      false,
    )
  })

  it('anthropic 且 baseURL 留空时载荷不含 baseURL', async () => {
    const w = mountDialog()
    await selectProviderType(w, 'anthropic')
    await fillField(w, 'name', 'My Claude')
    await fillField(w, 'apiKey', 'sk-ant-1')
    await fillField(w, 'model', 'claude-sonnet-4-5')
    await w.get('.ai-chat-provider-dialog__submit').trigger('click')

    const payload = w.emitted('create')![0][0] as ProviderFormPayload
    expect(payload).toEqual({
      name: 'My Claude',
      provider: 'anthropic',
      apiKey: 'sk-ant-1',
      model: 'claude-sonnet-4-5',
      persist: true,
    })
    expect(payload.baseURL).toBeUndefined()
  })

  it('空表单提交被校验拦截：按钮禁用且无 create emit', async () => {
    const w = mountDialog()
    expect(
      w.get('.ai-chat-provider-dialog__submit').attributes('disabled'),
    ).toBeDefined()
    await w.get('.ai-chat-provider-dialog__submit').trigger('click')
    expect(w.emitted('create')).toBeUndefined()
  })

  it('name 纯空格视为未填（trim 校验）', async () => {
    const w = mountDialog()
    await fillField(w, 'name', '   ')
    await w.get('.ai-chat-provider-dialog__preset--kimi').trigger('click')
    await fillField(w, 'apiKey', 'sk-test-123')
    await fillField(w, 'model', 'kimi-k2')
    expect(
      w.get('.ai-chat-provider-dialog__submit').attributes('disabled'),
    ).toBeDefined()
  })
})

describe('ProviderSettingsDialog 校验错误文案', () => {
  it('blur 空 apiKey 显示行内错误文案', async () => {
    const w = mountDialog()
    await fieldInput(w, 'apiKey').trigger('blur')
    const field = w.get('.ai-chat-provider-dialog__field--apiKey')
    expect(field.find('.ai-chat-provider-dialog__error').exists()).toBe(true)
    expect(field.get('.ai-chat-provider-dialog__error').text()).toBe(
      '该项为必填项',
    )
  })

  it('openai-compat 缺 baseURL 显示错误，填入后消失', async () => {
    const w = mountDialog()
    await fillField(w, 'name', 'My DeepSeek')
    await fillField(w, 'apiKey', 'sk-test-123')
    await fillField(w, 'model', 'deepseek-chat')
    await fieldInput(w, 'baseURL').trigger('blur')
    const field = w.get('.ai-chat-provider-dialog__field--baseURL')
    expect(field.get('.ai-chat-provider-dialog__error').text()).toBe(
      '该项为必填项',
    )
    expect(
      w.get('.ai-chat-provider-dialog__submit').attributes('disabled'),
    ).toBeDefined()

    await fillField(w, 'baseURL', 'https://api.deepseek.com/v1')
    // 重新查询：错误 <p> 卸载会重建字段子树，复用旧 wrapper 会拿到陈旧 DOM
    expect(w.find('.ai-chat-provider-dialog__error').exists()).toBe(false)
    expect(
      w.get('.ai-chat-provider-dialog__submit').attributes('disabled'),
    ).toBeUndefined()
  })
})

describe('ProviderSettingsDialog 删除与关闭', () => {
  it('点击删除按钮 emit remove(id)', async () => {
    const w = mountDialog({ providers: registered })
    await w.get('.ai-chat-provider-dialog__remove').trigger('click')
    expect(w.emitted('remove')).toHaveLength(1)
    expect(w.emitted('remove')![0]).toEqual(['custom-1'])
  })

  it('点击关闭按钮 emit update:open false', async () => {
    const w = mountDialog()
    await w.get('.ai-chat-provider-dialog__close').trigger('click')
    expect(w.emitted('update:open')).toHaveLength(1)
    expect(w.emitted('update:open')![0]).toEqual([false])
  })

  it('Esc 键关闭弹层', async () => {
    const w = mountDialog()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await nextTick()
    expect(w.emitted('update:open')![0]).toEqual([false])
  })
})

describe('ProviderSettingsDialog i18n', () => {
  it('en-US 下标题与空态文案为英文', async () => {
    setAiChatLocale('en-US', { persist: false })
    const w = mountDialog()
    expect(w.get('.ai-chat-provider-dialog__title').text()).toBe(
      'Provider Settings',
    )
    expect(w.text()).toContain('No registered models yet')
  })
})

describe('ProviderSettingsDialog 编辑已注册 provider', () => {
  const editTarget = {
    id: 'custom-9',
    name: 'My DeepSeek',
    provider: 'openai-compat',
    model: 'deepseek-chat',
    baseURL: 'https://api.deepseek.com/v1',
  }

  it('列表项「编辑」进入编辑态：表单预填、apiKey 留空、按钮变保存修改', async () => {
    const w = mountDialog({ providers: [editTarget] })
    await w.get('.ai-chat-provider-dialog__edit').trigger('click')

    expect((fieldInput(w, 'name').element as HTMLInputElement).value).toBe(
      'My DeepSeek',
    )
    expect((fieldInput(w, 'apiKey').element as HTMLInputElement).value).toBe('')
    expect(w.get('.ai-chat-provider-dialog__submit').text()).toContain(
      '保存修改',
    )
    expect(w.find('.ai-chat-provider-dialog__cancel-edit').exists()).toBe(true)
  })

  it('编辑态填新 apiKey 提交：emit update 携带原 id 与完整载荷', async () => {
    const w = mountDialog({ providers: [editTarget] })
    await w.get('.ai-chat-provider-dialog__edit').trigger('click')
    await fillField(w, 'apiKey', 'sk-new-456')

    await w.get('.ai-chat-provider-dialog__submit').trigger('click')

    const events = w.emitted('update')
    expect(events).toHaveLength(1)
    const [id, payload] = events![0] as [string, ProviderFormPayload]
    expect(id).toBe('custom-9')
    expect(payload).toEqual({
      name: 'My DeepSeek',
      provider: 'openai-compat',
      baseURL: 'https://api.deepseek.com/v1',
      apiKey: 'sk-new-456',
      model: 'deepseek-chat',
      persist: true,
    })
  })

  it('取消编辑回到新增模式：表单清空且不再 emit update', async () => {
    const w = mountDialog({ providers: [editTarget] })
    await w.get('.ai-chat-provider-dialog__edit').trigger('click')
    await w.get('.ai-chat-provider-dialog__cancel-edit').trigger('click')

    expect((fieldInput(w, 'name').element as HTMLInputElement).value).toBe('')
    expect(w.get('.ai-chat-provider-dialog__submit').text()).not.toContain(
      '保存修改',
    )
    await fillField(w, 'name', 'X')
    await fillField(w, 'apiKey', 'sk-x')
    await fillField(w, 'model', 'm-x')
    await w.get('.ai-chat-provider-dialog__preset--deepseek').trigger('click')
    await w.get('.ai-chat-provider-dialog__submit').trigger('click')
    expect(w.emitted('update')).toBeUndefined()
    expect(w.emitted('create')).toHaveLength(1)
  })
})
