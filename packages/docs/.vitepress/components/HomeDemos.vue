<script setup lang="ts">
/**
 * 首页演示画廊。dev 依赖页（需 pnpm dev 的 dev-server :8787）在 GitHub Pages
 * 构建中整页剔除，这里用构建期常量同步隐藏入口（define 注入，分支可折叠）。
 */
const isPagesBuild = import.meta.env.DOCS_TARGET === 'pages'

interface Demo {
  title: string
  desc: string
  link: string
  dev?: boolean
}

const demos: Demo[] = [
  {
    title: '完整 Playground',
    desc: '发送 / 中止 / 多会话 / 主题切换 / 思考流式，本地 mock 自包含',
    link: '/playground',
  },
  {
    title: 'RAG 引用演示',
    desc: '思考链检索 + 正文角标 hover 预览 + 来源列表 + 工具审批全链路',
    link: '/citation-demo',
  },
  {
    title: '主题配置器',
    desc: '73 个令牌在线编辑、实时预览、导出 CSS 覆盖文件',
    link: '/theme-builder',
  },
  {
    title: '反馈与分支',
    desc: 'Welcome 引导、/@ 内联建议、操作四件、三分支翻页，事件日志实时可见',
    link: '/feedback-demo',
  },
  {
    title: '模型元数据',
    desc: '15 家厂商图标、厂商分组、按百万 token 定价格式化、JSON diff 对比',
    link: '/model-meta-demo',
  },
  {
    title: '端侧语义搜索',
    desc: '浏览器里跑 bge-small-zh 向量检索：零 API 调用、数据不出本机、可离线',
    link: '/edge-search-demo',
  },
  {
    title: '多模态输入',
    desc: '压缩 → dataUrl → SSE 线协议可视化，未配模型时 mock 优雅降级',
    link: '/multimodal-demo',
  },
  {
    title: 'Mock 流式对话',
    desc: '真实 HTTP + SSE：token 粒度逐字输出，思考 / 工具 / 错误剧本一键触发',
    link: '/mock-server-demo',
    dev: true,
  },
  {
    title: '向量检索演示',
    desc: 'docs-agent 关键词 vs 语义混合双路并排对比，链路耗时实测',
    link: '/vector-search-demo',
    dev: true,
  },
  {
    title: '生成式 UI',
    desc: '工具回复渲染成天气卡片 / 方案采纳按钮组，降级链一并演示',
    link: '/genui-demo',
    dev: true,
  },
  {
    title: '多 Agent 编排',
    desc: '委托 Supervisor / 并行 Council / 流水线 Workflow 三形态可复现可对比',
    link: '/multi-agent-demo',
    dev: true,
  },
  {
    title: 'Workflow 直跑',
    desc: 'Mastra Workflow 原生接入：step 映射为工具帧，前端零协议改动',
    link: '/workflow-demo',
    dev: true,
  },
]
</script>

<template>
  <div class="home-demos">
    <a
      v-for="d in demos"
      v-show="!isPagesBuild || !d.dev"
      :key="d.link"
      class="home-demos__card"
      :class="{ 'home-demos__card--dev': d.dev }"
      :href="d.link"
    >
      <span class="home-demos__head">
        <span class="home-demos__title">{{ d.title }}</span>
        <span
          class="home-demos__badge"
          :class="d.dev ? 'home-demos__badge--dev' : ''"
        >
          {{ d.dev ? '需 dev-server' : '纯静态' }}
        </span>
      </span>
      <span class="home-demos__desc">{{ d.desc }}</span>
      <span class="home-demos__go">进入演示 →</span>
    </a>
  </div>
</template>

<style scoped>
.home-demos {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}

.home-demos__card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  background: var(--vp-c-bg);
  padding: 15px;
  text-decoration: none;
  transition:
    border-color 0.2s ease,
    transform 0.2s ease;
}

.home-demos__card:hover {
  border-color: var(--vp-c-brand-1);
  transform: translateY(-3px);
}

.home-demos__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.home-demos__title {
  font-weight: 700;
  font-size: 14px;
  color: var(--vp-c-text-1);
}

.home-demos__badge {
  flex: none;
  font-size: 10.5px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(16, 185, 129, 0.12);
  color: #059669;
}

.home-demos__badge--dev {
  background: rgba(245, 158, 11, 0.14);
  color: #b45309;
}

.dark .home-demos__badge {
  color: #34d399;
}

.dark .home-demos__badge--dev {
  color: #fbbf24;
}

.home-demos__desc {
  font-size: 12.5px;
  line-height: 1.65;
  color: var(--vp-c-text-2);
  flex: 1;
}

.home-demos__go {
  font-size: 12px;
  font-weight: 600;
  color: var(--vp-c-brand-1);
}

@media (max-width: 1119px) {
  .home-demos {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (max-width: 899px) {
  .home-demos {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 599px) {
  .home-demos {
    grid-template-columns: 1fr;
  }
}

@media (prefers-reduced-motion: reduce) {
  .home-demos__card {
    transition: none;
  }
  .home-demos__card:hover {
    transform: none;
  }
}
</style>
