<script setup lang="ts">
/**
 * 首页「为什么是现在 / 为什么是我们」三张情报卡：
 * 每张卡一个数字钩子 + 一段事实陈述，来源均为 2026-10 公开实测（见卡内脚注）。
 */
const cards = [
  {
    stat: '626 万',
    statUnit: '次 / 月',
    title: 'Vue 开发者在接 AI，官方只给了 useChat',
    desc: '@ai-sdk/vue 月下载量实测 626 万（2026-10，npm registry）——Vue 生态对 AI 聊天界面的需求是真实且巨大的，而官方 composables 不含任何 UI 组件：想不手搓界面，此前只能选绑 Tailwind 或绑 Vercel 的方案。',
    src: 'npm downloads API',
  },
  {
    stat: 'react',
    statUnit: 'Vue 项目的第一行安装命令',
    title: 'React 库的「Vue 支持」，是让 Vue 背上 React',
    desc: 'assistant-ui 官方 Vue 教程要求先安装 react 作为运行时底座，其 @assistant-ui/vue 至今未发布到 npm（2026-10 实测 Not found）。AI Chat UI 从第一行代码就是 Vue 3.5 + TypeScript 原生——没有兼容层，没有运行时夹层。',
    src: 'assistant-ui.com/docs/vue/quickstart',
  },
  {
    stat: '17 个月',
    statUnit: '无任何提交',
    title: '上一代聊天 UI，撑不起 AI 界面',
    desc: 'chatscope（1.8k star 的老牌聊天组件库）自 2025-05 起停更（GitHub API 实测）。没有流式渲染、思考链、工具调用、RAG 引用——AI 聊天不是「长得像聊天」就够了，交互代差是硬门槛。',
    src: 'GitHub API · chatscope/chat-ui-kit-react',
  },
]
</script>

<template>
  <div class="home-why">
    <article v-for="c in cards" :key="c.title" class="home-why__card">
      <div class="home-why__stat">
        <span class="home-why__num">{{ c.stat }}</span>
        <span class="home-why__unit">{{ c.statUnit }}</span>
      </div>
      <h3 class="home-why__title">{{ c.title }}</h3>
      <p class="home-why__desc">{{ c.desc }}</p>
      <span class="home-why__src">来源：{{ c.src }} · 2026-10</span>
    </article>
  </div>
</template>

<style scoped>
.home-why {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.home-why__card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  border: 1px solid var(--vp-c-divider);
  border-left: 3px solid var(--vp-c-brand-1);
  border-radius: 12px;
  background: var(--vp-c-bg);
  padding: 20px 18px 16px;
}

.home-why__stat {
  display: flex;
  align-items: baseline;
  gap: 8px;
  flex-wrap: wrap;
}

.home-why__num {
  font-family: var(--vp-font-family-mono, ui-monospace, monospace);
  font-size: 34px;
  font-weight: 800;
  line-height: 1;
  color: var(--vp-c-brand-1);
  letter-spacing: -0.02em;
}

.home-why__unit {
  font-size: 12px;
  color: var(--vp-c-text-3);
}

.home-why__title {
  font-size: 14.5px;
  font-weight: 700;
  color: var(--vp-c-text-1);
  margin: 0;
}

.home-why__desc {
  font-size: 12.5px;
  line-height: 1.75;
  color: var(--vp-c-text-2);
  margin: 0;
  flex: 1;
}

.home-why__src {
  font-size: 10.5px;
  color: var(--vp-c-text-3);
  border-top: 1px dashed var(--vp-c-divider);
  padding-top: 8px;
  margin-top: 2px;
}

@media (max-width: 959px) {
  .home-why {
    grid-template-columns: 1fr;
  }
}
</style>
