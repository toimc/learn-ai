<script setup lang="ts">
import EdgeSearchDemo from './demos/EdgeSearchDemo.vue'
</script>

<template>
  <div class="edge-search-demo-page">
    <ClientOnly>
      <EdgeSearchDemo />
    </ClientOnly>
  </div>
</template>

<style scoped>
.edge-search-demo-page {
  /* 页面自然滚动（会话库列表不定长），仅约束内容最大宽度居中 */
  min-height: calc(100vh - var(--vp-nav-height, 64px));
}
</style>
