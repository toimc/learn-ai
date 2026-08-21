// 中文字典（source of truth）。
// 不加 as const：MessageSchema = typeof zhCN 需要值为拓宽的 string，
// en-US 才能用 satisfies 通过（字面量类型会要求英文值 === 中文值）。
const zhCN = {
  shared: {
    close: '关闭',
    copy: '复制代码',
    copied: '已复制',
  },
  promptInput: {
    placeholder: '给 AI Chat UI 发送消息...',
    disclaimer: 'AI Chat UI 可能会产生不准确的信息，请注意甄别内容的准确性',
    send: '发送',
    stop: '停止',
    previewAttachment: '预览 {name}',
    removeAttachment: '移除 {name}',
    uploading: '上传中',
    uploadFailed: '上传失败',
  },
  conversation: {
    emptyTitle: '有什么可以帮你的？',
    emptyDescription: '选择一个话题开始，或直接输入你的问题',
  },
  message: {
    you: '你',
    assistant: 'AI Chat UI',
  },
  toolCall: {
    parameters: '参数',
    result: '结果',
    error: '错误',
  },
  attachments: {
    empty: '暂无附件',
  },
  comparison: {
    leftLabel: '回复 A',
    rightLabel: '回复 B',
    buttonLabel: '喜欢这个',
  },
  inputArea: {
    placeholder: '输入消息...',
    send: '发送',
    stop: '停止',
  },
  markdown: {
    rendering: '图表渲染中…',
    renderFailed: '图表渲染失败：',
  },
  thinking: {
    title: '思考过程',
    thoughtFor: '已思考 {duration} 秒',
    thinking: '正在思考…',
  },
  imageLightbox: {
    previewTitle: '图片预览',
    prevImage: '上一张',
    nextImage: '下一张',
  },
}

export type MessageSchema = typeof zhCN
export default zhCN
