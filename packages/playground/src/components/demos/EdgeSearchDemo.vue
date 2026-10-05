<script setup lang="ts">
import { computed, ref } from 'vue'
import { aiChatI18n } from '@toimc/vue'
import '../../locales' // 副作用：合并 pg 字典
import { MODEL_ID } from '../../semantic/edge-embedder'
import { createSemanticSearch } from '../../semantic/useSemanticSearch'
import type { SearchableConversation } from '../../semantic/pure'

const { t } = aiChatI18n.global

/** 演示会话库：标题字面与常见查询错开，才能看出「按字面找」vs「按意思找」 */
const CONVERSATIONS: SearchableConversation[] = [
  {
    id: 'e1',
    title: '聊聊 AI 交互体验',
    messages: [
      {
        role: 'user',
        content:
          'AI 聊天界面的长列表消息越滚越卡，虚拟列表和分页加载哪个更合适？想优化浏览器渲染性能',
      },
    ],
  },
  {
    id: 'e2',
    title: '组件库主题定制',
    messages: [
      {
        role: 'user',
        content: '暗色模式下颜色不对，CSS 变量应该怎么分层组织？',
      },
    ],
  },
  {
    id: 'e3',
    title: '接口联调踩坑',
    messages: [
      {
        role: 'user',
        content: 'SSE 流式输出中途断连，浏览器端怎么自动重连续传？',
      },
    ],
  },
  {
    id: 'e4',
    title: '周报模板整理',
    messages: [
      {
        role: 'user',
        content: '帮我把这周的工作整理成周报，分进展、风险、计划三段',
      },
    ],
  },
  {
    id: 'e5',
    title: 'Vite 构建优化',
    messages: [
      { role: 'user', content: 'vite build 产物太大，怎么按需加载和分包？' },
    ],
  },
  {
    id: 'e6',
    title: '旅行计划',
    messages: [
      {
        role: 'user',
        content: '国庆去成都玩三天，帮我排个行程，想吃本地人去的馆子',
      },
    ],
  },
  {
    id: 'e7',
    title: '表单校验方案',
    messages: [
      {
        role: 'user',
        content: '复杂表单的异步校验和错误提示交互怎么做比较优雅？',
      },
    ],
  },
  {
    id: 'e8',
    title: '读《精益创业》笔记',
    messages: [
      {
        role: 'user',
        content: 'MVP 最小可行产品那一章的要点，帮我提炼成行动清单',
      },
    ],
  },
]

/** 示例查询：第一条是 18-03 的杀手锏场景（关键字 0 命中、语义命中 e1） */
const EXAMPLES = ['浏览器性能优化', '夜间模式颜色怎么改', '断网重连', '去哪玩']

const engine = createSemanticSearch({ conversations: () => CONVERSATIONS })
const query = ref('')

/* ---------------- 懒加载：首次聚焦搜索框才触发 ---------------- */

const warmedUp = ref(false)
function onSearchFocus(): void {
  if (warmedUp.value) return
  warmedUp.value = true
  void engine.warmUp()
}

/* ---------------- 检索 ---------------- */

async function runSearch(text?: string): Promise<void> {
  const q = (text ?? query.value).trim()
  if (!q || engine.searching.value) return
  query.value = q
  await engine.search(q)
}

/* ---------------- 展示派生 ---------------- */

const byId = computed(() => new Map(CONVERSATIONS.map((c) => [c.id, c])))
function titleOf(id: string): string {
  return byId.value.get(id)?.title ?? id
}

const statusText = computed(() => {
  switch (engine.embedder.status.value) {
    case 'loading':
      return t('pg.edge.statusLoading', {
        progress: engine.embedder.progress.value,
      })
    case 'ready':
      return t('pg.edge.statusReady')
    case 'error':
      return t('pg.edge.statusError')
    default:
      return t('pg.edge.statusIdle')
  }
})

const deviceText = computed(() =>
  engine.embedder.device.value === 'webgpu'
    ? t('pg.edge.deviceWebgpu')
    : t('pg.edge.deviceWasm'),
)

const showProgress = computed(() => engine.embedder.status.value === 'loading')

