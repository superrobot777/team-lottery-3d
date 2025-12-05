<template>
  <div id="app">
    <!-- 加载 3D 抽奖场景组件 -->
    <LotteryScene />
  </div>
</template>

<script setup>
// 导入 3D 场景组件
import LotteryScene from './components/LotteryScene.vue'
</script>

<style>
/* ---------------------------------------------------
 * 全局样式：确保应用和 3D 场景能全屏显示
 * --------------------------------------------------- */

/* 强制重置 body 样式，确保占满全屏且无默认边距 */
body {
  margin: 0;
  padding: 0;
  overflow: hidden; /* 隐藏滚动条 */
  background-color: #000; /* 黑色背景 */
  font-family: 'Inter', sans-serif;
  width: 100vw;
  height: 100vh;
  /* 关键：覆盖 Vite 默认可能存在的居中布局设置 */
  display: block !important;
  place-items: unset !important;
  min-width: 0 !important;
  min-height: 0 !important;
}

#app {
  width: 100%;
  height: 100%;
  overflow: hidden;
  margin: 0;
  padding: 0;
}
</style>