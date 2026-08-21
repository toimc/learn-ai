import { Hono } from 'hono'

/** GET / 探活路由：`{ status: 'ok' }` */
export function createHealthRoutes(): Hono {
  const app = new Hono()
  app.get('/', (c) => c.json({ status: 'ok' }))
  return app
}
