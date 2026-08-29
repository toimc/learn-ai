import { existsSync, rmSync } from 'node:fs'
import { afterEach, describe, expect, it } from 'vitest'
import { MastraCompositeStore } from '@mastra/core/storage'
import type { StorageDomains } from '@mastra/core/storage'
import { LibSQLStore } from '@mastra/libsql'
import { Observability } from '@mastra/observability'
import { createCompositeStorage, ensureDbDir } from '../src/memory'
import { createObservability } from '../src/observability'

const TMP_DIR = '.tmp-observability-test'

afterEach(() => {
  rmSync(TMP_DIR, { recursive: true, force: true })
})

/**
 * 测试替身：LibSQL 的观测域实例。类型与 DuckDB 域同源（都继承 core 的
 * ObservabilityStorage），结构兼容 CompositeStorageOptions.observabilityDomain——
 * 单测注入它，避免加载 DuckDB 原生模块（darwin 二进制 + 文件锁）。
 */
function createLibSqlObservabilityDomain(): StorageDomains['observability'] {
  const url = `file:${TMP_DIR}/stub/observability.db`
  ensureDbDir(url)
  return new LibSQLStore({ id: 'test-observability-stub', url }).stores
    .observability
}

describe('createObservability', () => {
  it('返回 Observability 实例，configs.default 注册成功', () => {
    const observability = createObservability()
    expect(observability).toBeInstanceOf(Observability)
    expect(observability.hasInstance('default')).toBe(true)
  })
})

describe('createCompositeStorage', () => {
  it('返回 Promise（async 签名：DuckDB 观测域经 getStore 异步取出）', () => {
    expect(
      createCompositeStorage({
        observabilityDomain: createLibSqlObservabilityDomain(),
      }),
    ).toBeInstanceOf(Promise)
  })

  it('构造 MastraCompositeStore，default 库文件的父目录自动创建', async () => {
    const store = await createCompositeStorage({
      defaultDbUrl: `file:${TMP_DIR}/main/dev-server.db`,
      observabilityDomain: createLibSqlObservabilityDomain(),
    })
    expect(store).toBeInstanceOf(MastraCompositeStore)
    expect(existsSync(`${TMP_DIR}/main`)).toBe(true)
  })

  it('域路由：observability 域是注入实例的同一引用，memory 仍走 default 域', async () => {
    const observabilityDomain = createLibSqlObservabilityDomain()
    const store = await createCompositeStorage({
      defaultDbUrl: `file:${TMP_DIR}/main/dev-server.db`,
      observabilityDomain,
    })
    await expect(store.getStore('observability')).resolves.toBe(
      observabilityDomain,
    )
    await expect(store.getStore('memory')).resolves.toBeDefined()
  })
})
