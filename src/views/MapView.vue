<script setup lang="ts">
/**
 * MapView.vue
 * ============================================
 * 地图视图页面
 * 职责：承载完整的地图交互界面
 *   - 侧边栏：图层控制、工具栏、测量工具、数据分析
 *   - 主区域：LeafletMap 组件
 *   - 状态栏：实时坐标与缩放信息
 * 技术点：
 *   - 使用 Pinia mapStore 替代组件级 ref 管理地图状态
 *   - 使用 useLayers Composable 复用图层业务逻辑
 *   - Props/Emit 与全局 Store 结合实现组件通信
 * ============================================
 */

import { ref, computed, reactive, onMounted, onUnmounted, nextTick } from 'vue'
import { useThemeStore } from '@/stores/theme'
import { useMapStore } from '@/stores/map'
import { useBookmarkStore } from '@/stores/bookmark'
import { useLayers } from '@/composables/useLayers'
import LeafletMap from '@/components/LeafletMap.vue'
import MapLibreMap from '@/components/MapLibreMap.vue'
import LayerList from '@/components/LayerList.vue'
import { STYLE_PRESETS, type StylePreset } from '@/config/mapStyles'
import type { Feature, FeatureCollection } from 'geojson'

// --------------------------------------------
// ES6+ GIS 数据处理模块
// --------------------------------------------
import { loadGeoJSON } from '@/utils/geojsonLoader'
import { getCollectionStats, calculatePolygonAreas } from '@/utils/geojsonProcessor'
import { LayerModel } from '@/models/LayerModel'

// --------------------------------------------
// 主题状态
// --------------------------------------------
const themeStore = useThemeStore()
const currentTheme = computed(() => themeStore.theme)

// --------------------------------------------
// 全局地图状态（Pinia Store）
// --------------------------------------------
const mapStore = useMapStore()
const bookmarkStore = useBookmarkStore()

// --------------------------------------------
// 图层逻辑（Composable 复用）
// --------------------------------------------
const { allLayers, visibleCount } = useLayers()

// --------------------------------------------
// 侧边栏折叠状态（移动端用）
// --------------------------------------------
const sidebarCollapsed = ref(false)
function toggleSidebar() {
  sidebarCollapsed.value = !sidebarCollapsed.value
}

// --------------------------------------------
// 侧边栏可拖动调整宽度
// --------------------------------------------
const sidebarWidth = ref(220)
const isResizing = ref(false)
const gisAppRef = ref<HTMLDivElement | null>(null)

function startResize() {
  isResizing.value = true
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
}

function onResizeMove(e: MouseEvent) {
  if (!isResizing.value) return
  const newWidth = e.clientX
  if (newWidth >= 180 && newWidth <= 400) {
    sidebarWidth.value = newWidth
    if (gisAppRef.value) {
      gisAppRef.value.style.setProperty('--sidebar-width', `${newWidth}px`)
    }
  }
}

function stopResize() {
  isResizing.value = false
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
}

onMounted(() => {
  window.addEventListener('mousemove', onResizeMove)
  window.addEventListener('mouseup', stopResize)
})
onUnmounted(() => {
  window.removeEventListener('mousemove', onResizeMove)
  window.removeEventListener('mouseup', stopResize)
})

// --------------------------------------------
// 地图引擎切换
// --------------------------------------------
const mapEngine = ref<'leaflet' | 'maplibre'>('leaflet')
function switchEngine(engine: 'leaflet' | 'maplibre') {
  mapEngine.value = engine
  // MapLibre 在隐藏状态下初始化时 canvas 尺寸不正确，切换显示后需要重新计算
  if (engine === 'maplibre') {
    nextTick(() => {
      mlMapRef.value?.resize()
    })
  }
}

// --------------------------------------------
// MapLibre 专用状态
// --------------------------------------------
const mlStylePreset = ref<StylePreset>('amap-vec')
const mlGeoJSONData = ref<FeatureCollection | undefined>(undefined)
const mlSelectedFeature = ref<Feature | null>(null)

function handleSwitchMapLibreStyle(preset: StylePreset) {
  mlStylePreset.value = preset
}

/** 一键飞行到 3D 建筑区域（解放碑附近，带俯仰角） */
function handleFlyTo3DBuildings() {
  // 解放碑附近，zoom 15，pitch 60° 以明显看到 3D 拉伸
  mlMapRef.value?.flyTo(29.56, 106.58, 15, 60)
  // 调试用：2 秒后检查
  setTimeout(() => {
    console.log('[MapView] flyTo 调用完成')
  }, 2000)
}

