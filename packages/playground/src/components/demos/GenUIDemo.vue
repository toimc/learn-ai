<script setup lang="ts">
import { ref, watch, nextTick, onMounted } from 'vue'
import { useChat } from '@toimc/core'
import type { UISchema } from '@toimc/core'
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
  GenUIRenderer,
  WeatherCard,
  PlanActions,
  PromptInput,
  PromptInputBody,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTools,
  PromptInputButton,
  registerGenuiComponent,
} from '@toimc/vue'
import { createSseAdapter, checkHealth } from '../../mock/sse-adapter'
import '../../locales' // 副作用：合并 pg 字典

const { t } = aiChatI18n.global

// 入口三行注册：白名单由宿主决定（幂等，重复调用只是覆盖同键）
registerGenuiComponent('weather-card', WeatherCard)
registerGenuiComponent('plan-actions', PlanActions)

// ===== 静态演示：PlanActions 与 adopt 事件（无需服务） =====
// schema 形状 = 工具 execute 返回值里的 ui 字段（确定性生成，模型只决定调不调工具）
const planSchema: UISchema = {
  type: 'plan-actions',
  props: {
    plans: [
      {
        id: 'plan-vercel',
        title: 'Vercel 边缘部署',
        summary: '零配置、免费额度充足，适合文档站与轻量应用',
      },
      {
        id: 'plan-docker',
        title: 'Docker + 云服务器',
        summary: '可控性强、数据自持，适合有合规要求的项目',
      },
    ],
  },
}

// adopt 上抛演示：组件只上报 planId，业务动作由宿主决定
const adoptedId = ref<string | null>(null)
function onAdopt(planId: string) {
  adoptedId.value = planId
}

// ===== 实时聊天：天气卡片经 MessageContent toolCalls 接线 =====
const serverOnline = ref<boolean | null>(null)

const chat = useChat(createSseAdapter())

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

function onSend(payload: { text: string }) {
  void chat.send(payload.text)
}

onMounted(async () => {
  serverOnline.value = await checkHealth()
})
</script>

<template>
  <section class="pg-demo-card">
    <header class="pg-demo-card__header">
      <h3 class="pg-demo-card__title">{{ t('pg.genuiDemo.title') }}</h3>
      <p class="pg-demo-card__desc">{{ t('pg.genuiDemo.description') }}</p>
    </header>

    <!-- 静态演示：schema → 注册表 → 真实组件 + adopt 事件上抛 -->
    <div class="pg-genui-static">
      <h4 class="pg-genui-static__title">
        {{ t('pg.genuiDemo.staticTitle') }}
      </h4>
      <p class="pg-genui-static__desc">{{ t('pg.genuiDemo.staticDesc') }}</p>
      <div class="pg-genui-static__stage">
        <GenUIRenderer :schema="planSchema" @adopt="onAdopt" />
        <p v-if="adoptedId" class="pg-genui-static__adopted" role="status">
          {{ t('pg.genuiDemo.adopted', { planId: adoptedId }) }}
        </p>
      </div>
    </div>

    <!-- 实时聊天：weather-card 经 MessageContent 的 toolCalls 渲染区 -->
    <div class="pg-genui-live">
      <div class="pg-genui-live__head">
        <h4 class="pg-genui-live__title">{{ t('pg.genuiDemo.liveTitle') }}</h4>
        <span
          class="pg-genui-live__status"
          :class="{
            'pg-genui-live__status--online': serverOnline === true,
            'pg-genui-live__status--offline': serverOnline === false,
          }"
        >
          {{
            serverOnline === null
              ? '…'
              : serverOnline
                ? t('pg.genuiDemo.statusOnline')
                : t('pg.genuiDemo.statusOffline')
          }}
        </span>
      </div>
      <p class="pg-genui-live__desc">{{ t('pg.genuiDemo.liveDesc') }}</p>
      <p v-if="serverOnline === false" class="pg-genui-live__offline">
        {{ t('pg.genuiDemo.offlineHint') }}
      </p>

      <Conversation>
        <ConversationContent ref="chatAreaRef" @scroll="onScroll">
          <ConversationEmpty v-if="chat.messages.length === 0">
            <p class="pg-genui-live__empty">{{ t('pg.genuiDemo.liveDesc') }}</p>
          </ConversationEmpty>
          <Message v-for="msg in chat.messages" :key="msg.id" :from="msg.role">
            <MessageContent
              :content="msg.content"
              :thinking="msg.thinking"
              :streaming="chat.isStreaming"
              :tool-calls="msg.toolCalls"
            />
            <MessageActions v-if="msg.role === 'assistant' && msg.content">
              <MessageActionCopy :text="msg.content" />
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
              :placeholder="t('pg.genuiDemo.inputPlaceholder')"
            />
          </PromptInputBody>
          <template #footer>
            <PromptInputFooter>
              <template #tools>
                <PromptInputTools>
                  <PromptInputButton
                    :title="t('pg.genuiDemo.quickAsk')"
                    @click="onSend({ text: t('pg.genuiDemo.quickAsk') })"
                  >
                    {{ t('pg.genuiDemo.quickAsk') }}
                  </PromptInputButton>
                </PromptInputTools>
              </template>
              <template #hint>
                <PromptInputSubmit />
              </template>
            </PromptInputFooter>
          </template>
        </PromptInput>
      </Conversation>
    </div>
  </section>
</template>

<style scoped>
.pg-demo-card {
  max-width: 960px;
  margin: 0 auto;
  padding: 20px 20px 48px;
}

.pg-genui-static {
  margin: 16px 0;
  padding: 16px;
  border: 1px solid var(--ai-chat-color-border);
  border-radius: var(--ai-chat-radius-lg);
}

.pg-genui-static__title,
.pg-genui-live__title {
  margin: 0 0 6px;
  font-size: 15px;
  font-weight: 600;
  color: var(--ai-chat-color-text-primary);
}

.pg-genui-static__desc,
.pg-genui-live__desc {
  margin: 0 0 12px;
  font-size: 13px;
  line-height: 1.6;
  color: var(--ai-chat-color-text-secondary);
}

.pg-genui-static__stage {
  max-width: 420px;
}

.pg-genui-static__adopted {
  margin: 10px 0 0;
  padding: 6px 10px;
  border-radius: var(--ai-chat-radius-md);
  background: var(--ai-chat-hover-neutral);
  font-size: 13px;
  color: var(--ai-chat-color-accent);
  width: fit-content;
}

.pg-genui-live__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 6px;
}

.pg-genui-live__status {
  flex-shrink: 0;
  font-size: 12px;
  color: var(--ai-chat-color-text-muted);
}

.pg-genui-live__status--online {
  color: #16a34a;
}

.pg-genui-live__status--offline {
  color: #dc2626;
}

.pg-genui-live__offline {
  margin: 0 0 8px;
  padding: 8px 12px;
  border-radius: var(--ai-chat-radius-md);
  background: var(--ai-chat-hover-neutral);
  font-size: 12px;
  line-height: 1.6;
  color: var(--ai-chat-color-text-secondary);
}

.pg-genui-live__empty {
  margin: 0;
  padding: 24px 16px;
  font-size: 13px;
  color: var(--ai-chat-color-text-muted);
}
</style>
