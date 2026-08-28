import { readFileSync, writeFileSync } from 'node:fs'
import { Hono } from 'hono'
import type { ModelRegistry } from '@toimc/agents'
import { createMastraModel } from '@toimc/agents/mastra'
import { createMemory } from '../memory'
import { getTimeTool } from '../tools/get-time'
import { getWeatherTool } from '../tools/get-weather'
import { normalizeEndpointUrl } from '../agents/model-config'

/** 运行时注册表单载荷（与 @toimc/vue 的 ProviderFormPayload 字段一致；服务端不依赖 vue 包，独立定义） */
export interface ProviderFormPayload {
  name: string
  provider: 'openai-compat' | 'anthropic'
  /** openai-compat 必填（路由校验）；anthropic 可选（官方端点） */
  baseURL?: string
  apiKey: string
  model: string
}

/** 运行时注册项的公开视图（绝不含 apiKey；baseURL 非密钥，编辑预填需要回传） */
export interface ProviderOption {
  id: string
  name: string
  provider: string
  model?: string
  baseURL?: string
}

/** 运行时注册计数：进程内存，重启归零 */
let runtimeProviderSeq = 0

/**
 * 运行时注册 Provider：把表单配置组装为带工具与会话记忆的 Mastra Agent 模型。
 * - openai-compat：model 为 { id, url, apiKey }（OpenAICompatibleConfig 形态）
 * - anthropic：model 为 'anthropic/{model}' 路由串，注册前把 key 注入 env（Mastra 官方路由从 env 取）
 * 注册不做上游连通性校验（惰性，首次对话才真连）。返回脱敏的公开视图。
 */
export async function registerRuntimeProvider(
  registry: ModelRegistry,
  payload: ProviderFormPayload,
  /** 指定 id（PUT 原位更新 / 落盘恢复沿用原 id）；缺省自增 */
  idOverride?: string,
): Promise<ProviderOption> {
  const id = idOverride ?? `custom-${++runtimeProviderSeq}`
  if (payload.provider === 'anthropic') {
    process.env.ANTHROPIC_API_KEY = payload.apiKey
  }
  const created = await createMastraModel({
    id,
    name: payload.name,
    description: `运行时注册的 ${payload.provider} 模型（${payload.model}），支持工具调用与会话记忆`,
    // Mastra 的 model id 必须是 'provider/model' 路由串：裸模型名在首次调用时
    // 解析失败（"doesn't appear to contain a provider"），统一补默认前缀，已带前缀的原样透传
    model:
      payload.provider === 'openai-compat'
        ? {
            id: payload.model.includes('/')
              ? payload.model
              : `openai/${payload.model}`,
            url: payload.baseURL
              ? normalizeEndpointUrl(payload.baseURL)
              : undefined,
            apiKey: payload.apiKey,
          }
        : payload.model.startsWith('anthropic/')
          ? payload.model
          : `anthropic/${payload.model}`,
    tools: { getTimeTool, getWeatherTool },
    memory: createMemory(),
  })
  registry.registerAdapter(id, created.adapter, created.info)
  return {
    id,
    name: payload.name,
    provider: payload.provider,
    model: payload.model,
    ...(payload.baseURL ? { baseURL: payload.baseURL } : {}),
  }
}

/** 校验失败文案（契约：与 providers.test.ts 的字面量断言一致） */
function validate(payload: Partial<ProviderFormPayload>): string | null {
  if (!payload.name?.trim()) return 'name is required'
  if (payload.provider !== 'openai-compat' && payload.provider !== 'anthropic')
    return 'provider must be openai-compat or anthropic'
  if (!payload.apiKey?.trim()) return 'apiKey is required'
  if (!payload.model?.trim()) return 'model is required'
  if (payload.provider === 'openai-compat' && !payload.baseURL?.trim())
    return 'baseURL is required for openai-compat'
  return null
}

/** 落盘条目：注册表单 + id（apiKey 随之落 .temp 本地文件，git 忽略，重启恢复用） */
interface PersistedProvider extends ProviderFormPayload {
  id: string
}

