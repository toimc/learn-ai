import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { createIdentityStore } from '../../src/identity/store'
import { EmailTakenError } from '@toimc/server'
import { sha256 } from '@toimc/server'

/** 每文件独立临时目录：store 测试不污染包根 .temp 的真实库 */
const DIR = mkdtempSync(join(tmpdir(), 'aichat-identity-'))
const dbUrl = (name: string) => `file:${join(DIR, name)}`

afterAll(() => {
  rmSync(DIR, { recursive: true, force: true })
})

describe('identity store：users 与 API key', () => {
  it('createUser 落库可查，email 唯一（重复注册抛 EmailTakenError）', async () => {
    const store = await createIdentityStore(dbUrl('users.db'))
    const created = await store.createUser({
      email: 'alice@test.dev',
      passwordHash: 'scrypt:aa:bb',
    })
    expect(created.email).toBe('alice@test.dev')
    expect(created.plan).toBe('free')
    expect(created.id).toMatch(/^u_/)

    const byEmail = await store.findUserByEmail('alice@test.dev')
    expect(byEmail?.id).toBe(created.id)

    await expect(
      store.createUser({
        email: 'alice@test.dev',
        passwordHash: 'scrypt:aa:cc',
      }),
    ).rejects.toBeInstanceOf(EmailTakenError)
  })

  it('plan 可指定为 pro，findUserById 返回档案', async () => {
    const store = await createIdentityStore(dbUrl('plan.db'))
    const pro = await store.createUser({
      email: 'pro@test.dev',
      passwordHash: 'x',
      plan: 'pro',
    })
    const found = await store.findUserById(pro.id)
    expect(found?.plan).toBe('pro')
    expect(await store.findUserById('u_nope')).toBeNull()
  })

  it('findPasswordHash 按 userId 取哈希', async () => {
    const store = await createIdentityStore(dbUrl('hash.db'))
    const u = await store.createUser({
      email: 'pw@test.dev',
      passwordHash: 'scrypt:salt:hash',
    })
    expect(await store.findPasswordHash(u.id)).toBe('scrypt:salt:hash')
  })

  it('API key：入库→哈希命中返回 userId；撤销→同一 key 返回 null', async () => {
    const store = await createIdentityStore(dbUrl('keys.db'))
    const u = await store.createUser({
      email: 'key@test.dev',
      passwordHash: 'x',
    })
    const keyHash = sha256('sk-aichat-test-key-1')
    const record = await store.insertApiKey(u.id, keyHash, 'sk-aichat-tes')
    expect(record.status).toBe('active')

    expect(await store.findUserIdByActiveKeyHash(keyHash)).toBe(u.id)

    expect(await store.revokeApiKey(record.id, u.id)).toBe(true)
    expect(await store.findUserIdByActiveKeyHash(keyHash)).toBeNull()
    // 重复撤销返回 false；他人撤销别人的 key 也 false
    expect(await store.revokeApiKey(record.id, u.id)).toBe(false)
  })

  it('revokeApiKey 对不属于该用户的 key 返回 false（防横向越权撤销）', async () => {
    const store = await createIdentityStore(dbUrl('keys2.db'))
    const a = await store.createUser({ email: 'a@t.dev', passwordHash: 'x' })
    const b = await store.createUser({ email: 'b@t.dev', passwordHash: 'x' })
    const rec = await store.insertApiKey(a.id, sha256('sk-aichat-key-a'), 'p')
    expect(await store.revokeApiKey(rec.id, b.id)).toBe(false)
    expect(
      await store.findUserIdByActiveKeyHash(sha256('sk-aichat-key-a')),
    ).toBe(a.id)
  })
})

describe('identity store：thread 归属（IDOR 防线）', () => {
  it('首次使用登记归属；本人复用 true；他人冒用 false', async () => {
    const store = await createIdentityStore(dbUrl('threads.db'))
    expect(await store.claimThread('conv-1', 'alice')).toBe(true)
    expect(await store.claimThread('conv-1', 'alice')).toBe(true)
    expect(await store.claimThread('conv-1', 'bob')).toBe(false)
    expect(await store.claimThread('conv-2', 'bob')).toBe(true)
  })
})

describe('identity store：每日配额与用量记账', () => {
  it('incrDailyUsage 原子自增且按日键隔离（跨日翻页）', async () => {
    const store = await createIdentityStore(dbUrl('quota.db'))
    expect(await store.incrDailyUsage('u1', '2026-10-05')).toBe(1)
    expect(await store.incrDailyUsage('u1', '2026-10-05')).toBe(2)
    expect(await store.incrDailyUsage('u1', '2026-10-06')).toBe(1)
    expect(await store.incrDailyUsage('u2', '2026-10-05')).toBe(1)
  })

  it('配额计数持久化：同库文件重开后当日已用次数不清零', async () => {
    const url = dbUrl('persist.db')
    const first = await createIdentityStore(url)
    await first.incrDailyUsage('u1', '2026-10-05')
    await first.incrDailyUsage('u1', '2026-10-05')

    const reopened = await createIdentityStore(url)
    expect(await reopened.incrDailyUsage('u1', '2026-10-05')).toBe(3)
  })

  it('insertUsage/listUsage：字段按写入值原样回读（字面量断言）', async () => {
    const store = await createIdentityStore(dbUrl('usage.db'))
    await store.insertUsage({
      userId: 'u1',
      model: 'mock-pro',
      inputTokens: 12,
      outputTokens: 34,
      estimated: false,
      createdAt: '2026-10-05T08:00:00.000Z',
    })
    const rows = await store.listUsage({ userId: 'u1', day: '2026-10-05' })
    expect(rows).toHaveLength(1)
    expect(rows[0]).toEqual({
      id: 1,
      userId: 'u1',
      model: 'mock-pro',
      inputTokens: 12,
      outputTokens: 34,
      estimated: false,
      createdAt: '2026-10-05T08:00:00.000Z',
    })
  })

  it('listUsage 按用户与日期过滤，token 不可得时允许 null 落库', async () => {
    const store = await createIdentityStore(dbUrl('usage2.db'))
    await store.insertUsage({
      userId: 'u1',
      model: 'm',
      inputTokens: null,
      outputTokens: null,
      estimated: true,
      createdAt: '2026-10-05T09:00:00.000Z',
    })
    await store.insertUsage({
      userId: 'u2',
      model: 'm',
      inputTokens: 1,
      outputTokens: 1,
      estimated: false,
      createdAt: '2026-10-05T09:30:00.000Z',
    })
    expect(await store.listUsage({ userId: 'u1' })).toHaveLength(1)
    expect(await store.listUsage({ userId: 'u2' })).toHaveLength(1)
    expect(
      await store.listUsage({ userId: 'u1', day: '2026-10-06' }),
    ).toHaveLength(0)
  })
})
