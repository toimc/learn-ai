/**
 * 修复后的Playwright测试辅助函数
 * 基于实际playground.html页面的DOM结构
 */
import { expect, Page } from '@playwright/test'

/**
 * 等待并验证页面加载完成
 */
export async function waitForPageLoad(page: Page) {
  // 等待主应用容器出现
  await page.waitForSelector('.pg-app', { timeout: 10000 })

  // 等待Vue应用完全加载
  await page.waitForLoadState('networkidle', { timeout: 10000 })

  // 等待主要内容区域出现
  await page.waitForSelector('.pg-main', { timeout: 5000 })
}

/**
 * 发送消息到聊天输入框
 */
export async function sendMessage(page: Page, message: string) {
  // 查找实际的输入框
  const textarea = page.locator('textarea').first()
  await textarea.waitFor({ state: 'visible', timeout: 5000 })

  // 清空现有内容
  await textarea.fill('')

  // 输入消息
  await textarea.fill(message)

  // 查找发送按钮并点击（根据实际UI结构）
  const sendButton = page
    .locator(
      'button[type="submit"], button:has([aria-label="send"]), .pg-input-area button:last-child, button:has(svg)',
    )
    .first()

  if ((await sendButton.count()) > 0) {
    await sendButton.click()
  } else {
    // 如果没有发送按钮，按Enter键发送
    await textarea.press('Enter')
  }
}

/**
 * 等待AI响应消息出现
 */
export async function waitForAIMessage(page: Page, timeout = 10000) {
  // 等待消息数量增加（表示收到了新消息）
  const initialCount = await page.locator('.pg-conv-item').count()

  // 等待消息列表更新
  await page.waitForFunction(
    (initialCount) => {
      const messages = document.querySelectorAll(
        '.pg-message, [class*="message"], [class*="Message"]',
      )
      return messages.length > initialCount
    },
    initialCount,
    { timeout },
  )
}

/**
 * 获取当前消息数量
 */
export async function getMessageCount(page: Page): Promise<number> {
  // 根据实际页面结构查找消息元素
  const messages = page.locator(
    '.pg-message, [class*="ai-chat-message"], [class*="Message"]',
  )
  return await messages.count()
}

/**
 * 获取最后一条消息内容
 */
export async function getLastMessageContent(page: Page): Promise<string> {
  // 根据实际页面结构查找最后一条消息
  const lastMessage = page
    .locator('.pg-message, [class*="message"], [class*="Message"]')
    .last()
  const content = lastMessage
    .locator('[class*="content"], [class*="Content"]')
    .first()
  return (await content.innerText()) || ''
}

/**
 * 选择左侧会话
 */
export async function selectConversation(
  page: Page,
  conversationTitle: string,
) {
  // 点击包含指定文本的会话项
  const conversationItem = page
    .locator('.pg-conv-item')
    .filter({ hasText: conversationTitle })
  await conversationItem.click()

  // 等待消息更新
  await page.waitForTimeout(500)
}

/**
 * 创建新会话
 */
export async function createNewConversation(page: Page) {
  const initialConvCount = await page.locator('.pg-conv-item').count()

  // 点击新对话按钮
  const newChatButton = page.locator(
    '.pg-btn-new-chat, button:has-text("New chat"), button:has-text("新对话")',
  )
  await newChatButton.click()

  // 等待新会话创建
  await page.waitForFunction(
    (initialCount) => {
      const items = document.querySelectorAll('.pg-conv-item')
      return items.length > initialCount
    },
    initialConvCount,
    { timeout: 5000 },
  )
}

/**
 * 切换侧边栏
 */
export async function toggleSidebar(page: Page) {
  const sidebarToggle = page.locator('.pg-sidebar-toggle').first()
  await sidebarToggle.click()
  await page.waitForTimeout(300)
}

/**
 * 切换主题
 */
