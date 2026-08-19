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

async function* mockThinkingResponse(): AsyncGenerator<StreamChunk> {
  // 模拟思考过程
  const thinkingSteps = [
    'Analyzing the user request about Vue 3 composition...\n\n',
    'Breaking down the problem into key concepts:\n',
    '- reactive() and ref() differences\n',
    '- Composable patterns\n',
    '- Lifecycle hooks\n\n',
    'Considering best practices and performance implications...\n',
  ]

  for (const step of thinkingSteps) {
    yield { type: 'thinking', content: step }
    await new Promise((r) => setTimeout(r, 150))
  }

  // 思考完成，开始实际响应
  yield {
    type: 'text',
    content:
      'Based on my analysis, here are the key concepts about Vue 3 Composition API:\n\n',
  }
  await new Promise((r) => setTimeout(r, 200))

  yield {
    type: 'text',
    content: '## 1. Reactive References\n\n',
  }
  await new Promise((r) => setTimeout(r, 100))

  yield {
    type: 'text',
    content:
      '```typescript\n// ref() for primitive values\nconst count = ref(0)\n\n// reactive() for objects\nconst state = reactive({ count: 0 })\n```\n\n',
  }
  await new Promise((r) => setTimeout(r, 150))

  yield {
    type: 'text',
    content:
      '## 2. Composables Pattern\n\nComposables are functions that encapsulate and reuse reactive logic.\n\n',
  }
  await new Promise((r) => setTimeout(r, 100))

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
  mockThinkingResponse,
  mockToolCallResponse,
  mockTextResponse,
  mockErrorResponse,
]

let callIndex = 0

export const mockAdapter: ChatAdapter = {
  async *sendMessage(options: { messages: Message[] }) {
    const lastMessage = options.messages[options.messages.length - 1]
    const content = lastMessage?.content?.toLowerCase() ?? ''

    // 思考过程演示 - 专门的触发词
    if (
      content.includes('思考') ||
      content.includes('thinking') ||
      content.includes('思考过程')
    ) {
      yield* mockThinkingResponse()
      return
    }

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
