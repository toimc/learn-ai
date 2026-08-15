# Attachments 系列

附件展示组件，支持图片缩略图和文件图标。包含 6 个子组件：

- **Attachments** — 容器，支持 `variant` 布局模式
- **Attachment** — 单个附件，provide 数据给子组件
- **AttachmentPreview** — 图片缩略图（96px）/ 文件图标，图片可点击触发 `preview` 事件
- **AttachmentInfo** — 文件名 + 类型 + 大小
- **AttachmentRemove** — hover 显示删除按钮
- **AttachmentEmpty** — 空状态

## 基础用法

```vue
<Attachments variant="grid">
  <Attachment
    v-for="file in files"
    :key="file.id"
    :data="file"
  >
    <AttachmentPreview @preview="openPreview(file)" />
    <AttachmentInfo />
    <AttachmentRemove @remove="remove(file.id)" />
  </Attachment>
</Attachments>
```

## API

### Attachments

| 属性名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| variant | `'grid' \| 'inline' \| 'list'` | `'grid'` | 布局模式 |

### Attachment

| 属性名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| data | `Attachment` | — | 附件数据（必填） |

### AttachmentPreview / AttachmentInfo / AttachmentRemove

通过 inject 从父级 Attachment 获取数据，无需 Props。

AttachmentPreview 的事件：

| 事件名 | 参数 | 说明 |
|--------|------|------|
| preview | — | 点击图片缩略图时触发（非图片不触发） |
