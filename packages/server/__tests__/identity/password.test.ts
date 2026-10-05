import { describe, expect, it } from 'vitest'
import { hashPassword, verifyPassword } from '../../src/identity/password'

describe('hashPassword / verifyPassword（scrypt）', () => {
  it('哈希格式为 scrypt:<32位hex盐>:<128位hex派生键>，不包含明文', async () => {
    const stored = await hashPassword('correct horse battery staple')
    const parts = stored.split(':')
    expect(parts).toHaveLength(3)
    expect(parts[0]).toBe('scrypt')
    expect(parts[1]).toMatch(/^[0-9a-f]{32}$/)
    expect(parts[2]).toMatch(/^[0-9a-f]{128}$/)
    expect(stored.includes('correct')).toBe(false)
  })

  it('同一密码两次哈希盐不同（存储值不同），但都能通过校验', async () => {
    const a = await hashPassword('s3cret-pw')
    const b = await hashPassword('s3cret-pw')
    expect(a).not.toBe(b)
    expect(await verifyPassword('s3cret-pw', a)).toBe(true)
    expect(await verifyPassword('s3cret-pw', b)).toBe(true)
    expect(await verifyPassword('s3cret-pw!', a)).toBe(false)
  })

  it('错误密码返回 false，不抛异常', async () => {
    const stored = await hashPassword('right-password')
    expect(await verifyPassword('wrong-password', stored)).toBe(false)
    expect(await verifyPassword('', stored)).toBe(false)
  })

  it('存储值被篡改/格式非法时返回 false 而非抛错', async () => {
    expect(await verifyPassword('x', '')).toBe(false)
    expect(await verifyPassword('x', 'bcrypt:aa:bb')).toBe(false)
    expect(await verifyPassword('x', 'scrypt:zz:not-hex')).toBe(false)
    expect(await verifyPassword('x', 'scrypt::deadbeef')).toBe(false)
  })
})
