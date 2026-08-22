import { Hono } from 'hono'
import type { ModelRegistry } from '@toimc/agents'
import {
  registerRuntimeProvider,
  type ProviderFormPayload,
  type ProviderOption,
} from '../mastra/register'

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

/**
 * 运行时 Provider 路由：浏览器设置表单提交 → 注册为带工具的 Mastra Agent 模型。
 * apiKey 只进服务端内存（组装配置 / env 注入），不落盘、不进日志、不进任何 GET 响应；
 * store 挂在路由实例上，测试各建独立 app 互不污染。
 */
export function createProvidersRoutes(registry: ModelRegistry) {
  const store = new Map<string, ProviderOption>()
  const app = new Hono()

  app.post('/', async (c) => {
    const payload = (await c.req
      .json<Partial<ProviderFormPayload>>()
      .catch(() => ({}))) as Partial<ProviderFormPayload>
    const error = validate(payload)
    if (error) return c.json({ error }, 400)
    // validate 已确保必填字段齐全，收窄到完整表单类型
    const option = await registerRuntimeProvider(
      registry,
      payload as ProviderFormPayload,
    )
    store.set(option.id, option)
    return c.json(option, 201)
  })

  app.get('/', (c) => {
    return c.json({ providers: [...store.values()] })
  })

  app.delete('/:id', (c) => {
    const id = c.req.param('id')
    if (!store.has(id)) return c.json({ error: 'provider not found' }, 404)
    registry.removeAdapter(id)
    store.delete(id)
    return c.json({ ok: true })
  })

  return { app, store }
}

export type ProvidersService = ReturnType<typeof createProvidersRoutes>
