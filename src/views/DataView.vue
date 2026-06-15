<script setup lang="ts">
/**
 * DataView.vue
 * ============================================
 * 数据视图页面
 * 职责：以表格形式展示图层与 GeoJSON 数据的统计信息
 * 技术点：
 *   - 使用 useLayers Composable 读取全局图层状态
 *   - 使用 mapStore 获取地图统计信息
 *   - v-for 渲染表格，computed 派生统计数据
 * ============================================
 */

import { computed, reactive } from 'vue'
import { useMapStore } from '@/stores/map'
import { useLayers } from '@/composables/useLayers'
import { useThemeStore } from '@/stores/theme'
import { loadGeoJSON } from '@/utils/geojsonLoader'
import { getCollectionStats, calculatePolygonAreas } from '@/utils/geojsonProcessor'

const themeStore = useThemeStore()
const mapStore = useMapStore()
const { allLayers, visibleCount, filteredLayers } = useLayers()

// --------------------------------------------
// GeoJSON 数据加载与统计
// --------------------------------------------
const dataState = reactive({
  loading: false,
  loaded: false,
  error: '',
  stats: null as ReturnType<typeof getCollectionStats> | null,
  areaStats: null as ReturnType<typeof calculatePolygonAreas> | null,
})

async function handleLoadGeoJSON() {
  dataState.loading = true
  dataState.error = ''
  try {
    const result = await loadGeoJSON('/data/sample-cities.geojson')
    if (!result.success || !result.data) {
      throw new Error(result.error || '加载失败')
    }
    dataState.stats = getCollectionStats(result.data)
    dataState.areaStats = calculatePolygonAreas(result.data)
    dataState.loaded = true
  } catch (err) {
    dataState.error = err instanceof Error ? err.message : '未知错误'
  } finally {
    dataState.loading = false
  }
}

// --------------------------------------------
// 图层表格派生数据
// --------------------------------------------
const layerTableData = computed(() => {
  return allLayers.value.map((layer) => ({
    ...layer,
    statusText: layer.visible ? '显示' : '隐藏',
    statusClass: layer.visible ? 'status-on' : 'status-off',
  }))
})

const pointLayers = computed(() => allLayers.value.filter((l) => l.type === 'Point').length)
const lineLayers = computed(() => allLayers.value.filter((l) => l.type === 'LineString').length)
const polygonLayers = computed(() => allLayers.value.filter((l) => l.type === 'Polygon').length)
const rasterLayers = computed(() => allLayers.value.filter((l) => l.type === 'Raster').length)
</script>

