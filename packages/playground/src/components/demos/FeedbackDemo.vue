<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import {
  Message,
  MessageContent,
  MessageActions,
  MessageActionCopy,
  MessageActionRetry,
  MessageActionEdit,
  MessageActionFeedback,
  BranchPicker,
  Welcome,
  Prompts,
  PromptInputSuggestion,
  aiChatI18n,
} from '@toimc/vue'
import type { PromptItem, SuggestionTrigger } from '@toimc/vue'
import '../../locales' // 副作用：合并 pg 字典

const { t } = aiChatI18n.global

// ---------- Welcome + Prompts：选提示词填入输入框 ----------
const promptItems = computed<PromptItem[]>(() => [
  {
    key: 'weekly',
    label: t('pg.feedbackDemo.promptWeekly'),
    description: t('pg.feedbackDemo.promptWeeklyDesc'),
    icon: '📝',
  },
  {
    key: 'explain',
    label: t('pg.feedbackDemo.promptExplain'),
    description: t('pg.feedbackDemo.promptExplainDesc'),
    icon: '💡',
  },
  {
    key: 'brainstorm',
    label: t('pg.feedbackDemo.promptBrainstorm'),
    description: t('pg.feedbackDemo.promptBrainstormDesc'),
    icon: '🚀',
  },
  {
    key: 'polish',
    label: t('pg.feedbackDemo.promptPolish'),
    description: t('pg.feedbackDemo.promptPolishDesc'),
    icon: '✨',
  },
])

const promptTexts: Record<string, string> = {
  weekly:
    '帮我把本周的工作整理成一份结构化周报，按「进展 / 风险 / 下周计划」分节。',
  explain: '逐行解释下面这段代码的作用与设计意图，并指出可以改进的地方。',
  brainstorm:
    '围绕「AI 组件库的差异化定位」头脑风暴 5 个方向，每个方向给一句理由。',
  polish: '润色这段产品文案，要求口语化、去 AI 味，保留技术术语。',
}

// ---------- 输入框 + PromptInputSuggestion（受控：text / caret 由宿主维护） ----------
const inputText = ref('')
const caret = ref(0)
const anchor = ref<HTMLElement | null>(null)
const textareaEl = ref<HTMLTextAreaElement | null>(null)

const triggers = computed<SuggestionTrigger[]>(() => [
  {
    char: '/',
    items: [
      {
        key: 'summary',
        label: t('pg.feedbackDemo.cmdSummary'),
        description: t('pg.feedbackDemo.cmdSummaryDesc'),
      },
      {
        key: 'translate',
        label: t('pg.feedbackDemo.cmdTranslate'),
        description: t('pg.feedbackDemo.cmdTranslateDesc'),
      },
      {
        key: 'table',
        label: t('pg.feedbackDemo.cmdTable'),
        description: t('pg.feedbackDemo.cmdTableDesc'),
      },
      {
        key: 'polish',
        label: t('pg.feedbackDemo.cmdPolish'),
        description: t('pg.feedbackDemo.cmdPolishDesc'),
      },
    ],
  },
  {
    char: '@',
    items: [
      { key: 'docs', label: t('pg.feedbackDemo.atDocs') },
      { key: 'guide', label: t('pg.feedbackDemo.atGuide') },
      { key: 'faq', label: t('pg.feedbackDemo.atFaq') },
    ],
  },
])

function syncCaret(e: Event) {
  caret.value = (e.target as HTMLTextAreaElement).selectionStart
}

async function onSuggestionSelect(_item: unknown, nextText: string) {
  inputText.value = nextText
  caret.value = nextText.length
  await nextTick()
  // 光标复位由宿主处理：同步回 textarea，保持后续解析一致
  if (textareaEl.value) {
    textareaEl.value.selectionStart = textareaEl.value.selectionEnd =
      caret.value
  }
}

