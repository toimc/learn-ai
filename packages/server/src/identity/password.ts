import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from 'node:crypto'
import { promisify } from 'node:util'

const scrypt = promisify(scryptCallback) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>

const SALT_BYTES = 16
const KEY_LENGTH = 64

/**
 * 密码慢哈希（node:crypto scrypt，标准库零原生依赖；笔记写 argon2/bcrypt，
 * 本实现以「免原生编译依赖」为由取 scrypt——同属抗 GPU 暴破的慢哈希族）。
 * 存储格式：`scrypt:<salt-hex>:<derived-hex>`
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES)
  const derived = await scrypt(password, salt, KEY_LENGTH)
  return `scrypt:${salt.toString('hex')}:${derived.toString('hex')}`
}

/** 校验：常数时间比较；存储值格式非法（被篡改/旧格式）一律 false，不抛错 */
export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const parts = stored.split(':')
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false
  const salt = Buffer.from(parts[1] ?? '', 'hex')
  const expected = Buffer.from(parts[2] ?? '', 'hex')
  if (salt.length === 0 || expected.length === 0) return false
  const actual = await scrypt(password, salt, expected.length)
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}
