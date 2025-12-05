import { createApp } from 'vue'
import App from './App.vue'
import './style.css' // 如果您有全局CSS文件，请保持此行，否则可以删除

// 使用 createApp(App) 初始化您的 Vue 应用程序
// 并将其挂载到 index.html 中的 <div id="app"> 元素上
createApp(App).mount('#app')