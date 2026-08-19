<script setup lang="ts">
import type { Attachment } from '@ai-chat/core'
import {
  Message,
  MessageContent,
  MessageAttachments,
  Attachment as AttachmentCard,
  AttachmentPreview,
  AttachmentInfo,
} from '@ai-chat/vue'

// 图片附件：走 URL 缩略图；文件附件：走类型图标 + 名称/大小
// 缩略图用内联 SVG data URI，离线可见
function svgThumb(bg: string, label: string) {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='96' height='96'><rect width='96' height='96' rx='10' fill='${bg}'/><text x='48' y='42' font-size='12' fill='white' text-anchor='middle' font-family='sans-serif'>ai-chat-ui</text><text x='48' y='60' font-size='10' fill='white' text-anchor='middle' font-family='sans-serif'>${label}</text></svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

const imageFiles: Attachment[] = [
  {
    id: 'att-1',
    name: 'component-architecture.png',
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
]

const docFiles: Attachment[] = [
  {
    id: 'att-3',
    name: 'ai-chat-ui-调研报告.pdf',
    mediaType: 'application/pdf',
    size: 3.2 * 1024 * 1024,
  },
]
</script>

<template>
  <div class="attachments-demo">
    <Message from="user">
      <MessageAttachments>
        <AttachmentCard v-for="f in imageFiles" :key="f.id" :data="f">
          <AttachmentPreview />
          <AttachmentInfo />
        </AttachmentCard>
      </MessageAttachments>
      <MessageContent
        >这是我们现在的组件架构图和主题令牌设计，帮我review一下</MessageContent
      >
    </Message>

    <Message from="assistant">
      <MessageContent
        content="收到两张图。整体分层清晰，补充两点建议：**core 零依赖**的红线要守住；令牌层建议补一份 dark 变体清单。详细结论见附件。"
      />
      <MessageAttachments>
        <AttachmentCard v-for="f in docFiles" :key="f.id" :data="f">
          <AttachmentPreview />
          <AttachmentInfo />
        </AttachmentCard>
      </MessageAttachments>
    </Message>
  </div>
</template>

<style scoped>
.attachments-demo {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
</style>
