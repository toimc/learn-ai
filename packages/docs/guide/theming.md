# 主题定制

AI Chat UI 使用 CSS Variables 实现主题定制，不依赖任何 CSS 框架。所有变量以 `--ai-chat-` 为前缀。

## 全局变量

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `--ai-chat-border-color` | `#e5e7eb` | 全局边框颜色 |
| `--ai-chat-radius` | `8px` | 全局圆角 |
| `--ai-chat-bg` | `#ffffff` | 全局背景色 |
| `--ai-chat-padding` | `16px` | 全局内边距 |

## 气泡变量

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `--ai-chat-bubble-radius` | `12px` | 气泡圆角 |
| `--ai-chat-user-bg` | `#2563eb` | 用户消息背景 |
| `--ai-chat-user-color` | `#ffffff` | 用户消息文字 |
| `--ai-chat-assistant-bg` | `#f3f4f6` | 助手消息背景 |
| `--ai-chat-assistant-color` | `#1f2937` | 助手消息文字 |

## 按钮变量

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `--ai-chat-btn-radius` | `6px` | 按钮圆角 |
| `--ai-chat-btn-primary-bg` | `#2563eb` | 主要按钮背景 |
| `--ai-chat-btn-primary-color` | `#ffffff` | 主要按钮文字 |
| `--ai-chat-btn-primary-hover-bg` | `#1d4ed8` | 主要按钮悬停 |
| `--ai-chat-btn-secondary-bg` | `#f3f4f6` | 次要按钮背景 |
| `--ai-chat-btn-secondary-color` | `#374151` | 次要按钮文字 |
| `--ai-chat-btn-secondary-hover-bg` | `#e5e7eb` | 次要按钮悬停 |
| `--ai-chat-btn-danger-bg` | `#ef4444` | 危险按钮背景 |
| `--ai-chat-btn-danger-color` | `#ffffff` | 危险按钮文字 |

## 输入区域变量

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `--ai-chat-input-bg` | `#ffffff` | 输入框背景 |
| `--ai-chat-input-color` | `#1f2937` | 输入框文字 |
| `--ai-chat-primary` | `#2563eb` | 主色调（发送按钮） |
| `--ai-chat-danger` | `#ef4444` | 警告色（中止按钮） |

## 代码块变量

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `--ai-chat-code-bg` | `#1e1e2e` | 代码块背景 |
| `--ai-chat-code-color` | `#cdd6f4` | 代码块文字 |
| `--ai-chat-code-header-bg` | `#181825` | 代码块头部背景 |
| `--ai-chat-inline-code-bg` | `#f3f4f6` | 行内代码背景 |

## 使用方式

### 全局覆盖

在根样式中重定义变量：

```css
:root {
  --ai-chat-primary: #7c3aed;
  --ai-chat-user-bg: #7c3aed;
  --ai-chat-btn-primary-bg: #7c3aed;
  --ai-chat-btn-primary-hover-bg: #6d28d9;
}
```

### 组件级覆盖

通过父容器限定作用域：

```css
.my-chat {
  --ai-chat-user-bg: #059669;
  --ai-chat-assistant-bg: #ecfdf5;
}
```

```vue
<ChatWindow class="my-chat">
  <!-- ... -->
</ChatWindow>
```

### 暗色模式

```css
@media (prefers-color-scheme: dark) {
  :root {
    --ai-chat-bg: #1e1e2e;
    --ai-chat-border-color: #374151;
    --ai-chat-assistant-bg: #2d2d3f;
    --ai-chat-assistant-color: #e5e7eb;
    --ai-chat-input-bg: #2d2d3f;
    --ai-chat-input-color: #e5e7eb;
  }
}
```
