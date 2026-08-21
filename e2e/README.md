# 端到端测试 (E2E Tests)

本项目的Playwright端到端测试覆盖了ai-chat-ui组件库的核心功能。

## 测试覆盖范围

### 基础功能测试 (`playground.spec.ts`)
- ✅ 页面加载和渲染
- ✅ 消息发送和接收
- ✅ 会话管理和切换
- ✅ 流式消息渲染
- ✅ UI交互功能（侧边栏、主题切换）
- ✅ 响应式设计（移动端适配）
- ✅ 性能和稳定性

### 高级功能测试 (`playground-advanced.spec.ts`)
- ✅ Markdown渲染（代码块、列表、链接等）
- ✅ 代码高亮（JavaScript、Vue等）
- ✅ 思考过程显示
- ✅ A/B回复对比
- ✅ 消息操作（复制、重新生成）
- ✅ 附件功能
- ✅ 国际化切换
- ✅ 主题定制
- ✅ 键盘快捷键
- ✅ 无障碍支持

## 运行测试

### 安装依赖
```bash
pnpm install
```

### 运行所有测试
```bash
# 后台模式运行
pnpm test:e2e

# 有界面模式运行
pnpm test:e2e:ui

# 调试模式
pnpm test:e2e:debug

# 有头模式（可以看到浏览器）
pnpm test:e2e:headed
```

### 运行特定测试
```bash
# 只运行基础功能测试
pnpm test:e2e playground.spec.ts

# 只运行高级功能测试  
pnpm test:e2e playground-advanced.spec.ts

# 运行特定测试用例
pnpm test:e2e --grep "应该能够发送文本消息"
```

### 查看测试报告
```bash
pnpm test:e2e:report
```

## 测试环境

- **浏览器**: Chromium、Firefox、WebKit、移动端
- **Node版本**: ^22.18.0 || >=24.12.0
- **测试URL**: http://localhost:5173/playground.html
- **超时设置**: 30秒（测试）、5秒（期望）

## 项目结构

```
e2e/
├── README.md                          # 本文档
├── global-setup.ts                    # 全局测试设置
├── global-teardown.ts                 # 全局清理
├── helpers/
│   └── test-helpers.ts               # 测试辅助函数
├── playground.spec.ts                 # 基础功能测试
└── playground-advanced.spec.ts        # 高级功能测试
```

## 编写测试指南

### 使用测试辅助函数

```typescript
import { sendMessage, waitForAIMessage } from './helpers/test-helpers'

test('示例测试', async ({ page }) => {
  await page.goto('/playground.html')
  await sendMessage(page, '测试消息')
  await waitForAIMessage(page)
})
```

### 测试最佳实践

1. **清晰的测试描述**: 使用`应该...`格式描述测试目的
2. **独立的测试**: 每个测试应该独立运行，不依赖其他测试
3. **适当的等待**: 使用明确的等待条件，而非固定时间
4. **语义化选择器**: 优先使用data属性和语义化class
5. **错误处理**: 验证边界情况和错误处理

### 调试技巧

```bash
# UI模式查看详细执行过程
pnpm test:e2e:ui

# 截图调试（在测试中）
await page.screenshot({ path: 'debug.png' })

# 查看控制台
page.on('console', msg => console.log(msg.text()))
```

## CI/CD集成

```yaml
# .github/workflows/e2e.yml 示例
- name: Install dependencies
  run: pnpm install
  
- name: Install Playwright browsers
  run: pnpm exec playwright install --with-deps
  
- name: Run E2E tests
  run: pnpm test:e2e
  
- name: Upload test results
  if: always()
  uses: actions/upload-artifact@v3
  with:
    name: playwright-report
    path: test-results/
```

## 测试覆盖率

当前覆盖率统计：
- 基础功能: 15个测试用例
- 高级功能: 20个测试用例
- 总计: 35个测试用例

## 维护指南

### 添加新测试

1. 在对应的spec文件中添加测试用例
2. 使用现有的辅助函数
3. 遵循命名约定和结构
4. 运行测试确保通过

### 更新辅助函数

在`helpers/test-helpers.ts`中添加新函数时：
1. 添加详细注释
2. 包含错误处理
3. 考虑重用性
4. 更新本README文档

## 故障排除

### 常见问题

1. **测试超时**: 增加timeout配置或检查网络连接
2. **元素未找到**: 检查选择器是否正确，页面是否完全加载
3. **浏览器启动失败**: 确保已安装playwright浏览器
4. **端口冲突**: 检查5173端口是否被占用

### 获取帮助

- 查看Playwright官方文档: https://playwright.dev
- 查看项目Issue: GitHub Issues
- 查看测试报告: `pnpm test:e2e:report`

## 相关文档

- [Playwright官方文档](https://playwright.dev)
- [项目主README](../README.md)
- [组件API文档](../packages/vue/README.md)
- [开发指南](../CLAUDE.md)
