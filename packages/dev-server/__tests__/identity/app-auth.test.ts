import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import type { StreamChunk } from '@toimc/core'
import { readDevServerEnv } from '../../src/env'
import { createIdentityStore } from '../../src/identity/store'
import { createDevApp } from '../../src/app'

const DIR = mkdtempSync(join(tmpdir(), 'aichat-appauth-'))
const SECRET = 'app-auth-test-secret'

function userEnv(overrides: Record<string, string> = {}) {
  return readDevServerEnv({
    AUTH_MODE: 'user',
    AUTH_JWT_SECRET: SECRET,
    ...overrides,
  })
}

/** 每次组装独立库文件：用例间注册邮箱不互相撞车 */
let dbSeq = 0
async function makeApp(
  overrides: Record<string, string> = {},
  now?: () => Date,
) {
  const store = await createIdentityStore(
    `file:${join(DIR, `auth-${++dbSeq}.db`)}`,
  )
  const app = await createDevApp(userEnv(overrides), {
    identityStore: store,
    ...(now ? { now } : {}),
  })
  return { app, store }
}

/** 注册→签发 key→返回 {userId, accessToken, key}（应用层最短可用身份链） */
async function provision(
  app: Awaited<ReturnType<typeof createDevApp>>,
  email: string,
): Promise<{
  userId: string
  accessToken: string
  keyId: string
  key: string
}> {
  const reg = await app.request('/api/auth/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: 'password-123' }),
  })
  expect(reg.status).toBe(201)
  const { userId, accessToken } = (await reg.json()) as {
    userId: string
    accessToken: string
  }

  const keyRes = await app.request('/api/auth/keys', {
    method: 'POST',
    headers: { authorization: `Bearer ${accessToken}` },
  })
  expect(keyRes.status).toBe(201)
  const { keyId, key } = (await keyRes.json()) as { keyId: string; key: string }
  return { userId, accessToken, keyId, key }
}

function postChat(
  app: Awaited<ReturnType<typeof createDevApp>>,
  body: Record<string, unknown>,
  token?: string,
) {
  return app.request('/api/chat', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ speed: 0, ...body }),
  })
}

function parseChunks(bodyText: string): StreamChunk[] {
  return bodyText.split('\n\n').flatMap((frame) =>
    frame
      .split('\n')
      .filter((line) => line.startsWith('data:'))
      .map((line) => JSON.parse(line.slice(5).trim()) as StreamChunk),
  )
}

afterAll(() => {
  rmSync(DIR, { recursive: true, force: true })
})

describe('dev app 用户态：注册登录与 API Key', () => {
  it('注册返回 201 与 access token；重复邮箱 409；错误密码登录 401', async () => {
    const { app } = await makeApp()

    const reg = await app.request('/api/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: 'alice@test.dev',
        password: 'password-123',
      }),
    })
    expect(reg.status).toBe(201)
    const payload = (await reg.json()) as { userId: string; expiresIn: number }
    expect(payload.userId).toMatch(/^u_/)
    expect(payload.expiresIn).toBe(900)

    const dup = await app.request('/api/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: 'alice@test.dev',
        password: 'password-456',
      }),
    })
    expect(dup.status).toBe(409)

    const bad = await app.request('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'alice@test.dev', password: 'wrong-pass' }),
    })
    expect(bad.status).toBe(401)
    expect(await bad.json()).toEqual({ error: '邮箱或密码错误' })

    const ok = await app.request('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: 'alice@test.dev',
        password: 'password-123',
      }),
    })
    expect(ok.status).toBe(200)
  })

  it('无 token 访问 /api/chat 与 /api/models 均 401；/api/health 保持开放', async () => {
    const { app } = await makeApp()
    const chat = await postChat(app, {
      messages: [{ role: 'user', content: 'hi' }],
    })
    expect(chat.status).toBe(401)

    const models = await app.request('/api/models')
    expect(models.status).toBe(401)

    const health = await app.request('/api/health')
    expect(health.status).toBe(200)
  })

  it('撤销 key 后下一请求即 401（撤销全端点生效）', async () => {
    const { app } = await makeApp()
    const { accessToken, keyId, key } = await provision(app, 'revoke@test.dev')

    const ok = await postChat(
      app,
      { messages: [{ role: 'user', content: 'hi' }] },
      key,
    )
    expect(ok.status).toBe(200)
    await ok.text()

    const revoke = await app.request(`/api/auth/keys/${keyId}`, {
      method: 'DELETE',
      headers: { authorization: `Bearer ${accessToken}` },
    })
    expect(revoke.status).toBe(204)

    const denied = await postChat(
      app,
      { messages: [{ role: 'user', content: 'hi' }] },
      key,
    )
    expect(denied.status).toBe(401)
  })
})