function onMLFeatureClick(feature: GeoJSON.Feature) {
  mlSelectedFeature.value = feature
}

// --------------------------------------------
// 地图组件引用（用于调用暴露的方法）
// --------------------------------------------
const mapRef = ref<InstanceType<typeof LeafletMap> | null>(null)
const mlMapRef = ref<InstanceType<typeof MapLibreMap> | null>(null)

// 工具栏操作（根据当前引擎调用对应组件的方法）
function handleZoomIn() {
  if (mapEngine.value === 'leaflet') {
    mapRef.value?.zoomIn()
  } else {
    mlMapRef.value?.zoomIn()
  }
}
function handleZoomOut() {
  if (mapEngine.value === 'leaflet') {
    mapRef.value?.zoomOut()
  } else {
    mlMapRef.value?.zoomOut()
  }
}
function handleReset() {
  if (mapEngine.value === 'leaflet') {
    mapRef.value?.resetView()
  } else {
    mlMapRef.value?.resetView()
  }
}
function handleLocate() {
  if (mapEngine.value === 'leaflet') {
    mapRef.value?.locateMe()
  } else {
    mlMapRef.value?.locateMe()
  }
}

/** 飞行到书签位置 */
function handleFlyToBookmark(id: string) {
  const bm = bookmarkStore.bookmarks.find((b) => b.id === id)
  if (!bm) return
  if (mapEngine.value === 'leaflet') {
    mapRef.value?.flyTo(bm.lat, bm.lng, bm.zoom)
  } else {
    mlMapRef.value?.flyTo(bm.lat, bm.lng, bm.zoom)
  }
}

// --------------------------------------------
// 测量工具
// --------------------------------------------
const measureMode = ref<'none' | 'distance' | 'area'>('none')
const measureResult = ref('')

function handleMeasureDistance() {
  measureMode.value = 'distance'
  measureResult.value = '点击地图添加测量点，双击结束'
  mapRef.value?.startMeasureDistance()
}
function handleMeasureArea() {
  measureMode.value = 'area'
  measureResult.value = '点击地图添加顶点（至少3点），双击结束'
  mapRef.value?.startMeasureArea()
}
function handleClearMeasure() {
  measureMode.value = 'none'
  measureResult.value = ''
  mapRef.value?.clearMeasure()
}
function onMeasureResult(type: 'distance' | 'area', value: string) {
  measureResult.value = `${type === 'distance' ? '距离' : '面积'}: ${value}`
}

// --------------------------------------------
// 地图状态回调：将 LeafletMap 的 emit 同步到 mapStore
// --------------------------------------------
function onUpdateCenter(lat: number, lng: number) {
  mapStore.updateCenter(lat, lng)
}
function onUpdateZoom(zoom: number) {
  mapStore.updateZoom(zoom)
}
function onUpdateMouse(lat: number, lng: number) {
  mapStore.updateMouse(lat, lng)
}

// --------------------------------------------
// 书签功能
// --------------------------------------------
const bookmarkName = ref('')
const showBookmarkInput = ref(false)

/** 保存当前视角为书签 */
function handleSaveBookmark() {
  if (!showBookmarkInput.value) {
    // 首次点击：展示输入框，预填坐标作为名称
    bookmarkName.value = `书签 ${bookmarkStore.count + 1}`
    showBookmarkInput.value = true
    return
  }
  // 第二次点击：确认保存
  const name = bookmarkName.value.trim() || `书签 ${bookmarkStore.count + 1}`
  bookmarkStore.addBookmark(name, mapStore.centerLat, mapStore.centerLng, mapStore.zoom)
  bookmarkName.value = ''
  showBookmarkInput.value = false
}

/** 取消保存书签 */
function handleCancelBookmark() {
  showBookmarkInput.value = false
  bookmarkName.value = ''
}

/** 删除书签 */
function handleRemoveBookmark(id: string) {
  bookmarkStore.removeBookmark(id)
}

// --------------------------------------------
// GIS 数据处理面板状态
// --------------------------------------------
const dataPanel = reactive({
  loading: false,
  loaded: false,
  error: '',
  stats: null as ReturnType<typeof getCollectionStats> | null,
  areaStats: null as ReturnType<typeof calculatePolygonAreas> | null,
  filteredCount: 0,
})

