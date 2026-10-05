<script setup lang="ts">
import { computed, ref, watch, watchEffect } from 'vue'
import { aiChatI18n } from '@toimc/vue'
import { copyText } from '@toimc/core'
import {
  renderCodeStreaming,
  renderCodeFinal,
} from '../composables/useShikiTokenizer'
import { splitHighlightedLines } from '../utils/split-lines'

const { t } = aiChatI18n.global

const props = withDefaults(
  defineProps<{
    /** 代码块内容（围栏完整） */
    code: string
    /** 语言标识（别名会被归一，未知语言降级纯文本） */
    language?: string
    /** 是否仍在流式输出：true 合并 unstable 让尾行可见；false 调 close 收尾 */
    streaming?: boolean
    /** 显示行号，默认 false */
    showLineNumbers?: boolean
    /** 超过 collapsibleAfter 行显示折叠（展开/收起按钮），默认 0 = 不折叠 */
    collapsibleAfter?: number
  }>(),
  // language/streaming 显式 undefined：满足 vue/require-default-prop，行为不变
  {
    language: undefined,
    streaming: undefined,
    showLineNumbers: false,
    collapsibleAfter: 0,
  },
)

/** 高亮后的 HTML（token 级 span 串），异步填充 */
const highlighted = ref<string>('')

/** 复制反馈：点击后短暂切换为「已复制」态 */
const copied = ref(false)
let copyTimer: ReturnType<typeof setTimeout> | undefined

// 流式竞态守卫：仅最后一次 run 的结果可写入，避免旧 token 覆盖新结果
let runId = 0

async function copyCode() {
  // copyText（@toimc/core）降级链：clipboard API → textarea + execCommand；
  // 非安全上下文等全链路失败时返回 false，静默放弃（不进已复制态）
  if (!(await copyText(props.code))) return
  copied.value = true
  if (copyTimer) clearTimeout(copyTimer)
  copyTimer = setTimeout(() => {
    copied.value = false
  }, 1500)
}

// watchEffect 自动追踪 props 依赖；async 内部 await，异常时回退空串
watchEffect(async () => {
  const { code, language, streaming } = props
  if (code === '') {
    highlighted.value = ''
    return
  }
  const myId = ++runId
  try {
    const html =
      streaming === false
        ? await renderCodeFinal(code, language ?? '')
        : await renderCodeStreaming(code, language ?? '')
    if (myId === runId) highlighted.value = html
  } catch {
    // 降级：清空高亮，保留 pre/code 结构
    if (myId === runId) highlighted.value = ''
  }
})

/** 高亮 HTML 按行拆分：跨行 token span 行尾闭合、下一行重开 */
const lines = computed(() => splitHighlightedLines(highlighted.value))

/** 是否可折叠：阈值有效 + 非流式（尾部行未定，折叠会切掉进行中的行）+ 超过阈值行 */
const canCollapse = computed(
  () =>
    props.collapsibleAfter > 0 &&
    props.streaming !== true &&
    lines.value.length > props.collapsibleAfter,
)

/** 展开态（仅 canCollapse 时生效）；code 更新后重置回折叠态 */
const expanded = ref(false)
watch(
  () => props.code,
  () => {
    expanded.value = false
  },
)

function toggleExpanded() {
  expanded.value = !expanded.value
}

/** 折叠态：只渲染前 collapsibleAfter 行 */
const visibleLines = computed(() =>
  canCollapse.value && !expanded.value
    ? lines.value.slice(0, props.collapsibleAfter)
    : lines.value,
)

const isCollapsed = computed(() => canCollapse.value && !expanded.value)

/** 行号或折叠需要逐行结构；默认路径保持整块 v-html，DOM 结构与历史版本一致 */
const usePerLine = computed(() => props.showLineNumbers || canCollapse.value)
</script>

