<template>
  <!-- 容器元素，现在使用 w-full h-full 来填满父容器（即整个屏幕） -->
  <div ref="container" class="w-full h-full relative overflow-hidden">
    
    <!-- 新增: 红色幕布介绍层 - 动画完成后 v-if="false" 移除，减少性能消耗 -->
    <div v-if="showIntro" class="intro-curtain-layer">
        <!-- 抽奖标题，在幕布之上 -->
        <div class="intro-text">AU技术组聚餐抽奖</div>
        <!-- 左右两半幕布，使用 ref 控制 GSAP 动画 -->
        <div class="curtain left-curtain" ref="leftCurtain"></div>
        <div class="curtain right-curtain" ref="rightCurtain"></div>
    </div>

    <!-- 2D UI 覆盖层：当前奖项、抽奖按钮和结果展示 -->
    <div class="ui-layer">

      <!-- 当前抽取的奖项名称 (只显示级别，不显示奖品，制造反差感) -->
      <div class="prize-display">
        <!-- 抽奖介绍完成后才显示奖项名称 -->
        <span v-if="!showIntro">
            {{ currentPrizeIndex < prizeTiers.length ? currentPrizeName : '所有奖项已抽完' }}
        </span>
      </div>

      <!-- 抽奖按钮 -->
      <button 
        @click="startLottery" 
        :disabled="isDrawing || currentPrizeIndex >= prizeTiers.length || showIntro"
        class="lottery-btn"
      >
        {{ getButtonText() }}
      </button>

      <!-- 当前批次结果展示 (使用 Vue Transition 实现弹出动画) -->
      <Transition name="fade-scale">
        <div v-if="resultNames.length > 0 && !showFinalResults" class="result-box">
          
          <!-- 此处揭晓奖项名称和奖品描述 -->
          <div class="result-title">🎉 **{{ prizeTiers[currentPrizeIndex - 1].name }}** ({{ prizeTiers[currentPrizeIndex - 1].description }}) 🎉</div>
          
          <div class="winners-list">
            <span v-for="name in resultNames" :key="name" class="winner-chip">{{ name }}</span>
          </div>
          
          <button class="continue-btn" @click="resetLottery">
            <!-- 已将“继续”改为“确定” -->
            {{ currentPrizeIndex < prizeTiers.length ? '确定' : '查看最终结果' }}
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
                        <!-- 标题修改：从 '奖项 (奖品)' 简化为 '奖品'，并删除了中奖人数列 -->
                        <th>奖品</th> 
                        <th>中奖名单</th>
                    </tr>
                </thead>
                <tbody>
                    <!-- 循环遍历所有奖项 tier，并按 1等奖 -> 2等奖 -> 3等奖 顺序显示 -->
                    <tr v-for="prize in prizeTiers.slice().reverse()" :key="prize.name">
                        <!-- 显示奖项名称和奖品描述 -->
                        <!-- 单元格内容：保持显示 “奖项名称 (奖品描述)” -->
                        <td>{{ prize.name }} ({{ prize.description }})</td>
                        
                        <!-- 中奖名单列保持不变 -->
                        <td>
                            <span v-for="name in prize.drawn.value" :key="name" class="winner-chip final-chip">{{ name }}</span>
                            <span v-if="prize.drawn.value.length === 0">暂无</span>
                        </td>
                    </tr>
                </tbody>
            </table>
            
            <!-- 按钮区域 -->
            <div class="result-actions">
                <button class="continue-btn" @click="showFinalResults = false">
                    关闭查看
                </button>
                <button class="restart-btn" @click="restartLottery">
                    🎉 再抽一次 (重新开始)
                </button>
            </div>

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

// 1. 团队成员名单 (10人) - 将 '张三' 替换为 '杲绍峰'
const employees = [
  '杲绍峰', '苏昆', '王春祥', '刘东宇', '张衡',
  '梅东胜', '卓柏呈', '王超', '贾君慧', '王国强'
];
// 锁定一等奖得主：杲绍峰
const FORCED_WINNER_NAME = '杲绍峰'; 
// 一等奖在 prizeTiers 数组中的索引（从0开始）
const FIRST_PRIZE_INDEX = 2; 

// 2. 奖项设置和顺序 (三等奖 -> 二等奖 -> 一等奖)
const prizeTiers = [
    { name: '三等奖', count: 3, description: '喝三瓶啤酒', drawn: ref([]) }, 
    { name: '二等奖', count: 2, description: '喝半斤白酒', drawn: ref([]) }, 
    { name: '一等奖', count: 1, description: '为每人发66元红包', drawn: ref([]) }, 
];

