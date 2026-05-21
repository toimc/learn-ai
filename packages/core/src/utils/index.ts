let counter = 0

export function generateId(): string {
  return `msg_${Date.now()}_${++counter}`
}

export function createUserMessage(
  content: string,
  attachments?: import('../types').Attachment[],
): import('../types').Message {
  return {
    id: generateId(),
    role: 'user',
    content,
    attachments,
    createdAt: new Date(),
  }
}

export function createAssistantMessage(
  content = '',
  metadata?: Record<string, unknown>,
): import('../types').Message {
  return {
    id: generateId(),
    role: 'assistant',
    content,
    metadata,
    createdAt: new Date(),
  }
}
