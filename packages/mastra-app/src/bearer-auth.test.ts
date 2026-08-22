import { describe, expect, it } from 'vitest'
import { Hono } from 'hono'
import { bearerAuth } from './bearer-auth'

function makeApp(tokens: string[]) {
  const app = new Hono()
  app.use('/api/*', bearerAuth(tokens))
  app.get('/api/resource', (c) => c.json({ ok: true }))
  return app
}

describe('bearerAuth', () => {
  it('缺失 Authorization 头返回 401 与 Unauthorized 错误体', async () => {
    const res = await makeApp(['token-a']).request('/api/resource')
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: 'Unauthorized' })
  })

  it('错误 token 返回 401', async () => {
    const res = await makeApp(['token-a']).request('/api/resource', {
      headers: { authorization: 'Bearer wrong' },
    })
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: 'Unauthorized' })
  })

  it('非 Bearer 前缀的 Authorization 头同样 401', async () => {
    const res = await makeApp(['token-a']).request('/api/resource', {
      headers: { authorization: 'Basic dG9rZW4tYQ==' },
    })
    expect(res.status).toBe(401)
  })

  it('正确 token 放行到下游路由', async () => {
    const res = await makeApp(['token-a', 'token-b']).request('/api/resource', {
      headers: { authorization: 'Bearer token-b' },
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
  })
})
