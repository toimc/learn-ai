<script setup lang="ts">
import ThemeBuilder from './ThemeBuilder.vue'
</script>

<template>
  <div class="theme-builder-layout">
    <ThemeBuilder />
  </div>
</template>

<style>
.theme-builder-layout {
  width: 100%;
  /* 确定高度(视口减导航)：让内部 .tb-app 撑满并让左右两栏各自独立滚动。
     min-height 不构成确定高度，会导致整页随内容增长而滚动、预览撑不满。 */
  height: calc(100vh - var(--vp-nav-height, 64px));
  height: calc(100dvh - var(--vp-nav-height, 64px));
  display: flex;
  flex-direction: column;
}
</style>