let currentLayer: LayerModel | null = null

async function handleLoadData() {
  dataPanel.loading = true
  dataPanel.error = ''
  dataPanel.loaded = false

  try {
    const result = await loadGeoJSON('/data/sample-cities.geojson')
    if (!result.success || !result.data) {
      throw new Error(result.error || '加载失败')
    }

    currentLayer = new LayerModel('cities', result.data, {
      name: '示例城市数据',
      description: 'GeoJSON 示例数据',
      source: 'public/data/sample-cities.geojson',
    })

    const { features, ...meta } = result.data
    console.log('[DataPanel] 加载成功，元数据:', meta)
    console.log('[DataPanel] 要素数量:', features.length)

    const geometryTypes = [...new Set(features.map((f) => f.geometry?.type).filter(Boolean))]
    console.log('[DataPanel] 几何类型分布:', geometryTypes)

    const tier1Count = features.filter((f) => f.properties?.category === '一线城市').length
    console.log('[DataPanel] 一线城市数量:', tier1Count)

    const totalPopulation = features.reduce((sum, f) => {
      const pop = f.properties?.population
      return typeof pop === 'number' ? sum + pop : sum
    }, 0)
    console.log('[DataPanel] 总人口(万):', totalPopulation)

    dataPanel.stats = getCollectionStats(result.data)
    dataPanel.areaStats = calculatePolygonAreas(result.data)

    currentLayer.filterByType('Polygon')
    dataPanel.filteredCount = currentLayer.featureCount

    // 同步数据到 MapLibre 组件（数据驱动样式）
    mlGeoJSONData.value = result.data as FeatureCollection

    dataPanel.loaded = true
  } catch (err) {
    dataPanel.error = err instanceof Error ? err.message : '未知错误'
    console.error('[DataPanel] 加载失败:', err)
  } finally {
    dataPanel.loading = false
  }
}

async function handleLoadTestData() {
  dataPanel.loading = true
  dataPanel.error = ''
  dataPanel.loaded = false

  try {
    const result = await loadGeoJSON('/data/test-cluster-3d.geojson')
    if (!result.success || !result.data) {
      throw new Error(result.error || '加载失败')
    }

    currentLayer = new LayerModel('test-cluster-3d', result.data, {
      name: '测试数据（聚合+3D）',
      description: '320 个点 + 15 个建筑多边形',
      source: 'public/data/test-cluster-3d.geojson',
    })

    const { features } = result.data
    console.log('[DataPanel] 测试数据加载成功，要素数量:', features.length)

    dataPanel.stats = getCollectionStats(result.data)
    dataPanel.areaStats = calculatePolygonAreas(result.data)

    currentLayer.filterByType('Polygon')
    dataPanel.filteredCount = currentLayer.featureCount

    // 同步数据到 MapLibre 组件（触发聚合 + 3D 拉伸）
    mlGeoJSONData.value = result.data as FeatureCollection

    dataPanel.loaded = true
  } catch (err) {
    dataPanel.error = err instanceof Error ? err.message : '未知错误'
    console.error('[DataPanel] 测试数据加载失败:', err)
  } finally {
    dataPanel.loading = false
  }
}

function handleClearFilter() {
  currentLayer?.clearFilter()
  dataPanel.filteredCount = currentLayer?.featureCount ?? 0
}
</script>

