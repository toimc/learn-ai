<script setup lang="ts">
import VectorSearchDemo from './demos/VectorSearchDemo.vue'
</script>

<template>
  <div class="vector-search-demo-page">
    <ClientOnly>
      <VectorSearchDemo />
    </ClientOnly>
  </div>
</template>

<style scoped>
.vector-search-demo-page {
  /* 页面自然滚动（结果列表不定长），仅约束内容最大宽度居中 */
  min-height: calc(100vh - var(--vp-nav-height, 64px));
}
</style>