/**
 * 运行时 Provider 路由：浏览器设置表单提交 → 注册为带工具的 Mastra Agent 模型。
 * apiKey 只进服务端内存（组装配置 / env 注入），不进日志、不进任何 GET 响应；
 * 传入 persistPath 时（生产显式 opt-in，测试缺省隔离）注册表落盘 .temp，进程
 * 重启经 restore() 恢复且 id 沿用（开发期 watch 重启不再丢注册、前端选中不失效）。
 * store 挂在路由实例上，测试各建独立 app 互不污染。
 */
export function createProvidersRoutes(
  registry: ModelRegistry,
  options: { persistPath?: string } = {},
) {
  const store = new Map<string, ProviderOption>()
  const app = new Hono()

  function persist(): void {
    if (!options.persistPath) return
    const items: PersistedProvider[] = []
    for (const option of store.values()) {
      const saved = pendingForms.get(option.id)
      if (saved) items.push({ ...saved, id: option.id })
    }
    try {
      writeFileSync(options.persistPath, JSON.stringify(items), 'utf8')
    } catch {
      // 落盘失败不影响运行态（只丢重启恢复能力）
    }
  }

  /** id → 注册表单（含 apiKey/baseURL），落盘与 PUT/恢复对账的数据源 */
  const pendingForms = new Map<string, ProviderFormPayload>()

  async function register(
    payload: ProviderFormPayload,
    idOverride?: string,
  ): Promise<ProviderOption> {
    const option = await registerRuntimeProvider(registry, payload, idOverride)
    store.set(option.id, option)
    pendingForms.set(option.id, payload)
    return option
  }

  /**
   * 启动恢复：读落盘条目逐条重注册（id 沿用），自增序号抬到已恢复最大值
   * （避免新注册与恢复 id 相撞）；坏条目静默跳过。
   */
  async function restore(): Promise<void> {
    if (!options.persistPath) return
    let raw: string
    try {
      raw = readFileSync(options.persistPath, 'utf8')
    } catch {
      return
    }
    let items: PersistedProvider[]
    try {
      items = JSON.parse(raw)
    } catch {
      return
    }
    for (const item of Array.isArray(items) ? items : []) {
      // validate 返回 null 才是通过（返回错误串则条目损坏跳过）
      if (!item?.id || validate(item)) continue
      try {
        await register(item, item.id)
        const seq = Number(item.id.replace(/^custom-/, ''))
        if (Number.isFinite(seq)) {
          runtimeProviderSeq = Math.max(runtimeProviderSeq, seq)
        }
      } catch {
        // 单条损坏不阻断整体恢复
      }
    }
  }

  app.post('/', async (c) => {
    const payload = (await c.req
      .json<Partial<ProviderFormPayload>>()
      .catch(() => ({}))) as Partial<ProviderFormPayload>
    const error = validate(payload)
    if (error) return c.json({ error }, 400)
    // validate 已确保必填字段齐全，收窄到完整表单类型
    const option = await register(payload as ProviderFormPayload)
    persist()
    return c.json(option, 201)
  })

  app.put('/:id', async (c) => {
    const id = c.req.param('id')
    if (!store.has(id)) return c.json({ error: 'provider not found' }, 404)
    const payload = (await c.req
      .json<Partial<ProviderFormPayload>>()
      .catch(() => ({}))) as Partial<ProviderFormPayload>
    const error = validate(payload)
    if (error) return c.json({ error }, 400)
    registry.removeAdapter(id)
    const option = await register(payload as ProviderFormPayload, id)
    persist()
    return c.json(option)
  })

  app.get('/', (c) => {
    return c.json({ providers: [...store.values()] })
  })

  app.delete('/:id', (c) => {
    const id = c.req.param('id')
    if (!store.has(id)) return c.json({ error: 'provider not found' }, 404)
    registry.removeAdapter(id)
    store.delete(id)
    pendingForms.delete(id)
    persist()
    return c.json({ ok: true })
  })

  return { app, store, restore }
}

export type ProvidersService = ReturnType<typeof createProvidersRoutes>
