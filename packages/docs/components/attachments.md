# Attachments 系列

附件展示组件，支持图片缩略图和文件图标。包含 6 个子组件：

- **Attachments** — 容器，支持 `variant` 布局模式
- **Attachment** — 单个附件，provide 数据给子组件
- **AttachmentPreview** — 图片缩略图（96px）/ 文件图标，图片可点击触发 `preview` 事件
- **AttachmentInfo** — 文件名 + 类型 + 大小
- **AttachmentRemove** — hover 显示删除按钮
- **AttachmentEmpty** — 空状态

## 代码演示

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Attachment as AttachmentData } from '@toimc/core'
import {
  Attachments,
  Attachment,
  AttachmentPreview,
  AttachmentInfo,
  AttachmentRemove,
  AttachmentEmpty,
  ImageLightbox,
} from '@toimc/vue'

// 缩略图用内联 SVG data URI，离线可见
function svgThumb(bg: string, label: string) {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='96' height='96'><rect width='96' height='96' rx='10' fill='${bg}'/><text x='48' y='42' font-size='12' fill='white' text-anchor='middle' font-family='sans-serif'>ai-chat-ui</text><text x='48' y='60' font-size='10' fill='white' text-anchor='middle' font-family='sans-serif'>${label}</text></svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

let seq = 0
const files = ref<AttachmentData[]>([
  {
    id: 'att-1',
    name: 'architecture.png',
    mediaType: 'image/png',
    size: 248 * 1024,
    url: svgThumb('%236366f1', '架构图'),
  },
  {
    id: 'att-2',
    name: 'theme-tokens.png',
    mediaType: 'image/png',
    size: 190 * 1024,
    url: svgThumb('%238b5cf6', '令牌表'),
  },
  {
    id: 'att-3',
    name: '调研报告.pdf',
    mediaType: 'application/pdf',
    size: 3.2 * 1024 * 1024,
  },
])

const imageFiles = computed(() => files.value.filter((f) => f.mediaType.startsWith('image/')))
const lightboxVisible = ref(false)
const lightboxIndex = ref(0)

function addImage() {
  seq += 1
  const palettes = ['%230891b2', '%2316a34a', '%23d97706', '%23dc2626']
  files.value.push({
    id: `img-${seq}`,
    name: `screenshot-${seq}.png`,
    mediaType: 'image/png',
    size: Math.round(80 + Math.random() * 300) * 1024,
    url: svgThumb(palettes[seq % palettes.length], `截图 ${seq}`),
  })
}

function addFile() {
  seq += 1
  const kinds = [
    { ext: 'xlsx', type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
    { ext: 'zip', type: 'application/zip' },
    { ext: 'csv', type: 'text/csv' },
  ]
  const kind = kinds[seq % kinds.length]
  files.value.push({
    id: `file-${seq}`,
    name: `数据导出-${seq}.${kind.ext}`,
    mediaType: kind.type,
    size: Math.round(1 + Math.random() * 8) * 1024 * 1024,
  })
}

function remove(id: string) {
  files.value = files.value.filter((f) => f.id !== id)
}

function openPreview(file: AttachmentData) {
  const i = imageFiles.value.findIndex((img) => img.id === file.id)
  if (i >= 0) {
    lightboxIndex.value = i
    lightboxVisible.value = true
  }
}

const inlineFiles: AttachmentData[] = [
  { id: 'inl-1', name: '需求说明.pdf', mediaType: 'application/pdf', size: 412 * 1024 },
  { id: 'inl-2', name: '排期表.xlsx', mediaType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', size: 96 * 1024 },
  { id: 'inl-3', name: '接口草案.md', mediaType: 'text/markdown', size: 12 * 1024 },
]

const listFiles = ref<AttachmentData[]>([
  { id: 'lst-1', name: 'ai-chat-ui-调研报告.pdf', mediaType: 'application/pdf', size: 3.2 * 1024 * 1024 },
  { id: 'lst-2', name: '竞品对比.xlsx', mediaType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', size: 886 * 1024 },
  { id: 'lst-3', name: '会议纪要.docx', mediaType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', size: 154 * 1024 },
])
</script>

### grid 网格

缩略图网格，最适合消息内展示多图与混合附件：点击图片缩略图经 `preview` 事件打开 [ImageLightbox](./image-lightbox.md) 大图，hover 卡片右上角出现移除按钮，清空后回落到 `AttachmentEmpty` 空态：

<DemoContainer>
  <div style="display: flex; flex-direction: column; gap: 12px">
    <div style="display: flex; gap: 8px; align-items: center">
      <button
        style="
          padding: 4px 12px;
          font-size: 13px;
          border: 1px solid var(--vp-c-divider);
          border-radius: 6px;
          background: var(--vp-c-bg);
          cursor: pointer;
        "
        @click="addImage"
      >
        + 添加图片
      </button>
      <button
        style="
          padding: 4px 12px;
          font-size: 13px;
          border: 1px solid var(--vp-c-divider);
          border-radius: 6px;
          background: var(--vp-c-bg);
          cursor: pointer;
        "
        @click="addFile"
      >
        + 添加文件
      </button>
      <span style="font-size: 12px; color: var(--ai-chat-color-text-muted)">
        当前 {{ files.length }} 个附件
      </span>
    </div>
    <Attachments variant="grid">
      <Attachment v-for="f in files" :key="f.id" :data="f">
        <AttachmentPreview @preview="openPreview(f)" />
        <AttachmentInfo />
        <AttachmentRemove @remove="remove(f.id)" />
      </Attachment>
      <AttachmentEmpty v-if="files.length === 0">
        暂无附件，点击上方按钮添加
      </AttachmentEmpty>
    </Attachments>
  </div>
  <ImageLightbox
    v-if="lightboxVisible"
    :attachments="imageFiles"
    :index="lightboxIndex"
    @close="lightboxVisible = false"
  />
</DemoContainer>

### inline 行内

横向流动、自动换行的窄条形态，适合输入区上方待发送的文件 chip 列表：

<DemoContainer>
  <Attachments variant="inline">
    <Attachment v-for="f in inlineFiles" :key="f.id" :data="f">
      <AttachmentPreview />
      <AttachmentInfo />
    </Attachment>
  </Attachments>
</DemoContainer>

### list 列表

纵向文件列表，信息密度最高，适合文档类附件明细与逐项移除：

<DemoContainer>
  <Attachments variant="list">
    <Attachment v-for="f in listFiles" :key="f.id" :data="f">
      <AttachmentPreview />
      <AttachmentInfo />
      <AttachmentRemove @remove="listFiles = listFiles.filter((x) => x.id !== f.id)" />
    </Attachment>
    <AttachmentEmpty v-if="listFiles.length === 0">文件已全部移除</AttachmentEmpty>
  </Attachments>
</DemoContainer>

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

| 插槽名 | 说明 |
|--------|------|
| default | 附件项（Attachment 系列子组件，可混入 AttachmentEmpty 空态） |

### Attachment

| 属性名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| data | `Attachment` | — | 附件数据（必填） |

| 插槽名 | 说明 |
|--------|------|
| default | 附件项内容（AttachmentPreview / AttachmentInfo / AttachmentRemove） |

### AttachmentPreview / AttachmentInfo / AttachmentRemove

通过 inject 从父级 Attachment 获取数据，无需 Props。

AttachmentPreview 的事件：

| 事件名 | 参数 | 说明 |
|--------|------|------|
| preview | — | 点击图片缩略图时触发（非图片不触发） |
