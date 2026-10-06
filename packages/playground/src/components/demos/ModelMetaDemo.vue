<script setup lang="ts">
import { computed } from 'vue'
import {
  detectModelVendor,
  groupModelsByVendor,
  formatPerMillion,
  formatTokenCost,
  pricingTier,
  type ModelPricing,
  type ModelVendor,
} from '@toimc/core'
import { ModelIcon, JsonDiffView, aiChatI18n } from '@toimc/vue'
import '../../locales' // 副作用：合并 pg 字典

const { t } = aiChatI18n.global

// ---------- ModelIcon：15 家厂商各一个代表模型 id + 1 个未知兜底 ----------
const vendorModels: { model: string; vendor: ModelVendor }[] = [
  { model: 'gpt-4o', vendor: 'openai' },
  { model: 'claude-sonnet-4', vendor: 'anthropic' },
  { model: 'gemini-2.5-pro', vendor: 'google' },
  { model: 'glm-4-plus', vendor: 'zhipu' },
  { model: 'qwen3-max', vendor: 'qwen' },
  { model: 'deepseek-chat', vendor: 'deepseek' },
  { model: 'mistral-large', vendor: 'mistral' },
  { model: 'llama-3.3-70b', vendor: 'meta' },
  { model: 'command-r-plus', vendor: 'cohere' },
  { model: 'yi-large', vendor: 'yi' },
  { model: 'grok-3', vendor: 'xai' },
  { model: 'kimi-k2', vendor: 'moonshot' },
  { model: 'doubao-pro-32k', vendor: 'doubao' },
  { model: 'minimax-text-01', vendor: 'minimax' },
  { model: 'ernie-4.5', vendor: 'wenxin' },
]

const vendorName = (v: ModelVendor) =>
  v === 'unknown'
    ? t('pg.modelMetaDemo.unknownVendor')
    : detectModelVendor(vendorModels.find((m) => m.vendor === v)!.model).label

// ---------- detectModelVendor 分组：含路由型 id 与未知 id ----------
const modelIdPool = [
  'gpt-4o-mini',
  'o3-mini',
  'claude-3.5-haiku',
  'openrouter/anthropic/claude-3.5-sonnet',
  'gemini-2.0-flash',
  'chatglm3-turbo',
  'qwen2.5-72b-instruct',
  'deepseek-r1',
  'mixtral-8x7b',
  'meta-llama/Llama-3.1-8B',
  'internal-llm-finetuned',
  'whisper-1',
]

const groups = computed(() => {
  const raw = groupModelsByVendor(modelIdPool)
  return (Object.keys(raw) as ModelVendor[])
    .filter((v) => raw[v].length > 0)
    .map((v) => ({
      vendor: v,
      label:
        v === 'unknown'
          ? t('pg.modelMetaDemo.unknownVendor')
          : detectModelVendor(raw[v][0]).label,
      models: raw[v],
    }))
})

// ---------- 定价格式化：$/1M 展示 + 一次对话成本试算（mock 演示价） ----------
interface PricingRow {
  model: string
  pricing: ModelPricing
  inputTokens: number
  outputTokens: number
}

const pricingRows: PricingRow[] = [
  {
    model: 'gpt-4o',
    pricing: { inputPerMTokens: 2.5, outputPerMTokens: 10 },
    inputTokens: 12000,
    outputTokens: 3000,
  },
  {
    model: 'gpt-4o-mini',
    pricing: { inputPerMTokens: 0.15, outputPerMTokens: 0.6 },
    inputTokens: 12000,
    outputTokens: 3000,
  },
  {
    model: 'claude-sonnet-4',
    pricing: { inputPerMTokens: 3, outputPerMTokens: 15 },
    inputTokens: 12000,
    outputTokens: 3000,
  },
  {
    model: 'deepseek-chat',
    pricing: { inputPerMTokens: 0.27, outputPerMTokens: 1.1 },
    inputTokens: 12000,
    outputTokens: 3000,
  },
  {
    model: 'internal-llm-finetuned',
    pricing: {},
    inputTokens: 12000,
    outputTokens: 3000,
  },
]