// 3. 抽奖状态和结果
const remainingEmployees = ref([]); // 尚未中奖的名单
const currentPrizeIndex = ref(0); // 当前正在抽取的奖项索引
const isDrawing = ref(false); 
const resultNames = ref([]); // 当前批次抽中的名单 (用于弹窗显示)
const showFinalResults = ref(false); // 控制最终结果表格的显示

// --- 介绍屏幕状态和引用 ---
const showIntro = ref(true); 
const leftCurtain = ref(null);
const rightCurtain = ref(null);
// --- 结束: 介绍屏幕状态和引用 ---


// 4. 计算属性
const currentPrizeName = computed(() => {
    // 仅显示奖项名称，用于抽奖过程中的展示 (制造反差感，不提前暴露奖品)
    if (currentPrizeIndex.value < prizeTiers.length) {
        return prizeTiers[currentPrizeIndex.value].name;
    }
    return '抽奖已结束';
});

// --- UI 辅助函数 ---
const getButtonText = () => {
    if (isDrawing.value) return '✨ 抽奖中...';
    if (currentPrizeIndex.value >= prizeTiers.length) return '所有奖项已抽完';
    
    const prize = prizeTiers[currentPrizeIndex.value];
    return `抽取 ${prize.name} (共 ${prize.count} 名)`;
};


// --- GSAP 动画逻辑封装 ---
const runCurtainAnimation = () => {
    if (!leftCurtain.value || !rightCurtain.value) return;

    // 确保幕布位置复位（用于重新开始）
    gsap.set([leftCurtain.value, rightCurtain.value], { x: '0%', opacity: 1 });
    gsap.set('.intro-text', { opacity: 1 });
    
    showIntro.value = true; // 确保 intro layer 重新显示

    // Animation timeline
    gsap.timeline()
        .to('.intro-text', { // 1. Text fade out
            delay: 2.0,
            duration: 0.5,
            opacity: 0,
            ease: 'power1.out'
        })
        .to(leftCurtain.value, { // 2. Left Curtain open
            duration: 1.5,
            x: '-100%',
            ease: 'power3.inOut'
        }, "<") // Start at the same time as the right curtain
        .to(rightCurtain.value, { // 3. Right Curtain open
            duration: 1.5,
            x: '100%',
            ease: 'power3.inOut',
            onComplete: () => {
                showIntro.value = false; // 动画结束后隐藏整个 intro layer
            }
        }, "<");
};


// --- 抽奖核心函数 ---

