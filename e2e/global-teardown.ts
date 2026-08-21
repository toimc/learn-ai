/**
 * Playwright全局清理
 * 在所有测试结束后执行
 */
import { FullConfig } from '@playwright/test'

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function globalTeardown(_config: FullConfig) {
  console.log('✅ E2E tests completed')
  console.log('📊 Check test results in the test-results directory')
}

export default globalTeardown
