---
layout: page
title: Playground
---

<script setup lang="ts">
import { useChat } from '@ai-chat/core'
import { mockAdapter } from './.vitepress/utils/mock-adapter'

const chat = useChat(mockAdapter)

function handleSend(content: string) {
  chat.send(content)
}
</script>

<div style="max-width: 720px; margin: 0 auto; min-height: 600px">
  <ChatWindow height="600px">
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