<template>
  <div class="data-view" :data-theme="themeStore.theme">
    <header class="view-header">
      <h1>📊 数据视图</h1>
      <button class="theme-toggle" @click="themeStore.toggleTheme">
        <span v-if="themeStore.theme === 'light'">🌙 深色</span>
        <span v-else>☀️ 浅色</span>
      </button>
    </header>

    <main class="view-main">
      <!-- 图层概览卡片 -->
      <section class="data-section">
        <h2>图层概览</h2>
        <div class="stat-cards">
          <div class="stat-card">
            <span class="stat-card-value">{{ allLayers.length }}</span>
            <span class="stat-card-label">总图层数</span>
          </div>
          <div class="stat-card">
            <span class="stat-card-value">{{ visibleCount }}</span>
            <span class="stat-card-label">可见图层</span>
          </div>
          <div class="stat-card">
            <span class="stat-card-value">{{ pointLayers }}</span>
            <span class="stat-card-label">点图层</span>
          </div>
          <div class="stat-card">
            <span class="stat-card-value">{{ lineLayers }}</span>
            <span class="stat-card-label">线图层</span>
          </div>
          <div class="stat-card">
            <span class="stat-card-value">{{ polygonLayers }}</span>
            <span class="stat-card-label">面图层</span>
          </div>
          <div class="stat-card">
            <span class="stat-card-value">{{ rasterLayers }}</span>
            <span class="stat-card-label">栅格图层</span>
          </div>
        </div>
      </section>

      <!-- 图层明细表格 -->
      <section class="data-section">
        <h2>图层明细</h2>
        <div class="table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>名称</th>
                <th>图标</th>
                <th>类型</th>
                <th>状态</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="layer in layerTableData" :key="layer.id" :class="{ 'row-dimmed': !layer.visible }">
                <td><code>{{ layer.id }}</code></td>
                <td>{{ layer.name }}</td>
                <td>{{ layer.icon }}</td>
                <td><span class="type-tag">{{ layer.type || '-' }}</span></td>
                <td>
                  <span class="status-badge" :class="layer.statusClass">
                    {{ layer.statusText }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <!-- 地图当前状态 -->
      <section class="data-section">
        <h2>地图状态</h2>
        <div class="info-grid">
          <div class="info-item">
            <span class="info-label">中心纬度</span>
            <span class="info-value">{{ mapStore.formattedCenterCoord }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">缩放级别</span>
            <span class="info-value">{{ mapStore.zoom }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">鼠标坐标</span>
            <span class="info-value">{{ mapStore.formattedMouseCoord }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">搜索关键词</span>
            <span class="info-value">{{ mapStore.searchKeyword || '无' }}</span>
          </div>
        </div>
      </section>

      <!-- GeoJSON 数据加载 -->
      <section class="data-section">
        <h2>GeoJSON 数据分析</h2>
        <button class="action-btn" :disabled="dataState.loading" @click="handleLoadGeoJSON">
          {{ dataState.loading ? '加载中...' : '加载并分析 GeoJSON' }}
        </button>

        <div v-if="dataState.error" class="error-box">
          ⚠️ {{ dataState.error }}
        </div>

        <div v-if="dataState.loaded && dataState.stats" class="analysis-result">
          <div class="info-grid">
            <div class="info-item">
              <span class="info-label">要素总数</span>
              <span class="info-value">{{ dataState.stats.featureCount }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">几何类型</span>
              <span class="info-value">{{ dataState.stats.geometryTypes.join(', ') }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">平均属性数</span>
              <span class="info-value">{{ dataState.stats.avgPropertiesPerFeature }}</span>
            </div>
          </div>

          <div v-if="dataState.areaStats && dataState.areaStats.length" class="area-table-wrapper">
            <h3>面积统计</h3>
            <table class="data-table">
              <thead>
                <tr>
                  <th>名称</th>
                  <th>面积</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in dataState.areaStats" :key="item.id">
                  <td>{{ item.name }}</td>
                  <td><code>{{ item.areaFormatted }}</code></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </main>
  </div>
</template>

<style scoped>
.data-view {
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
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.data-section {
  background-color: var(--bg-sidebar);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  padding: 20px;
  box-shadow: var(--shadow-sm);
  transition: background-color var(--transition-base), border-color var(--transition-base);
}

.data-section h2 {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 16px;
  color: var(--text-primary);
}

.data-section h3 {
  font-size: 14px;
  font-weight: 600;
  margin: 16px 0 10px;
  color: var(--text-secondary);
}

/* 统计卡片 */
.stat-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 12px;
}

.stat-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 16px;
  background-color: var(--bg-main);
  border-radius: 8px;
  border: 1px solid var(--border-color);
}

.stat-card-value {
  font-size: 24px;
  font-weight: 700;
  color: var(--accent-color);
  font-family: 'Consolas', monospace;
}

.stat-card-label {
  font-size: 12px;
  color: var(--text-secondary);
}

/* 表格 */
.table-wrapper {
  overflow-x: auto;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

.data-table th,
.data-table td {
  padding: 10px 12px;
  text-align: left;
  border-bottom: 1px solid var(--border-color);
}

.data-table th {
  font-weight: 600;
  color: var(--text-secondary);
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  background-color: var(--bg-main);
}

.data-table tr:hover td {
  background-color: var(--bg-main);
}

.row-dimmed {
  opacity: 0.6;
}

.type-tag {
  font-size: 11px;
  padding: 2px 8px;
  background-color: var(--bg-main);
  color: var(--text-muted);
  border-radius: 4px;
}

.status-badge {
  font-size: 11px;
  padding: 2px 10px;
  border-radius: 10px;
  font-weight: 500;
}

.status-on {
  background-color: rgba(16, 185, 129, 0.15);
  color: #10b981;
}

.status-off {
  background-color: rgba(107, 114, 128, 0.15);
  color: var(--text-muted);
}

/* 信息网格 */
.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 12px;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px;
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
  font-family: 'Consolas', monospace;
}

/* 操作按钮 */
.action-btn {
  padding: 10px 18px;
  border: 1px solid var(--accent-color);
  border-radius: 8px;
  background-color: var(--accent-color);
  color: #ffffff;
  font-size: 14px;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.action-btn:hover {
  background-color: var(--accent-hover);
  border-color: var(--accent-hover);
}

.action-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.error-box {
  margin-top: 12px;
  padding: 10px 14px;
  background-color: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 6px;
  font-size: 13px;
  color: #ef4444;
}

.analysis-result {
  margin-top: 16px;
}

.area-table-wrapper {
  margin-top: 16px;
}

@media (max-width: 768px) {
  .view-main {
    padding: 16px;
  }

  .stat-cards {
    grid-template-columns: repeat(2, 1fr);
  }

  .info-grid {
    grid-template-columns: 1fr;
  }
}
</style>
