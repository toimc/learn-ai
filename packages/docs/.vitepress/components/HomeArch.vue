<script setup lang="ts">
/**
 * 首页架构流向图：前端只认 ChatAdapter，后端任选；API Key 只留在服务端。
 * 纯 CSS 绘制，横向流向，窄屏自动纵向堆叠。
 */
const backends = [
  'OpenAI 兼容',
  'Anthropic',
  'GLM / DeepSeek',
  'Kimi / Qwen',
  'Ollama 本地',
  '自建网关',
]
</script>

<template>
  <div class="home-arch">
    <div class="home-arch__flow">
      <div class="home-arch__node">
        <div class="home-arch__node-title">你的应用</div>
        <div class="home-arch__node-sub">Vue 3.5+ 宿主页面</div>
      </div>

      <div class="home-arch__arrow" aria-hidden="true" />

      <div class="home-arch__node">
        <div class="home-arch__node-title">
          @toimc/vue <span class="home-arch__plus">+ markdown</span>
        </div>
        <div class="home-arch__node-sub">62 个组件 · 流式渲染</div>
      </div>

      <div class="home-arch__arrow" aria-hidden="true" />

      <div class="home-arch__node">
        <div class="home-arch__node-title">@toimc/core</div>
        <div class="home-arch__node-sub">useChat 状态机 · StreamChunk</div>
      </div>

      <div class="home-arch__arrow home-arch__arrow--hot" aria-hidden="true" />

      <div class="home-arch__node home-arch__node--adapter">
        <div class="home-arch__node-title">ChatAdapter</div>
        <div class="home-arch__node-sub">AsyncGenerator&lt;StreamChunk&gt;</div>
      </div>

      <div class="home-arch__arrow home-arch__arrow--hot" aria-hidden="true" />

      <div class="home-arch__node home-arch__node--backends">
        <div class="home-arch__node-title">后端任选</div>
        <div class="home-arch__chips">
          <span v-for="b in backends" :key="b" class="home-arch__chip">{{
            b
          }}</span>
        </div>
      </div>
    </div>

    <p class="home-arch__hint">
      层间流向：你的应用 → 组件层 → 状态机 → ChatAdapter 接口 → 后端任选
    </p>

    <div class="home-arch__lane">
      <span class="home-arch__lane-tag">可选</span>
      <strong>@toimc/server</strong> Hono 网关（Bearer 认证 · 限流 · SSE · JWT /
      API Key / 配额）
      <span class="home-arch__lane-sep">+</span>
      <strong>@toimc/agents</strong> 多协议适配（OpenAI 兼容 · Anthropic ·
      Mastra）
      <span class="home-arch__lane-note">—— API Key 只留在服务端</span>
    </div>
  </div>
</template>

<style scoped>
.home-arch__hint {
  display: none;
  margin: 10px 0 0;
  text-align: center;
  font-size: 12px;
  color: var(--vp-c-text-3);
}

.home-arch {
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  background:
    linear-gradient(var(--vp-c-bg-soft), var(--vp-c-bg-soft)), var(--vp-c-bg);
  padding: 26px 20px 18px;
}

.home-arch__flow {
  display: flex;
  align-items: stretch;
  justify-content: center;
  gap: 10px;
  flex-wrap: nowrap;
}

.home-arch__node {
  flex: 1;
  min-width: 0;
  border: 1px solid var(--vp-c-divider);
  border-radius: 10px;
  background: var(--vp-c-bg);
  padding: 12px 10px;
  text-align: center;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 4px;
}

.home-arch__node--adapter {
  border-color: var(--vp-c-brand-1);
  box-shadow: 0 0 0 3px var(--vp-c-brand-soft);
  background:
    linear-gradient(180deg, var(--vp-c-brand-soft), transparent 70%),
    var(--vp-c-bg);
}

.home-arch__node--backends {
  flex: 1.25;
}