export async function toggleTheme(page: Page) {
  // 根据实际页面结构查找主题切换按钮
  const themeButton = page
    .locator(
      'button:has(svg:has-circle("12,12,r,5")), button[title*="theme"], button[aria-label*="theme"]',
    )
    .first()

  if ((await themeButton.count()) > 0) {
    await themeButton.click()
    await page.waitForTimeout(200)
  } else {
    console.log('⚠️ 主题切换按钮未找到')
  }
}

/**
 * 等待流式消息完成
 */
export async function waitForStreamingComplete(page: Page, timeout = 15000) {
  // 等待流式状态结束（根据实际实现调整）
  await page.waitForTimeout(2000) // 先等待基本加载

  // 检查是否有流式指示器消失
  const streamingIndicator = page.locator(
    '.pg-typing, [class*="typing"], [class*="streaming"]',
  )

  if ((await streamingIndicator.count()) > 0) {
    await streamingIndicator.waitFor({ state: 'hidden', timeout })
  }
}

/**
 * 断言当前会话标题
 */
export async function assertConversationTitle(
  page: Page,
  expectedTitle: string,
) {
  const activeConversation = page.locator(
    '.pg-conv-item.active .pg-conv-text, .pg-conv-item.active',
  )
  await expect(activeConversation).toHaveText(expectedTitle, { timeout: 5000 })
}

/**
 * 断言消息存在特定文本
 */
export async function assertMessageContains(page: Page, searchText: string) {
  const messages = page.locator('.pg-message, [class*="message"]')
  await expect(messages.filter({ hasText: searchText })).toHaveCount(1, {
    timeout: 5000,
  })
}

/**
 * 获取当前激活的会话ID
 */
export async function getActiveConversationId(page: Page): Promise<string> {
  const activeConv = page.locator('.pg-conv-item.active')
  return (
    (await activeConv.getAttribute('data-id')) ||
    (await activeConv.evaluate((el) => el.id)) ||
    ''
  )
}

/**
 * 检查输入框是否禁用
 */
export async function isInputDisabled(page: Page): Promise<boolean> {
  const textarea = page.locator('textarea').first()
  const isDisabled = await textarea.isDisabled()
  return isDisabled
}

/**
 * 截图并保存（用于调试）
 */
export async function takeScreenshot(page: Page, name: string) {
  await page.screenshot({
    path: `test-results/screenshots/${name}.png`,
    fullPage: true,
  })
}

/**
 * 获取流式消息的实时内容
 */
export async function getStreamingContent(page: Page): Promise<string> {
  const streamingMessage = page
    .locator('.pg-message, [class*="message"]')
    .last()
  const content = streamingMessage
    .locator('[class*="content"], [class*="Content"]')
    .first()
  return (await content.innerText()) || ''
}

/**
 * 等待页面完全加载（包括Vue应用初始化）
 */
export async function waitForAppReady(page: Page) {
  // 等待主容器
  await page.waitForSelector('.pg-app', { timeout: 10000 })

  // 等待Vue应用挂载
  await page.waitForFunction(
    () => {
      const app = document.querySelector('.pg-app')
      return app && app.children.length > 0
    },
    { timeout: 10000 },
  )

  // 等待主要内容区域
  await page.waitForSelector('.pg-main', { timeout: 5000 })
}

/**
 * 检查页面是否有会话列表
 */
export async function hasConversations(page: Page): Promise<boolean> {
  const conversations = await page.locator('.pg-conv-item').count()
  return conversations > 0
}

/**
 * 获取会话数量
 */
export async function getConversationCount(page: Page): Promise<number> {
  return await page.locator('.pg-conv-item').count()
}

/**
 * 检查是否有欢迎界面
 */
export async function hasWelcomeScreen(page: Page): Promise<boolean> {
  const welcomeElements = await page
    .locator('.pg-welcome, [class*="welcome"], [class*="Welcome"]')
    .count()
  return welcomeElements > 0
}
