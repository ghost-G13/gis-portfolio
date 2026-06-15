<script setup lang="ts">
/**
 * App.vue
 * ============================================
 * 应用根组件（Shell 模式）
 * 职责：
 *   - 提供全局导航栏（Vue Router 链接）
 *   - 挂载 <router-view> 渲染当前页面
 *   - 管理全局主题状态（通过 Pinia themeStore）
 *   - 定义全局 CSS 变量与 reset，供所有子页面共享
 * ============================================
 */

import { computed } from 'vue'
import { useThemeStore } from '@/stores/theme'

const themeStore = useThemeStore()
const currentTheme = computed(() => themeStore.theme)
</script>

<template>
  <div id="app-shell" :data-theme="currentTheme">
    <!-- ==================== 全局导航栏 ==================== -->
    <header class="global-nav">
      <div class="nav-brand">
        <span class="nav-logo">🗺️</span>
        <span class="nav-title">GIS 应用</span>
      </div>

      <nav class="nav-links">
        <router-link to="/" class="nav-link" active-class="nav-link-active">
          <span class="nav-link-icon">🗺️</span>
          <span class="nav-link-text">地图</span>
        </router-link>
        <router-link to="/geo" class="nav-link" active-class="nav-link-active">
          <span class="nav-link-icon">🎨</span>
          <span class="nav-link-text">专题</span>
        </router-link>
        <router-link to="/data" class="nav-link" active-class="nav-link-active">
          <span class="nav-link-icon">📊</span>
          <span class="nav-link-text">数据</span>
        </router-link>
        <router-link to="/about" class="nav-link" active-class="nav-link-active">
          <span class="nav-link-icon">ℹ️</span>
          <span class="nav-link-text">关于</span>
        </router-link>
      </nav>

      <button
        class="theme-toggle"
        aria-label="切换主题"
        @click="themeStore.toggleTheme"
      >
        <span class="theme-icon" v-if="currentTheme === 'light'">🌙</span>
        <span class="theme-icon" v-else>☀️</span>
        <span class="theme-label">{{ currentTheme === 'light' ? '深色' : '浅色' }}</span>
      </button>
    </header>

    <!-- ==================== 路由视图 ==================== -->
    <router-view v-slot="{ Component }">
      <transition name="fade" mode="out-in">
        <component :is="Component" />
      </transition>
    </router-view>
  </div>
</template>

<style>
/* ============================================
   全局 CSS 变量定义：浅色主题（默认）
   ============================================ */
:root {
  /* 布局尺寸 */
  --header-height: 56px;
  --footer-height: 32px;
  --sidebar-width: 220px;

  /* 颜色系统 */
  --bg-page: #f0f2f5;
  --bg-header: #ffffff;
  --bg-sidebar: #ffffff;
  --bg-footer: #ffffff;
  --bg-main: #e4e6eb;

  --text-primary: #1f2329;
  --text-secondary: #5c6670;
  --text-muted: #8f959e;

  --border-color: #dde1e6;
  --accent-color: #2563eb;
  --accent-hover: #1d4ed8;
  --map-accent: #2563eb;

  --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.08);
  --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.1);

  /* 过渡时间 */
  --transition-fast: 0.15s ease;
  --transition-base: 0.25s ease;
}

/* ============================================
   CSS 变量定义：深色主题
   ============================================ */
[data-theme="dark"] {
  --bg-page: #0d1117;
  --bg-header: #161b22;
  --bg-sidebar: #161b22;
  --bg-footer: #161b22;
  --bg-main: #0d1117;

  --text-primary: #c9d1d9;
  --text-secondary: #8b949e;
  --text-muted: #6e7681;

  --border-color: #30363d;
  --accent-color: #58a6ff;
  --accent-hover: #79c0ff;
  --map-accent: #58a6ff;

  --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.4);
  --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.5);
}

/* ============================================
   全局重置与基础样式
   ============================================ */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body, #app {
  width: 100%;
  height: 100%;
  font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
  background-color: var(--bg-page);
  color: var(--text-primary);
  transition: background-color var(--transition-base), color var(--transition-base);
}

/* ============================================
   全局导航栏
   ============================================ */
#app-shell {
  width: 100%;
  min-height: 100vh;
  background-color: var(--bg-page);
  transition: background-color var(--transition-base);
}

.global-nav {
  position: sticky;
  top: 0;
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  height: var(--header-height);
  background-color: var(--bg-header);
  border-bottom: 1px solid var(--border-color);
  box-shadow: var(--shadow-sm);
  transition: background-color var(--transition-base), border-color var(--transition-base);
}

.nav-brand {
  display: flex;
  align-items: center;
  gap: 10px;
}

.nav-logo {
  font-size: 22px;
}

.nav-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  transition: color var(--transition-base);
}

.nav-links {
  display: flex;
  align-items: center;
  gap: 6px;
}

.nav-link {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: 8px;
  text-decoration: none;
  color: var(--text-secondary);
  font-size: 14px;
  font-weight: 500;
  transition: all var(--transition-fast);
}

.nav-link:hover {
  background-color: var(--bg-main);
  color: var(--accent-color);
}

.nav-link-active {
  background-color: var(--accent-color);
  color: #ffffff !important;
}

.nav-link-active:hover {
  background-color: var(--accent-hover);
}

.nav-link-icon {
  font-size: 16px;
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
  box-shadow: var(--shadow-md);
}

.theme-icon {
  font-size: 16px;
}

.theme-label {
  font-size: 13px;
  font-weight: 500;
}

/* ============================================
   路由切换动画
   ============================================ */
.fade-enter-active,
.fade-leave-active {
  transition: opacity var(--transition-base), transform var(--transition-base);
}

.fade-enter-from {
  opacity: 0;
  transform: translateY(6px);
}

.fade-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

/* ============================================
   响应式适配
   ============================================ */
@media (max-width: 768px) {
  .global-nav {
    padding: 0 16px;
  }

  .nav-title {
    display: none;
  }

  .nav-link-text {
    display: none;
  }

  .nav-link {
    padding: 8px 12px;
  }

  .theme-label {
    display: none;
  }
}
</style>