<template>
  <div
    ref="gisAppRef"
    class="gis-app"
    :class="{ 'sidebar-collapsed': sidebarCollapsed, 'resizing': isResizing }"
    :data-theme="currentTheme"
  >
    <!-- ==================== 顶栏（页面内）==================== -->
    <header class="page-header">
      <button class="menu-btn" aria-label="切换侧边栏" @click="toggleSidebar">
        <span class="hamburger"></span>
      </button>
      <h1 class="page-title">🗺️ 地图视图</h1>
      <button class="theme-toggle" aria-label="切换主题" @click="themeStore.toggleTheme">
        <span class="theme-icon" v-if="currentTheme === 'light'">🌙</span>
        <span class="theme-icon" v-else>☀️</span>
        <span class="theme-label">{{ currentTheme === 'light' ? '深色' : '浅色' }}</span>
      </button>
    </header>

    <!-- ==================== 侧边栏 ==================== -->
    <aside class="app-sidebar">
      <div class="resize-handle" @mousedown="startResize" title="拖动调整宽度"></div>

      <!-- 图层控制区 —— 通过 Props 绑定 mapStore 数据，Emit 回调更新 Store -->
      <nav class="sidebar-section">
        <h2>
          图层
          <span class="layer-count-badge">{{ visibleCount }} / {{ allLayers.length }}</span>
        </h2>
        <LayerList
          :layers="mapStore.layers"
          v-model:search-keyword="mapStore.searchKeyword"
          @update:layer="mapStore.toggleLayerVisibility"
        />
      </nav>

      <!-- 地图引擎切换 -->
      <nav class="sidebar-section">
        <h2>地图引擎</h2>
        <div class="toolbar">
          <button
            class="tool-btn"
            :class="{ 'tool-btn-active': mapEngine === 'leaflet' }"
            @click="switchEngine('leaflet')"
            title="Leaflet 栅格地图"
          >
            <span class="tool-icon">🍃</span>
            <span class="tool-label">Leaflet</span>
          </button>
          <button
            class="tool-btn"
            :class="{ 'tool-btn-active': mapEngine === 'maplibre' }"
            @click="switchEngine('maplibre')"
            title="MapLibre 矢量瓦片"
          >
            <span class="tool-icon">🗺️</span>
            <span class="tool-label">MapLibre</span>
          </button>
        </div>
      </nav>

      <!-- 底图样式切换（仅 MapLibre 引擎时显示） -->
      <nav v-if="mapEngine === 'maplibre'" class="sidebar-section">
        <h2>底图样式</h2>
        <div class="toolbar">
          <button
            v-for="(cfg, key) in STYLE_PRESETS"
            :key="key"
            class="tool-btn"
            :class="{ 'tool-btn-active': mlStylePreset === key }"
            @click="handleSwitchMapLibreStyle(key)"
            :title="cfg.name"
          >
            <span class="tool-icon">{{ cfg.icon }}</span>
            <span class="tool-label">{{ cfg.name }}</span>
          </button>
        </div>
      </nav>

      <!-- 一键查看 3D 建筑（仅 MapLibre 引擎时显示） -->
      <nav v-if="mapEngine === 'maplibre'" class="sidebar-section">
        <h2>3D 视角</h2>
        <button class="tool-btn" @click="handleFlyTo3DBuildings" title="飞行到建筑区并倾斜视角">
          <span class="tool-icon">🔍</span>
          <span class="tool-label">一键查看 3D 建筑</span>
        </button>
      </nav>

      <!-- 要素信息（MapLibre 点击高亮） -->
      <nav v-if="mapEngine === 'maplibre' && mlSelectedFeature" class="sidebar-section">
        <h2>选中要素</h2>
        <div class="feature-info">
          <div class="feature-row">
            <span class="feature-label">名称</span>
            <span class="feature-value">{{ (mlSelectedFeature.properties as any)?.name ?? '-' }}</span>
          </div>
          <div class="feature-row">
            <span class="feature-label">类别</span>
            <span class="feature-value">{{ (mlSelectedFeature.properties as any)?.category ?? '-' }}</span>
          </div>
          <div class="feature-row">
            <span class="feature-label">人口(万)</span>
            <span class="feature-value">{{ (mlSelectedFeature.properties as any)?.population ?? '-' }}</span>
          </div>
          <div class="feature-row">
            <span class="feature-label">面积</span>
            <span class="feature-value">{{ (mlSelectedFeature.properties as any)?.area ?? '-' }}</span>
          </div>
          <button class="tool-btn clear-btn" @click="mlSelectedFeature = null" style="margin-top:8px;">
            <span class="tool-icon">🧹</span>
            <span class="tool-label">清除选择</span>
          </button>
        </div>
      </nav>

      <!-- 工具栏 -->
      <nav class="sidebar-section">
        <h2>工具栏</h2>
        <div class="toolbar">
          <button class="tool-btn" @click="handleZoomIn" title="放大">
            <span class="tool-icon">➕</span>
            <span class="tool-label">放大</span>
          </button>
          <button class="tool-btn" @click="handleZoomOut" title="缩小">
            <span class="tool-icon">➖</span>
            <span class="tool-label">缩小</span>
          </button>
          <button class="tool-btn" @click="handleReset" title="重置视角">
            <span class="tool-icon">🎯</span>
            <span class="tool-label">重置</span>
          </button>
          <button class="tool-btn" @click="handleLocate" title="定位">
            <span class="tool-icon">📡</span>
            <span class="tool-label">定位</span>
          </button>
        </div>
      </nav>

      <!-- 测量工具 -->
      <nav class="sidebar-section">
        <h2>测量工具</h2>
        <div class="toolbar">
          <button
            class="tool-btn"
            :class="{ 'tool-btn-active': measureMode === 'distance' }"
            @click="handleMeasureDistance"
            title="测距"
          >
            <span class="tool-icon">📏</span>
            <span class="tool-label">测距</span>
          </button>
          <button
            class="tool-btn"
            :class="{ 'tool-btn-active': measureMode === 'area' }"
            @click="handleMeasureArea"
            title="测面积"
          >
            <span class="tool-icon">📐</span>
            <span class="tool-label">测面积</span>
          </button>
          <button class="tool-btn" @click="handleClearMeasure" title="清除测量">
            <span class="tool-icon">🧹</span>
            <span class="tool-label">清除</span>
          </button>
        </div>
        <div v-if="measureResult" class="measure-result">
          <span class="measure-result-text">{{ measureResult }}</span>
        </div>
      </nav>

      <!-- 实时坐标面板（toolbar-map 联动） -->
      <section class="sidebar-section coord-panel">
        <h2>实时坐标</h2>
        <div class="coord-grid">
          <div class="coord-row">
            <span class="coord-label">鼠标</span>
            <span class="coord-value">{{ mapStore.formattedMouseCoord }}</span>
          </div>
          <div class="coord-row">
            <span class="coord-label">中心</span>
            <span class="coord-value">{{ mapStore.formattedCenterCoord }}</span>
          </div>
          <div class="coord-row">
            <span class="coord-label">缩放</span>
            <span class="coord-value">{{ mapStore.zoom }}</span>
          </div>
        </div>
      </section>

      <!-- 书签面板 -->
      <section class="sidebar-section bookmark-panel">
        <h2>
          书签
          <span class="layer-count-badge" v-if="bookmarkStore.count">{{ bookmarkStore.count }}</span>
        </h2>

        <!-- 保存书签操作区 -->
        <div class="bookmark-actions">
          <div v-if="showBookmarkInput" class="bookmark-input-row">
            <input
              v-model="bookmarkName"
              type="text"
              class="bookmark-input"
              placeholder="输入书签名称..."
              @keyup.enter="handleSaveBookmark"
              @keyup.escape="handleCancelBookmark"
            />
            <button class="bookmark-btn bookmark-confirm" @click="handleSaveBookmark" title="确认">✔</button>
            <button class="bookmark-btn bookmark-cancel" @click="handleCancelBookmark" title="取消">✖</button>
          </div>
          <button v-else class="tool-btn" @click="handleSaveBookmark" title="保存当前视角为书签">
            <span class="tool-icon">🔖</span>
            <span class="tool-label">保存书签</span>
          </button>
        </div>

        <!-- 书签列表 -->
        <div v-if="bookmarkStore.count" class="bookmark-list">
          <div
            v-for="bm in bookmarkStore.sortedBookmarks"
            :key="bm.id"
            class="bookmark-item"
            @click="handleFlyToBookmark(bm.id)"
            title="点击飞行到该位置"
          >
            <div class="bookmark-item-info">
              <span class="bookmark-item-name">📌 {{ bm.name }}</span>
              <span class="bookmark-item-coord">{{ bm.lat.toFixed(4) }}°, {{ bm.lng.toFixed(4) }}° | z{{ bm.zoom }}</span>
            </div>
            <button
              class="bookmark-delete-btn"
              @click.stop="handleRemoveBookmark(bm.id)"
              title="删除书签"
            >🗑️</button>
          </div>
        </div>
        <div v-else class="bookmark-empty">
          暂无书签，导航到感兴趣的位置后点击“保存书签”
        </div>
      </section>

      <!-- GIS 数据处理面板 -->
      <section class="sidebar-section data-panel">
        <h2>数据分析</h2>
        <button class="tool-btn load-btn" :disabled="dataPanel.loading" @click="handleLoadData">
          <span class="tool-icon">📂</span>
          <span class="tool-label">{{ dataPanel.loading ? '加载中...' : '加载 GeoJSON' }}</span>
        </button>
        <button
          class="tool-btn load-btn"
          style="margin-top: 8px; background-color: #f59e0b; border-color: #f59e0b;"
          :disabled="dataPanel.loading"
          @click="handleLoadTestData"
        >
          <span class="tool-icon">🧪</span>
          <span class="tool-label">{{ dataPanel.loading ? '加载中...' : '加载测试数据（聚合+3D）' }}</span>
        </button>

        <div v-if="dataPanel.error" class="data-error">
          ⚠️ {{ dataPanel.error }}
        </div>

        <div v-if="dataPanel.loaded && dataPanel.stats" class="data-stats">
          <div class="stat-row">
            <span class="stat-label">要素总数</span>
            <span class="stat-value">{{ dataPanel.stats.featureCount }}</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">几何类型</span>
            <span class="stat-value">{{ dataPanel.stats.geometryTypes.join(', ') }}</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">平均属性数</span>
            <span class="stat-value">{{ dataPanel.stats.avgPropertiesPerFeature }}</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">过滤后(Polygon)</span>
            <span class="stat-value">{{ dataPanel.filteredCount }}</span>
          </div>
        </div>

        <div v-if="dataPanel.areaStats && dataPanel.areaStats.length" class="data-areas">
          <h3>面积统计</h3>
          <div v-for="item in dataPanel.areaStats" :key="item.id" class="area-row">
            <span class="area-name">{{ item.name }}</span>
            <span class="area-value">{{ item.areaFormatted }}</span>
          </div>
        </div>

        <button v-if="dataPanel.loaded" class="tool-btn clear-btn" @click="handleClearFilter">
          <span class="tool-icon">🔄</span>
          <span class="tool-label">清除过滤</span>
        </button>
      </section>
    </aside>

    <!-- ==================== 地图主区域（双容器）==================== -->
    <main class="app-main">
      <!-- Leaflet 栅格地图容器 -->
      <div v-show="mapEngine === 'leaflet'" class="map-engine-container">
        <LeafletMap
          ref="mapRef"
          :theme="currentTheme"
          :layers="mapStore.layers"
          @update:center="onUpdateCenter"
          @update:zoom="onUpdateZoom"
          @update:mouse="onUpdateMouse"
          @measure:result="onMeasureResult"
        />
      </div>

      <!-- MapLibre 矢量瓦片地图容器 -->
      <div v-show="mapEngine === 'maplibre'" class="map-engine-container">
        <MapLibreMap
          ref="mlMapRef"
          :latitude="mapStore.centerLat"
          :longitude="mapStore.centerLng"
          :zoom="mapStore.zoom"
          :style-preset="mlStylePreset"
          :geojson-data="mlGeoJSONData"
          @update:center="onUpdateCenter"
          @update:zoom="onUpdateZoom"
          @update:mouse="onUpdateMouse"
          @feature:click="onMLFeatureClick"
        />
      </div>
    </main>

    <!-- ==================== 状态栏 ==================== -->
    <footer class="app-footer">
      <div class="status-group">
        <span class="status-item" title="鼠标当前位置">
          🖱️ {{ mapStore.formattedMouseCoord }}
        </span>
        <span class="status-item">中心: {{ mapStore.formattedCenterCoord }}</span>
        <span class="status-item">缩放: {{ mapStore.zoom }}</span>
      </div>
      <div class="status-group">
        <span class="status-item">可见图层: {{ visibleCount }}</span>
        <span class="status-item">坐标系: WGS84</span>
        <span class="status-item">底图: 多源切换</span>
      </div>
    </footer>
  </div>