// ---------- 对话区：消息操作四件 + 分支翻页 ----------
const userContent = ref('MessageFeedback 怎么接入？')

const retryPool = [
  '最小接入：`<MessageFeedback :value="v" @change="v = $event" @comment="onComment" />`，一行模板完成采集闭环。',
  '上报失败建议静默重试、不打断对话——组件是纯 UI 状态件，不做任何 API 调用。',
]

const branches = ref([
  '反馈闭环三步：**采集**（点赞 / 点踩）→ **细化**（点踩后的评论框）→ **上报**（宿主在 `change` / `comment` 事件里持久化）。',
  '`value` 是受控回显口，传入历史反馈即同步显示；`change` 为 toggle 语义——再点同值取消（回传 `null`）。',
  '放进 `MessageActions` 行时透传 `data-always-visible`：行本身 hover 才显示，反馈按钮需要常显。',
])
const activeBranch = ref(0)
const feedbackValue = ref<'up' | 'down' | null>(null)

// ---------- 事件日志（宿主侧上报演示） ----------
const logs = ref<string[]>([])

function fillInput(item: PromptItem) {
  inputText.value = promptTexts[item.key] ?? item.label
  caret.value = inputText.value.length
  textareaEl.value?.focus()
}

function send() {
  const text = inputText.value.trim()
  if (!text) return
  userContent.value = text
  logs.value.unshift(t('pg.feedbackDemo.logSent', { text }))
  inputText.value = ''
  caret.value = 0
}

function onRetry() {
  const next = retryPool[branches.value.length % retryPool.length]
  branches.value.push(next)
  activeBranch.value = branches.value.length - 1
  logs.value.unshift(
    t('pg.feedbackDemo.logRegenerated', { n: branches.value.length }),
  )
}

function onEdit(text: string) {
  userContent.value = text
  logs.value.unshift(t('pg.feedbackDemo.logEdited', { text }))
}

function onFeedbackChange(value: 'up' | 'down' | null) {
  feedbackValue.value = value
  const key =
    value === 'up'
      ? 'pg.feedbackDemo.logUp'
      : value === 'down'
        ? 'pg.feedbackDemo.logDown'
        : 'pg.feedbackDemo.logCleared'
  logs.value.unshift(t(key))
}

function onComment(text: string) {
  logs.value.unshift(t('pg.feedbackDemo.logComment', { text }))
}
</script>

