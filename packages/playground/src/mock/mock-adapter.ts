import type { ChatAdapter, StreamChunk, Message } from '@ai-chat/core'

async function* mockTextResponse(): AsyncGenerator<StreamChunk> {
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
}

async function* mockToolCallResponse(): AsyncGenerator<StreamChunk> {
  yield {
    type: 'text',
    content: 'Let me check the weather for you.\n\n',
  }
  await new Promise((r) => setTimeout(r, 200))

  yield {
    type: 'tool_call',
    content: '',
    metadata: {
      toolCallId: 'call_1',
      toolName: 'get_weather',
      toolArguments: { city: 'Beijing', unit: 'celsius' },
    },
  }
  await new Promise((r) => setTimeout(r, 500))

  yield {
    type: 'tool_result',
    content: '',
    metadata: {
      toolCallId: 'call_1',
      toolName: 'get_weather',
      toolResult: { temperature: 22, condition: 'Sunny', humidity: 45 },
      duration: 480,
    },
  }
  await new Promise((r) => setTimeout(r, 100))

  yield {
    type: 'text',
    content: 'The weather in Beijing is **22°C**, sunny with 45% humidity.',
  }
  yield { type: 'done', content: '' }
}

async function* mockErrorResponse(): AsyncGenerator<StreamChunk> {
  yield {
    type: 'text',
    content: 'Let me try something...\n\n',
  }
  await new Promise((r) => setTimeout(r, 200))

  yield {
    type: 'tool_call',
    content: '',
    metadata: {
      toolCallId: 'call_err',
      toolName: 'failing_tool',
      toolArguments: { param: 'value' },
    },
  }
  await new Promise((r) => setTimeout(r, 300))

  yield {
    type: 'tool_result',
    content: '',
    metadata: {
      toolCallId: 'call_err',
      toolName: 'failing_tool',
      toolError: 'Connection timeout: service unavailable',
      duration: 300,
    },
  }
  await new Promise((r) => setTimeout(r, 100))

  yield {
    type: 'text',
    content: 'Sorry, the tool call failed. Please try again.',
  }
  yield { type: 'done', content: '' }
}

const responseGenerators = [
  mockTextResponse,
  mockToolCallResponse,
  mockTextResponse,
  mockErrorResponse,
]

let callIndex = 0

export const mockAdapter: ChatAdapter = {
  async *sendMessage(options: { messages: Message[] }) {
    const lastMessage = options.messages[options.messages.length - 1]
    const content = lastMessage?.content?.toLowerCase() ?? ''

    if (content.includes('tool') || content.includes('工具')) {
      yield* mockToolCallResponse()
      return
    }

    if (content.includes('error') || content.includes('错误')) {
      yield* mockErrorResponse()
      return
    }

    const generator = responseGenerators[callIndex % responseGenerators.length]
    callIndex++
    yield* generator()
  },
}
