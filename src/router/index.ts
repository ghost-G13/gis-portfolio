import { createRouter, createWebHistory } from 'vue-router'

/**
 * Vue Router 路由配置（组件懒加载）
 * ============================================
 * 使用动态导入 () => import('@/views/xxx.vue') 实现组件懒加载：
 *   - 访问对应路由时才下载该页面组件的 JS 代码
 *   - 减少首屏加载体积，提升应用启动速度
 *
 * 定义三个页面路由：
 *   - /      -> MapView   地图主页面
 *   - /data  -> DataView  数据表格页面
 *   - /about -> AboutView 关于页面
 * ============================================
 */
const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'Map',
      component: () => import('@/views/MapView.vue'),
      meta: { title: '地图' },
    },
    {
      path: '/geo',
      name: 'GeoAnalysis',
      component: () => import('@/views/GeoAnalysisView.vue'),
      meta: { title: '专题分析' },
    },
    {
      path: '/data',
      name: 'Data',
      component: () => import('@/views/DataView.vue'),
      meta: { title: '数据' },
    },
    {
      path: '/about',
      name: 'About',
      component: () => import('@/views/AboutView.vue'),
      meta: { title: '关于' },
    },
  ],
})

export default router
