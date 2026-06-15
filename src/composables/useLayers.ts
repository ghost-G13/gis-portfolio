/**
 * ============================================================
 * useLayers — 图层管理组合式函数 (Composable)
 * ============================================================
 * 职责：
 *   - 复用图层相关的业务逻辑
 *   - 封装对 mapStore 的图层操作
 *   - 提供搜索过滤、批量显隐、统计等功能
 * 使用方式：在任意组件中调用 const { filtered, toggle, ... } = useLayers()
 * ============================================================
 */

import { computed } from 'vue'
import { useMapStore } from '@/stores/map'

export function useLayers() {
  const mapStore = useMapStore()

  // --------------------------------------------------
  // 1. 从 Store 中派生的只读数据
  // --------------------------------------------------

  /** 全部图层 */
  const allLayers = computed(() => mapStore.layers)

  /** 搜索过滤后的图层 */
  const filteredLayers = computed(() => {
    const keyword = mapStore.searchKeyword.trim().toLowerCase()
    if (!keyword) return mapStore.layers
    return mapStore.layers.filter((layer) =>
      layer.name.toLowerCase().includes(keyword)
    )
  })

  /** 可见图层数量 */
  const visibleCount = computed(() => mapStore.visibleLayerCount)

  /** 图层搜索关键词 */
  const searchKeyword = computed({
    get: () => mapStore.searchKeyword,
    set: (val: string) => mapStore.setSearchKeyword(val),
  })

  // --------------------------------------------------
  // 2. 操作方法（委托给 Store）
  // --------------------------------------------------

  /** 切换图层显隐 */
  function toggleLayer(id: string, visible: boolean) {
    mapStore.toggleLayerVisibility(id, visible)
  }

  /** 显示全部图层 */
  function showAll() {
    mapStore.showAllLayers()
  }

  /** 隐藏全部图层 */
  function hideAll() {
    mapStore.hideAllLayers()
  }

  /** 设置搜索关键词 */
  function setKeyword(keyword: string) {
    mapStore.setSearchKeyword(keyword)
  }

  // --------------------------------------------------
  // 3. 返回接口
  // --------------------------------------------------
  return {
    allLayers,
    filteredLayers,
    visibleCount,
    searchKeyword,
    toggleLayer,
    showAll,
    hideAll,
    setKeyword,
  }
}
