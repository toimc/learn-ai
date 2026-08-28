import { serve } from '@hono/node-server'
import { createDevApp } from './app'
import { readDevServerEnv } from './env'

const env = readDevServerEnv()

const app = await createDevApp(env)
const server = serve({ fetch: app.fetch, port: env.port }, (info) => {
  console.log(`[dev-server] listening on http://localhost:${info.port}`)
  console.log(
    `[dev-server] SSE 端点: POST http://localhost:${info.port}/api/chat`,
  )
})

function shutdown() {
  server.close(() => process.exit(0))
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
