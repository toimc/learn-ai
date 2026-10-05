import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import { setAiChatLocale } from '@toimc/vue'

/**
 * 引擎边界 mock：组件与搜索引擎是装配关系（引擎自身在 useSemanticSearch.test.ts
 * 里用注入 loader/storage 独立集成测试），这里只校验接线与渲染。
 */
const h = vi.hoisted(() => ({
  warmUp: vi.fn(async () => {}),
  search: vi.fn(async () => {}),
  state: null as null | Record<string, unknown>,
}))

vi.mock('../../../src/semantic/useSemanticSearch', async () => {
  const { ref } = await import('vue')
  return {
    createSemanticSearch: () => {
      h.state = {
        embedder: {
          status: ref('idle'),
          progress: ref(0),
          device: ref('wasm'),
          cached: ref<boolean | null>(null),
        },
        query: ref(''),
        searching: ref(false),
        indexing: ref(false),
        indexedCount: ref(0),
        semanticResults: ref<{ id: string; score: number }[]>([]),
        keywordResults: ref<{ id: string; score: number }[]>([]),
        degraded: ref(false),
        timing: ref<{ embedMs: number; scanMs: number } | null>(null),
        isIndexed: (id: string) => id === 'e1',
        warmUp: h.warmUp,
        search: h.search,
      }
      return h.state
    },
  }
})

import EdgeSearchDemo from '../../../src/components/demos/EdgeSearchDemo.vue'

// jsdom 的 navigator.language 为 en-US，断言中文文案前先钉回 zh-CN
beforeEach(() => {
  setAiChatLocale('zh-CN', { persist: false })
  h.warmUp.mockClear()
  h.search.mockClear()
})
afterEach(() => {
  h.state = null
})

type EngineState = {
  embedder: {
    status: { value: string }
    progress: { value: number }
    device: { value: string }
    cached: { value: boolean | null }
  }
  semanticResults: { value: { id: string; score: number }[] }
  keywordResults: { value: { id: string; score: number }[] }
  degraded: { value: boolean }
  indexing: { value: boolean }
  indexedCount: { value: number }
}

function engine(): EngineState {
  return h.state as unknown as EngineState
}

async function mountDemo() {
  const w = mount(EdgeSearchDemo)
  await flushPromises()
  return w
}

describe('EdgeSearchDemo', () => {
  it('渲染标题与初始状态（模型未加载）', async () => {
    const w = await mountDemo()
    expect(w.text()).toContain('浏览器端语义搜索')
    expect(w.text()).toContain('模型未加载')
  })

  it('懒加载：首次聚焦搜索框触发 warmUp，再次聚焦不重复触发', async () => {
    const w = await mountDemo()
    const input = w.get('input[type="text"]')
    await input.trigger('focus')
    expect(h.warmUp).toHaveBeenCalledTimes(1)
    await input.trigger('blur')
    await input.trigger('focus')
    expect(h.warmUp).toHaveBeenCalledTimes(1)
  })

  it('输入回车以查询词调用 search；空查询不触发', async () => {
    const w = await mountDemo()
    const input = w.get('input[type="text"]')
    await input.setValue('浏览器性能优化')
    await input.trigger('keydown.enter')
    expect(h.search).toHaveBeenCalledWith('浏览器性能优化')

    h.search.mockClear()
    await input.setValue('   ')
    await input.trigger('keydown.enter')
    expect(h.search).not.toHaveBeenCalled()
  })

  it('点击示例 chip 直接检索该示例', async () => {
    const w = await mountDemo()
    const chip = w.findAll('button').find((b) => b.text() === '浏览器性能优化')
    expect(chip).toBeDefined()
    await chip!.trigger('click')
    expect(h.search).toHaveBeenCalledWith('浏览器性能优化')
  })

  it('加载进度按百分比渲染（62%）', async () => {
    const w = await mountDemo()
    engine().embedder.status.value = 'loading'
    engine().embedder.progress.value = 62
    await nextTick()
    expect(w.text()).toContain('62%')
  })

  it('降级横幅：模型失败时提示关键字兜底', async () => {
    const w = await mountDemo()
    engine().embedder.status.value = 'error'
    engine().degraded.value = true
    await nextTick()
    expect(w.text()).toContain('降级')
    expect(w.text()).toContain('关键字')
  })

  it('双轨渲染：关键字轨与语义轨分别列出命中会话标题与得分', async () => {
    const w = await mountDemo()
    engine().embedder.status.value = 'ready'
    engine().keywordResults.value = [{ id: 'e5', score: 1 }]
    engine().semanticResults.value = [
      { id: 'e1', score: 0.87 },
      { id: 'e2', score: 0.4 },
    ]
    await nextTick()
    // e5 标题落在关键字轨，e1/e2 落在语义轨（标题字面来自组件 fixtures）
    expect(w.text()).toContain('Vite 构建优化')
    expect(w.text()).toContain('聊聊 AI 交互体验')
    expect(w.text()).toContain('0.87')
  })

  it('会话库列表标注向量化状态', async () => {
    const w = await mountDemo()
    expect(w.text()).toContain('会话库')
    // e1 已向量化、其余待向量化（isIndexed 只认 e1）
    const badges = w.findAll('[data-indexed]')
    expect(
      badges.filter((b) => b.attributes('data-indexed') === 'true'),
    ).toHaveLength(1)
  })

  it('模型就绪后显示设备与缓存状态 chip', async () => {
    const w = await mountDemo()
    engine().embedder.status.value = 'ready'
    engine().embedder.device.value = 'webgpu'
    engine().embedder.cached.value = true
    await nextTick()
    expect(w.text()).toContain('WebGPU')
    expect(w.text()).toContain('已缓存')
  })
})
