<script setup lang="ts">
import { computed, ref } from 'vue'
import type { ToolCallInfo } from '@toimc/core'
import { aiChatI18n } from '@toimc/vue'
import {
  isOrchestrationResult,
  type OrchestrationPattern,
  type OrchestrationResult,
  type StageRole,
} from './orchestration-types'
import '../../locales' // 副作用：合并 pg 字典

const props = defineProps<{
  /** orchestrate 工具的 ToolCallInfo；result 字段即 OrchestrationResult */
  data: ToolCallInfo
}>()

const { t } = aiChatI18n.global

/** 结构校验通过才渲染时间线；不符 → 原始 JSON 兜底（16-02 错误两层思路） */
const result = computed<OrchestrationResult | null>(() =>
  isOrchestrationResult(props.data.result) ? props.data.result : null,
)

const badgeLabel = computed(() => {
  const keys: Record<OrchestrationPattern, string> = {
    delegate: 'pg.multiAgent.card.badgeDelegate',
    parallel: 'pg.multiAgent.card.badgeParallel',
    pipeline: 'pg.multiAgent.card.badgePipeline',
  }
  return t(keys[result.value?.pattern ?? 'delegate'])
})

const roleLabels = computed<Record<StageRole, string>>(() => ({
  researcher: t('pg.multiAgent.card.roleResearcher'),
  writer: t('pg.multiAgent.card.roleWriter'),
  reviewer: t('pg.multiAgent.card.roleReviewer'),
}))

const totalDurationMs = computed(() =>
  (result.value?.stages ?? []).reduce((sum, s) => sum + s.durationMs, 0),
)

const fallbackJson = computed(() =>
  JSON.stringify(props.data.result ?? null, null, 2),
)

/** 各阶段产出默认收起；Set 的增删在 Vue 3 中是响应式操作 */
const expandedStages = ref(new Set<number>())

function toggleOutput(index: number): void {
  if (expandedStages.value.has(index)) expandedStages.value.delete(index)
  else expandedStages.value.add(index)
}
</script>

<template>
  <div class="collab-card">
    <template v-if="result">
      <header class="collab-card__head">
        <span class="collab-card__badge">{{ badgeLabel }}</span>
        <p class="collab-card__task" :title="result.task">{{ result.task }}</p>
        <span class="collab-card__meta">
          {{ t('pg.multiAgent.card.agentsCount', { n: result.stages.length }) }}
          ·
          {{ t('pg.multiAgent.card.totalDuration', { ms: totalDurationMs }) }}
        </span>
      </header>

      <p
        v-if="result.pattern === 'parallel'"
        class="collab-card__parallel-note"
      >
        {{ t('pg.multiAgent.card.parallelNote') }}
      </p>

      <ol
        class="collab-card__stages"
        :class="{
          'collab-card__stages--parallel': result.pattern === 'parallel',
        }"
      >
        <li
          v-for="(stage, i) in result.stages"
          :key="i"
          class="collab-card__stage"
          :data-status="stage.status"
        >
          <div class="collab-card__stage-row">
            <span class="collab-card__stage-dot" :data-status="stage.status" />
            <span class="collab-card__stage-role">
              {{ roleLabels[stage.role] }}
            </span>
            <span class="collab-card__stage-agent">{{ stage.agentId }}</span>
            <span class="collab-card__stage-model">{{ stage.model }}</span>
            <span class="collab-card__stage-duration">
              {{ stage.durationMs }} ms
            </span>
            <span v-if="stage.meta?.retried" class="collab-card__stage-retried">
              {{ t('pg.multiAgent.card.retried') }}
            </span>
            <span
              v-if="stage.meta?.verdict"
              class="collab-card__stage-verdict"
              :data-verdict="stage.meta.verdict"
            >
              {{
                stage.meta.verdict === 'pass'
                  ? t('pg.multiAgent.card.verdictPass')
                  : t('pg.multiAgent.card.verdictRevise')
              }}
            </span>
            <button
              v-if="stage.output"
              type="button"
              class="collab-card__stage-toggle"
              @click="toggleOutput(i)"
            >
              {{
                expandedStages.has(i)
                  ? t('pg.multiAgent.card.hideOutput')
                  : t('pg.multiAgent.card.showOutput')
              }}
            </button>
          </div>
          <p
            v-if="expandedStages.has(i) && stage.output"
            class="collab-card__stage-output"
          >
            {{ stage.output }}
          </p>
        </li>
      </ol>
    </template>

    <!-- result 未到（tool_call 流式中）：进行中态 -->
    <div
      v-else-if="props.data.result === undefined"
      class="collab-card__pending"
    >
      {{ t('pg.multiAgent.card.pending') }}
    </div>

    <!-- 结构不符：人话提示在上，原始 JSON 折叠在下 -->
    <div v-else class="collab-card__fallback">
      <p class="collab-card__fallback-title">
        {{ t('pg.multiAgent.card.invalidTitle') }}
      </p>
      <details class="collab-card__fallback-details">
        <summary class="collab-card__fallback-summary">JSON</summary>
        <pre class="collab-card__fallback-json">{{ fallbackJson }}</pre>
      </details>
    </div>
  </div>
