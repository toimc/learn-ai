<script setup lang="ts">
import { useChat } from '@ai-chat/core'
import { ChatWindow, MessageList, MessageBubble, InputArea } from '@ai-chat/vue'
import { MarkdownRenderer } from '@ai-chat/markdown'
import { mockAdapter } from './adapter'

const chat = useChat(mockAdapter)

function handleSend(content: string) {
  chat.send(content)
}
</script>

<template>
  <div style="max-width: 720px; margin: 40px auto; height: 80vh">
    <ChatWindow>
      <MessageList v-slot="{ message }" :messages="chat.messages">
        <MessageBubble :message="message">
          <MarkdownRenderer :content="message.content" />
        </MessageBubble>
      </MessageList>
      <template #footer>
        <InputArea
          :disabled="chat.isStreaming"
          @send="handleSend"
          @abort="chat.abort"
        />
      </template>
    </ChatWindow>
  </div>
</template>