// 重置抽奖状态：隐藏弹窗，准备下一轮抽奖 (用于抽奖进行中)
const resetLottery = () => {
    if (currentPrizeIndex.value >= prizeTiers.length) {
        resultNames.value = []; 
        showFinalResults.value = true;
    } else {
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
    
    renderer.render(scene, camera);
}

// 重新开始抽奖 (用于最终结果页)
const restartLottery = () => {
    // 1. 重置核心状态
    remainingEmployees.value = [...employees];
    currentPrizeIndex.value = 0;
    
    // 2. 清空所有奖项的中奖名单
    prizeTiers.forEach(prize => {
        prize.drawn.value = [];
    });

    // 3. 重置 UI 状态
    resultNames.value = [];
    showFinalResults.value = false;
    
    // 4. 重置 3D 元素外观
    sphereGroup.children.forEach((obj) => {
        gsap.to(obj.element.style, {
            opacity: 1,
            scale: 1,
            color: 'white',
            border: '3px solid rgba(0, 255, 255, 0.7)',
            textShadow: '0 0 5px #0ff',
            filter: 'blur(0px)',
            duration: 0.5,
        });
    });
    renderer.render(scene, camera);

    // 5. 重新播放幕布动画
    runCurtainAnimation(); 
};


const startLottery = () => {
    // 确保抽奖未进行，且不是在开场动画期间
    if (isDrawing.value || currentPrizeIndex.value >= prizeTiers.length || showFinalResults.value || showIntro.value) return; 
    
    if (resultNames.value.length > 0) {
        if (currentPrizeIndex.value >= prizeTiers.length) {
            resetLottery();
            return; 
        }
        
        resetLottery();
        setTimeout(() => _executeLotterySequence(), 500); 
    } else {
        _executeLotterySequence();
    }
};

const _executeLotterySequence = () => {
    isDrawing.value = true;
    resultNames.value = [];

    const currentPrize = prizeTiers[currentPrizeIndex.value];
    let drawCount = currentPrize.count;
    
    // 1. 确定候选人池
    let candidates = [...remainingEmployees.value]; // 复制一份所有剩余员工名单
    
    // 如果抽取的不是一等奖 (FIRST_PRIZE_INDEX = 2)，则排除锁定的一等奖得主 (杲绍峰)
    if (currentPrizeIndex.value !== FIRST_PRIZE_INDEX) {
        candidates = candidates.filter(name => name !== FORCED_WINNER_NAME);
    }
    // 现在 'candidates' 是用于随机抽取的正确名单。

    const winners = [];
    
    // ** 2. 强制中奖逻辑 (针对一等奖) **
    if (currentPrizeIndex.value === FIRST_PRIZE_INDEX && currentPrize.count === 1) {
        // 1. 强制加入预定的一等奖得主
        winners.push(FORCED_WINNER_NAME);
        
        // 2. 将该得主从 *持久的* 剩余名单 (remainingEmployees.value) 中移除
        const forcedIndex = remainingEmployees.value.findIndex(name => name === FORCED_WINNER_NAME);
        if (forcedIndex !== -1) {
            remainingEmployees.value.splice(forcedIndex, 1);
        }
        
        // 3. 减少需要随机抽取的数量
        drawCount--; 
    }

    // 3. 随机选择剩余的 N 位中奖者
    for (let i = 0; i < drawCount; i++) {
        if (candidates.length === 0) break; // 如果候选人池空了
        
        const randomIndex = Math.floor(Math.random() * candidates.length);
        const winner = candidates.splice(randomIndex, 1)[0]; // 从候选人池中移除并选中
        winners.push(winner);
        
        // 4. 从 *持久的* 剩余名单 (remainingEmployees.value) 中移除这位中奖者
        const originalIndex = remainingEmployees.value.findIndex(name => name === winner);
        if (originalIndex !== -1) {
            remainingEmployees.value.splice(originalIndex, 1);
        }
    }
    
    // 如果没有抽取到中奖者 (比如名单抽完了)，则停止
    if (winners.length === 0 && currentPrize.count > 0) {
        isDrawing.value = false;
        resultNames.value = ["名单已抽空"]; // 提示信息
        currentPrizeIndex.value++;
        return;
    }
    
    // 确定动画聚焦对象 (使用第一个中奖者，无论是否是强制得主)
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
            
            // 选中元素放大、发光 (只对当前抽中的所有名字进行高亮)
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


// --- Three.js 核心函数 (保持不变) ---

let camera, scene, renderer; 
let sphereGroup; 
let rafId; 
let targetObject = null; 

const animate = () => {
    if (sphereGroup && !isDrawing.value && resultNames.value.length === 0 && !showFinalResults.value && !showIntro.value) {
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
    renderer.domElement.style.left = '0px'; 

    container.value.appendChild(renderer.domElement);
    
    createSphereElements();

    window.addEventListener('resize', onWindowResize);
};


// --- Vue 生命周期钩子 ---
const container = ref(null); 
onMounted(() => {
    init(); 
    animate(); 
    runCurtainAnimation(); // 初始加载时运行幕布动画
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
/* 确保组件完全占据父容器 */
.w-full { width: 100%; }
.h-full { height: 100%; }

/* --- 幕布介绍层样式 (NEW) --- */
.intro-curtain-layer {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 100; /* 确保在最顶层 */
    display: flex;
    justify-content: center;
    align-items: center;
    background-color: transparent; 
    overflow: hidden;
    pointer-events: none;
    user-select: none;
}

.curtain {
    position: absolute;
    top: 0;
    width: 50%;
    height: 100%;
    background-color: #8b0000; /* 深红色 */
    box-shadow: 0 0 50px rgba(0, 0, 0, 0.9);
    z-index: 101; /* 幕布在文本之上，但文本 z-index 更高 */
}

.left-curtain {
    left: 0;
}

.right-curtain {
    right: 0;
}

.intro-text {
    position: absolute;
    color: #ffff00; /* 金黄色文字 */
    font-size: 80px;
    font-weight: 900;
    text-shadow: 0 0 20px #ff0000, 0 0 5px #fff;
    z-index: 102; /* 文字在幕布之上 */
    pointer-events: none;
    user-select: none;
    padding: 20px 40px;
    border: 5px solid gold;
    border-radius: 10px;
}
/* --- 结束: 幕布介绍层样式 --- */

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
    display: flex; /* 使用 flex 布局 */
    flex-direction: column;
    align-items: center;
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

.result-actions {
    display: flex;
    justify-content: center;
    gap: 1.5rem; 
    margin-top: 2rem; 
}

.continue-btn {
    padding: 12px 25px;
    font-size: 20px;
    color: #000;
    background-color: #00ffff; 
    border: none;
    border-radius: 8px;
    cursor: pointer;
    transition: background-color 0.3s;
}

.continue-btn:hover {
    background-color: #33ffff;
}

/* 新增：重新开始按钮样式 */
.restart-btn {
    padding: 12px 25px;
    font-size: 20px;
    color: #fff;
    background-color: #ff3366; 
    border: 3px solid #fff;
    border-radius: 8px;
    cursor: pointer;
    transition: background-color 0.3s;
}

.restart-btn:hover {
    background-color: #e60039;
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