</template>

<style scoped>
.collab-card {
  margin: 8px 0;
  border: 1px solid var(--ai-chat-border-color, #e2e8f0);
  border-radius: var(--ai-chat-radius-lg, 10px);
  overflow: hidden;
  font-size: 13px;
  background: var(--ai-chat-bg-color, #fff);
}

.collab-card__head {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  padding: 10px 12px;
  background: var(--ai-chat-color-bg-secondary, #f8fafc);
  border-bottom: 1px solid var(--ai-chat-border-color, #e2e8f0);
}

.collab-card__badge {
  flex-shrink: 0;
  padding: 2px 8px;
  border-radius: 999px;
  font-weight: 600;
  color: var(--ai-chat-color-text-on-accent, #fff);
  background: var(--ai-chat-color-accent, #6366f1);
}

.collab-card__task {
  flex: 1 1 160px;
  min-width: 0;
  margin: 0;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.collab-card__meta {
  flex-shrink: 0;
  font-size: 12px;
  color: var(--ai-chat-color-text-muted, #9ca3af);
}

.collab-card__parallel-note {
  margin: 0;
  padding: 6px 12px;
  font-size: 12px;
  color: var(--ai-chat-color-text-muted, #9ca3af);
  border-bottom: 1px dashed var(--ai-chat-border-color, #e2e8f0);
}

.collab-card__stages {
  list-style: none;
  margin: 0;
  padding: 4px 0;
}

/* 串行形态：时间线（左侧细线 + 状态点） */
.collab-card__stage {
  position: relative;
  padding: 6px 12px 6px 14px;
  border-left: 2px solid var(--ai-chat-border-color, #e2e8f0);
  margin-left: 10px;
}

.collab-card__stage-dot {
  position: absolute;
  left: -5px;
  top: 12px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--ai-chat-color-status-success, #10b981);
}

.collab-card__stage-dot[data-status='error'] {
  background: var(--ai-chat-color-status-error, #ef4444);
}

.collab-card__stage-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.collab-card__stage-role {
  font-weight: 600;
}

.collab-card__stage-agent,
.collab-card__stage-model {
  font-size: 12px;
  color: var(--ai-chat-color-text-muted, #9ca3af);
}

.collab-card__stage-model {
  padding: 1px 6px;
  border-radius: 4px;
  background: rgba(128, 128, 128, 0.15);
}

.collab-card__stage-duration {
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  color: var(--ai-chat-color-text-muted, #9ca3af);
}

.collab-card__stage-retried {
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 12px;
  background: rgba(245, 158, 11, 0.15);
  color: var(--ai-chat-color-status-warning, #f59e0b);
}

.collab-card__stage-verdict {
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 12px;
  background: rgba(16, 185, 129, 0.12);
  color: var(--ai-chat-color-status-success, #10b981);
}

.collab-card__stage-verdict[data-verdict='revise'] {
  background: rgba(239, 68, 68, 0.1);
  color: var(--ai-chat-color-status-error, #ef4444);
}

.collab-card__stage-toggle {
  margin-left: auto;
  border: none;
  background: transparent;
  padding: 2px 6px;
  font-size: 12px;
  cursor: pointer;
  color: var(--ai-chat-color-accent, #6366f1);
}

.collab-card__stage-toggle:hover {
  text-decoration: underline;
}

.collab-card__stage-output {
  margin: 6px 0 2px;
  padding: 8px 10px;
  border-radius: 6px;
  background: var(--ai-chat-color-bg-secondary, #f8fafc);
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.6;
}

/* 并行形态：三路并列（窄容器自动换列），顶部色条体现并发 */
.collab-card__stages--parallel {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 8px;
  padding: 10px 12px;
}

.collab-card__stages--parallel .collab-card__stage {
  margin-left: 0;
  border-left: none;
  border-top: 2px solid var(--ai-chat-color-accent, #6366f1);
  border-radius: 6px;
  background: var(--ai-chat-color-bg-secondary, #f8fafc);
  padding: 8px 10px;
}

.collab-card__stages--parallel .collab-card__stage-dot {
  position: static;
  display: inline-block;
}

.collab-card__stages--parallel .collab-card__stage[data-status='error'] {
  border-top-color: var(--ai-chat-color-status-error, #ef4444);
}

.collab-card__pending {
  padding: 12px;
  font-size: 13px;
  color: var(--ai-chat-color-text-muted, #9ca3af);
}

.collab-card__fallback {
  padding: 10px 12px;
}

.collab-card__fallback-title {
  margin: 0 0 6px;
  font-size: 13px;
  color: var(--ai-chat-color-status-error, #ef4444);
}

.collab-card__fallback-summary {
  cursor: pointer;
  font-size: 12px;
  color: var(--ai-chat-color-text-muted, #9ca3af);
}

.collab-card__fallback-json {
  margin: 6px 0 0;
  padding: 8px;
  border-radius: 6px;
  background: var(--ai-chat-color-bg-secondary, #f8fafc);
  font-size: 12px;
  line-height: 1.5;
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-word;
}

@media (max-width: 480px) {
  .collab-card__task {
    flex-basis: 100%;
  }
}
</style>
