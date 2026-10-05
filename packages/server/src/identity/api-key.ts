import { createHash, randomBytes } from 'node:crypto'
import type { IdentityStore } from './types'

export const API_KEY_PREFIX = 'sk-aichat-'
/** 后台展示前缀长度（sk-aichat-ab12…） */
const PREFIX_LENGTH = 16

export function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex')
}

/** 签发：明文只显示一次，库里只存哈希与展示前缀 */
export function issueApiKey(): {
  key: string
  keyHash: string
  keyPrefix: string
} {
  const key = `${API_KEY_PREFIX}${randomBytes(24).toString('base64url')}`
  return {
    key,
    keyHash: sha256(key),
    keyPrefix: key.slice(0, PREFIX_LENGTH),
  }
}

/** 校验：哈希后查库，命中且 status=active 才放行（撤销下一秒全端点生效） */
export async function verifyApiKey(
  key: string,
  store: Pick<IdentityStore, 'findUserIdByActiveKeyHash'>,
): Promise<string | null> {
  return store.findUserIdByActiveKeyHash(sha256(key))
}
