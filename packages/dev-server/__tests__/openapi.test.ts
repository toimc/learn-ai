import { describe, expect, it } from 'vitest'
import { openApiSpec } from '../src/openapi'

/**
 * openapi.ts 与真实路由的对账测试：预期值全部为手写字面量
 * （来源：app.ts 装配 + server 包 identity/workflows/providers 路由源码），
 * 与实现同源同错即失效——改动路由时本文件必须同步红灯。
 */
type Json = Record<string, unknown>

const spec = openApiSpec as unknown as Json
const paths = spec.paths as Record<string, Json>

/** $ref 解析：按规范消费者（Scalar 等）的视角跳转到 components/schemas（限深 10 防循环） */
function resolve(node: unknown, depth = 0): unknown {
  if (depth > 10) return node
  if (node && typeof node === 'object' && '$ref' in (node as Json)) {
    const ref = (node as Json).$ref as string
    if (!ref.startsWith('#/')) return node
    const target = ref
      .slice(2)
      .split('/')
      .reduce<unknown>((cur, key) => {
        if (cur && typeof cur === 'object') return (cur as Json)[key]
        return undefined
      }, spec)
    return resolve(target, depth + 1)
  }
  return node
}

/** 从任意子节点按点路径取值；$ref 一律对根 spec 解析 */
function get(node: Json, path: string): Json | undefined {
  const result = path.split('.').reduce<unknown>((cur, key) => {
    const resolved = resolve(cur)
    if (resolved && typeof resolved === 'object') {
      return (resolved as Json)[key]
    }
    return undefined
  }, node)
  return resolve(result) as Json | undefined
}

describe('路径清单对账（文档是路由的镜子）', () => {
  it('identity 认证四端点在列', () => {
    expect(Object.keys(paths)).toContain('/api/auth/register')
    expect(Object.keys(paths)).toContain('/api/auth/login')
    expect(Object.keys(paths)).toContain('/api/auth/keys')
    expect(Object.keys(paths)).toContain('/api/auth/keys/{keyId}')
  })

  it('workflow 两端点在列', () => {
    expect(Object.keys(paths)).toContain('/api/workflows')
    expect(Object.keys(paths)).toContain('/api/workflows/{id}/run')
  })

  it('向量检索三端点挂在 /api 前缀下（网关 basePath 覆盖子挂载）', () => {
    expect(Object.keys(paths)).toContain('/api/vector/stats')
    expect(Object.keys(paths)).toContain('/api/vector/search')
    expect(Object.keys(paths)).toContain('/api/vector/chunks')
  })

  it('裸 /vector/* 旧路径已修正（实测 404 的幽灵路径不留）', () => {
    expect(Object.keys(paths)).not.toContain('/vector/stats')
    expect(Object.keys(paths)).not.toContain('/vector/search')
    expect(Object.keys(paths)).not.toContain('/vector/chunks')
  })

  it('providers 支持 PUT 原位更新', () => {
    const provider = paths['/api/providers/{id}'] as Json
    expect(Object.keys(provider)).toContain('put')
  })
})

describe('POST /api/auth/register', () => {
  const op = get(paths['/api/auth/register'] as Json, 'post') as Json
  const bodySchema = get(
    get(op, 'requestBody.content.application/json.schema') as Json,
    'properties',
  ) as Json

  it('请求体字段：email + password', () => {
    expect(Object.keys(bodySchema)).toContain('email')
    expect(Object.keys(bodySchema)).toContain('password')
  })

  it('201 响应含 accessToken 四字段（新号即登录态）', () => {
    const schema = get(
      op,
      'responses.201.content.application/json.schema',
    ) as Json
    const props = schema.properties as Json
    expect(Object.keys(props)).toContain('userId')
    expect(Object.keys(props)).toContain('email')
    expect(Object.keys(props)).toContain('accessToken')
    expect(Object.keys(props)).toContain('expiresIn')
  })

  it('错误码齐备：400 格式 / 409 邮箱占用 / 429 注册限流', () => {
    const responses = op.responses as Json
    expect(Object.keys(responses)).toContain('400')
    expect(Object.keys(responses)).toContain('409')
    expect(Object.keys(responses)).toContain('429')
  })
})

describe('POST /api/auth/login', () => {
  const op = get(paths['/api/auth/login'] as Json, 'post') as Json

  it('200 与 401（邮箱或密码错误，不泄漏哪个字段错）', () => {
    const responses = op.responses as Json
    expect(Object.keys(responses)).toContain('200')
    expect(Object.keys(responses)).toContain('401')
  })
})

