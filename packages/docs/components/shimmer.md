# Shimmer

微光扫过动画组件，常用于等待态或加载占位。

## 基础用法

<DemoContainer>
  <div style="display: flex; flex-direction: column; gap: 8px;">
    <Shimmer as="div" style="height: 16px; width: 60%;">正在思考...</Shimmer>
    <Shimmer as="div" style="height: 16px; width: 80%;">加载中</Shimmer>
  </div>
</DemoContainer>

## API

### Props

| 属性名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| as | `string` | `'span'` | 渲染的 HTML 标签名 |

### CSS 变量

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| --ai-chat-color-accent | `#6366f1` | 微光渐变色 |
