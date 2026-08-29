#!/usr/bin/env node
import { weatherMcpServer } from './weather-server'

/**
 * stdio 独立入口（官方 "Publish a stdio server package" 形态的本地版）：
 * MCP 客户端以 command 拉起本进程，工具经 stdin/stdout JSON-RPC 提供。
 * 真机验证过的 Claude Code 项目级 .mcp.json 配置（zsh -lc 保证 corepack 进 PATH）：
 *   { "mcpServers": { "weather": {
 *       "command": "/bin/zsh",
 *       "args": ["-lc", "cd <仓库绝对路径>/packages/dev-server && corepack pnpm exec tsx src/mcp/weather-stdio.ts"]
 *   } } }
 * dev-server 为私有包不发布 npm，故不走 bin/npx 形态。
 */
weatherMcpServer.startStdio().catch((error) => {
  console.error('Failed to start MCP server:', error)
  process.exit(1)
})
