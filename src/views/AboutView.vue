<script setup lang="ts">
/**
 * AboutView.vue
 * ============================================
 * 关于页面
 * 职责：展示项目介绍、技术栈与实验说明
 * ============================================
 */

import { useThemeStore } from '@/stores/theme'

const themeStore = useThemeStore()

const techStack = [
  { category: '前端框架', items: ['Vue 3', 'Vite', 'TypeScript'] },
  { category: '状态管理', items: ['Pinia', 'Vue Composables'] },
  { category: '路由', items: ['Vue Router 4'] },
  { category: '地图引擎', items: ['Leaflet', 'OpenStreetMap', 'Esri', 'OpenTopoMap'] },
  { category: 'GIS 算法', items: ['Haversine 距离', '多边形面积', 'GeoJSON 解析'] },
  { category: '样式布局', items: ['CSS Grid', 'Flexbox', 'CSS 变量', 'Media Query'] },
]

const experiments = [
  { id: '实验一', title: '环境搭建', desc: 'Vue 3 + Vite + TypeScript 项目初始化，目录结构设计，Git 版本控制' },
  { id: '实验二-1', title: '布局与主题', desc: 'CSS Grid/Flexbox 语义化布局，深色/浅色主题切换，响应式适配' },
  { id: '实验二-2', title: 'ES6+ 数据处理', desc: 'GeoJSON 异步加载，数组高阶函数（map/filter/reduce），Class 数据模型' },
  { id: '实验二-3', title: '组件通信', desc: 'Props/Emit 父子通信，v-model 双向绑定，图层列表与搜索过滤' },
  { id: '实验二-4', title: '全局状态与路由', desc: 'Pinia mapStore 全局状态，Vue Router 多页面，Composables 复用逻辑' },
]
</script>

<template>
  <div class="about-view" :data-theme="themeStore.theme">
    <header class="view-header">
      <h1>ℹ️ 关于</h1>
      <button class="theme-toggle" @click="themeStore.toggleTheme">
        <span v-if="themeStore.theme === 'light'">🌙 深色</span>
        <span v-else>☀️ 浅色</span>
      </button>
    </header>

    <main class="view-main">
      <!-- 项目简介 -->
      <section class="about-section">
        <h2>项目简介</h2>
        <p class="about-text">
          本项目是一个基于 Vue 3 + TypeScript + Leaflet 的 GIS 地图应用，
          作为《GIS 工程与开发》课程的实验成果。应用实现了地图浏览、图层管理、
          测量工具、GeoJSON 数据加载与分析等功能，并采用现代化的前端技术栈进行构建。
        </p>
        <p class="about-text">
          地图默认中心点位于中国重庆市（29.5630°N, 106.5516°E），
          支持多种底图切换（街道图、卫星图、地形图、深色图），
          以及六个示例图层的动态显隐控制。
        </p>
      </section>

      <!-- 技术栈 -->
      <section class="about-section">
        <h2>技术栈</h2>
        <div class="tech-grid">
          <div v-for="group in techStack" :key="group.category" class="tech-card">
            <h3>{{ group.category }}</h3>
            <ul>
              <li v-for="item in group.items" :key="item">{{ item }}</li>
            </ul>
          </div>
        </div>
      </section>

      <!-- 实验目录 -->
      <section class="about-section">
        <h2>实验内容</h2>
        <div class="exp-list">
          <div v-for="exp in experiments" :key="exp.id" class="exp-item">
            <div class="exp-id">{{ exp.id }}</div>
            <div class="exp-content">
              <h3>{{ exp.title }}</h3>
              <p>{{ exp.desc }}</p>
            </div>
          </div>
        </div>
      </section>

      <!-- 开发者信息 -->
      <section class="about-section">
        <h2>开发信息</h2>
        <div class="info-grid">
          <div class="info-item">
            <span class="info-label">课程名称</span>
            <span class="info-value">GIS 工程与开发</span>
          </div>
          <div class="info-item">
            <span class="info-label">构建工具</span>
            <span class="info-value">Vite 5 + Vue 3.4</span>
          </div>
          <div class="info-item">
            <span class="info-label">地图引擎</span>
            <span class="info-value">Leaflet 1.9</span>
          </div>
          <div class="info-item">
            <span class="info-label">坐标系统</span>
            <span class="info-value">WGS84 (EPSG:4326)</span>
          </div>
        </div>
      </section>
    </main>
  </div>
</template>

<style scoped>
.about-view {
  min-height: 100vh;
  background-color: var(--bg-page);
  color: var(--text-primary);
  transition: background-color var(--transition-base), color var(--transition-base);
}

.view-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  height: var(--header-height);
  background-color: var(--bg-header);
  border-bottom: 1px solid var(--border-color);
  box-shadow: var(--shadow-sm);
}

.view-header h1 {
  font-size: 18px;
  font-weight: 600;
}

.theme-toggle {
  height: 36px;
  padding: 0 14px;
  border: 1px solid var(--accent-color);
  border-radius: 8px;
  background-color: var(--accent-color);
  color: #ffffff;
  font-size: 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: all var(--transition-fast);
}

.theme-toggle:hover {
  background-color: var(--accent-hover);
  border-color: var(--accent-hover);
  transform: scale(1.04);
}

.view-main {
  padding: 24px;
  max-width: 900px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.about-section {
  background-color: var(--bg-sidebar);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  padding: 24px;
  box-shadow: var(--shadow-sm);
  transition: background-color var(--transition-base), border-color var(--transition-base);
}

.about-section h2 {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 16px;
  color: var(--text-primary);
  padding-bottom: 10px;
  border-bottom: 1px solid var(--border-color);
}

.about-text {
  font-size: 15px;
  line-height: 1.7;
  color: var(--text-secondary);
  margin-bottom: 12px;
}

.about-text:last-child {
  margin-bottom: 0;
}

/* 技术栈卡片 */
.tech-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 16px;
}

.tech-card {
  padding: 16px;
  background-color: var(--bg-main);
  border-radius: 8px;
  border: 1px solid var(--border-color);
}

.tech-card h3 {
  font-size: 14px;
  font-weight: 600;
  color: var(--accent-color);
  margin-bottom: 10px;
}

.tech-card ul {
  list-style: none;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.tech-card li {
  font-size: 13px;
  padding: 4px 10px;
  background-color: var(--bg-sidebar);
  color: var(--text-secondary);
  border-radius: 4px;
  border: 1px solid var(--border-color);
}

/* 实验列表 */
.exp-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.exp-item {
  display: flex;
  gap: 16px;
  padding: 14px 16px;
  background-color: var(--bg-main);
  border-radius: 8px;
  border: 1px solid var(--border-color);
  transition: transform var(--transition-fast), box-shadow var(--transition-fast);
}

.exp-item:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-sm);
}

.exp-id {
  font-size: 12px;
  font-weight: 600;
  color: var(--accent-color);
  background-color: rgba(37, 99, 235, 0.1);
  padding: 4px 10px;
  border-radius: 6px;
  height: fit-content;
  white-space: nowrap;
}

.exp-content h3 {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 4px;
}

.exp-content p {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.5;
}

/* 信息网格 */
.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 14px;
  background-color: var(--bg-main);
  border-radius: 6px;
}

.info-label {
  font-size: 12px;
  color: var(--text-secondary);
}

.info-value {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

@media (max-width: 768px) {
  .view-main {
    padding: 16px;
  }

  .tech-grid {
    grid-template-columns: 1fr;
  }

  .exp-item {
    flex-direction: column;
    gap: 8px;
  }

  .info-grid {
    grid-template-columns: 1fr 1fr;
  }
}
</style>