</template>

<style scoped>
/* ============================================
   地图视图 Grid 布局（桌面端）
   ============================================ */
.gis-app {
  width: 100%;
  height: calc(100vh - var(--header-height));
  display: grid;
  grid-template-rows: var(--header-height) 1fr var(--footer-height);
  grid-template-columns: var(--sidebar-width) 1fr;
  grid-template-areas:
    "header header"
    "sidebar main"
    "footer footer";
  overflow: hidden;
}

/* ============================================
   页面顶栏
   ============================================ */
.page-header {
  grid-area: header;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  background-color: var(--bg-header);
  border-bottom: 1px solid var(--border-color);
  box-shadow: var(--shadow-sm);
  z-index: 100;
  transition: background-color var(--transition-base), border-color var(--transition-base);
}

.page-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
  flex: 1;
  margin-left: 12px;
  transition: color var(--transition-base);
}

.menu-btn {
  display: none;
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 6px;
  background: transparent;
  cursor: pointer;
  align-items: center;
  justify-content: center;
  transition: background-color var(--transition-fast);
}

.menu-btn:hover {
  background-color: var(--bg-main);
}

.hamburger {
  display: block;
  width: 18px;
  height: 2px;
  background-color: var(--text-primary);
  position: relative;
  transition: background-color var(--transition-fast);
}

