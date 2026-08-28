/**
 * /api/providers 运行时注册路由盲测（双盲分工）
 *
 * 仅依据 docs/superpowers/spec/11-运行时Provider注册与真实模型会话-20260822.md §2.3、
 * register.ts 中 ProviderFormPayload/ProviderOption 类型声明、app.ts 组装签名编写，
 * 未读 routes/providers.ts 实现源码与既有测试。
 *
 * 组装方式与 app.ts 一致：createProvidersRoutes(registry) 子应用挂到网关 '/providers'，
 * 网关 basePath 默认 '/api'，故最终路径为 /api/providers、/api/models。
 * 每个用例独立建 registry + 网关，互不泄漏（custom-{n} 为模块级递增计数，断言用正则不写死）。
 */
import { describe, it, expect } from 'vitest'
import { createChatGateway } from '@toimc/server'
import { ModelRegistry } from '@toimc/agents'
import { createProvidersRoutes } from '../../src/routes/providers'

type TestApp = Awaited<ReturnType<typeof createTestApp>>

async function createTestApp() {
  const registry = new ModelRegistry()
  const providers = createProvidersRoutes(registry)
  const app = createChatGateway({ models: registry })
  app.route('/providers', providers.app)
  return app
}

function postProvider(app: TestApp, payload: unknown) {
  return app.request('/api/providers', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

/** 合法 openai-compat 载荷（baseURL/model 均取 spec §2.1 写明的示例字面量） */
const validOpenaiCompat = {
  name: 'DeepSeek 盲测',
  provider: 'openai-compat',
  baseURL: 'https://api.deepseek.com/v1',
  apiKey: 'sk-blind-server-key-001',
  model: 'deepseek-chat',
}

describe('POST /api/providers（spec §2.3 正常路径）', () => {
  it('合法 openai-compat 载荷 → 201，响应 name/provider/model 等于提交字面量且 id 形如 custom-{n}', async () => {
    // Arrange
    const app = await createTestApp()
    // Act
    const res = await postProvider(app, validOpenaiCompat)
    // Assert
    expect(res.status).toBe(201)
    const body = (await res.json()) as Record<string, unknown>
    expect(body.name).toBe('DeepSeek 盲测')
    expect(body.provider).toBe('openai-compat')
    expect(body.model).toBe('deepseek-chat')
    expect(String(body.id)).toMatch(/^custom-\d+$/)
  })

  it('注册成功后 GET /api/models 包含该 custom id', async () => {
    // Arrange
    const app = await createTestApp()
    const created = await postProvider(app, validOpenaiCompat)
    const createdBody = (await created.json()) as { id: string }
    // Act
    const res = await app.request('/api/models')
    // Assert
    expect(res.status).toBe(200)
    const json: unknown = await res.json()
    const list = Array.isArray(json)
      ? json
      : (json as { models?: unknown[] }).models
    expect(Array.isArray(list)).toBe(true)
    const ids = (list as Array<{ id?: string }>).map((m) => m?.id)
    expect(ids).toContain(createdBody.id)
  })
})

describe('边界（spec §2.3 密钥只存服务端内存 + DELETE 语义）', () => {
  it('GET /api/providers 响应 JSON 序列化全文不含 apiKey 子串，也不含已提交的密钥值', async () => {
    // Arrange：先注册一个带已知密钥的 provider
    const app = await createTestApp()
    await postProvider(app, {
      name: '密钥泄漏盲测',
      provider: 'openai-compat',
      baseURL: 'https://api.deepseek.com/v1',
      apiKey: 'sk-blind-server-secret-999',
      model: 'deepseek-chat',
    })
    // Act
    const res = await app.request('/api/providers')
    // Assert
    expect(res.status).toBe(200)
    const raw = JSON.stringify(await res.json())
    expect(raw.includes('apiKey')).toBe(false)
    expect(raw.includes('sk-blind-server-secret-999')).toBe(false)
  })

  it('DELETE 不存在的 custom-99999 → 404', async () => {
    // Arrange
    const app = await createTestApp()
    // Act
    const res = await app.request('/api/providers/custom-99999', {
      method: 'DELETE',
    })
    // Assert
    expect(res.status).toBe(404)
  })
})

describe('异常：校验失败 → 400 { error: string }（spec §2.3）', () => {
  it('缺 apiKey → 400，响应含非空 error 字符串', async () => {
    // Arrange
    const app = await createTestApp()
    const payload = {
      name: '缺密钥盲测',
      provider: 'openai-compat',
      baseURL: 'https://api.deepseek.com/v1',
      model: 'deepseek-chat',
    }
    // Act
    const res = await postProvider(app, payload)
    // Assert
    expect(res.status).toBe(400)
    const body = (await res.json()) as { error?: unknown }
    expect(typeof body.error).toBe('string')
    expect((body.error as string).length).toBeGreaterThan(0)
  })

  it('缺 model → 400，响应含非空 error 字符串', async () => {
    // Arrange
    const app = await createTestApp()
    const payload = {
      name: '缺模型盲测',
      provider: 'openai-compat',
      baseURL: 'https://api.deepseek.com/v1',
      apiKey: 'sk-blind-server-key-101',
    }
    // Act
    const res = await postProvider(app, payload)
    // Assert
    expect(res.status).toBe(400)
    const body = (await res.json()) as { error?: unknown }
    expect(typeof body.error).toBe('string')
    expect((body.error as string).length).toBeGreaterThan(0)
  })

  it('openai-compat 缺 baseURL → 400，响应含非空 error 字符串', async () => {
    // Arrange
    const app = await createTestApp()
    const payload = {
      name: '缺端点盲测',
      provider: 'openai-compat',
      apiKey: 'sk-blind-server-key-102',
      model: 'deepseek-chat',
    }
    // Act
    const res = await postProvider(app, payload)
    // Assert
    expect(res.status).toBe(400)
    const body = (await res.json()) as { error?: unknown }
    expect(typeof body.error).toBe('string')
    expect((body.error as string).length).toBeGreaterThan(0)
  })
})
