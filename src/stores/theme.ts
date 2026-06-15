/**
 * ============================================================
 * 主题状态管理 (Pinia Store)
 * ============================================================
 * 职责：管理全应用深色/浅色主题状态，支持持久化到 localStorage
 * ============================================================
 */

import { ref, watch } from 'vue'
import { defineStore } from 'pinia'

// 定义合法的主题类型
type Theme = 'light' | 'dark'

export const useThemeStore = defineStore('theme', () => {
  // --------------------------------------------------
  // 响应式状态
  // --------------------------------------------------
  // 优先从 localStorage 读取用户上次设置，否则默认浅色主题
  const stored = typeof localStorage !== 'undefined' ? localStorage.getItem('gis-theme') : null
  const theme = ref<Theme>((stored as Theme) || 'light')

  // --------------------------------------------------
  // 切换主题方法
  // --------------------------------------------------
  function toggleTheme() {
    theme.value = theme.value === 'light' ? 'dark' : 'light'
  }

  // --------------------------------------------------
  // 显式设置主题
  // --------------------------------------------------
  function setTheme(newTheme: Theme) {
    theme.value = newTheme
  }

  // --------------------------------------------------
  // 监听主题变化并持久化到 localStorage
  // 同时更新 document 的 data-theme 属性供 CSS 变量选择器使用
  // --------------------------------------------------
  watch(
    theme,
    (newVal) => {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('gis-theme', newVal)
      }
      if (typeof document !== 'undefined') {
        document.documentElement.setAttribute('data-theme', newVal)
      }
    },
    { immediate: true } // 初始化时立即执行一次
  )

  return { theme, toggleTheme, setTheme }
})
