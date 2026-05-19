import { describe, it, expect } from 'vitest'
import { generateId, createUserMessage, createAssistantMessage } from '../utils'

describe('generateId', () => {
  it('should generate unique ids', () => {
    const id1 = generateId()
    const id2 = generateId()
    expect(id1).not.toBe(id2)
  })

  it('should start with msg_ prefix', () => {
    expect(generateId()).toMatch(/^msg_\d+_\d+$/)
  })
})

describe('createUserMessage', () => {
  it('should create a user message with content', () => {
    const msg = createUserMessage('Hello')
    expect(msg.role).toBe('user')
    expect(msg.content).toBe('Hello')
    expect(msg.id).toBeTruthy()
    expect(msg.createdAt).toBeInstanceOf(Date)
  })

  it('should create a user message with attachments', () => {
    const attachment = {
      type: 'image' as const,
      url: 'https://example.com/img.png',
      name: 'img.png',
      mimeType: 'image/png',
    }
    const msg = createUserMessage('Look at this', [attachment])
    expect(msg.attachments).toHaveLength(1)
    expect(msg.attachments![0].type).toBe('image')
  })
})

describe('createAssistantMessage', () => {
  it('should create an empty assistant message by default', () => {
    const msg = createAssistantMessage()
    expect(msg.role).toBe('assistant')
    expect(msg.content).toBe('')
    expect(msg.id).toBeTruthy()
  })

  it('should create an assistant message with content and metadata', () => {
    const msg = createAssistantMessage('Hi there', { model: 'gpt-4' })
    expect(msg.content).toBe('Hi there')
    expect(msg.metadata).toEqual({ model: 'gpt-4' })
  })
})
