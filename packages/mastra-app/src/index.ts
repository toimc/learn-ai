import { serve } from '@hono/node-server'
import { createApp } from './create-app'
import { readAppEnv } from './env'
import { mastra } from './mastra'

const { port } = readAppEnv()

const app = await createApp(mastra)
const server = serve({ fetch: app.fetch, port }, (info) => {
  console.log(`[mastra-app] listening on http://localhost:${info.port}`)
  console.log(
    `[mastra-app] stream 端点: POST http://localhost:${info.port}/api/agents/chat-agent/stream`,
  )
})

function shutdown() {
  server.close(() => process.exit(0))
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
