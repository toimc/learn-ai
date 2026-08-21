import { Hono } from 'hono'
import type { ModelRegistry } from '@toimc/agents'

/** GET / 模型列表路由：返回注册表公开视图 `{ models: ModelPublicInfo[] }`（脱敏） */
export function createModelsRoutes(registry: ModelRegistry): Hono {
  const app = new Hono()
  app.get('/', (c) => c.json({ models: registry.list() }))
  return app
}