<template>
  <div class="ai-chat-code-block" :class="{ 'is-collapsed': isCollapsed }">
    <div class="ai-chat-code-block__header">
      <span v-if="language" class="ai-chat-code-block__lang">{{
        language
      }}</span>
      <button
        type="button"
        class="ai-chat-code-block__copy"
        :class="{ 'is-copied': copied }"
        :title="copied ? t('shared.copied') : t('shared.copy')"
        @click="copyCode"
      >
        <!-- 复制图标 / 已复制对勾 -->
        <svg
          v-if="!copied"
          viewBox="0 0 24 24"
          width="14"
          height="14"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
        <svg
          v-else
          viewBox="0 0 24 24"
          width="14"
          height="14"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </button>
    </div>
    <!-- pre 对空白敏感：code/span 标签之间不得留模板空白文本节点 -->
    <pre class="ai-chat-code-block__pre"><code
        v-if="!usePerLine"
        class="ai-chat-code-block__code"
        v-html="highlighted"
      ></code><code
        v-else
        class="ai-chat-code-block__code"
      ><span
          v-for="(line, i) in visibleLines"
          :key="i"
          class="ai-chat-code-block__line"
        ><span
            v-if="showLineNumbers"
            class="ai-chat-code-block__ln"
          >{{ i + 1 }}</span><span
            class="ai-chat-code-block__lc"
            v-html="line || '\u00A0'"
          ></span></span></code></pre>
    <div v-if="canCollapse" class="ai-chat-code-block__toggle-row">
      <button
        type="button"
        class="ai-chat-code-block__toggle"
        @click="toggleExpanded"
      >
        <svg
          viewBox="0 0 24 24"
          width="12"
          height="12"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          :class="{ 'is-open': expanded }"
          aria-hidden="true"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
        {{ expanded ? t('codeBlock.collapse') : t('codeBlock.expand') }}
      </button>
    </div>
  </div>
</template>

