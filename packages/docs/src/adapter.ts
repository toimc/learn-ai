import type { ChatAdapter } from '@ai-chat/core'

export const mockAdapter: ChatAdapter = {
  async *sendMessage() {
    const lines = [
      'Hello! I am a mock AI assistant.\n\n',
      'Here is some **markdown** with `code`:\n\n',
      '```typescript\n',
      'const greeting = "Hello World"\n',
      'console.log(greeting)\n',
      '```\n\n',
      'This is a _streaming_ response simulation.',
    ]
    for (const line of lines) {
      yield { type: 'text', content: line }
      await new Promise((r) => setTimeout(r, 100))
    }
    yield { type: 'done', content: '' }
  },
}