// computed 包一层：语言切换后档位标签跟随更新
const tierLabel = computed<Record<ReturnType<typeof pricingTier>, string>>(
  () => ({
    free: t('pg.modelMetaDemo.tierFree'),
    economy: t('pg.modelMetaDemo.tierEconomy'),
    standard: t('pg.modelMetaDemo.tierStandard'),
    premium: t('pg.modelMetaDemo.tierPremium'),
  }),
)

// ---------- JsonDiffView：工具参数前后对比 ----------
const oldArgs = {
  path: '/tmp/report-draft.md',
  mode: 'overwrite',
  tags: ['draft', 'rag'],
  retries: 1,
}
const newArgs = {
  path: '/tmp/report-final.md',
  mode: 'append',
  tags: ['final', 'rag', 'reviewed'],
  retries: 3,
  notify: true,
}
</script>

<template>
  <div class="model-meta-demo">
    <!-- 1. ModelIcon 品牌图标 -->
    <section class="model-meta-demo__section">
      <h3 class="model-meta-demo__title">
        {{ t('pg.modelMetaDemo.iconTitle') }}
      </h3>
      <p class="model-meta-demo__desc">{{ t('pg.modelMetaDemo.iconDesc') }}</p>
      <div class="model-meta-demo__icon-grid">
        <div
          v-for="item in vendorModels"
          :key="item.model"
          class="model-meta-demo__icon-cell"
          :title="`${item.model} → ${vendorName(item.vendor)}`"
        >
          <ModelIcon :model="item.model" :size="26" />
          <span class="model-meta-demo__icon-id">{{ item.model }}</span>
          <span class="model-meta-demo__icon-vendor">{{
            vendorName(item.vendor)
          }}</span>
        </div>
        <div class="model-meta-demo__icon-cell" title="unknown fallback">
          <ModelIcon model="internal-llm-finetuned" :size="26" />
          <span class="model-meta-demo__icon-id">internal-llm-…</span>
          <span class="model-meta-demo__icon-vendor">{{
            t('pg.modelMetaDemo.unknownVendor')
          }}</span>
        </div>
      </div>
    </section>

    <!-- 2. detectModelVendor 分组 -->
    <section class="model-meta-demo__section">
      <h3 class="model-meta-demo__title">
        {{ t('pg.modelMetaDemo.groupTitle') }}
      </h3>
      <p class="model-meta-demo__desc">{{ t('pg.modelMetaDemo.groupDesc') }}</p>
      <div class="model-meta-demo__groups">
        <div
          v-for="group in groups"
          :key="group.vendor"
          class="model-meta-demo__group"
        >
          <div class="model-meta-demo__group-head">
            <ModelIcon :model="group.models[0]" :size="16" />
            <span>{{ group.label }}</span>
            <span class="model-meta-demo__group-count">{{
              group.models.length
            }}</span>
          </div>
          <div class="model-meta-demo__chips">
            <code v-for="id in group.models" :key="id">{{ id }}</code>
          </div>
        </div>
      </div>
    </section>

    <!-- 3. 定价格式化 -->
    <section class="model-meta-demo__section">
      <h3 class="model-meta-demo__title">
        {{ t('pg.modelMetaDemo.pricingTitle') }}
      </h3>
      <p class="model-meta-demo__desc">
        {{ t('pg.modelMetaDemo.pricingDesc') }}
      </p>
      <div class="model-meta-demo__table-wrap">
        <table class="model-meta-demo__table">
          <thead>
            <tr>
              <th>{{ t('pg.modelMetaDemo.colModel') }}</th>
              <th>{{ t('pg.modelMetaDemo.colInput') }}</th>
              <th>{{ t('pg.modelMetaDemo.colOutput') }}</th>
              <th>{{ t('pg.modelMetaDemo.colTier') }}</th>
              <th>{{ t('pg.modelMetaDemo.colCost') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in pricingRows" :key="row.model">
              <td>
                <span class="model-meta-demo__model-cell">
                  <ModelIcon :model="row.model" :size="16" />
                  <code>{{ row.model }}</code>
                </span>
              </td>
              <td>{{ formatPerMillion(row.pricing.inputPerMTokens) }}</td>
              <td>{{ formatPerMillion(row.pricing.outputPerMTokens) }}</td>
              <td>
                <span
                  class="model-meta-demo__tier"
                  :class="`model-meta-demo__tier--${pricingTier(row.pricing)}`"
                >
                  {{ tierLabel[pricingTier(row.pricing)] }}
                </span>
              </td>
              <td>
                {{
                  formatTokenCost(
                    row.pricing,
                    row.inputTokens,
                    row.outputTokens,
                  )
                }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="model-meta-demo__note">
        {{ t('pg.modelMetaDemo.pricingNote') }}
      </p>
    </section>

    <!-- 4. JsonDiffView 工具参数对比 -->
    <section class="model-meta-demo__section">
      <h3 class="model-meta-demo__title">
        {{ t('pg.modelMetaDemo.diffTitle') }}
      </h3>
      <p class="model-meta-demo__desc">{{ t('pg.modelMetaDemo.diffDesc') }}</p>
      <JsonDiffView :old-value="oldArgs" :new-value="newArgs" />
    </section>
  </div>
</template>

<style scoped>
.model-meta-demo {
  max-width: 960px;
  margin: 0 auto;
  padding: 20px 20px 48px;
}

.model-meta-demo__section {
  margin-bottom: 32px;
}

.model-meta-demo__title {
  margin: 0 0 4px;
  font-size: 15px;
  font-weight: 600;
  color: var(--vp-c-text-1);
}

.model-meta-demo__desc {
  margin: 0 0 14px;
  font-size: 13px;
  color: var(--vp-c-text-3);
}

.model-meta-demo__note {
  margin: 10px 0 0;
  font-size: 12px;
  color: var(--vp-c-text-3);
}

.model-meta-demo__icon-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 10px;
}

.model-meta-demo__icon-cell {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  padding: 12px;
  border: 1px solid var(--vp-c-border);
  border-radius: 10px;
  background: var(--vp-c-bg-soft);
}

.model-meta-demo__icon-id {
  font-size: 12px;
  font-family: var(--vp-font-family-mono, monospace);
  color: var(--vp-c-text-1);
  word-break: break-all;
}

.model-meta-demo__icon-vendor {
  font-size: 11.5px;
  color: var(--vp-c-text-3);
}

.model-meta-demo__groups {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.model-meta-demo__group {
  padding: 10px 14px;
  border: 1px solid var(--vp-c-border);
  border-radius: 10px;
  background: var(--vp-c-bg-soft);
}

.model-meta-demo__group-head {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--vp-c-text-1);
}

.model-meta-demo__group-count {
  padding: 0 8px;
  border-radius: 999px;
  background: var(--vp-c-gray-soft, rgba(128, 128, 128, 0.14));
  font-size: 11px;
  font-weight: 500;
  color: var(--vp-c-text-2);
}

.model-meta-demo__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}

.model-meta-demo__chips code {
  padding: 2px 8px;
  border-radius: 6px;
  background: var(--vp-c-default-soft, rgba(128, 128, 128, 0.1));
  font-size: 12px;
  color: var(--vp-c-text-2);
}

.model-meta-demo__table-wrap {
  overflow-x: auto;
  border: 1px solid var(--vp-c-border);
  border-radius: 10px;
}

.model-meta-demo__table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.model-meta-demo__table th,
.model-meta-demo__table td {
  padding: 8px 12px;
  border-bottom: 1px solid var(--vp-c-divider);
  text-align: left;
  white-space: nowrap;
}

.model-meta-demo__table th {
  background: var(--vp-c-bg-soft);
  font-weight: 600;
  color: var(--vp-c-text-2);
}

.model-meta-demo__table tr:last-child td {
  border-bottom: none;
}

.model-meta-demo__model-cell {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.model-meta-demo__tier {
  display: inline-block;
  padding: 1px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 500;
}

.model-meta-demo__tier--free {
  background: rgba(22, 163, 74, 0.14);
  color: #16a34a;
}

.model-meta-demo__tier--economy {
  background: rgba(37, 99, 235, 0.12);
  color: #2563eb;
}

.model-meta-demo__tier--standard {
  background: rgba(128, 128, 128, 0.16);
  color: var(--vp-c-text-2);
}

.model-meta-demo__tier--premium {
  background: rgba(202, 138, 4, 0.16);
  color: #ca8a04;
}
</style>