<style>
@layer ai-chat-components {
  /* 容器：单一卡片，仅外层圆角；overflow:hidden 让 header 与 code 共享外层圆角，视觉合为一体 */
  .ai-chat-code-block {
    position: relative;
    margin: 12px 0;
    background: var(--ai-chat-color-code-bg, #1a1a1a);
    border: 1px solid var(--ai-chat-color-border, #2e2e2e);
    border-radius: var(--ai-chat-radius-md, 8px);
    overflow: hidden;
  }

  /* header：顶部信息条 + 右侧复制按钮，紧贴 code，下方一条分隔线 */
  .ai-chat-code-block .ai-chat-code-block__header {
    display: flex;
    align-items: center;
    padding: 6px 8px 6px 12px;
    font-size: 12px;
    line-height: 1;
    letter-spacing: 0.5px;
    text-transform: uppercase;
    color: var(--ai-chat-color-text-muted, #9ca3af);
    background: var(--ai-chat-color-code-header-bg, #242427);
    border-bottom: 1px solid var(--ai-chat-color-border, #2e2e2e);
  }

  /* 复制按钮：右对齐、弱化态，hover/已复制切换为强调色 */
  .ai-chat-code-block .ai-chat-code-block__copy {
    margin-left: auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    padding: 0;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: var(--ai-chat-color-text-muted, #9ca3af);
    cursor: pointer;
    transition:
      background var(--ai-chat-duration-fast, 0.12s),
      color var(--ai-chat-duration-fast, 0.12s);
  }
  .ai-chat-code-block .ai-chat-code-block__copy:hover {
    background: var(--ai-chat-hover-neutral, rgba(128, 128, 128, 0.15));
    color: var(--ai-chat-color-text-primary, #fafafa);
  }
  .ai-chat-code-block .ai-chat-code-block__copy:focus-visible {
    outline: 2px solid var(--ai-chat-color-accent, #6366f1);
    outline-offset: 1px;
  }
  .ai-chat-code-block .ai-chat-code-block__copy.is-copied {
    color: var(--ai-chat-color-accent, #6366f1);
  }

  /* pre 自身零 margin / 无边框 / 无圆角，紧贴 header；背景透明沿用容器 */
  /* 用 .ai-chat-code-block 父级提升特异性到 (0,2,0)，压制宿主 .ai-chat-message-content pre 等外泄规则 */
  .ai-chat-code-block .ai-chat-code-block__pre {
    margin: 0;
    padding: 12px 16px;
    background: transparent;
    border: none;
    border-radius: 0;
    overflow-x: auto;
    font-family: var(
      --ai-chat-font-mono,
      'SF Mono',
      'Fira Code',
      'Consolas',
      monospace
    );
    font-size: 13px;
    line-height: 1.6;
    /* 无 token 变量的裸文本回退色，随主题自适应 */
    color: var(--ai-chat-color-text-primary, #fafafa);
  }

  /* token span 读取自身携带的 --shiki-* 变量；项目默认为暗色（--shiki-dark），无需重新高亮 */
  .ai-chat-code-block .ai-chat-code-block__code span {
    color: var(--shiki-dark, var(--shiki-light, inherit));
  }

  /* 亮色主题覆盖（项目约定：默认暗色，[data-theme='light'] 为亮色） */
  [data-theme='light'] .ai-chat-code-block .ai-chat-code-block__code span {
    color: var(--shiki-light, var(--shiki-dark, inherit));
  }

  /* per-line 行结构（行号/折叠启用时）：行号列 + 内容列 */
  .ai-chat-code-block .ai-chat-code-block__line {
    display: flex;
    align-items: baseline;
  }

  /* 行号：sticky 钉在横向滚动区左侧；背景与代码区同色遮住滚过的内容 */
  .ai-chat-code-block .ai-chat-code-block__ln {
    position: sticky;
    left: 0;
    flex: none;
    width: 3ch;
    padding-right: 16px;
    text-align: right;
    user-select: none;
    background: var(--ai-chat-color-code-bg, #1a1a1a);
    color: var(--ai-chat-color-text-muted, #9ca3af);
  }

  /* 行内容：保留代码缩进的连续空格 */
  .ai-chat-code-block .ai-chat-code-block__lc {
    white-space: pre;
  }

  /* 折叠/展开按钮行：居中弱化按钮，紧贴代码区底部 */
  .ai-chat-code-block .ai-chat-code-block__toggle-row {
    display: flex;
    justify-content: center;
    padding: 2px 0 6px;
  }

  .ai-chat-code-block .ai-chat-code-block__toggle {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 12px;
    border: none;
    border-radius: 999px;
    background: transparent;
    color: var(--ai-chat-color-text-muted, #9ca3af);
    font-size: 12px;
    line-height: 1;
    cursor: pointer;
    transition:
      background var(--ai-chat-duration-fast, 0.12s),
      color var(--ai-chat-duration-fast, 0.12s);
  }
  .ai-chat-code-block .ai-chat-code-block__toggle:hover {
    background: var(--ai-chat-hover-neutral, rgba(128, 128, 128, 0.15));
    color: var(--ai-chat-color-text-primary, #fafafa);
  }
  .ai-chat-code-block .ai-chat-code-block__toggle:focus-visible {
    outline: 2px solid var(--ai-chat-color-accent, #6366f1);
    outline-offset: 1px;
  }
  .ai-chat-code-block .ai-chat-code-block__toggle svg {
    transition: transform var(--ai-chat-duration-fast, 0.12s);
  }
  .ai-chat-code-block .ai-chat-code-block__toggle svg.is-open {
    transform: rotate(180deg);
  }

  /* 折叠态：代码区底部渐隐，暗示下方还有内容；mask 不占布局、不随横向滚动移动 */
  .ai-chat-code-block.is-collapsed .ai-chat-code-block__pre {
    -webkit-mask-image: linear-gradient(to bottom, black 65%, transparent);
    mask-image: linear-gradient(to bottom, black 65%, transparent);
  }
}
</style>
