<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import { useChat } from '@toimc/core'
import type { ChatAdapter, StreamChunk } from '@toimc/core'
import {
  aiChatI18n,
  Conversation,
  ConversationContent,
  ConversationEmpty,
  ConversationScrollBtn,
  Message,
  MessageContent,
  MessageActions,
  MessageActionCopy,
  MessageActionSpeak,
  PromptInput,
  PromptInputBody,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTools,
  PromptInputMicButton,
  useSpeechInput,
  useSpeechOutput,
} from '@toimc/vue'
import '../../locales' // 副作用：合并 pg 字典

const { t } = aiChatI18n.global

// 中文流式剧本（自包含）：多句短文让句子级朗读的「凑满一句读一句」可感知
const REPLY_SENTENCES = [
  '语音输入走浏览器原生的 SpeechRecognition，不需要任何云端服务。',
  '说完一句话自动停止，识别文本先进输入框，确认无误再发送。',
  '朗读走 speechSynthesis，流式回复凑满一句就入队，边生成边读。',
  '自动朗读默认关闭，开启后偏好会记住，下次进来还是你的选择。',
]

const scriptAdapter: ChatAdapter = {
  async *sendMessage(opts): AsyncGenerator<StreamChunk> {
    const signal = opts.signal
    yield { type: 'text', content: '好的，一段关于本页功能的介绍：\n\n' }
    for (const sentence of REPLY_SENTENCES) {
      if (signal?.aborted) return
      yield { type: 'text', content: `${sentence}\n\n` }
      await new Promise((r) => setTimeout(r, 500))
    }
    yield { type: 'done', content: '' }
  },
}

// 语音输出单例：enabled 是模块级共享开关（localStorage 持久化）；
// speaking 是实例级状态，本实例只反映自动朗读路径，手动朗读态在消息按钮上
const { enabled: autoSpeak, feedChunk, stop, toggle } = useSpeechOutput()

// 流式 chunk → 朗读队列（onResponse 透传每帧）
const chat = useChat(scriptAdapter, {
  onResponse(chunk) {
    if (chunk.type === 'text') feedChunk(chunk.content)
  },
})

const chatAreaRef = ref<HTMLElement>()
const isAtBottom = ref(true)

function scrollToBottom() {
  nextTick(() => {
    if (chatAreaRef.value) {
      chatAreaRef.value.scrollTop = chatAreaRef.value.scrollHeight
    }
  })
}

function onScroll(e: Event) {
  const el = e.target as HTMLElement
  isAtBottom.value = el.scrollHeight - el.scrollTop - el.clientHeight < 50
}

watch(() => chat.messages.length, scrollToBottom)

// 发送前打断上一条的朗读：新回复进来，旧声音让位
function onSend(payload: { text: string }) {
  stop()
  void chat.send(payload.text)
}

// 麦克风支持性提示（不支持时按钮自动隐藏，文案说明原因）
const micInput = useSpeechInput()
</script>

<template>
  <section class="pg-demo-card">
    <header class="pg-demo-card__header">
      <h3 class="pg-demo-card__title">{{ t('pg.voiceDemo.title') }}</h3>
      <p class="pg-demo-card__desc">{{ t('pg.voiceDemo.description') }}</p>
    </header>

    <div class="pg-voice-toolbar">
      <button
        type="button"
        class="pg-voice-toggle"
        :class="{ 'pg-voice-toggle--on': autoSpeak }"
        :aria-pressed="autoSpeak"
        @click="toggle()"
      >
        {{ t('pg.voiceDemo.autoSpeak') }}：
        {{
          autoSpeak
            ? t('pg.voiceDemo.autoSpeakOn')
            : t('pg.voiceDemo.autoSpeakOff')
        }}
      </button>
      <span v-if="!micInput.supported" class="pg-voice-mic-unsupported">
        {{ t('pg.voiceDemo.micUnsupported') }}
      </span>
    </div>

    <Conversation>
      <ConversationContent ref="chatAreaRef" @scroll="onScroll">
        <ConversationEmpty v-if="chat.messages.length === 0">
          <p class="pg-voice-empty">
            {{ t('pg.voiceDemo.inputPlaceholder') }}
          </p>
        </ConversationEmpty>
        <Message v-for="msg in chat.messages" :key="msg.id" :from="msg.role">
          <MessageContent
            :content="msg.content"
            :streaming="chat.isStreaming"
          />
          <MessageActions v-if="msg.role === 'assistant' && msg.content">
            <MessageActionCopy :text="msg.content" />
            <MessageActionSpeak :text="msg.content" />
          </MessageActions>
        </Message>
      </ConversationContent>
      <ConversationScrollBtn
        v-if="!isAtBottom && chat.messages.length > 0"
        @click="scrollToBottom"
      />
      <PromptInput send-key="enter" @send="onSend">
        <PromptInputBody>
          <PromptInputTextarea
            :placeholder="t('pg.voiceDemo.inputPlaceholder')"
          />
        </PromptInputBody>
        <template #footer>
          <PromptInputFooter>
            <template #tools>
              <PromptInputTools>
                <PromptInputMicButton />
              </PromptInputTools>
            </template>
            <template #hint>
              <PromptInputSubmit />
            </template>
          </PromptInputFooter>
        </template>
      </PromptInput>
    </Conversation>
  </section>
</template>

<style scoped>
.pg-voice-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}

.pg-voice-toggle {
  height: 30px;
  padding: 0 12px;
  border: 1px solid var(--ai-chat-color-border);
  border-radius: 999px;
  background: transparent;
  color: var(--ai-chat-color-text-secondary);
  font-size: 13px;
  cursor: pointer;
  transition:
    background var(--ai-chat-duration-fast) var(--ai-chat-easing),
    color var(--ai-chat-duration-fast) var(--ai-chat-easing);
}

.pg-voice-toggle--on {
  border-color: var(--ai-chat-color-accent);
  color: var(--ai-chat-color-accent);
}

.pg-voice-toggle:hover {
  background: var(--ai-chat-hover-neutral);
}

.pg-voice-mic-unsupported {
  font-size: 12px;
  color: var(--ai-chat-color-text-muted);
}

.pg-voice-empty {
  margin: 0;
  padding: 24px 16px;
  font-size: 13px;
  color: var(--ai-chat-color-text-muted);
}
</style>