function scoreOf(score: number): string {
  return score.toFixed(2)
}
</script>

<template>
  <div class="esd">
    <header class="esd-header">
      <div class="esd-title-row">
        <h2 class="esd-title">{{ t('pg.edge.title') }}</h2>
        <span class="esd-status" :data-status="engine.embedder.status.value">{{
          statusText
        }}</span>
      </div>
      <p class="esd-desc">{{ t('pg.edge.description') }}</p>

      <!-- 引擎 chips：模型 / 设备 / 缓存 -->
      <div class="esd-chips">
        <span class="esd-chip esd-chip--mono">{{ MODEL_ID }} · q8</span>
        <span
          v-if="engine.embedder.status.value !== 'idle'"
          class="esd-chip"
          :data-device="engine.embedder.device.value"
          >{{ t('pg.edge.deviceLabel') }}：{{ deviceText }}</span
        >
        <span v-if="engine.embedder.cached.value !== null" class="esd-chip">{{
          engine.embedder.cached.value
            ? t('pg.edge.cachedChip')
            : t('pg.edge.firstLoadChip')
        }}</span>
      </div>

      <!-- 下载进度条 -->
      <div v-if="showProgress" class="esd-progress" role="progressbar">
        <div class="esd-progress-bar">
          <div
            class="esd-progress-fill"
            :style="{ width: `${engine.embedder.progress.value}%` }"
          />
        </div>
        <span class="esd-progress-text">{{ statusText }}</span>
      </div>

      <p class="esd-lazy-hint">{{ t('pg.edge.lazyHint') }}</p>
    </header>

    <!-- 降级横幅：三级降级落底时的如实提示 -->
    <p v-if="engine.degraded.value" class="esd-degraded">
      {{ t('pg.edge.degraded') }}
    </p>

    <!-- 示例查询 + 搜索框（首次聚焦触发懒加载） -->
    <div class="esd-examples">
      <span class="esd-examples-label">{{ t('pg.edge.examples') }}</span>
      <button
        v-for="ex in EXAMPLES"
        :key="ex"
        type="button"
        class="esd-example"
        @click="runSearch(ex)"
      >
        {{ ex }}
      </button>
    </div>

    <div class="esd-search">
      <input
        v-model="query"
        class="esd-input"
        type="text"
        :placeholder="t('pg.edge.placeholder')"
        @focus="onSearchFocus"
        @keydown.enter="runSearch()"
      />
      <button
        type="button"
        class="esd-submit"
        :disabled="engine.searching.value"
        @click="runSearch()"
      >
        {{
          engine.searching.value ? t('pg.edge.searching') : t('pg.edge.search')
        }}
      </button>
    </div>

    <!-- 双轨对比：按字面找 vs 按意思找 -->
    <div class="esd-lanes">
      <section class="esd-lane">
        <h3 class="esd-lane-title">
          {{ t('pg.edge.laneKeyword') }}
          <span class="esd-lane-count">{{
            engine.keywordResults.value.length
          }}</span>
        </h3>
        <p v-if="engine.keywordResults.value.length === 0" class="esd-no-hit">
          {{ t('pg.edge.noHit') }}
        </p>
        <ul v-else class="esd-results">
          <li
            v-for="r in engine.keywordResults.value"
            :key="`k-${r.id}`"
            class="esd-result"
          >
            <span class="esd-result-title">{{ titleOf(r.id) }}</span>
            <span class="esd-result-score">{{ scoreOf(r.score) }}</span>
          </li>
        </ul>
      </section>

      <section class="esd-lane esd-lane--semantic">
        <h3 class="esd-lane-title">
          {{ t('pg.edge.laneSemantic') }}
          <span class="esd-lane-count">{{
            engine.semanticResults.value.length
          }}</span>
        </h3>
        <p
          v-if="
            engine.embedder.status.value !== 'ready' && !engine.degraded.value
          "
          class="esd-wait"
        >
          {{ t('pg.edge.noModelYet') }}
        </p>
        <p
          v-else-if="engine.semanticResults.value.length === 0"
          class="esd-no-hit"
        >
          {{ t('pg.edge.noHit') }}
        </p>
        <ul v-else class="esd-results">
          <li
            v-for="r in engine.semanticResults.value"
            :key="`s-${r.id}`"
            class="esd-result"
          >
            <span class="esd-result-title">{{ titleOf(r.id) }}</span>
            <span class="esd-result-score">{{ scoreOf(r.score) }}</span>
          </li>
        </ul>
        <p v-if="engine.timing.value" class="esd-timing">
          {{
            t('pg.edge.timing', {
              embed: engine.timing.value.embedMs,
              scan: engine.timing.value.scanMs,
            })
          }}
        </p>
      </section>
    </div>

    <!-- 会话库：向量入库状态一览 -->
    <section class="esd-corpus">
      <h3 class="esd-corpus-title">
        {{ t('pg.edge.conversationsTitle') }}
        <span class="esd-lane-count">
          {{
            engine.indexing.value
              ? t('pg.edge.indexing')
              : t('pg.edge.indexedCount', {
                  indexed: engine.indexedCount.value,
                  total: CONVERSATIONS.length,
                })
          }}
        </span>
      </h3>
      <p class="esd-corpus-desc">{{ t('pg.edge.conversationsDesc') }}</p>
      <ul class="esd-corpus-list">
        <li
          v-for="c in CONVERSATIONS"
          :key="c.id"
          class="esd-corpus-item"
          :data-indexed="engine.isIndexed(c.id)"
        >
          <span class="esd-corpus-title-text">{{ c.title }}</span>
          <span class="esd-corpus-snippet">{{
            c.messages[0]?.content.slice(0, 42) + '…'
          }}</span>
          <span class="esd-corpus-badge">{{
            engine.isIndexed(c.id)
              ? t('pg.edge.convIndexed')
              : t('pg.edge.convPending')
          }}</span>
        </li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.esd {
  max-width: 960px;
  margin: 0 auto;
  padding: 20px 20px 48px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.esd-title-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.esd-title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
}