describe('API Key 签发与撤销', () => {
  it('POST /api/auth/keys 201 返回明文 key 只此一次', () => {
    const op = get(paths['/api/auth/keys'] as Json, 'post') as Json
    const schema = get(
      op,
      'responses.201.content.application/json.schema',
    ) as Json
    const props = schema.properties as Json
    expect(Object.keys(props)).toContain('keyId')
    expect(Object.keys(props)).toContain('key')
    expect(Object.keys(props)).toContain('keyPrefix')
  })

  it('签发走 JWT Bearer（API Key 不能繁殖 key）', () => {
    const op = get(paths['/api/auth/keys'] as Json, 'post') as Json
    const security = op.security as Json[]
    expect(security?.[0]).toEqual({ bearerAuth: [] })
  })

  it('DELETE /api/auth/keys/{keyId} 204 / 404', () => {
    const op = get(paths['/api/auth/keys/{keyId}'] as Json, 'delete') as Json
    const responses = op.responses as Json
    expect(Object.keys(responses)).toContain('204')
    expect(Object.keys(responses)).toContain('404')
  })
})

describe('POST /api/chat 治理响应', () => {
  const op = get(paths['/api/chat'] as Json, 'post') as Json

  it('402 配额响应：QUOTA_EXCEEDED + upgradeUrl + retry-after', () => {
    const resp402 = get(op, 'responses.402') as Json
    expect(resp402).toBeDefined()
    const example = get(resp402, 'content.application/json.example') as Json
    expect(example.code).toBe('QUOTA_EXCEEDED')
    expect(example.upgradeUrl).toBe('/pricing')
    const headers = resp402.headers as Json
    expect(Object.keys(headers)).toContain('retry-after')
  })

  it('403 thread 归属响应：THREAD_FORBIDDEN', () => {
    const example = get(
      op,
      'responses.403.content.application/json.example',
    ) as Json
    expect(example.code).toBe('THREAD_FORBIDDEN')
  })

  it('401 未认证响应在列（static 配 token / identity 模式）', () => {
    const responses = op.responses as Json
    expect(Object.keys(responses)).toContain('401')
  })

  it('SSE 示例 done 帧携带 metadata.usage（mock/mastra 均回传）', () => {
    const example = get(
      op,
      'responses.200.content.text/event-stream.example',
    ) as string
    expect(example).toContain('"usage"')
    expect(example).toContain('"inputTokens"')
    expect(example).toContain('"outputTokens"')
  })
})

describe('StreamChunk schema', () => {
  it('metadata 补 usage 字段（inputTokens / outputTokens）', () => {
    const usage = get(
      get(
        spec,
        'components.schemas.StreamChunk.properties.metadata.properties',
      ) as Json,
      'usage',
    ) as Json
    const props = usage.properties as Json
    expect(Object.keys(props)).toContain('inputTokens')
    expect(Object.keys(props)).toContain('outputTokens')
  })
})

describe('workflow 端点', () => {
  it('GET /api/workflows 列表（纯 mock 模式空数组）', () => {
    const op = get(paths['/api/workflows'] as Json, 'get') as Json
    const responses = op.responses as Json
    expect(Object.keys(responses)).toContain('200')
  })

  it('POST /api/workflows/{id}/run 与 /api/chat 同线协议（SSE）', () => {
    const op = get(paths['/api/workflows/{id}/run'] as Json, 'post') as Json
    const content = get(op, 'responses.200.content') as Json
    expect(Object.keys(content)).toContain('text/event-stream')
    const responses = op.responses as Json
    expect(Object.keys(responses)).toContain('400')
    expect(Object.keys(responses)).toContain('404')
  })
})

describe('info.description（introduction 锚点）', () => {
  const description = get(spec, 'info.description') as string

  it('说明双模式：mock 剧本与 MASTRA_MODEL 真实 agent', () => {
    expect(description).toContain('MASTRA_MODEL')
    expect(description).toContain('剧本')
  })

  it('说明 identity 模式：AUTH_MODE=static|user 行为差异', () => {
    expect(description).toContain('AUTH_MODE')
    expect(description).toContain('static')
    expect(description).toContain('user')
  })

  it('说明向量检索端点群与 SSE 线协议', () => {
    expect(description).toContain('/api/vector')
    expect(description).toContain('StreamChunk')
  })
})

describe('ProviderOption schema 对齐（baseURL 回传供编辑预填）', () => {
  it('公开视图含 baseURL、不含 apiKey', () => {
    const props = get(
      spec,
      'components.schemas.ProviderOption.properties',
    ) as Json
    expect(Object.keys(props)).toContain('baseURL')
    expect(Object.keys(props)).not.toContain('apiKey')
  })
})
