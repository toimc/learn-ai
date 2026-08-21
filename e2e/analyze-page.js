/**
 * 分析实际页面结构 - 直接可执行版本
 */
const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    console.log('🔍 正在访问页面...');
    await page.goto('http://localhost:5173/playground.html');

    // 等待页面加载
    await page.waitForTimeout(3000);

    console.log('📋 页面主要元素分析：');

    // 检查主要容器
    const app = await page.$('#app');
    console.log('✓ 找到 #app 容器');

    // 检查Vue应用内的主要元素
    const mainElements = await page.evaluate(() => {
      const body = document.body;

      // 获取所有class包含特定前缀的元素
      const getAllElements = (prefix) => {
        const elements = document.querySelectorAll(`[class*="${prefix}"]`);
        return Array.from(elements).slice(0, 10).map(el => ({
          tag: el.tagName,
          classes: el.className,
          id: el.id,
          textContent: el.textContent?.substring(0, 50)
        }));
      };

      return {
        pgElements: getAllElements('pg-'),
        aiChatElements: getAllElements('ai-chat-'),
        bodyClasses: body.className,
        allDivs: document.querySelectorAll('div').length
      };
    });

    console.log('🎯 pg- 前缀元素:', mainElements.pgElements.length, '个');
    mainElements.pgElements.forEach((el, i) => {
      console.log(`  ${i + 1}. ${el.tag}.${el.classes?.split(' ')[0] || ''} - "${el.textContent?.substring(0, 30)}"`);
    });

    console.log('🎯 ai-chat- 前缀元素:', mainElements.aiChatElements.length, '个');
    mainElements.aiChatElements.forEach((el, i) => {
      if (i < 5) { // 只显示前5个
        console.log(`  ${i + 1}. ${el.tag}.${el.classes?.split(' ')[0] || ''}`);
      }
    });

    // 检查具体的会话元素
    const conversations = await page.$$('.pg-conv-item');
    console.log(`📝 找到 ${conversations.length} 个会话项`);

    // 检查输入框
    const textarea = await page.$('textarea');
    console.log(`✓ 找到输入框: ${textarea ? '是' : '否'}`);

    // 检查发送按钮
    const buttons = await page.$$('button');
    console.log(`🔘 找到 ${buttons.length} 个按钮`);

    // 获取页面标题
    const title = await page.title();
    console.log(`📄 页面标题: "${title}"`);

    // 截图保存
    await page.screenshot({ path: 'playground-structure.png', fullPage: true });
    console.log('📸 已保存页面截图: playground-structure.png');

  } catch (error) {
    console.error('❌ 分析出错:', error);
  } finally {
    await browser.close();
  }
})();
