<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { aiChatI18n } from '@toimc/vue'
import '../../locales' // 副作用：合并 pg 字典

const { t } = aiChatI18n.global

const BASE_URL = 'http://localhost:8787'

/** 与 dev-server /vector 路由的返回形状一致（服务端 types 不跨包，前端独立声明） */
interface SearchResultItem {
  source: string
  title: string
  snippet: string
  score: number
  matchedTerms: string[]
}

interface VectorStats {
  enabled: boolean
  model?: string
  url?: string
  indexExists?: boolean
  chunks?: number
  dimension?: number
  error?: string
  vector?: { engine: string; location: string }
}

interface VectorSearchResponse {
  query: string
  keyword: { results: SearchResultItem[] }
  hybrid: { results: SearchResultItem[]; mode: string }
  mode: string
  degradedReason: string | null
  timing: {
    keyword: { keywordMs: number; vectorMs: number; totalMs: number }
    hybrid: { keywordMs: number; vectorMs: number; totalMs: number }
  }
}

/** 示例查询：演示内容（中文文档语料下中文 query 才有对比意义），非 UI 文案不进字典 */
const EXAMPLES = [
  '怎么让组件库支持英文',
  '消息对比',
  '夜间模式下颜色不对',
  '聊天气泡怎么改圆角',
]

type ServerStatus = 'connecting' | 'online' | 'offline'
const status = ref<ServerStatus>('connecting')
const stats = ref<VectorStats | null>(null)

const query = ref('')
const searching = ref(false)
const response = ref<VectorSearchResponse | null>(null)
const searchedQuery = ref('')

/** 语义轨就绪：服务在线 + embedding 已配置 + 索引已建 */
const ready = computed(
  () =>
    status.value === 'online' &&
    stats.value?.enabled === true &&
    stats.value.indexExists === true,
)

const statusText = computed(() =>
  status.value === 'online'
    ? t('pg.vector.statusOnline')
    : status.value === 'connecting'
      ? t('pg.vector.statusConnecting')
      : t('pg.vector.statusOffline'),
)

/** 嵌入端点 host（链路节点随 EMBEDDING_MODEL_URL 如实展示本地/云端） */
const embeddingHost = computed(() => {
  const raw = stats.value?.url ?? 'http://localhost:11434/v1'
  try {
    return new URL(raw).host
  } catch {
    return raw
  }
})

const isLocalEmbedding = computed(() =>
  ['localhost', '127.0.0.1', '[::1]'].some((h) =>
    embeddingHost.value.startsWith(h),
  ),
)

async function refreshStats(): Promise<void> {
  status.value = 'connecting'
  try {
    const res = await window.fetch(`${BASE_URL}/api/vector/stats`)
    stats.value = (await res.json()) as VectorStats
    status.value = 'online'
  } catch {
    stats.value = null
    status.value = 'offline'
  }
}

