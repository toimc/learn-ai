/**
 * Playwright全局设置
 * 在所有测试开始前执行
 */
import { FullConfig } from '@playwright/test'

async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting E2E tests...')
  console.log('📋 Test configuration:', {
    testDir: config.testDir,
    workers: config.workers,
    projects: config.projects?.length,
  })
}

export default globalSetup
