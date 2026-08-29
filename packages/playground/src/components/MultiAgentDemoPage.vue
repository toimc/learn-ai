<script setup lang="ts">
import MultiAgentDemo from './demos/MultiAgentDemo.vue'
</script>

<template>
  <div class="multi-agent-demo-page">
    <ClientOnly>
      <MultiAgentDemo />
    </ClientOnly>
  </div>
</template>

<style scoped>
.multi-agent-demo-page {
  /* 占满 navbar 以下剩余视口：demo 内部自管滚动（头部/形态切换固定，
     消息区弹性伸缩），窄/矮视口下输入框始终可见，不随页面滚动出首屏 */
  height: calc(100vh - var(--vp-nav-height, 64px));
  height: calc(100dvh - var(--vp-nav-height, 64px));
  overflow: hidden;
}
</style>
