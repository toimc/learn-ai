import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright端到端测试配置
 * 用于测试ai-chat-ui组件库的Playground演示功能
 */
export default defineConfig({
  // 测试文件位置
  testDir: './e2e',

  // 测试超时时间（毫秒）
  timeout: 30 * 1000,

  // 期望超时时间
  expect: {
    timeout: 5000,
  },

  // 失败时是否截图
  use: {
    // 基础URL - 指向本地开发服务器
    baseURL: 'http://localhost:5173',

    // 失败时截图
    screenshot: 'only-on-failure',

    // 失败时录制视频
    video: 'retain-on-failure',

    // 追踪模式
    trace: 'on-first-retry',

    // 浏览器上下文选项
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true,
  },

  // 测试运行配置
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,

  // 报告器配置
  reporter: [
    ['html'],
    ['list'],
    ['json', { outputFile: 'test-results/results.json' }],
  ],

  // 全局设置
  globalSetup: './e2e/global-setup.ts',
  globalTeardown: './e2e/global-teardown.ts',

  // 不同浏览器的测试项目
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },

    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },

    // 移动端测试
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },
  ],

  // 开发服务器配置
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:5173',
    timeout: 120 * 1000,
    reuseExistingServer: !process.env.CI,
  },
})
