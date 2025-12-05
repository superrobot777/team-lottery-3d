<template>
  <!-- 容器元素，用于 Three.js 渲染器挂载 -->
  <div ref="container" class="w-full h-screen relative overflow-hidden">
    
    <!-- 2D UI 覆盖层：当前奖项、抽奖按钮和结果展示 -->
    <div class="ui-layer">

      <!-- 当前抽取的奖项名称 -->
      <div class="prize-display">
        {{ currentPrizeIndex < prizeTiers.length ? currentPrizeName : '所有奖项已抽完' }}
      </div>

      <!-- 抽奖按钮 -->
      <button 
        @click="startLottery" 
        :disabled="isDrawing || currentPrizeIndex >= prizeTiers.length"
        class="lottery-btn"
      >
        {{ getButtonText() }}
      </button>

      <!-- 当前批次结果展示 (使用 Vue Transition 实现弹出动画) -->
      <Transition name="fade-scale">
        <div v-if="resultNames.length > 0 && !showFinalResults" class="result-box">
          
          <div class="result-title">🎉 **{{ prizeTiers[currentPrizeIndex - 1].name }}** 中奖名单! 🎉</div>
          
          <div class="winners-list">
            <span v-for="name in resultNames" :key="name" class="winner-chip">{{ name }}</span>
          </div>
          
          <button class="continue-btn" @click="resetLottery">
            {{ currentPrizeIndex < prizeTiers.length ? '继续抽取下一奖项' : '查看最终结果' }}
          </button>
        </div>
      </Transition>
      
      <!-- 最终结果展示表格 -->
      <Transition name="fade-scale">
        <div v-if="showFinalResults" class="final-results-box">
            <div class="result-title">🏆 最终抽奖结果一览 🏆</div>
            
            <table class="results-table">
                <thead>
                    <tr>
                        <th>奖项</th>
                        <th>中奖人数</th>
                        <th>中奖名单</th>
                    </tr>
                </thead>
                <tbody>
                    <!-- 循环遍历所有奖项 tier，并按 1等奖 -> 2等奖 -> 3等奖 -> 参与奖 顺序显示 -->
                    <tr v-for="prize in prizeTiers.slice().reverse()" :key="prize.name">
                        <td>{{ prize.name }}</td>
                        <td>{{ prize.drawn.value.length }} / {{ prize.count }}</td>
                        <td>
                            <span v-for="name in prize.drawn.value" :key="name" class="winner-chip final-chip">{{ name }}</span>
                            <span v-if="prize.drawn.value.length === 0">暂无</span>
                        </td>
                    </tr>
                </tbody>
            </table>
            
            <button class="continue-btn" @click="showFinalResults = false">
                关闭查看
            </button>
        </div>
      </Transition>

    </div>

  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, computed } from 'vue';
import * as THREE from 'three';
import { CSS3DRenderer, CSS3DObject } from 'three/examples/jsm/renderers/CSS3DRenderer.js';
import gsap from 'gsap';


// --- 状态和数据 ---

// 1. 团队成员名单 (10人)
const employees = [
  '杲绍峰', '梅东胜', '王春翔', '张衡', '贾君慧',
  '王国强', '苏昆', '王超', '卓柏呈', '刘东宇'
];

// 2. 奖项设置和顺序 (参与奖 -> 三等奖 -> 二等奖 -> 一等奖)
const prizeTiers = [
    { name: '参与奖', count: 4, drawn: ref([]) }, // 4 winners
    { name: '三等奖', count: 3, drawn: ref([]) }, // 3 winners
    { name: '二等奖', count: 2, drawn: ref([]) }, // 2 winners
    { name: '一等奖', count: 1, drawn: ref([]) }, // 1 winner
];

// 3. 抽奖状态和结果
const remainingEmployees = ref([]); // 尚未中奖的名单
const currentPrizeIndex = ref(0); // 当前正在抽取的奖项索引
const isDrawing = ref(false); 
const resultNames = ref([]); // 当前批次抽中的名单 (用于弹窗显示)
const showFinalResults = ref(false); // 新增：控制最终结果表格的显示