.hamburger::before,
.hamburger::after {
  content: '';
  position: absolute;
  left: 0;
  width: 18px;
  height: 2px;
  background-color: var(--text-primary);
  transition: transform var(--transition-fast), background-color var(--transition-fast);
}

.hamburger::before { top: -6px; }
.hamburger::after { top: 6px; }

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

.theme-icon { font-size: 16px; }
.theme-label { font-size: 13px; font-weight: 500; }

/* ============================================
   侧边栏
   ============================================ */
.app-sidebar {
  grid-area: sidebar;
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px;
  background-color: var(--bg-sidebar);
  border-right: 1px solid var(--border-color);
  overflow-y: auto;
  transition: background-color var(--transition-base), border-color var(--transition-base);
  position: relative;
}

.resize-handle {
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  width: 6px;
  cursor: col-resize;
  background: transparent;
  z-index: 10;
  transition: background-color var(--transition-fast);
}

.resize-handle:hover,
.gis-app.resizing .resize-handle {
  background-color: var(--accent-color);
}

.gis-app.resizing {
  user-select: none;
}

.sidebar-section h2 {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 10px;
  transition: color var(--transition-base);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.layer-count-badge {
  font-size: 11px;
  font-weight: 500;
  padding: 2px 8px;
  background-color: var(--accent-color);
  color: #ffffff;
  border-radius: 10px;
  text-transform: none;
  letter-spacing: 0;
}

.toolbar {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.tool-btn {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background-color: var(--bg-sidebar);
  color: var(--text-primary);
  font-size: 14px;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.tool-btn:hover {
  border-color: var(--accent-color);
  background-color: var(--bg-main);
  color: var(--accent-color);
  transform: translateY(-2px);
  box-shadow: var(--shadow-sm);
}

.tool-btn:active {
  transform: translateY(0) scale(0.98);
}

.tool-icon { font-size: 18px; }
.tool-label { font-weight: 500; }

/* ============================================
   实时坐标面板（toolbar-map 联动）
   ============================================ */
.coord-panel .coord-grid {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px;
  background-color: var(--bg-main);
  border-radius: 6px;
}

.coord-row {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
}

.coord-label {
  color: var(--text-secondary);
  font-weight: 500;
}

.coord-value {
  color: var(--accent-color);
  font-family: 'Consolas', monospace;
  font-weight: 600;
}

/* ============================================
   地图主区域
   ============================================ */
.app-main {
  grid-area: main;
  position: relative;
  background-color: var(--bg-main);
  overflow: hidden;
  transition: background-color var(--transition-base);
}

.map-engine-container {
  width: 100%;
  height: 100%;
  position: absolute;
  top: 0;
  left: 0;
}

/* ============================================
   状态栏
   ============================================ */
.app-footer {
  grid-area: footer;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  background-color: var(--bg-footer);
  border-top: 1px solid var(--border-color);
  font-size: 12px;
  color: var(--text-muted);
  transition: background-color var(--transition-base), border-color var(--transition-base), color var(--transition-base);
}

.status-group {
  display: flex;
  gap: 20px;
}

.status-item {
  font-family: 'Consolas', monospace;
}

/* ============================================
   数据分析面板样式
   ============================================ */
.data-panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.data-panel .load-btn {
  background-color: var(--accent-color);
  color: #ffffff;
  border-color: var(--accent-color);
}

.data-panel .load-btn:hover {
  background-color: var(--accent-hover);
  border-color: var(--accent-hover);
}

.data-panel .load-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.data-error {
  padding: 8px 10px;
  background-color: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 6px;
  font-size: 12px;
  color: #ef4444;
}

.data-stats {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px;
  background-color: var(--bg-main);
  border-radius: 6px;
}

.stat-row {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
}

.stat-label { color: var(--text-secondary); }

.stat-value {
  color: var(--text-primary);
  font-weight: 600;
  font-family: 'Consolas', monospace;
}

.data-areas {
  padding: 10px;
  background-color: var(--bg-main);
  border-radius: 6px;
}

.data-areas h3 {
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 6px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.area-row {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  padding: 3px 0;
}

.area-name { color: var(--text-secondary); }

.area-value {
  color: var(--accent-color);
  font-weight: 600;
  font-family: 'Consolas', monospace;
}

.clear-btn { border-style: dashed; }

/* ============================================
   要素信息面板（MapLibre 点击交互）
   ============================================ */
.feature-info {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px;
  background-color: var(--bg-main);
  border-radius: 6px;
}

.feature-row {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
}

.feature-label {
  color: var(--text-secondary);
  font-weight: 500;
}

.feature-value {
  color: var(--accent-color);
  font-weight: 600;
  font-family: 'Consolas', monospace;
}

/* ============================================
   测量工具样式
   ============================================ */
.tool-btn-active {
  border-color: var(--accent-color) !important;
  background-color: var(--accent-color) !important;
  color: #ffffff !important;
  transform: none;
  box-shadow: var(--shadow-sm);
}

.tool-btn-active:hover {
  background-color: var(--accent-hover) !important;
  border-color: var(--accent-hover) !important;
  transform: none;
}

.measure-result {
  margin-top: 8px;
  padding: 10px 12px;
  background-color: var(--bg-main);
  border: 1px solid var(--accent-color);
  border-radius: 6px;
  transition: all var(--transition-base);
}

.measure-result-text {
  font-size: 13px;
  font-weight: 600;
  color: var(--accent-color);
  font-family: 'Consolas', monospace;
}

/* ============================================
   书签面板样式
   ============================================ */
.bookmark-actions {
  margin-bottom: 10px;
}

.bookmark-input-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.bookmark-input {
  flex: 1;
  height: 32px;
  padding: 0 10px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background-color: var(--bg-main);
  color: var(--text-primary);
  font-size: 13px;
  outline: none;
  transition: border-color var(--transition-fast);
}

.bookmark-input:focus {
  border-color: var(--accent-color);
}

.bookmark-btn {
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition-fast);
}

.bookmark-confirm {
  background-color: #10b981;
  color: #fff;
}

.bookmark-confirm:hover {
  background-color: #059669;
}

.bookmark-cancel {
  background-color: var(--bg-main);
  color: var(--text-secondary);
}

.bookmark-cancel:hover {
  background-color: var(--border-color);
}

.bookmark-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 220px;
  overflow-y: auto;
}

.bookmark-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  cursor: pointer;
  transition: all var(--transition-fast);
  background-color: var(--bg-main);
}

.bookmark-item:hover {
  border-color: var(--accent-color);
  background-color: var(--bg-sidebar);
  transform: translateX(2px);
}

.bookmark-item-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.bookmark-item-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.bookmark-item-coord {
  font-size: 11px;
  color: var(--text-muted);
  font-family: 'Consolas', monospace;
}

.bookmark-delete-btn {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 4px;
  background: transparent;
  cursor: pointer;
  font-size: 12px;
  opacity: 0.5;
  transition: all var(--transition-fast);
  display: flex;
  align-items: center;
  justify-content: center;
}

.bookmark-delete-btn:hover {
  opacity: 1;
  background-color: #fecaca;
  color: #dc2626;
}

.bookmark-empty {
  font-size: 12px;
  color: var(--text-muted);
  text-align: center;
  padding: 16px 8px;
  line-height: 1.5;
}

/* ============================================
   响应式适配：移动端（< 768px）
   ============================================ */
@media (max-width: 768px) {
  .gis-app {
    grid-template-columns: 1fr;
    grid-template-areas:
      "header"
      "main"
      "footer";
  }

  .app-sidebar {
    position: fixed;
    left: 0;
    top: var(--header-height);
    bottom: var(--footer-height);
    width: var(--sidebar-width);
    z-index: 90;
    transform: translateX(0);
    transition: transform var(--transition-base), background-color var(--transition-base);
  }

  .gis-app.sidebar-collapsed .app-sidebar {
    transform: translateX(-100%);
  }

  .menu-btn {
    display: flex;
  }

  .page-title {
    font-size: 16px;
  }

  .app-footer {
    flex-direction: column;
    justify-content: center;
    gap: 2px;
    padding: 4px 12px;
    height: auto;
    min-height: var(--footer-height);
  }
}
</style>