.home-arch__node-title {
  font-weight: 700;
  font-size: 14px;
  color: var(--vp-c-text-1);
  font-family: var(--vp-font-family-mono, ui-monospace, monospace);
}

.home-arch__node--adapter .home-arch__node-title {
  color: var(--vp-c-brand-1);
}

.home-arch__plus {
  font-weight: 500;
  font-size: 11.5px;
  color: var(--vp-c-text-3);
}

.home-arch__node-sub {
  font-size: 11.5px;
  line-height: 1.4;
  color: var(--vp-c-text-2);
}

.home-arch__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  justify-content: center;
  margin-top: 2px;
}

.home-arch__chip {
  font-size: 10.5px;
  padding: 2px 7px;
  border-radius: 999px;
  border: 1px solid var(--vp-c-divider);
  color: var(--vp-c-text-2);
  background: var(--vp-c-bg-soft);
  white-space: nowrap;
}

.home-arch__arrow {
  align-self: center;
  width: 18px;
  height: 2px;
  flex: none;
  background:
    linear-gradient(
      90deg,
      transparent 0 2px,
      var(--vp-c-divider) 2px calc(100% - 6px),
      transparent 0
    ),
    var(--vp-c-divider);
  position: relative;
}

.home-arch__arrow::after {
  content: '';
  position: absolute;
  right: 0;
  top: 50%;
  translate: 0 -50%;
  border: 4px solid transparent;
  border-left-color: var(--vp-c-divider);
}

.home-arch__arrow--hot {
  background: repeating-linear-gradient(
    90deg,
    var(--vp-c-brand-1) 0 4px,
    transparent 4px 8px
  );
  animation: arch-flow 1.2s linear infinite;
}

.home-arch__arrow--hot::after {
  border-left-color: var(--vp-c-brand-1);
}

@keyframes arch-flow {
  to {
    background-position: 8px 0;
  }
}

.home-arch__lane {
  margin-top: 16px;
  border: 1px dashed var(--vp-c-divider);
  border-radius: 10px;
  padding: 10px 14px;
  font-size: 12.5px;
  line-height: 1.8;
  color: var(--vp-c-text-2);
  text-align: center;
}

.home-arch__lane strong {
  color: var(--vp-c-text-1);
  font-family: var(--vp-font-family-mono, ui-monospace, monospace);
  font-size: 12px;
}

.home-arch__lane-tag {
  display: inline-block;
  font-size: 10.5px;
  font-weight: 600;
  color: var(--vp-c-brand-1);
  border: 1px solid var(--vp-c-brand-1);
  border-radius: 4px;
  padding: 0 5px;
  margin-right: 8px;
  vertical-align: 1px;
}

.home-arch__lane-sep {
  margin: 0 6px;
  color: var(--vp-c-text-3);
}

.home-arch__lane-note {
  color: var(--vp-c-text-3);
}

@media (max-width: 1159px) {
  .home-arch__hint {
    display: block;
  }
  .home-arch__flow {
    flex-direction: column;
    align-items: stretch;
  }
  .home-arch__arrow {
    width: 2px;
    height: 16px;
    align-self: center;
    background: var(--vp-c-divider);
  }
  .home-arch__arrow::after {
    right: 50%;
    top: auto;
    bottom: 0;
    translate: 50% 0;
    border: 4px solid transparent;
    border-top-color: var(--vp-c-divider);
    border-left-color: transparent;
  }
  .home-arch__arrow--hot {
    background: repeating-linear-gradient(
      180deg,
      var(--vp-c-brand-1) 0 4px,
      transparent 4px 8px
    );
    animation: arch-flow-v 1.2s linear infinite;
  }
  .home-arch__arrow--hot::after {
    border-top-color: var(--vp-c-brand-1);
  }
}

@keyframes arch-flow-v {
  to {
    background-position: 0 8px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .home-arch__arrow--hot {
    animation: none;
  }
}
</style>
