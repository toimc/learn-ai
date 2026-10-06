<script setup lang="ts">
interface Feature {
  icon: string
  title: string
  desc: string
  link: string
}

const features: Feature[] = [
  {
    icon: '🔌',
    title: 'ChatAdapter 后端无关',
    desc: '一个 AsyncGenerator 接口对接任何后端——OpenAI 兼容、Anthropic、自建网关随意换，前端代码零改动。',
    link: '/guide/usage',
  },
  {
    icon: '⚡',
    title: '流式渲染管线',
    desc: 'StreamChunk 六种帧（text / thinking / tool_call / tool_result / error / done）逐帧消费，打字机、光标、中止全内置。',
    link: '/composables/use-chat',
  },
  {
    icon: '🧠',
    title: '思考链展示',
    desc: 'ThinkingChain 多步骤时间线，pending / active / complete / error 分步流转，结束自动算耗时折叠成一行。',
    link: '/components/thinking-chain',
  },
  {
    icon: '🛠️',
    title: '工具调用可视化',
    desc: 'ToolCall 六态状态机 + 参数/结果 JSON 面板 + awaiting-approval 人工审批，function call 全过程透明。',
    link: '/components/tool-call',
  },
  {
    icon: '📎',
    title: 'RAG 引用溯源',
    desc: 'InlineCitation 正文角标悬浮预览引用片段，Sources 来源列表，外链走 http(s) 白名单校验。',
    link: '/components/inline-citation',
  },
  {
    icon: '🎛️',
    title: '生成式 UI',
    desc: '工具结果携带 UISchema，经组件白名单注册表渲染成真实 Vue 组件——决策权给 AI，渲染权留在工程。',
    link: '/guide/genui',
  },
  {
    icon: '🎨',
    title: '三层主题令牌',
    desc: '原始→语义→组件 73 个 CSS 变量，暗色只翻转语义层；4 套预设 + 在线主题配置器一键导出。',
    link: '/guide/theming',
  },
  {
    icon: '🧅',
    title: '@layer 样式隔离',
    desc: '库样式全部收在级联层内不污染宿主；宿主一行普通 CSS 即可覆盖任意组件，全程零 !important。',
    link: '/guide/theming',
  },
  {
    icon: '🌐',
    title: '中英双语 i18n',
    desc: '内置 zh-CN / en-US 字典，setAiChatLocale 一行切换并同步 <html lang>，与宿主 vue-i18n 实例天然隔离。',
    link: '/guide/i18n',
  },
  {
    icon: '🖼️',
    title: '多模态输入',
    desc: '上传 / 粘贴 / 拖拽附件管道，canvas 压缩转 base64 直发视觉模型——blob 预览地址与发送数据各归其位。',
    link: '/guide/multimodal',
  },
  {
    icon: '🎙️',
    title: '语音输入输出',
    desc: 'Web Speech API 零依赖封装：语音识别进输入框，回复按句朗读、可打断、状态持久化。',
    link: '/guide/speech',
  },
  {
    icon: '🧭',
    title: '消息分支与对比',
    desc: 'BranchPicker 多分支翻页切换，ComparisonMessage 双模型 A/B 对比，点选后原地固化。',
    link: '/components/comparison-message',
  },
  {
    icon: '🖥️',
    title: '服务端全家桶',
    desc: '@toimc/server Hono 网关 + @toimc/agents 多协议适配，JWT / API Key / 每日配额开箱即用，Key 不出服务端。',
    link: '/guide/server',
  },
  {
    icon: '📦',
    title: '按包安装',
    desc: 'core 零依赖、agents 零外部依赖，Monorepo 五包独立发布——只要组件不要服务端？不装就是了。',
    link: '/guide/installation',
  },
  {
    icon: '🧪',
    title: '1605+ 测试用例',
    desc: '173 个测试文件 + Playwright E2E 三浏览器覆盖，正常 / 边界 / 异常三场景纪律，改动有回归网兜底。',
    link: '/guide/testing',
  },
  {
    icon: '🚀',
    title: '参考实现齐全',
    desc: 'Mastra 会话记忆、LibSQLVector 混合检索 RAG、MCP 双向、多 Agent 编排——dev-server 里都有可跑的实现。',
    link: '/guide/rag',
  },
]
</script>

<template>
  <div class="home-fgrid">
    <a
      v-for="f in features"
      :key="f.title"
      class="home-fgrid__card"
      :href="f.link"
    >
      <span class="home-fgrid__icon" aria-hidden="true">{{ f.icon }}</span>
      <span class="home-fgrid__title">{{ f.title }}</span>
      <span class="home-fgrid__desc">{{ f.desc }}</span>
      <span class="home-fgrid__more">了解详情 →</span>
    </a>
  </div>
</template>

<style scoped>
.home-fgrid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}

.home-fgrid__card {
  display: flex;
  flex-direction: column;
  gap: 7px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  background: var(--vp-c-bg);
  padding: 16px 15px 14px;
  text-decoration: none;
  transition:
    border-color 0.2s ease,
    transform 0.2s ease,
    box-shadow 0.2s ease;
}

.home-fgrid__card:hover {
  border-color: var(--vp-c-brand-1);
  transform: translateY(-3px);
  box-shadow: 0 10px 24px -12px rgba(37, 99, 235, 0.35);
}

.home-fgrid__icon {
  font-size: 20px;
  line-height: 1;
  width: 38px;
  height: 38px;
  display: grid;
  place-items: center;
  border-radius: 9px;
  background: var(--vp-c-brand-soft);
}

.home-fgrid__title {
  font-weight: 700;
  font-size: 14.5px;
  color: var(--vp-c-text-1);
  margin-top: 4px;
}

.home-fgrid__desc {
  font-size: 12.5px;
  line-height: 1.65;
  color: var(--vp-c-text-2);
  flex: 1;
}

.home-fgrid__more {
  font-size: 12px;
  font-weight: 600;
  color: var(--vp-c-brand-1);
  opacity: 0;
  transform: translateX(-4px);
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}

.home-fgrid__card:hover .home-fgrid__more {
  opacity: 1;
  transform: translateX(0);
}

@media (max-width: 1119px) {
  .home-fgrid {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (max-width: 899px) {
  .home-fgrid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 599px) {
  .home-fgrid {
    grid-template-columns: 1fr;
  }
}

@media (prefers-reduced-motion: reduce) {
  .home-fgrid__card,
  .home-fgrid__more {
    transition: none;
  }
  .home-fgrid__card:hover {
    transform: none;
  }
  .home-fgrid__more {
    opacity: 1;
    transform: none;
  }
}
</style>