// 4. 计算属性
const currentPrizeName = computed(() => {
    return currentPrizeIndex.value < prizeTiers.length ? prizeTiers[currentPrizeIndex.value].name : '抽奖已结束';
});

// --- UI 辅助函数 ---
const getButtonText = () => {
    if (isDrawing.value) return '✨ 抽奖中...';
    if (currentPrizeIndex.value >= prizeTiers.length) return '所有奖项已抽完';
    
    const prize = prizeTiers[currentPrizeIndex.value];
    return `抽取 ${prize.name} (共 ${prize.count} 名)`;
};


// --- 抽奖核心函数 ---

// 重置抽奖状态：隐藏弹窗，准备下一轮抽奖
const resetLottery = () => {
    // 检查是否所有奖项都已抽取完毕
    if (currentPrizeIndex.value >= prizeTiers.length) {
        // 如果抽完了，显示最终结果表格
        resultNames.value = []; // 清空当前的临时结果弹窗
        showFinalResults.value = true;
        // 动画元素保持在暗淡状态，突出最终结果
    } else {
        // 继续抽取下一个奖项
        resultNames.value = []; // 清空当前结果，隐藏弹窗
    
        // 恢复所有元素的原始样式
        sphereGroup.children.forEach((obj) => {
            gsap.to(obj.element.style, {
                opacity: 1,
                scale: 1,
                color: 'white',
                border: '3px solid rgba(0, 255, 255, 0.7)',
                textShadow: '0 0 5px #0ff',
                filter: 'blur(0px)',
                duration: 1,
            });
        });
        targetObject = null;
    }
    
    // 强制更新 Three.js 渲染以确保恢复视觉效果
    renderer.render(scene, camera);
}


const startLottery = () => {
    if (isDrawing.value || currentPrizeIndex.value >= prizeTiers.length || showFinalResults.value) return; 
    
    // 如果上一次有结果，先执行重置操作
    if (resultNames.value.length > 0) {
        // 如果是最后一个奖项抽完，resetLottery会直接打开最终结果，所以需要检查
        if (currentPrizeIndex.value >= prizeTiers.length) {
            resetLottery();
            return; // 阻止继续执行抽奖序列
        }
        
        resetLottery();
        // 确保动画有时间执行，再开始新的抽奖
        setTimeout(() => _executeLotterySequence(), 500); 
    } else {
        _executeLotterySequence();
    }
};

const _executeLotterySequence = () => {
    isDrawing.value = true;
    resultNames.value = [];

    const currentPrize = prizeTiers[currentPrizeIndex.value];
    const drawCount = currentPrize.count;
    let candidates = remainingEmployees.value;

    // 1. 随机选择 N 位中奖者
    const winners = [];
    for (let i = 0; i < drawCount; i++) {
        if (candidates.length === 0) break;
        const randomIndex = Math.floor(Math.random() * candidates.length);
        const winner = candidates.splice(randomIndex, 1)[0]; // 移除并获取中奖者
        winners.push(winner);
    }
    
    // 2. 确定动画聚焦对象 (使用第一个中奖者)
    const targetEmployee = winners[0];
    const targetIndex = employees.indexOf(targetEmployee);
    targetObject = sphereGroup.children[targetIndex];

    // 3. 动画：加速旋转 (持续 0.5秒)
    gsap.to(sphereGroup.rotation, {
        duration: 0.5,
        y: sphereGroup.rotation.y + Math.PI * 6, // 快速转 3 圈
        ease: 'power1.out',
    });
    
    // 4. 动画：平滑减速与锁定
    const finalRotY = sphereGroup.rotation.y + Math.PI * (10 + Math.random() * 4); 

    gsap.to(sphereGroup.rotation, {
        delay: 0.5,
        duration: 4, 
        y: finalRotY, 
        ease: 'power4.out', 
        onComplete: () => {
            
            // ** 5. 结果聚焦与状态更新 **
            
            // 状态更新
            currentPrize.drawn.value.push(...winners); // 添加到当前奖项的已中奖列表
            resultNames.value = winners; // 设置当前批次抽奖结果
            currentPrizeIndex.value++; // 移动到下一奖项
            isDrawing.value = false;
            
            // 选中元素放大、发光 (只对第一个中奖者或所有中奖者做特殊处理)
            // 这里我们只对当前抽中的所有名字进行高亮
            sphereGroup.children.forEach((obj) => {
                const name = obj.element.textContent;
                if (winners.includes(name)) {
                    gsap.to(obj.element.style, {
                        scale: 2.2, 
                        color: '#FFFF00', 
                        border: '5px solid #FF00FF', 
                        textShadow: '0 0 10px #FF00FF',
                        duration: 0.5, 
                        repeat: -1, 
                        yoyo: true, 
                    });
                } else {
                     gsap.to(obj.element.style, {
                        opacity: 0.1,
                        scale: 0.7,
                        filter: 'blur(3px)',
                        duration: 0.5,
                    });
                }
            });
            renderer.render(scene, camera); // 确保渲染器更新
        }
    });
};