describe('dev app 用户态：会话隔离（thread 归属）', () => {
  it('他人 conversationId 返回 403，本人复用正常', async () => {
    const { app } = await makeApp()
    const alice = await provision(app, 'alice@test.dev')
    const bob = await provision(app, 'bob@test.dev')

    const own = await postChat(
      app,
      {
        model: 'mock-pro',
        messages: [{ role: 'user', content: 'hi' }],
        conversationId: 'conv-shared',
      },
      alice.key,
    )
    expect(own.status).toBe(200)
    await own.text()

    const hijack = await postChat(
      app,
      {
        model: 'mock-pro',
        messages: [{ role: 'user', content: 'hi' }],
        conversationId: 'conv-shared',
      },
      bob.key,
    )
    expect(hijack.status).toBe(403)
    expect(await hijack.json()).toEqual({
      error: 'Forbidden thread',
      code: 'THREAD_FORBIDDEN',
    })
  })
})

describe('dev app 用户态：配额与用量记账', () => {
  it('free 配额 1：首条 200、第二条 402 QUOTA_EXCEEDED（含升级引导字段）', async () => {
    const { app } = await makeApp({ AUTH_DAILY_QUOTA_FREE: '1' })
    const { key } = await provision(app, 'quota@test.dev')
    const body = {
      model: 'mock-pro',
      messages: [{ role: 'user', content: 'hi' }],
    }

    const first = await postChat(app, body, key)
    expect(first.status).toBe(200)
    await first.text()

    const second = await postChat(app, body, key)
    expect(second.status).toBe(402)
    const json = (await second.json()) as {
      code: string
      quota: number
      upgradeUrl: string
    }
    expect(json.code).toBe('QUOTA_EXCEEDED')
    expect(json.quota).toBe(1)
    expect(json.upgradeUrl).toBe('/pricing')
    expect(second.headers.get('retry-after')).toMatch(/^\d+$/)
  })

  it('跨日重置：注入时钟推进到次日同一 key 恢复放行', async () => {
    let now = new Date('2026-06-15T12:00:00Z')
    const { app } = await makeApp({ AUTH_DAILY_QUOTA_FREE: '1' }, () => now)
    const { key } = await provision(app, 'reset@test.dev')
    const body = {
      model: 'mock-pro',
      messages: [{ role: 'user', content: 'hi' }],
    }

    expect((await postChat(app, body, key)).status).toBe(200)
    const drained = await postChat(app, body, key)
    expect(drained.status).toBe(402)
    await drained.text().catch(() => undefined)

    now = new Date('2026-06-16T00:30:00Z')
    const nextDay = await postChat(app, body, key)
    expect(nextDay.status).toBe(200)
    await nextDay.text()
  })

  it('对话完成记账到 userId：mock 真实 usage 落库（estimated=false，字段字面量）', async () => {
    const { app, store } = await makeApp()
    const { userId, key } = await provision(app, 'usage@test.dev')

    const res = await postChat(
      app,
      { model: 'mock-pro', messages: [{ role: 'user', content: 'hi' }] },
      key,
    )
    expect(res.status).toBe(200)
    const chunks = parseChunks(await res.text())
    expect(chunks[chunks.length - 1].type).toBe('done')

    const rows = await store.listUsage({ userId })
    expect(rows).toHaveLength(1)
    const row = rows[0]
    // mock 适配器在 done 帧回传 estimateTokens 口径的 usage：'hi' 为 2 个非 CJK 字符 → 1 token
    expect(row.model).toBe('mock-pro')
    expect(row.inputTokens).toBe(1)
    expect(row.estimated).toBe(false)
    expect(typeof row.outputTokens).toBe('number')
    expect(row.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('客户端伪造 userId 不影响记账归属（只认认证身份）', async () => {
    const { app, store } = await makeApp()
    const { userId, key } = await provision(app, 'real@test.dev')
    const victimRowsBefore = await store.listUsage({ userId: 'u_victim' })

    const res = await postChat(
      app,
      {
        model: 'mock-pro',
        messages: [{ role: 'user', content: 'hi' }],
        userId: 'u_victim',
      },
      key,
    )
    expect(res.status).toBe(200)
    await res.text()

    expect(await store.listUsage({ userId: 'u_victim' })).toHaveLength(
      victimRowsBefore.length,
    )
    expect(await store.listUsage({ userId })).toHaveLength(1)
  })
})