<template>
  <div class="feedback-demo">
    <!-- 1. Welcome + Prompts：选提示词填入下方输入框 -->
    <section class="feedback-demo__section feedback-demo__section--welcome">
      <Welcome :description="t('pg.feedbackDemo.welcomeDesc')">
        <Prompts :items="promptItems" wrap @select="fillInput" />
        <template #extra>
          <span class="feedback-demo__welcome-extra">
            {{ t('pg.feedbackDemo.welcomeExtra') }}
          </span>
        </template>
      </Welcome>
    </section>

    <!-- 2. 输入框：输入 / 或 @ 体验内联建议 -->
    <section class="feedback-demo__section">
      <div ref="anchor" class="feedback-demo__input-wrap">
        <textarea
          ref="textareaEl"
          v-model="inputText"
          rows="3"
          class="feedback-demo__textarea"
          :placeholder="t('pg.feedbackDemo.inputPlaceholder')"
          @selectionchange="syncCaret"
          @keyup="syncCaret"
          @click="syncCaret"
        />
        <div class="feedback-demo__input-bar">
          <span class="feedback-demo__input-hint">{{
            t('pg.feedbackDemo.inputHint')
          }}</span>
          <button class="feedback-demo__btn" @click="send">
            {{ t('pg.feedbackDemo.send') }}
          </button>
        </div>
        <PromptInputSuggestion
          :text="inputText"
          :caret="caret"
          :triggers="triggers"
          :anchor="anchor"
          @select="onSuggestionSelect"
        />
      </div>
    </section>

    <!-- 3. 消息操作四件 + 分支翻页 -->
    <section class="feedback-demo__section">
      <h3 class="feedback-demo__title">{{ t('pg.feedbackDemo.convTitle') }}</h3>
      <p class="feedback-demo__desc">{{ t('pg.feedbackDemo.convDesc') }}</p>

      <!-- 用户消息：原位编辑 -->
      <Message from="user">
        <MessageActionEdit :initial-text="userContent" @edit="onEdit" />
      </Message>

      <!-- AI 消息：分支翻页 + Copy / Retry / Feedback -->
      <Message from="assistant">
        <BranchPicker
          :branch-count="branches.length"
          :active-branch="activeBranch"
          @change="(i: number) => (activeBranch = i)"
        >
          <MessageContent :content="branches[activeBranch]" />
        </BranchPicker>
        <MessageActions>
          <MessageActionCopy :text="branches[activeBranch]" />
          <MessageActionRetry @retry="onRetry" />
          <MessageActionFeedback
            :value="feedbackValue"
            @change="onFeedbackChange"
            @comment="onComment"
          />
        </MessageActions>
      </Message>
    </section>

    <!-- 4. 事件日志：宿主侧上报演示 -->
    <section class="feedback-demo__section">
      <h3 class="feedback-demo__title">{{ t('pg.feedbackDemo.logTitle') }}</h3>
      <ul v-if="logs.length" class="feedback-demo__logs">
        <li v-for="(log, i) in logs" :key="`${i}-${log}`">{{ log }}</li>
      </ul>
      <p v-else class="feedback-demo__desc">
        {{ t('pg.feedbackDemo.logEmpty') }}
      </p>
    </section>
  </div>
</template>

<style scoped>
.feedback-demo {
  max-width: 960px;
  margin: 0 auto;
  padding: 20px 20px 48px;
}

.feedback-demo__section {
  margin-bottom: 30px;
}

.feedback-demo__section--welcome {
  border: 1px solid var(--vp-c-border);
  border-radius: 14px;
  padding: 8px;
  min-height: 300px;
}

.feedback-demo__title {
  margin: 0 0 4px;
  font-size: 15px;
  font-weight: 600;
  color: var(--vp-c-text-1);
}

.feedback-demo__desc {
  margin: 0 0 12px;
  font-size: 13px;
  color: var(--vp-c-text-3);
}

.feedback-demo__welcome-extra {
  font-size: 12.5px;
  color: var(--vp-c-text-3);
}

.feedback-demo__input-wrap {
  position: relative;
  border: 1px solid var(--vp-c-border);
  border-radius: 12px;
  background: var(--vp-c-bg-soft);
  padding: 10px 12px;
}

.feedback-demo__textarea {
  width: 100%;
  border: none;
  outline: none;
  resize: vertical;
  background: transparent;
  color: var(--vp-c-text-1);
  font-size: 14px;
  font-family: inherit;
  line-height: 1.6;
}

.feedback-demo__textarea::placeholder {
  color: var(--vp-c-text-3);
}

.feedback-demo__input-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 6px;
}

.feedback-demo__input-hint {
  font-size: 12px;
  color: var(--vp-c-text-3);
}

.feedback-demo__btn {
  padding: 6px 18px;
  border: 1px solid var(--vp-c-brand-1);
  border-radius: 8px;
  background: var(--vp-c-brand-1);
  color: #fff;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
}

.feedback-demo__logs {
  margin: 0;
  padding: 10px 14px;
  border: 1px solid var(--vp-c-border);
  border-radius: 10px;
  background: var(--vp-c-bg-soft);
  list-style: none;
  font-size: 12.5px;
  color: var(--vp-c-text-2);
}

.feedback-demo__logs li {
  padding: 3px 0;
  border-bottom: 1px dashed var(--vp-c-divider);
  word-break: break-all;
}

.feedback-demo__logs li:last-child {
  border-bottom: none;
}
</style>
