<script setup lang="ts">
import { ref, computed } from 'vue'
import { aiChatI18n } from '../locales'

const { t } = aiChatI18n.global

interface Props {
  content?: string
  duration?: number // 思考耗时（毫秒）
  showDuration?: boolean // 是否显示思考时长
  streaming?: boolean // 是否正在流式更新
}

const props = withDefaults(defineProps<Props>(), {
  showDuration: true,
  streaming: false,
})

// 流式时内容实时展示，完成后自动折叠为触发器
const isExpanded = ref(false)

// 时长格式化：<10s 保留 1 位小数，≥10s 取整
const formattedDuration = computed(() => {
  if (!props.duration || props.duration <= 0) return ''
  const seconds = props.duration / 1000
  return seconds >= 10
    ? `${Math.round(seconds)}`
    : `${Number(seconds.toFixed(1))}`
})

// 触发器文案：流式 → 正在思考…；完成且有耗时 → 已思考 X 秒；否则 → 思考过程
const headerLabel = computed(() => {
  if (props.streaming) return t('thinking.thinking')
  if (props.showDuration && formattedDuration.value) {
    return t('thinking.thoughtFor', { duration: formattedDuration.value })
  }
  return t('thinking.title')
})

function toggleExpand() {
  isExpanded.value = !isExpanded.value
}
</script>

<template>
  <div
    class="ai-chat-thinking"
    :class="{
      'ai-chat-thinking--expanded': isExpanded,
      'ai-chat-thinking--streaming': streaming,
    }"
  >
    <button
      type="button"
      class="ai-chat-thinking__trigger"
      @click="toggleExpand"
    >
      <svg
        class="ai-chat-thinking__icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path
          d="M12 3l1.9 5.8a2 2 0 0 0 1.3 1.3L21 12l-5.8 1.9a2 2 0 0 0-1.3 1.3L12 21l-1.9-5.8a2 2 0 0 0-1.3-1.3L3 12l5.8-1.9a2 2 0 0 0 1.3-1.3L12 3z"
        />
      </svg>
      <span class="ai-chat-thinking__label">{{ headerLabel }}</span>
      <svg
        class="ai-chat-thinking__chevron"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </button>

    <transition name="ai-chat-thinking">
      <!-- 思考文本恒渲染，默认插槽追加在其后（工具面板等），无插槽时视觉不变 -->
      <div v-if="isExpanded || streaming" class="ai-chat-thinking__body">
        {{ content }}<slot></slot
        ><span v-if="streaming" class="ai-chat-thinking__cursor" />
      </div>
    </transition>
  </div>
</template>

<!-- scoped 不包 @layer（style-isolation 例外条款）：宿主全局 reset（如 VitePress base.css
     的未分层 button{padding:0;color:inherit}）优先级高于所有层，会打穿层内声明；
     scoped 的 data-v 属性选择器在未分层域内比特异性，天然免疫 -->
<style scoped>
.ai-chat-thinking {
  margin-bottom: 10px;
}

/* 触发器：低调的行内文字按钮，hover 才出现背景 */
.ai-chat-thinking__trigger {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 8px 3px 6px;
  margin-left: -6px; /* 补偿左侧 padding，与消息正文视觉对齐 */
  border: none;
  border-radius: 6px;
  background: transparent;
  font: inherit;
  font-size: 12.5px;
  line-height: 1;
  color: var(--ai-chat-color-text-muted);
  cursor: pointer;
  user-select: none;
  transition:
    background-color var(--ai-chat-duration-fast) var(--ai-chat-easing),
    color var(--ai-chat-duration-fast) var(--ai-chat-easing);
}

.ai-chat-thinking__trigger:hover {
  background: rgba(128, 128, 128, 0.15);
  color: var(--ai-chat-color-text-secondary);
}

.ai-chat-thinking__trigger:focus-visible {
  outline: 2px solid var(--ai-chat-color-accent);
  outline-offset: 1px;
}

.ai-chat-thinking__icon {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
}

/* 流式中的图标：accent 色 + 轻呼吸 */
.ai-chat-thinking--streaming .ai-chat-thinking__icon {
  color: var(--ai-chat-color-accent);
  animation: ai-chat-thinking-breathe 2s ease-in-out infinite;
}

@keyframes ai-chat-thinking-breathe {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.45;
  }
}

.ai-chat-thinking__label {
  white-space: nowrap;
}

.ai-chat-thinking__chevron {
  width: 12px;
  height: 12px;
  flex-shrink: 0;
  transition: transform 0.2s var(--ai-chat-easing);
}

.ai-chat-thinking--expanded .ai-chat-thinking__chevron {
  transform: rotate(180deg);
}

/* 展开内容：左侧细线 + 缩进的引用式排版 */
.ai-chat-thinking__body {
  margin: 6px 0 2px;
  padding-left: 12px;
  border-left: 2px solid var(--ai-chat-color-border);
  font-size: 13px;
  line-height: 1.65;
  color: var(--ai-chat-color-text-secondary);
  white-space: pre-wrap;
  word-break: break-word;
}

.ai-chat-thinking__cursor {
  display: inline-block;
  width: 2px;
  height: 13px;
  margin-left: 2px;
  vertical-align: -2px;
  background: var(--ai-chat-color-accent);
  animation: ai-chat-thinking-blink 1s step-end infinite;
}

@keyframes ai-chat-thinking-blink {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0;
  }
}

/* 展开/收起：fade + 微位移，高度直接铺开保持干净 */
.ai-chat-thinking-enter-active {
  transition:
    opacity 0.25s var(--ai-chat-easing),
    transform 0.25s var(--ai-chat-easing);
}

.ai-chat-thinking-leave-active {
  transition:
    opacity 0.18s var(--ai-chat-easing),
    transform 0.18s var(--ai-chat-easing);
}

.ai-chat-thinking-enter-from,
.ai-chat-thinking-leave-to {
  opacity: 0;
  transform: translateY(-3px);
}

@media (prefers-reduced-motion: reduce) {
  .ai-chat-thinking__icon,
  .ai-chat-thinking__cursor {
    animation: none;
  }

  .ai-chat-thinking__chevron,
  .ai-chat-thinking__trigger {
    transition: none;
  }
}
</style>