.esd-status {
  font-size: 12px;
  padding: 2px 10px;
  border-radius: 999px;
  background: rgba(128, 128, 128, 0.15);
  white-space: nowrap;
}
.esd-status[data-status='ready'] {
  color: #16a34a;
}
.esd-status[data-status='error'] {
  color: #dc2626;
}
.esd-status[data-status='loading'] {
  color: var(--ai-chat-color-accent-600, #4f46e5);
}

.esd-desc {
  margin: 0;
  font-size: 14px;
  line-height: 1.7;
  opacity: 0.8;
}

.esd-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.esd-chip {
  font-size: 12px;
  padding: 3px 10px;
  border-radius: 6px;
  background: rgba(128, 128, 128, 0.15);
}
.esd-chip--mono {
  font-family: var(--ai-chat-font-mono, monospace);
}
.esd-chip[data-device='webgpu'] {
  background: rgba(99, 102, 241, 0.12);
  color: var(--ai-chat-color-accent-600, #4f46e5);
}

/* ---------- 下载进度条 ---------- */

.esd-progress {
  display: flex;
  align-items: center;
  gap: 10px;
}

.esd-progress-bar {
  flex: 1;
  height: 6px;
  border-radius: 999px;
  background: rgba(128, 128, 128, 0.2);
  overflow: hidden;
}

.esd-progress-fill {
  height: 100%;
  border-radius: 999px;
  background: var(--ai-chat-color-accent-500, #6366f1);
  transition: width 0.2s;
}

.esd-progress-text {
  font-size: 12px;
  white-space: nowrap;
  color: var(--ai-chat-color-accent-600, #4f46e5);
}

.esd-lazy-hint {
  margin: 0;
  font-size: 12px;
  opacity: 0.6;
}

/* ---------- 降级横幅 ---------- */

.esd-degraded {
  margin: 0;
  font-size: 13px;
  padding: 8px 12px;
  border-radius: 8px;
  background: rgba(234, 179, 8, 0.12);
  color: #b45309;
}

/* ---------- 示例查询 ---------- */

.esd-examples {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.esd-examples-label {
  font-size: 12px;
  opacity: 0.6;
}

.esd-example {
  font-size: 12px;
  padding: 4px 12px;
  border-radius: 999px;
  border: 1px solid rgba(128, 128, 128, 0.35);
  background: transparent;
  color: inherit;
  cursor: pointer;
  transition: background 0.2s;
}
.esd-example:hover {
  background: rgba(128, 128, 128, 0.15);
}

/* ---------- 搜索框（固定同高 38px） ---------- */

.esd-search {
  display: flex;
  gap: 10px;
  align-items: center;
}

.esd-input {
  flex: 1;
  height: 38px;
  padding: 0 14px;
  font-size: 14px;
  border-radius: var(--ai-chat-radius-md, 8px);
  border: 1px solid rgba(128, 128, 128, 0.35);
  background: transparent;
  color: inherit;
  transition: border-color 0.15s;
}
.esd-input:focus {
  outline: none;
  border-color: var(--ai-chat-color-accent-500, #6366f1);
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15);
}

.esd-submit {
  display: inline-flex;
  align-items: center;
  height: 38px;
  padding: 0 20px;
  font-size: 14px;
  font-weight: 500;
  border: none;
  border-radius: var(--ai-chat-radius-md, 8px);
  background: var(--ai-chat-color-accent-500, #6366f1);
  color: #fff;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.15s;
}
.esd-submit:hover:not(:disabled) {
  background: var(--ai-chat-color-accent-600, #4f46e5);
}
.esd-submit:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

/* ---------- 双轨对比 ---------- */

.esd-lanes {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
@media (max-width: 720px) {
  .esd-lanes {
    grid-template-columns: 1fr;
  }
}

.esd-lane {
  border: 1px solid rgba(128, 128, 128, 0.25);
  border-radius: 10px;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.esd-lane--semantic {
  border-color: var(--ai-chat-color-accent-500, #6366f1);
}

.esd-lane-title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
}

.esd-lane-count {
  font-size: 12px;
  font-weight: 500;
  opacity: 0.6;
}

.esd-wait {
  margin: 0;
  font-size: 13px;
  opacity: 0.55;
}

.esd-no-hit {
  margin: 0;
  font-size: 13px;
  padding: 10px 12px;
  border-radius: 8px;
  background: rgba(220, 38, 38, 0.08);
  color: #dc2626;
}

.esd-results {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.esd-result {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  border: 1px solid rgba(128, 128, 128, 0.2);
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 13px;
}

.esd-result-title {
  font-weight: 500;
}

.esd-result-score {
  font-family: var(--ai-chat-font-mono, monospace);
  font-size: 12px;
  padding: 1px 8px;
  border-radius: 999px;
  background: rgba(99, 102, 241, 0.12);
  color: var(--ai-chat-color-accent-600, #4f46e5);
  white-space: nowrap;
}

.esd-timing {
  margin: 0;
  font-size: 12px;
  font-family: var(--ai-chat-font-mono, monospace);
  opacity: 0.65;
}

/* ---------- 会话库 ---------- */

.esd-corpus {
  border: 1px solid rgba(128, 128, 128, 0.25);
  border-radius: 10px;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.esd-corpus-title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
}

.esd-corpus-desc {
  margin: 0;
  font-size: 12px;
  opacity: 0.6;
}

.esd-corpus-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.esd-corpus-item {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  border: 1px solid rgba(128, 128, 128, 0.2);
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 13px;
}

.esd-corpus-item[data-indexed='true'] {
  border-color: rgba(34, 197, 94, 0.45);
}

.esd-corpus-title-text {
  font-weight: 500;
}

.esd-corpus-snippet {
  flex: 1;
  min-width: 200px;
  font-size: 12px;
  opacity: 0.6;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.esd-corpus-badge {
  font-size: 11px;
  padding: 1px 8px;
  border-radius: 999px;
  background: rgba(128, 128, 128, 0.15);
  opacity: 0.75;
  white-space: nowrap;
}
.esd-corpus-item[data-indexed='true'] .esd-corpus-badge {
  background: rgba(34, 197, 94, 0.15);
  color: #16a34a;
  opacity: 1;
}

@media (prefers-reduced-motion: reduce) {
  .esd-progress-fill,
  .esd-example,
  .esd-submit {
    transition: none;
  }
}
</style>