// --- Three.js 核心函数 (与之前相同) ---

let camera, scene, renderer; 
let sphereGroup; 
let rafId; 
let targetObject = null; 

const animate = () => {
    if (sphereGroup && !isDrawing.value && resultNames.value.length === 0 && !showFinalResults.value) {
        sphereGroup.rotation.y += 0.005; 
        sphereGroup.rotation.x += 0.001; 
    }

    renderer.render(scene, camera);
    rafId = requestAnimationFrame(animate);
};

const onWindowResize = () => {
    if (!container.value) return; 
    const width = container.value.clientWidth;
    const height = container.value.clientHeight;

    camera.aspect = width / height;
    camera.updateProjectionMatrix(); 
    renderer.setSize(width, height);
};

const createSphereElements = () => {
    sphereGroup = new THREE.Group();
    const radius = 600; 
    const N = employees.length; // 10 人

    for (let i = 0; i < N; i++) {
        const phi = Math.acos(1 - 2 * i / N); 
        const theta = Math.sqrt(N * Math.PI) * phi; 

        const x = radius * Math.sin(phi) * Math.cos(theta);
        const y = radius * Math.sin(phi) * Math.sin(theta);
        const z = radius * Math.cos(phi);

        const element = document.createElement('div');
        element.textContent = employees[i];
        
        element.style.cssText = `
            padding: 12px 18px;
            color: white;
            font-size: 26px; 
            font-weight: 900;
            border: 3px solid rgba(0, 255, 255, 0.7); 
            border-radius: 8px;
            background: rgba(0, 50, 50, 0.6);
            backdrop-filter: blur(5px); 
            text-shadow: 0 0 5px #0ff; 
            transition: all 0.5s;
            text-align: center;
            pointer-events: none; 
        `;
        
        const object = new CSS3DObject(element);
        object.position.set(x, y, z);
        object.lookAt(camera.position); 

        sphereGroup.add(object);
    }

    scene.add(sphereGroup);
};


const init = () => {
    if (!container.value) return; 
    
    // 初始化剩余名单
    remainingEmployees.value = [...employees];
    currentPrizeIndex.value = 0;

    const width = container.value.clientWidth;
    const height = container.value.clientHeight;

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000); 

    camera = new THREE.PerspectiveCamera(50, width / height, 1, 5000);
    camera.position.z = 2000; 

    renderer = new CSS3DRenderer();
    renderer.setSize(width, height);
    renderer.domElement.style.position = 'absolute';
    renderer.domElement.style.top = '0px';

    container.value.appendChild(renderer.domElement);
    
    createSphereElements();

    window.addEventListener('resize', onWindowResize);
};


// --- Vue 生命周期钩子 ---
const container = ref(null); 
onMounted(() => {
    init(); 
    animate(); 
});

onBeforeUnmount(() => {
    window.removeEventListener('resize', onWindowResize);
    cancelAnimationFrame(rafId); 
    if (renderer && container.value && renderer.domElement) {
        container.value.removeChild(renderer.domElement);
    }
});
</script>

<style scoped>
/* --- 容器样式 --- */
.h-screen { height: 100vh; }
.w-full { width: 100vw; }

/* --- 2D UI 覆盖层样式 (按钮和结果) --- */
.ui-layer {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none; 
  display: flex;
  flex-direction: column;
  justify-content: flex-end; 
  align-items: center;
  padding-bottom: 80px;
  z-index: 10; 
}

