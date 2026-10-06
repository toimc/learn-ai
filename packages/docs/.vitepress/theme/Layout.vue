<script setup lang="ts">
import DefaultTheme from 'vitepress/theme'
import HomeHeroChat from '../components/HomeHeroChat.vue'
</script>

<template>
  <DefaultTheme.Layout>
    <!-- 首页 hero 右侧：用本库组件现场跑一段自动播放的对话（dogfooding） -->
    <template #home-hero-image>
      <HomeHeroChat />
    </template>
  </DefaultTheme.Layout>
</template>
