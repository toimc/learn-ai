import { serve } from '@hono/node-server'
import { createMockApp } from './app'

const port = Number(process.env.MOCK_SERVER_PORT ?? 8787)

const app = await createMockApp()
const server = serve({ fetch: app.fetch, port }, (info) => {
  console.log(`[mock-server] listening on http://localhost:${info.port}`)
  console.log(
    `[mock-server] SSE 端点: POST http://localhost:${info.port}/api/chat`,
  )
})

function shutdown() {
  server.close(() => process.exit(0))
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
