import { describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import { issueApiKey, sha256 } from '../../src/identity/api-key'
import { verifyApiKey } from '../../src/identity/api-key'
import type { IdentityStore } from '../../src/identity/types'

describe('sha256', () => {
  it('NIST 标准向量：sha256("abc") 为已知十六进制字面量', () => {
    // 预期值来源：FIPS 180-2 测试向量（独立第三方），非实现回放
    expect(sha256('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    )
  })

  it('空串同样命中公开常量', () => {
    expect(sha256('')).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    )
  })
})

describe('issueApiKey', () => {
  it('明文 key 以 sk-aichat- 开头，keyPrefix 为前 16 个字符', () => {
    const issued = issueApiKey()
    expect(issued.key.startsWith('sk-aichat-')).toBe(true)
    expect(issued.key.length).toBeGreaterThan(16)
    expect(issued.keyPrefix).toBe(issued.key.slice(0, 16))
    // 后缀是 base64url 随机段（无 + / 等非 URL 安全字符）
    expect(issued.key.slice(10)).toMatch(/^[A-Za-z0-9_-]+$/)
  })

  it('keyHash 是 64 位十六进制，且等于对明文再哈希一次（sha256 已被 NIST 向量独立校验）', () => {
    const issued = issueApiKey()
    expect(issued.keyHash).toMatch(/^[0-9a-f]{64}$/)
    expect(issued.keyHash).toBe(
      createHash('sha256').update(issued.key).digest('hex'),
    )
  })

  it('两次签发互不相同', () => {
    expect(issueApiKey().key).not.toBe(issueApiKey().key)
  })
})

describe('verifyApiKey', () => {
  /** 只实现 findUserIdByActiveKeyHash 的最小替身（其余方法本用例不可达） */
  function makeStore(
    hashToUser: Record<string, { userId: string; status: string }>,
  ): Pick<IdentityStore, 'findUserIdByActiveKeyHash'> {
    return {
      async findUserIdByActiveKeyHash(keyHash: string) {
        const hit = hashToUser[keyHash]
        if (!hit || hit.status !== 'active') return null
        return hit.userId
      },
    }
  }

  it('命中 active key 返回 userId', async () => {
    const issued = issueApiKey()
    const store = makeStore({
      [issued.keyHash]: { userId: 'u1', status: 'active' },
    })
    expect(await verifyApiKey(issued.key, store)).toBe('u1')
  })

  it('revoked key 返回 null（撤销下一秒生效）', async () => {
    const issued = issueApiKey()
    const store = makeStore({
      [issued.keyHash]: { userId: 'u1', status: 'revoked' },
    })
    expect(await verifyApiKey(issued.key, store)).toBeNull()
  })

  it('未知 key 返回 null', async () => {
    expect(await verifyApiKey('sk-aichat-unknown', makeStore({}))).toBeNull()
  })
})