.prize-display {
    pointer-events: none;
    position: absolute;
    top: 50px;
    padding: 10px 30px;
    font-size: 36px;
    font-weight: bold;
    color: #00ffff;
    background: rgba(0, 0, 0, 0.7);
    border: 3px solid #00ffff;
    border-radius: 10px;
    box-shadow: 0 0 15px #00ffff;
    z-index: 10;
}

.lottery-btn {
  pointer-events: auto; 
  padding: 18px 40px;
  font-size: 28px;
  font-weight: bold;
  color: #fff;
  background-color: #ff3366; 
  border: 4px solid #ff9900; 
  border-radius: 12px;
  box-shadow: 0 0 30px #ff3366, 0 0 10px #ff9900 inset;
  cursor: pointer;
  transition: all 0.3s;
  animation: pulse 1.5s infinite; 
  width: 90%; 
  max-width: 380px;
}

.lottery-btn:hover:not(:disabled) {
  background-color: #ff6699;
  transform: scale(1.08);
}

.lottery-btn:disabled {
  background-color: #444;
  cursor: default;
  opacity: 0.9;
  animation: none;
}

.result-box {
  pointer-events: auto; 
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  padding: 40px 60px;
  background: rgba(0, 0, 0, 0.98); 
  color: #ffff00; 
  font-weight: 900;
  border: 8px solid #ffff00;
  border-radius: 25px;
  box-shadow: 0 0 60px rgba(255, 255, 0, 0.9);
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  z-index: 20; 
  max-width: 80vw;
  min-width: 400px;
}

.final-results-box {
    pointer-events: auto; 
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    padding: 40px;
    background: rgba(0, 0, 0, 0.95); 
    color: #fff; 
    border: 5px solid #00ff00;
    border-radius: 20px;
    box-shadow: 0 0 50px rgba(0, 255, 0, 0.5);
    text-align: center;
    max-width: 90vw;
    min-width: 600px;
    z-index: 25; 
}


.result-title {
    font-size: 48px;
    margin-bottom: 20px;
    color: #fff;
    text-shadow: 0 0 10px #fff;
}

.winners-list {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 10px;
}

.winner-chip {
    background-color: #00ffff;
    color: #000;
    padding: 8px 15px;
    border-radius: 20px;
    font-size: 20px;
    font-weight: bold;
}

.final-chip {
    background-color: #3333ff; /* 与临时弹窗区分颜色 */
    color: white;
    padding: 4px 8px;
    margin: 4px;
    display: inline-block;
    font-size: 16px;
    font-weight: normal;
}

.continue-btn {
    padding: 12px 25px;
    font-size: 20px;
    color: #000;
    background-color: #00ffff; 
    border: none;
    border-radius: 8px;
    cursor: pointer;
    margin-top: 20px;
    transition: background-color 0.3s;
}

.continue-btn:hover {
    background-color: #33ffff;
}

/* 最终结果表格样式 */
.results-table {
    width: 100%;
    margin-top: 20px;
    border-collapse: collapse;
    color: #fff;
    font-size: 18px;
}

.results-table th, .results-table td {
    padding: 12px;
    border: 1px solid #008000;
    text-align: left;
}

.results-table th {
    background-color: #004d00;
    color: #aaffaa;
    font-size: 20px;
}

.results-table td {
    background-color: #1a1a1a;
}

/* 按钮的脉冲动画 */
@keyframes pulse {
  0% { box-shadow: 0 0 30px #ff3366, 0 0 10px #ff9900 inset; }
  50% { box-shadow: 0 0 50px #ff3366, 0 0 20px #ff9900 inset; }
  100% { box-shadow: 0 0 30px #ff3366, 0 0 10px #ff9900 inset; }
}

/* Vue 结果弹窗的过渡动画 */
.fade-scale-enter-active,
.fade-scale-leave-active {
  transition: all 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55); 
}
.fade-scale-enter-from,
.fade-scale-leave-to {
  opacity: 0;
  transform: translate(-50%, -50%) scale(0.3);
}
.fade-scale-enter-to,
.fade-scale-leave-from {
  opacity: 1;
  transform: translate(-50%, -50%) scale(1);
}
</style>