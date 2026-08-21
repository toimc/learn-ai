<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { aiChatI18n } from '@toimc/vue'
import { checkHealth } from '../mock/sse-adapter'
import '../locales' // 副作用：合并 pg 字典

const { t } = aiChatI18n.global

const SPEC_URL = 'http://localhost:8787/api/openapi.json'

const host = ref<HTMLElement>()
const status = ref<'connecting' | 'online' | 'offline'>('connecting')

onMounted(async () => {
  // 探活：给顶部提示条一个明确状态（Scalar 自身加载失败只显示内部错误）
  status.value = (await checkHealth()) ? 'online' : 'offline'

  try {
    // standalone ESM 构建免 React，经 docs vite alias 解析；720KB 走动态分包
    const { createApiReference } =
      await import('@scalar/api-reference-standalone')
    // 暗色与站点 data-theme 同步（mount 时取值；切换主题后刷新页面生效）
    const dark = document.documentElement.getAttribute('data-theme') === 'dark'
    createApiReference(host.value as HTMLElement, {
      url: SPEC_URL,
      darkMode: dark,
      hideClientButton: true,
    })
  } catch {
    status.value = 'offline'
  }
})
</script>

<template>
  <div class="mock-api-page">
    <!-- 顶部提示条：接口文档数据源状态 -->
    <div class="mock-api-page__banner" :data-status="status">
      <span class="mock-api-page__dot" />
      <span class="mock-api-page__text">
        {{
          status === 'online'
            ? t('pg.mockApi.bannerOnline')
            : status === 'connecting'
              ? t('pg.mockApi.bannerConnecting')
              : t('pg.mockApi.bannerOffline')
        }}
      </span>
      <a class="mock-api-page__link" href="/mock-server-demo">
        {{ t('pg.mockApi.goDemo') }}
      </a>
    </div>

    <ClientOnly>
      <div ref="host" class="mock-api-page__host" />
    </ClientOnly>
  </div>
</template>

<style scoped>
/* 定高占满视口剩余高度（不是 min-height：那会让 Scalar 按内容撑开，
   页面整体变成长滚动）。Scalar 自身依赖页面滚动（.scalar-app overflow
   visible），因此把滚动容器设在 host 上：banner 固定、host 内部滚 */
.mock-api-page {
  height: calc(100vh - var(--vp-nav-height, 64px));
  height: calc(100dvh - var(--vp-nav-height, 64px));
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.mock-api-page__banner {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 20px;
  font-size: 13px;
  border-bottom: 1px solid var(--vp-c-divider, #e2e8f0);
}

.mock-api-page__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #94a3b8;
  flex-shrink: 0;
}

.mock-api-page[data-status='online'] .mock-api-page__dot {
  background: #22c55e;
}

.mock-api-page[data-status='connecting'] .mock-api-page__dot {
  background: #eab308;
}

.mock-api-page[data-status='offline'] .mock-api-page__dot {
  background: #ef4444;
}

.mock-api-page__link {
  margin-left: auto;
  color: var(--vp-c-brand, #6366f1);
  text-decoration: none;
}

/* host 即滚动容器：Scalar 内容在其中滚，sticky 侧栏相对它定位 */
.mock-api-page__host {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
}
</style>
