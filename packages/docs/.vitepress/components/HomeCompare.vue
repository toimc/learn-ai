<script setup lang="ts">
/**
 * 首页竞品对比表。数据快照 2026-10（star / 下载量经 GitHub API 与 npm registry
 * 实测），竞品迭代快，页脚标注截止时间；「未核实」的字段一律不进表格。
 */
interface Row {
  label: string
  us: string
  items: [string, string, string] // assistant-ui / AI Elements / CopilotKit
}

const columns = [
  { name: 'AI Chat UI', sub: '@toimc · 本库', us: true },
  { name: 'assistant-ui', sub: '12.4k star' },
  { name: 'Vercel AI Elements', sub: '2.5k star' },
  { name: 'CopilotKit', sub: '37.8k star' },
]

const rows: Row[] = [
  {
    label: '框架支持',
    us: 'Vue 3.5+ 原生',
    items: [
      'React（Vue 绑定 npm 未发布）',
      'React（copy-paste）',
      'React 为主，Vue 包 2026-05 新发',
    ],
  },
  {
    label: '后端耦合',
    us: 'ChatAdapter 接口，任意后端',
    items: [
      '默认绑 Vercel AI SDK',
      '绑 AI SDK 协议',
      '绑 CopilotRuntime + AG-UI',
    ],
  },
  {
    label: '使用方式',
    us: '组件级拆用，5 包按需安装',
    items: ['headless + 组件', '复制代码进仓库', '整体框架接入'],
  },
  {
    label: '样式方案',
    us: '零 CSS 框架 · CSS Variables · @layer 隔离',
    items: ['Tailwind + shadcn', 'Tailwind + shadcn', 'Tailwind 系'],
  },
  {
    label: '思考链流式展示',
    us: '✅',
    items: ['✅', '✅', '部分'],
  },
  {
    label: '工具调用人工审批',
    us: '✅',
    items: ['✅', '—', '✅'],
  },
  {
    label: 'RAG 行内引用',
    us: '✅',
    items: ['✅', '✅', '部分'],
  },
  {
    label: '生成式 UI',
    us: '✅ 白名单注册表',
    items: ['✅', '部分', '✅'],
  },
  {
    label: '消息分支 / 双模型对比',
    us: '✅',
    items: ['✅ branching', '—', '—'],
  },
  {
    label: '中文文档',
    us: '✅',
    items: ['—', '—', '—'],
  },
]
</script>

<template>
  <div class="home-cmp">
    <div class="home-cmp__scroll">
      <table class="home-cmp__table">
        <thead>
          <tr>
            <th class="home-cmp__head-label">维度</th>
            <th
              v-for="c in columns"
              :key="c.name"
              class="home-cmp__head"
              :class="{ 'home-cmp__head--us': c.us }"
            >
              <span class="home-cmp__head-name">{{ c.name }}</span>
              <span class="home-cmp__head-sub">{{ c.sub }}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in rows" :key="r.label">
            <td class="home-cmp__label">{{ r.label }}</td>
            <td class="home-cmp__us">{{ r.us }}</td>
            <td
              v-for="(v, i) in r.items"
              :key="i"
              class="home-cmp__cell"
              :class="{ 'is-muted': v === '—' }"
            >
              {{ v }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <p class="home-cmp__swipe">← 左右滑动查看完整对比 →</p>
    <p class="home-cmp__foot">
      star 数与发布状态实测于 GitHub API / npm registry，数据截至
      2026-10；CopilotKit 与 assistant-ui 的 Vue
      支持均在快速演进，以各项目官网为准。
    </p>
  </div>
</template>

<style scoped>
.home-cmp__scroll {
  overflow-x: auto;
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  background: var(--vp-c-bg);
}

.home-cmp__table {
  width: 100%;
  min-width: 760px;
  border-collapse: collapse;
  font-size: 13px;
}

.home-cmp__table :deep() th,
.home-cmp__table :deep() td {
  padding: 10px 14px;
  border-bottom: 1px solid var(--vp-c-divider);
  text-align: left;
  vertical-align: top;
  line-height: 1.55;
}

.home-cmp__table tr:last-child :deep() td {
  border-bottom: none;
}

.home-cmp__head-label,
.home-cmp__label {
  color: var(--vp-c-text-2);
  font-weight: 600;
  white-space: nowrap;
  background: var(--vp-c-bg-soft);
}

.home-cmp__head {
  font-weight: 700;
}

.home-cmp__head-name {
  display: block;
  color: var(--vp-c-text-1);
}

.home-cmp__head-sub {
  display: block;
  font-size: 11px;
  font-weight: 500;
  color: var(--vp-c-text-3);
  margin-top: 2px;
}

.home-cmp__head--us {
  background: var(--vp-c-brand-soft);
}

.home-cmp__head--us .home-cmp__head-name {
  color: var(--vp-c-brand-1);
}

.home-cmp__us {
  font-weight: 600;
  color: var(--vp-c-brand-1);
  background: color-mix(in srgb, var(--vp-c-brand-soft) 45%, transparent);
}

.home-cmp__cell {
  color: var(--vp-c-text-2);
}

.home-cmp__cell.is-muted {
  color: var(--vp-c-text-3);
}

.home-cmp__swipe {
  display: none;
  margin: 8px 2px 0;
  font-size: 11.5px;
  color: var(--vp-c-text-3);
}

@media (max-width: 759px) {
  .home-cmp__swipe {
    display: block;
  }
}

.home-cmp__foot {
  margin-top: 10px;
  font-size: 11.5px;
  line-height: 1.7;
  color: var(--vp-c-text-3);
}
</style>
