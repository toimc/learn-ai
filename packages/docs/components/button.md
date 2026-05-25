# Button

通用按钮组件，支持三种类型和三种尺寸。

## 按钮类型

<DemoContainer>
  <div style="display: flex; gap: 12px; align-items: center">
    <Button type="primary">主要按钮</Button>
    <Button type="secondary">次要按钮</Button>
    <Button type="danger">危险按钮</Button>
  </div>
</DemoContainer>

## 按钮尺寸

<DemoContainer>
  <div style="display: flex; gap: 12px; align-items: center">
    <Button size="small">Small</Button>
    <Button size="medium">Medium</Button>
    <Button size="large">Large</Button>
  </div>
</DemoContainer>

## 禁用状态

<DemoContainer>
  <div style="display: flex; gap: 12px; align-items: center">
    <Button disabled>禁用按钮</Button>
    <Button type="secondary" disabled>禁用按钮</Button>
    <Button type="danger" disabled>禁用按钮</Button>
  </div>
</DemoContainer>

## API

### Props

| 属性名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| type | `'primary' \| 'secondary' \| 'danger'` | `'primary'` | 按钮类型 |
| size | `'small' \| 'medium' \| 'large'` | `'medium'` | 按钮尺寸 |
| disabled | `boolean` | `false` | 是否禁用 |

### Events

| 事件名 | 参数 | 说明 |
|--------|------|------|
| click | `(event: MouseEvent)` | 按钮点击 |

### Slots

| 插槽名 | 说明 |
|--------|------|
| default | 按钮内容 |

### CSS 变量

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| --ai-chat-btn-radius | `6px` | 按钮圆角 |
| --ai-chat-btn-primary-bg | `#2563eb` | 主要按钮背景 |
| --ai-chat-btn-primary-color | `#ffffff` | 主要按钮文字 |
| --ai-chat-btn-primary-hover-bg | `#1d4ed8` | 主要按钮悬停背景 |
| --ai-chat-btn-secondary-bg | `#f3f4f6` | 次要按钮背景 |
| --ai-chat-btn-secondary-color | `#1f2937` | 次要按钮文字 |
| --ai-chat-btn-secondary-hover-bg | `#e5e7eb` | 次要按钮悬停背景 |
| --ai-chat-btn-danger-bg | `#dc2626` | 危险按钮背景 |
| --ai-chat-btn-danger-color | `#ffffff` | 危险按钮文字 |
| --ai-chat-btn-danger-hover-bg | `#b91c1c` | 危险按钮悬停背景 |