async function search(text: string): Promise<void> {
  const q = text.trim()
  if (!q || searching.value) return
  query.value = q
  searching.value = true
  response.value = null
  try {
    const res = await window.fetch(`${BASE_URL}/api/vector/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: q }),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    response.value = (await res.json()) as VectorSearchResponse
    searchedQuery.value = q
  } catch {
    response.value = null
  } finally {
    searching.value = false
  }
}

onMounted(refreshStats)
</script>

<template>
  <div class="vsd">
    <header class="vsd-header">
      <div class="vsd-title-row">
        <h2 class="vsd-title">{{ t('pg.vector.title') }}</h2>
        <span class="vsd-status" :data-status="status">{{ statusText }}</span>
      </div>
      <p class="vsd-desc">{{ t('pg.vector.description') }}</p>

      <!-- 索引统计 chips -->
      <div v-if="ready" class="vsd-stats">
        <span class="vsd-chip">🧠 {{ stats?.model }}</span>
        <span class="vsd-chip"
          >📦 {{ stats?.chunks }} {{ t('pg.vector.statsChunks') }}</span
        >
        <span class="vsd-chip"
          >📐 {{ stats?.dimension }} {{ t('pg.vector.statsDimension') }}</span
        >
      </div>

      <!-- 未就绪引导：离线 / 未配置 / 索引未建 三种 -->
      <div v-else class="vsd-guide">
        <template v-if="status === 'offline'">
          <p class="vsd-guide-title">{{ t('pg.vector.offlineTitle') }}</p>
          <p class="vsd-guide-body">{{ t('pg.vector.offlineHint') }}</p>
        </template>
        <template v-else-if="stats && !stats.enabled">
          <p class="vsd-guide-title">{{ t('pg.vector.notEnabledTitle') }}</p>
          <p class="vsd-guide-body">{{ t('pg.vector.notEnabledHint') }}</p>
        </template>
        <template v-else-if="stats && !stats.indexExists">
          <p class="vsd-guide-title">{{ t('pg.vector.noIndexTitle') }}</p>
          <p class="vsd-guide-body">{{ t('pg.vector.noIndexHint') }}</p>
          <p v-if="stats.error" class="vsd-guide-error">{{ stats.error }}</p>
        </template>
      </div>
    </header>

    <!-- 查询区（离线时禁用；未就绪仍可查，双路会一致展示关键词基线） -->
    <div class="vsd-search" :class="{ 'is-disabled': status === 'offline' }">
      <input
        v-model="query"
        class="vsd-input"
        type="text"
        :placeholder="t('pg.vector.inputPlaceholder')"
        :disabled="status === 'offline'"
        @keydown.enter="search(query)"
      />
      <button
        type="button"
        class="vsd-submit"
        :disabled="searching || status === 'offline'"
        @click="search(query)"
      >
        {{ searching ? t('pg.vector.searching') : t('pg.vector.search') }}
      </button>
    </div>

    <div class="vsd-examples">
      <span class="vsd-examples-label">{{ t('pg.vector.examples') }}</span>
      <button
        v-for="ex in EXAMPLES"
        :key="ex"
        type="button"
        class="vsd-example"
        :disabled="status === 'offline'"
        @click="search(ex)"
      >
        {{ ex }}
      </button>
    </div>

    <!-- 降级提示条 -->
    <p v-if="response?.degradedReason" class="vsd-degraded">
      {{ t('pg.vector.degraded', { reason: response.degradedReason }) }}
    </p>

    <!-- 调用链路：查询后激活并显示各节点实时耗时 -->
    <section class="vsd-chain" :class="{ 'is-active': !!response }">
      <h3 class="vsd-chain-title">{{ t('pg.vector.chainTitle') }}</h3>
      <p class="vsd-chain-desc">{{ t('pg.vector.chainDesc') }}</p>

      <div class="vsd-chain-node vsd-chain-head">
        <span class="vsd-node"
          >🌐 {{ t('pg.vector.nodeBrowser')
          }}<small>{{ t('pg.vector.nodeBrowserSub') }}</small></span
        >
        <span class="vsd-chain-arrow">→</span>
        <span class="vsd-node"
          >⚡ {{ t('pg.vector.nodeServer')
          }}<small>{{ t('pg.vector.nodeServerSub') }}</small></span
        >
      </div>

      <div class="vsd-chain-split">
        <div class="vsd-chain-branch">
          <span class="vsd-node">
            📄 {{ t('pg.vector.nodeKeyword')
            }}<small>{{ t('pg.vector.nodeKeywordSub') }}</small>
          </span>
          <span v-if="response" class="vsd-ms"
            >{{ response.timing.keyword.keywordMs }}ms</span
          >
        </div>
        <div
          class="vsd-chain-branch"
          :class="{
            'is-degraded': !!response?.degradedReason,
            'is-off': ready === false,
          }"
        >
          <span class="vsd-node">
            {{ isLocalEmbedding ? '🧠' : '☁️' }} {{ embeddingHost }}
            <em
              class="vsd-node-badge"
              :class="{ 'is-cloud': !isLocalEmbedding }"
              >{{
                isLocalEmbedding
                  ? t('pg.vector.chainLocal')
                  : t('pg.vector.chainCloud')
              }}</em
            >
            <small
              >{{ stats?.model || '—' }} ·
              {{ t('pg.vector.nodeOllamaSub') }}</small
            >
          </span>
          <span class="vsd-chain-arrow">→</span>
          <span class="vsd-node">
            🗃️ {{ stats?.vector?.engine || 'LibSQLVector'
            }}<small
              >{{ stats?.vector?.location || 'docs-vector.db' }} · top8</small
            >
          </span>
          <span v-if="response" class="vsd-ms"
            >{{ response.timing.hybrid.vectorMs }}ms</span
          >
        </div>
      </div>

      <div class="vsd-chain-node">
        <span class="vsd-node">
          ⚖️ {{ t('pg.vector.nodeFuse')
          }}<small>{{ t('pg.vector.nodeFuseSub') }}</small>
        </span>
        <span v-if="response" class="vsd-ms"
          >{{ response.timing.hybrid.totalMs }}ms</span
        >
        <span v-else class="vsd-chain-idle">{{
          t('pg.vector.chainIdle')
        }}</span>
      </div>
    </section>

    <!-- 两路对比 -->
    <div v-if="response" class="vsd-lanes">
      <section class="vsd-lane">
        <h3 class="vsd-lane-title">
          {{ t('pg.vector.keywordLane') }}
          <span class="vsd-lane-count">{{
            response.keyword.results.length
          }}</span>
        </h3>
        <p v-if="response.keyword.results.length === 0" class="vsd-no-hit">
          {{ t('pg.vector.noHit') }}
        </p>
        <ul v-else class="vsd-results">
          <li
            v-for="r in response.keyword.results"
            :key="`k-${r.source}`"
            class="vsd-result"
          >
            <div class="vsd-result-head">
              <span class="vsd-result-source">{{ r.source }}</span>
              <span class="vsd-result-score">{{ r.score }}</span>
            </div>
            <div v-if="r.matchedTerms.length" class="vsd-result-terms">
              <span
                v-for="term in r.matchedTerms"
                :key="term"
                class="vsd-term"
                >{{ term }}</span
              >
            </div>
            <p class="vsd-result-snippet">{{ r.snippet.slice(0, 140) }}</p>
          </li>
        </ul>
      </section>

      <section class="vsd-lane vsd-lane--hybrid">
        <h3 class="vsd-lane-title">
          {{ t('pg.vector.hybridLane') }}
          <span class="vsd-lane-badge" :data-mode="response.mode">
            {{
              response.mode === 'hybrid'
                ? t('pg.vector.modeHybrid')
                : t('pg.vector.modeKeyword')
            }}
          </span>
          <span class="vsd-lane-count">{{
            response.hybrid.results.length
          }}</span>
        </h3>
        <p v-if="response.hybrid.results.length === 0" class="vsd-no-hit">
          {{ t('pg.vector.noHit') }}
        </p>
        <ul v-else class="vsd-results">
          <li
            v-for="r in response.hybrid.results"
            :key="`h-${r.source}`"
            class="vsd-result"
          >
            <div class="vsd-result-head">
              <span class="vsd-result-source">{{ r.source }}</span>
              <span class="vsd-result-score">{{ r.score }}</span>
            </div>
            <div v-if="r.matchedTerms.length" class="vsd-result-terms">
              <span
                v-for="term in r.matchedTerms"
                :key="term"
                class="vsd-term"
                >{{ term }}</span
              >
            </div>
            <p class="vsd-result-snippet">{{ r.snippet.slice(0, 140) }}</p>
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>

<style scoped>
.vsd {
  max-width: 960px;
  margin: 0 auto;
  padding: 20px 20px 48px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.vsd-title-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.vsd-title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
}

.vsd-status {
  font-size: 12px;
  padding: 2px 10px;
  border-radius: 999px;
  background: rgba(128, 128, 128, 0.15);
}
.vsd-status[data-status='online'] {
  color: #16a34a;
}
.vsd-status[data-status='offline'] {
  color: #dc2626;
}

.vsd-desc {
  margin: 0;
  font-size: 14px;
  line-height: 1.7;
  opacity: 0.8;
}

.vsd-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.vsd-chip {
  font-size: 12px;
  padding: 3px 10px;
  border-radius: 6px;
  background: rgba(128, 128, 128, 0.15);
}

.vsd-guide {
  border: 1px dashed rgba(128, 128, 128, 0.4);
  border-radius: 8px;
  padding: 14px 16px;
}

.vsd-guide-title {
  margin: 0 0 6px;
  font-weight: 600;
  font-size: 14px;
}

.vsd-guide-body {
  margin: 0;
  font-size: 13px;
  line-height: 1.8;
  opacity: 0.75;
}

.vsd-guide-error {
  margin: 8px 0 0;
  font-size: 12px;
  color: #dc2626;
  word-break: break-all;
}

.vsd-search {
  display: flex;
  gap: 10px;
  align-items: center;
}
.vsd-search.is-disabled {
  opacity: 0.5;
}

/* 输入框与按钮固定同高（38px），不依赖 padding 撑开 */
.vsd-input {
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
.vsd-input:focus {
  outline: none;
  border-color: var(--ai-chat-color-accent-500, #6366f1);
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15);
}

.vsd-submit {
  height: 38px;
  padding: 0 22px;
  font-size: 14px;
  font-weight: 500;
  border: none;
  border-radius: var(--ai-chat-radius-md, 8px);
  background: var(--ai-chat-color-accent-500, #6366f1);
  color: #fff;
  cursor: pointer;
  white-space: nowrap;
  transition:
    background 0.15s,
    transform 0.1s;
}
.vsd-submit:hover:not(:disabled) {
  background: var(--ai-chat-color-accent-600, #4f46e5);
}
.vsd-submit:active:not(:disabled) {
  transform: scale(0.97);
}
.vsd-submit:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.vsd-examples {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.vsd-examples-label {
  font-size: 12px;
  opacity: 0.6;
}

.vsd-example {
  font-size: 12px;
  padding: 4px 12px;
  border-radius: 999px;
  border: 1px solid rgba(128, 128, 128, 0.35);
  background: transparent;
  color: inherit;
  cursor: pointer;
}
.vsd-example:hover {
  background: rgba(128, 128, 128, 0.15);
}

.vsd-chain {
  border: 1px solid rgba(128, 128, 128, 0.25);
  border-radius: 10px;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.vsd-chain-title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
}

.vsd-chain-desc {
  margin: -6px 0 0;
  font-size: 12px;
  line-height: 1.7;
  opacity: 0.7;
}

.vsd-chain-node,
.vsd-chain-split {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}

.vsd-chain-split {
  flex-direction: column;
  align-items: stretch;
  gap: 8px;
  border-left: 2px solid rgba(128, 128, 128, 0.3);
  padding-left: 14px;
  margin-left: 8px;
}

.vsd-chain-branch {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}

.vsd-node {
  display: inline-flex;
  flex-direction: column;
  gap: 2px;
  padding: 6px 12px;
  border: 1px solid rgba(128, 128, 128, 0.3);
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  background: rgba(128, 128, 128, 0.06);
  transition:
    border-color 0.2s,
    background 0.2s;
}

.vsd-node small {
  font-size: 11px;
  font-weight: 400;
  opacity: 0.65;
}

/* 查询后链路激活：节点亮 accent */
.vsd-chain.is-active .vsd-node {
  border-color: var(--ai-chat-color-accent-500, #6366f1);
  background: rgba(99, 102, 241, 0.08);
}

/* 降级/未启用：语义路弱化 */
.vsd-chain-branch.is-degraded .vsd-node,
.vsd-chain-branch.is-off .vsd-node {
  border-color: rgba(234, 179, 8, 0.6);
  background: rgba(234, 179, 8, 0.06);
}

.vsd-node-badge {
  font-size: 10px;
  font-style: normal;
  font-weight: 600;
  padding: 0 6px;
  margin-left: 6px;
  border-radius: 4px;
  background: rgba(34, 197, 94, 0.15);
  color: #16a34a;
  align-self: center;
}

.vsd-node-badge.is-cloud {
  background: rgba(59, 130, 246, 0.15);
  color: #2563eb;
}

.vsd-chain-arrow {
  font-size: 14px;
  opacity: 0.45;
}

.vsd-ms {
  font-size: 12px;
  font-weight: 600;
  font-family: var(--ai-chat-font-mono, monospace);
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(99, 102, 241, 0.12);
  color: var(--ai-chat-color-accent-600, #4f46e5);
}

.vsd-chain-idle {
  font-size: 12px;
  opacity: 0.55;
}

.vsd-degraded {
  margin: 0;
  font-size: 13px;
  padding: 8px 12px;
  border-radius: 8px;
  background: rgba(234, 179, 8, 0.12);
  color: #b45309;
}

.vsd-lanes {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
@media (max-width: 720px) {
  .vsd-lanes {
    grid-template-columns: 1fr;
  }
}

.vsd-lane {
  border: 1px solid rgba(128, 128, 128, 0.25);
  border-radius: 10px;
  padding: 14px 16px;
}
.vsd-lane--hybrid {
  border-color: var(--ai-chat-color-accent-500, #6366f1);
}

.vsd-lane-title {
  margin: 0 0 10px;
  font-size: 14px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
}

.vsd-lane-badge {
  font-size: 11px;
  font-weight: 500;
  padding: 1px 8px;
  border-radius: 999px;
  background: rgba(99, 102, 241, 0.15);
  color: var(--ai-chat-color-accent-600, #4f46e5);
}
.vsd-lane-badge[data-mode='keyword'] {
  background: rgba(128, 128, 128, 0.15);
  color: inherit;
  opacity: 0.75;
}

.vsd-lane-count {
  font-size: 12px;
  font-weight: 500;
  opacity: 0.6;
}

.vsd-no-hit {
  margin: 0;
  font-size: 13px;
  padding: 10px 12px;
  border-radius: 8px;
  background: rgba(220, 38, 38, 0.08);
  color: #dc2626;
}

.vsd-results {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.vsd-result {
  border: 1px solid rgba(128, 128, 128, 0.2);
  border-radius: 8px;
  padding: 10px 12px;
}

.vsd-result-head {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  font-size: 12px;
}

.vsd-result-source {
  font-family: var(--ai-chat-font-mono, monospace);
  font-weight: 600;
  word-break: break-all;
}

.vsd-result-score {
  opacity: 0.65;
  white-space: nowrap;
}

.vsd-result-terms {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 6px;
}

.vsd-term {
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 4px;
  background: rgba(99, 102, 241, 0.12);
}

.vsd-result-snippet {
  margin: 8px 0 0;
  font-size: 12px;
  line-height: 1.6;
  opacity: 0.7;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
