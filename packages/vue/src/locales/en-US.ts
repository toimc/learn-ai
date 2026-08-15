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
} satisfies MessageSchema
