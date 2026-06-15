/**
 * ============================================================
 * Map Store — 全局地图与图层状态管理 (Pinia)
 * ============================================================
 * 职责：
 *   - 集中管理地图视图状态（中心、缩放、鼠标坐标）
 *   - 集中管理图层列表状态（显隐、搜索、统计）
 *   - 提供 Actions 供各组件调用，避免状态分散在多个组件中
 * ============================================================
 */

import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import type { LayerItem } from '@/components/LayerList.vue'

export const useMapStore = defineStore('map', () => {
  // --------------------------------------------------
  // 1. 地图视图状态（State）
  // --------------------------------------------------

  /** 地图中心纬度 */
  const centerLat = ref(29.5630)
  /** 地图中心经度 */
  const centerLng = ref(106.5516)
  /** 地图缩放级别 */
  const zoom = ref(12)
  /** 鼠标当前纬度（实时追踪） */
  const mouseLat = ref(0)
  /** 鼠标当前经度（实时追踪） */
  const mouseLng = ref(0)

  // --------------------------------------------------
  // 2. 图层列表状态（State）
  // --------------------------------------------------

  /** 图层列表 */
  const layers = ref<LayerItem[]>([
    { id: 'poi', name: 'POI 兴趣点', icon: '📍', visible: true, type: 'Point' },
    { id: 'range', name: '覆盖范围', icon: '⭕', visible: true, type: 'Polygon' },
    { id: 'road', name: '道路网', icon: '🛣️', visible: false, type: 'LineString' },
    { id: 'building', name: '建筑物', icon: '🏠', visible: false, type: 'Polygon' },
    { id: 'river', name: '水系分布', icon: '💧', visible: true, type: 'LineString' },
    { id: 'terrain', name: '地形高程', icon: '⛰️', visible: false, type: 'Raster' },
  ])

  /** 图层搜索关键词 */
  const searchKeyword = ref('')

  // --------------------------------------------------
  // 3. 计算属性（Getters —— 基于 State 的派生值）
  // --------------------------------------------------

  /** 可见图层数量 */
  const visibleLayerCount = computed(() => {
    return layers.value.filter((layer) => layer.visible).length
  })

  /** 经过搜索过滤后的图层列表 */
  const filteredLayers = computed(() => {
    const keyword = searchKeyword.value.trim().toLowerCase()
    if (!keyword) return layers.value
    return layers.value.filter((layer) =>
      layer.name.toLowerCase().includes(keyword)
    )
  })

  /** 格式化的鼠标坐标字符串（供工具栏显示） */
  const formattedMouseCoord = computed(() => {
    return `${mouseLat.value.toFixed(6)}°, ${mouseLng.value.toFixed(6)}°`
  })

  /** 格式化的中心坐标字符串 */
  const formattedCenterCoord = computed(() => {
    return `${centerLat.value.toFixed(4)}°, ${centerLng.value.toFixed(4)}°`
  })

  // --------------------------------------------------
  // 4. 动作方法（Actions）
  // --------------------------------------------------

  /** 更新地图中心坐标 */
  function updateCenter(lat: number, lng: number) {
    centerLat.value = lat
    centerLng.value = lng
  }

  /** 更新地图缩放级别 */
  function updateZoom(z: number) {
    zoom.value = z
  }

  /** 更新鼠标实时坐标 */
  function updateMouse(lat: number, lng: number) {
    mouseLat.value = lat
    mouseLng.value = lng
  }

  /** 切换指定图层的可见性 */
  function toggleLayerVisibility(id: string, visible: boolean) {
    const layer = layers.value.find((l) => l.id === id)
    if (layer) {
      layer.visible = visible
    }
  }

  /** 设置图层搜索关键词 */
  function setSearchKeyword(keyword: string) {
    searchKeyword.value = keyword
  }

  /** 显示所有图层 */
  function showAllLayers() {
    layers.value.forEach((layer) => {
      layer.visible = true
    })
  }

  /** 隐藏所有图层 */
  function hideAllLayers() {
    layers.value.forEach((layer) => {
      layer.visible = false
    })
  }

  // --------------------------------------------------
  // 5. 返回 —— 所有响应式状态和计算属性供组件使用
  // --------------------------------------------------
  return {
    // State
    centerLat,
    centerLng,
    zoom,
    mouseLat,
    mouseLng,
    layers,
    searchKeyword,
    // Getters
    visibleLayerCount,
    filteredLayers,
    formattedMouseCoord,
    formattedCenterCoord,
    // Actions
    updateCenter,
    updateZoom,
    updateMouse,
    toggleLayerVisibility,
    setSearchKeyword,
    showAllLayers,
    hideAllLayers,
  }
}, {
  persist: {
    key: 'gis-map-store',
    pick: ['centerLat', 'centerLng', 'zoom', 'layers', 'searchKeyword'],
  },
})
