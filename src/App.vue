<script setup>
import TeamLottery3D from './components/TeamLottery3D.vue' 
</script>

<template>
  <!-- 根容器：确保占据整个视口 (h-screen) 并移除所有多余的标题 -->
  <div id="app-container" class="w-full h-screen">
    <TeamLottery3D class="w-full h-full" />
  </div>
</template>

<style>
/* 确保 HTML, body, 和 #app 元素从根部开始就占据整个视口 */
html, body, #app {
  margin: 0;
  padding: 0;
  width: 100%;
  height: 100%;
  overflow: hidden; /* 确保没有滚动条 */
  background-color: #0d0d0d; /* 设置整体暗色背景 */
}

/* 强制应用容器占据整个视口，修复只显示一半的问题 */
#app-container {
  position: fixed; 
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
}
</style>