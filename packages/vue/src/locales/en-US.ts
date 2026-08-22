import type { MessageSchema } from './zh-CN'

// satisfies：key 结构与 zh-CN 完全一致，缺 key/写错 key 编译期报错
export default {
  shared: {
    close: 'Close',
    copy: 'Copy code',
    copied: 'Copied',
  },
  promptInput: {
    placeholder: 'Send a message to AI Chat UI...',
    disclaimer:
      'AI Chat UI may produce inaccurate information. Please double-check.',
    send: 'Send',
    stop: 'Stop',
    previewAttachment: 'Preview {name}',
    removeAttachment: 'Remove {name}',
    uploading: 'Uploading',
    uploadFailed: 'Upload failed',
  },
  conversation: {
    emptyTitle: 'How can I help you?',
    emptyDescription: 'Pick a topic to get started, or type your question',
  },
  message: {
    you: 'You',
    assistant: 'AI Chat UI',
  },
  toolCall: {
    parameters: 'Parameters',
    result: 'Result',
    error: 'Error',
  },
  attachments: {
    empty: 'No attachments',
  },
  comparison: {
    leftLabel: 'Response A',
    rightLabel: 'Response B',
    buttonLabel: 'Like this',
  },
  inputArea: {
    placeholder: 'Type a message...',
    send: 'Send',
    stop: 'Stop',
  },
  markdown: {
    rendering: 'Rendering diagram…',
    renderFailed: 'Failed to render diagram: ',
  },
  thinking: {
    title: 'Thinking Process',
    thoughtFor: 'Thought for {duration}s',
    thinking: 'Thinking…',
  },
  provider: {
    title: 'Provider Settings',
    typeLabel: 'Service type',
    typeOpenaiCompat: 'OpenAI compatible',
    typeAnthropic: 'Anthropic',
    nameLabel: 'Display name',
    namePlaceholder: 'e.g. My DeepSeek',
    baseURLLabel: 'Base URL',
    baseURLPlaceholder: 'https://api.example.com/v1',
    baseURLPresetsLabel: 'Quick presets: ',
    presetOpenai: 'OpenAI',
    presetDeepseek: 'DeepSeek',
    presetGlm: 'GLM',
    presetKimi: 'Kimi',
    apiKeyLabel: 'API Key',
    apiKeyPlaceholder: 'sk-...',
    modelLabel: 'Model',
    modelPlaceholder: 'e.g. deepseek-chat / claude-sonnet-4-5',
    submit: 'Register',
    remove: 'Delete',
    listTitle: 'Registered models',
    listEmpty: 'No registered models yet',
    errorRequired: 'This field is required',
  },
  imageLightbox: {
    previewTitle: 'Image preview',
    prevImage: 'Previous image',
    nextImage: 'Next image',
  },
} satisfies MessageSchema
