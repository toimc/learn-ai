import { randomUUID } from 'node:crypto'
import { createClient } from '@libsql/client'
import type { Client } from '@libsql/client'
import {
  EmailTakenError,
  type IdentityStore,
  type UsageRecord,
  type UserRecord,
} from '@toimc/server'
import { ensureDbDir, tempDbUrl } from '../paths'

/** 用户体系库缺省落盘位置：包根 .temp/auth.db（与记忆库同锚定模式，git 忽略） */
const AUTH_DB_URL = tempDbUrl('auth.db')

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  plan TEXT NOT NULL DEFAULT 'free',
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  key_prefix TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS thread_owners (
  thread_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS daily_usage (
  user_id TEXT NOT NULL,
  day TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day)
);
CREATE TABLE IF NOT EXISTS usage_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  model TEXT NOT NULL,
  input_tokens INTEGER,
  output_tokens INTEGER,
  estimated INTEGER NOT NULL DEFAULT 0,
  cost_usd REAL,
  created_at TEXT NOT NULL
);
`

function toUser(row: Record<string, unknown>): UserRecord {
  return {
    id: String(row.id),
    email: String(row.email),
    plan: row.plan === 'pro' ? 'pro' : 'free',
    createdAt: String(row.created_at),
  }
}

/**
 * LibSQL 实现 IdentityStore 端口（19-01/19-02 表结构）：
 * users / api_keys / thread_owners / daily_usage / usage_log 五表一库，
 * 与记忆库分文件——身份与记账数据独立于会话数据，注销/审计互不牵连。
 */
export async function createIdentityStore(
  dbUrl: string = AUTH_DB_URL,
): Promise<IdentityStore> {
  ensureDbDir(dbUrl)
  const db: Client = createClient({ url: dbUrl })
  await db.executeMultiple(SCHEMA)

  return {
    async createUser({ email, passwordHash, plan = 'free' }) {
      const user = {
        id: `u_${randomUUID()}`,
        email,
        passwordHash,
        plan,
        createdAt: new Date().toISOString(),
      }
      try {
        await db.execute({
          sql: 'INSERT INTO users (id, email, password_hash, plan, created_at) VALUES (?, ?, ?, ?, ?)',
          args: [
            user.id,
            user.email,
            user.passwordHash,
            user.plan,
            user.createdAt,
          ],
        })
      } catch (err) {
        if (err instanceof Error && /UNIQUE constraint/i.test(err.message)) {
          throw new EmailTakenError(email)
        }
        throw err
      }
      return {
        id: user.id,
        email: user.email,
        plan: user.plan,
        createdAt: user.createdAt,
      }
    },

    async findUserByEmail(email) {
      const rs = await db.execute({
        sql: 'SELECT id, email, plan, created_at FROM users WHERE email = ? LIMIT 1',
        args: [email],
      })
      const row = rs.rows[0]
      return row ? toUser(row as Record<string, unknown>) : null
    },

    async findUserById(id) {
      const rs = await db.execute({
        sql: 'SELECT id, email, plan, created_at FROM users WHERE id = ? LIMIT 1',
        args: [id],
      })
      const row = rs.rows[0]
      return row ? toUser(row as Record<string, unknown>) : null
    },

    async findPasswordHash(userId) {
      const rs = await db.execute({
        sql: 'SELECT password_hash FROM users WHERE id = ? LIMIT 1',
        args: [userId],
      })
      const row = rs.rows[0]
      return row ? String(row.password_hash) : null
    },

    async insertApiKey(userId, keyHash, keyPrefix) {
      const record = {
        id: `k_${randomUUID()}`,
        createdAt: new Date().toISOString(),
      }
      await db.execute({
        sql: 'INSERT INTO api_keys (id, user_id, key_hash, key_prefix, status, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        args: [
          record.id,
          userId,
          keyHash,
          keyPrefix,
          'active',
          record.createdAt,
        ],
      })
      return {
        id: record.id,
        userId,
        keyPrefix,
        status: 'active' as const,
        createdAt: record.createdAt,
      }
    },

    async findUserIdByActiveKeyHash(keyHash) {
      const rs = await db.execute({
        sql: 'SELECT user_id FROM api_keys WHERE key_hash = ? AND status = ? LIMIT 1',
        args: [keyHash, 'active'],
      })
      const row = rs.rows[0]
      return row ? String(row.user_id) : null
    },

    async revokeApiKey(keyId, userId) {
      const rs = await db.execute({
        sql: 'UPDATE api_keys SET status = ? WHERE id = ? AND user_id = ? AND status = ?',
        args: ['revoked', keyId, userId, 'active'],
      })
      return rs.rowsAffected === 1
    },

    async claimThread(threadId, userId) {
      // 单语句原子登记：冲突时保持原归属并回读——返回值即当前属主
      const rs = await db.execute({
        sql: `INSERT INTO thread_owners (thread_id, user_id, created_at) VALUES (?, ?, ?)
              ON CONFLICT(thread_id) DO UPDATE SET user_id = user_id
              RETURNING user_id`,
        args: [threadId, userId, new Date().toISOString()],
      })
      return String(rs.rows[0]?.user_id) === userId
    },

    async incrDailyUsage(userId, day) {
      const rs = await db.execute({
        sql: `INSERT INTO daily_usage (user_id, day, count) VALUES (?, ?, 1)
              ON CONFLICT(user_id, day) DO UPDATE SET count = count + 1
              RETURNING count`,
        args: [userId, day],
      })
      return Number(rs.rows[0]?.count ?? 0)
    },

    async insertUsage(record) {
      await db.execute({
        sql: `INSERT INTO usage_log (user_id, model, input_tokens, output_tokens, estimated, cost_usd, created_at)
              VALUES (?, ?, ?, ?, ?, NULL, ?)`,
        args: [
          record.userId,
          record.model,
          record.inputTokens,
          record.outputTokens,
          record.estimated ? 1 : 0,
          record.createdAt,
        ],
      })
    },

    async listUsage(input) {
      const rs = input.day
        ? await db.execute({
            sql: 'SELECT id, user_id, model, input_tokens, output_tokens, estimated, created_at FROM usage_log WHERE user_id = ? AND substr(created_at, 1, 10) = ? ORDER BY id',
            args: [input.userId, input.day],
          })
        : await db.execute({
            sql: 'SELECT id, user_id, model, input_tokens, output_tokens, estimated, created_at FROM usage_log WHERE user_id = ? ORDER BY id',
            args: [input.userId],
          })
      return rs.rows.map((row) => {
        const r = row as Record<string, unknown>
        const record: UsageRecord = {
          id: Number(r.id),
          userId: String(r.user_id),
          model: String(r.model),
          inputTokens: r.input_tokens == null ? null : Number(r.input_tokens),
          outputTokens:
            r.output_tokens == null ? null : Number(r.output_tokens),
          estimated: Number(r.estimated) === 1,
          createdAt: String(r.created_at),
        }
        return record
      })
    },
  }
}
