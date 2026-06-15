<script setup lang="ts">
/**
 * GeoAnalysisView.vue
 * ============================================
 * GIS 专题分析页面
 * 功能：
 *   1. 加载行政区 GeoJSON（阿里云 DataV），用 L.geoJSON + onEachFeature 绑定交互
 *   2. 制作分级设色图（getColor 分级函数 + style 回调 + 图例）
 *   3. 制作比例符号图（按属性值映射符号大小）
 *   4. 用 pointToLayer 渲染点要素
 *   5. 用 filter 过滤要素
 * 数据源：阿里云 DataV GeoAtlas（重庆市 38 个区县）
 * ============================================
 */

import { ref, onMounted, onUnmounted, watch, computed } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import MapLegend from '@/components/MapLegend.vue'
import { useThemeStore } from '@/stores/theme'
import {
  districtStats,
  getDensity,
  getChoroplethColor,
  getGdpRadius,
  getGdpColor,
} from '@/data/chongqingStats'
import { personalData, getPOITypeName, getSeasonIcon } from '@/data/personalData'

const themeStore = useThemeStore()

// --------------------------------------------
// 类型定义
// --------------------------------------------
type ViewMode = 'choropleth' | 'proportional' | 'point' | 'filter' | 'footprints' | 'pois'

interface GeoFeature {
  type: 'Feature'
  properties: {
    adcode: string
    name: string
    center: [number, number]
    centroid: [number, number]
    [key: string]: unknown
  }
  geometry: {
    type: string
    coordinates: unknown
  }
}

interface GeoCollection {
  type: 'FeatureCollection'
  features: GeoFeature[]
}

// --------------------------------------------
// 响应式状态
// --------------------------------------------
const mapContainer = ref<HTMLDivElement | null>(null)
let mapInstance: L.Map | null = null
let geoJsonLayer: L.GeoJSON | null = null
let proportionalLayer: L.LayerGroup | null = null
let pointLayer: L.GeoJSON | null = null
let personalDataLayer: L.LayerGroup | null = null

const viewMode = ref<ViewMode>('choropleth')
const isLoading = ref(false)
const loadError = ref('')
const geoData = ref<GeoCollection | null>(null)

// 过滤条件
const filterMinDensity = ref(0)
const filterMinGdp = ref(0)

// 高亮状态
let highlightedLayer: L.Layer | null = null

// --------------------------------------------
// 底图配置
// --------------------------------------------
const baseMaps: Record<string, L.TileLayer> = {
  '高德标准': L.tileLayer(
    'https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}',
    { subdomains: '1234', maxZoom: 18, attribution: '&copy; 高德地图' }
  ),
  '高德卫星': L.tileLayer(
    'https://webst0{s}.is.autonavi.com/appmaptile?style=6&x={x}&y={y}&z={z}',
    { subdomains: '1234', maxZoom: 18, attribution: '&copy; 高德地图' }
  ),
  'OSM': L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors',
  }),
}

// --------------------------------------------
// 辅助函数：重置高亮
// --------------------------------------------
function resetHighlight(e: L.LeafletEvent) {
  const layer = e.target as L.Path
  if (geoJsonLayer) {
    geoJsonLayer.resetStyle(layer)
  }
  highlightedLayer = null
}

// --------------------------------------------
// 辅助函数：高亮样式
// --------------------------------------------
function highlightFeature(e: L.LeafletEvent) {
  const layer = e.target as L.Path
  layer.setStyle({
    weight: 3,
    color: '#666',
    dashArray: '',
    fillOpacity: 0.9,
  })
  layer.bringToFront()
  highlightedLayer = layer
}

// --------------------------------------------
// 辅助函数：Popup 内容
// --------------------------------------------
function createPopupContent(feature: GeoFeature): string {
  const props = feature.properties
  const stat = districtStats[props.adcode]
  const density = getDensity(props.adcode)

  let html = `<div style="min-width:180px;">`
  html += `<h4 style="margin:0 0 8px 0;font-size:15px;border-bottom:1px solid #eee;padding-bottom:4px;">${props.name}</h4>`

  if (stat) {
    html += `<div style="font-size:13px;line-height:1.8;">`
    html += `<div><b>人口：</b>${stat.population} 万人</div>`
    html += `<div><b>面积：</b>${stat.area} km²</div>`
    html += `<div><b>人口密度：</b>${density} 人/km²</div>`
    html += `<div><b>GDP：</b>${stat.gdp} 亿元</div>`
    html += `</div>`
  } else {
    html += `<div style="font-size:12px;color:#999;">暂无统计数据</div>`
  }

  html += `</div>`
  return html
}

// --------------------------------------------
// 1. 分级设色图 —— style 回调 + onEachFeature
// --------------------------------------------
function renderChoropleth(data: GeoCollection) {
  clearLayers()

  geoJsonLayer = L.geoJSON(data as any, {
    style: (feature) => {
      const adcode = (feature?.properties as any)?.adcode as string
      const density = getDensity(adcode)
      return {
        fillColor: getChoroplethColor(density),
        weight: 1.5,
        opacity: 1,
        color: '#3182bd',
        dashArray: '',
        fillOpacity: 0.7,
      }
    },
    onEachFeature: (feature, layer) => {
      // 绑定 Popup（点击显示详细信息）
      layer.bindPopup(createPopupContent(feature as unknown as GeoFeature))

      // 鼠标悬停高亮交互
      layer.on({
        mouseover: highlightFeature,
        mouseout: resetHighlight,
        click: (e) => {
          const l = e.target as L.Layer
          l.openPopup()
        },
      })
    },
  }).addTo(mapInstance!)

  // 自动适配视图到 GeoJSON 边界
  mapInstance!.fitBounds(geoJsonLayer.getBounds(), { padding: [40, 40] })
}

// --------------------------------------------
// 2. 比例符号图 —— 在区县中心放置圆，大小按 GDP 映射
// --------------------------------------------
function renderProportional(data: GeoCollection) {
  clearLayers()

  proportionalLayer = L.layerGroup().addTo(mapInstance!)

  data.features.forEach((feature) => {
    const adcode = feature.properties.adcode
    const stat = districtStats[adcode]
    if (!stat) return

    const [lng, lat] = feature.properties.centroid
    const radius = getGdpRadius(stat.gdp)
    const color = getGdpColor(stat.gdp)

    const circle = L.circleMarker([lat, lng], {
      radius,
      fillColor: color,
      color: '#fff',
      weight: 1.5,
      opacity: 1,
      fillOpacity: 0.75,
    })

    circle.bindPopup(createPopupContent(feature))
    circle.on({
      mouseover: (e) => {
        const target = e.target as L.CircleMarker
        target.setStyle({ fillOpacity: 0.95, weight: 2.5 })
        target.openPopup()
      },
      mouseout: (e) => {
        const target = e.target as L.CircleMarker
        target.setStyle({ fillOpacity: 0.75, weight: 1.5 })
        target.closePopup()
      },
    })

    if (proportionalLayer) {
      proportionalLayer.addLayer(circle)
    }
  })

  // 同时绘制行政区边界（半透明，作为参考底图）
  const boundaryLayer = L.geoJSON(data as any, {
    style: {
      weight: 1,
      color: '#999',
      fillColor: 'transparent',
      fillOpacity: 0,
      opacity: 0.6,
    },
  }).addTo(mapInstance!)

  proportionalLayer.addLayer(boundaryLayer)

  // 适配视图
  const bounds = boundaryLayer.getBounds()
  if (bounds.isValid()) {
    mapInstance!.fitBounds(bounds, { padding: [60, 60] })
  }
}

// --------------------------------------------
// 3. pointToLayer —— 用自定义图标渲染点要素
// --------------------------------------------
function renderPointToLayer(data: GeoCollection) {
  clearLayers()

  pointLayer = L.geoJSON(data as any, {
    // filter：只保留有统计数据的要素
    filter: (feature) => {
      const adcode = (feature?.properties as any)?.adcode as string
      return !!districtStats[adcode]
    },

    // pointToLayer：将每个 Polygon 要素的中心点渲染为自定义 Marker
    pointToLayer: (_feature, latlng) => {
      const adcode = (_feature?.properties as any)?.adcode as string
      const stat = districtStats[adcode]
      const density = getDensity(adcode)

      // 自定义 divIcon：显示区县名称首字和密度等级色
      const color = getChoroplethColor(density)
      const size = stat ? Math.max(24, Math.min(48, stat.population / 5)) : 24

      const html = `
        <div style="
          width:${size}px;height:${size}px;
          background:${color};color:#fff;
          border-radius:50%;display:flex;
          align-items:center;justify-content:center;
          font-size:${Math.max(10, size / 3)}px;font-weight:bold;
          border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.3);
        ">
          ${(_feature?.properties as any)?.name?.charAt(0) ?? ''}
        </div>
      `

      const icon = L.divIcon({
        html,
        className: 'custom-point-icon',
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
      })

      return L.marker(latlng, { icon })
    },

    // 将 Polygon 转为点：使用 centroid
    coordsToLatLng: (coords) => {
      // 这里我们利用 onEachFeature 在 Polygon 上创建标记，
      // 所以 pointToLayer 实际上不会接收到真正的 Point 几何体。
      // 替代方案：手动遍历 Feature 并在 centroid 上创建标记。
      return L.latLng(coords as [number, number])
    },
  })

  // 由于 GeoJSON 是 Polygon 而非 Point，pointToLayer 不会被触发。
  // 我们需要手动在 centroid 上创建点标记来演示 pointToLayer 的效果。
  const pointGroup = L.layerGroup().addTo(mapInstance!)

  data.features.forEach((feature) => {
    const adcode = feature.properties.adcode
    const stat = districtStats[adcode]
    if (!stat) return

    const [lng, lat] = feature.properties.centroid
    const density = getDensity(adcode)
    const color = getChoroplethColor(density)
    const size = Math.max(24, Math.min(48, stat.population / 5))

    const html = `
      <div style="
        width:${size}px;height:${size}px;
        background:${color};color:#fff;
        border-radius:50%;display:flex;
        align-items:center;justify-content:center;
        font-size:${Math.max(10, size / 3)}px;font-weight:bold;
        border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.3);
      ">
        ${feature.properties.name.charAt(0)}
      </div>
    `

    const icon = L.divIcon({
      html,
      className: 'custom-point-icon',
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
    })

    const marker = L.marker([lat, lng], { icon })
    marker.bindPopup(createPopupContent(feature))
    marker.on('mouseover', () => marker.openPopup())
    marker.on('mouseout', () => marker.closePopup())
    pointGroup.addLayer(marker)
  })

  // 绘制半透明边界
  const boundaryLayer = L.geoJSON(data as any, {
    style: { weight: 1, color: '#bbb', fillColor: '#f0f0f0', fillOpacity: 0.3 },
  }).addTo(mapInstance!)

  pointGroup.addLayer(boundaryLayer)

  const bounds = boundaryLayer.getBounds()
  if (bounds.isValid()) {
    mapInstance!.fitBounds(bounds, { padding: [40, 40] })
  }
}

// --------------------------------------------
// 4. filter 过滤 —— 按人口密度和 GDP 双重过滤
// --------------------------------------------
function renderFiltered(data: GeoCollection) {
  clearLayers()

  geoJsonLayer = L.geoJSON(data as any, {
    // filter 回调：根据条件过滤要素
    filter: (feature) => {
      const adcode = (feature?.properties as any)?.adcode as string
      const stat = districtStats[adcode]
      if (!stat) return false

      const density = getDensity(adcode)
      const gdp = stat.gdp

      return density >= filterMinDensity.value && gdp >= filterMinGdp.value
    },

    style: (feature) => {
      const adcode = (feature?.properties as any)?.adcode as string
      const density = getDensity(adcode)
      return {
        fillColor: getChoroplethColor(density),
        weight: 2,
        opacity: 1,
        color: '#2171b5',
        dashArray: '',
        fillOpacity: 0.75,
      }
    },

    onEachFeature: (feature, layer) => {
      layer.bindPopup(createPopupContent(feature as unknown as GeoFeature))
      layer.on({
        mouseover: highlightFeature,
        mouseout: resetHighlight,
      })
    },
  }).addTo(mapInstance!)

  const bounds = geoJsonLayer.getBounds()
  if (bounds.isValid()) {
    mapInstance!.fitBounds(bounds, { padding: [40, 40] })
  }
}

// --------------------------------------------
// 5. 渲染个人足迹
// --------------------------------------------
function renderFootprints() {
  clearLayers()

  personalDataLayer = L.layerGroup().addTo(mapInstance!)

  // 绘制足迹连线
  const footprintCoords = personalData.footprints.map((f): L.LatLngTuple => [f.lat, f.lng])
  L.polyline(footprintCoords, {
    color: '#ef4444',
    weight: 3,
    opacity: 0.7,
    dashArray: '8,4',
  }).addTo(personalDataLayer)

  // 绘制足迹点
  personalData.footprints.forEach((footprint) => {
    const seasonIcon = getSeasonIcon(footprint.season as '春' | '夏' | '秋' | '冬')
    const html = `
      <div style="
        width:40px;height:40px;
        background:linear-gradient(135deg, #ef4444, #f97316);
        color:#fff;border-radius:50%;
        display:flex;flex-direction:column;
        align-items:center;justify-content:center;
        font-size:10px;font-weight:bold;
        border:3px solid #fff;box-shadow:0 3px 10px rgba(0,0,0,0.3);
      ">
        <span style="font-size:16px;">${seasonIcon}</span>
        <span>${footprint.year}</span>
      </div>
    `

    const icon = L.divIcon({
      html,
      className: 'footprint-icon',
      iconSize: [40, 40],
      iconAnchor: [20, 20],
    })

    const marker = L.marker([footprint.lat, footprint.lng], { icon })
    marker.bindPopup(`
      <div style="min-width:180px;">
        <h4 style="margin:0 0 8px 0;font-size:15px;">${seasonIcon} ${footprint.name}</h4>
        <div style="font-size:13px;line-height:1.6;">
          <div><b>年份：</b>${footprint.year}年 ${footprint.season}季</div>
          <div><b>时长：</b>${footprint.duration}天</div>
          <div style="margin-top:6px;color:#666;font-style:italic;">"${footprint.description}"</div>
        </div>
      </div>
    `)
    marker.on('mouseover', () => marker.openPopup())
    marker.on('mouseout', () => marker.closePopup())
    personalDataLayer!.addLayer(marker)
  })

  // 自动适配视图
  const footprintBounds = L.latLngBounds(footprintCoords as L.LatLngExpression[])
  mapInstance!.fitBounds(footprintBounds, { padding: [60, 60] })
}

// --------------------------------------------
// 6. 渲染兴趣点
// --------------------------------------------
function renderPOIs() {
  clearLayers()

  personalDataLayer = L.layerGroup().addTo(mapInstance!)

  personalData.pois.forEach((poi) => {
    const typeName = getPOITypeName(poi.type as 'scenic' | 'food' | 'shopping' | 'culture')
    const ratingStars = '⭐'.repeat(poi.rating)
    const typeColors: Record<string, string> = {
      scenic: '#10b981',
      food: '#f59e0b',
      shopping: '#8b5cf6',
      culture: '#3b82f6',
    }
    const color = typeColors[poi.type] || '#6b7280'

    const html = `
      <div style="
        width:${32 + poi.rating * 4}px;height:${32 + poi.rating * 4}px;
        background:${color};color:#fff;border-radius:50%;
        display:flex;flex-direction:column;
        align-items:center;justify-content:center;
        font-size:${8 + poi.rating}px;font-weight:bold;
        border:3px solid #fff;box-shadow:0 3px 10px rgba(0,0,0,0.3);
      ">
        <span style="font-size:${12 + poi.rating * 2}px;">📍</span>
      </div>
    `

    const icon = L.divIcon({
      html,
      className: 'poi-icon',
      iconSize: [32 + poi.rating * 4, 32 + poi.rating * 4],
      iconAnchor: [(32 + poi.rating * 4) / 2, (32 + poi.rating * 4) / 2],
    })

    const marker = L.marker([poi.lat, poi.lng], { icon })
    marker.bindPopup(`
      <div style="min-width:180px;">
        <h4 style="margin:0 0 8px 0;font-size:15px;">📍 ${poi.name}</h4>
        <div style="font-size:13px;line-height:1.6;">
          <div><b>类型：</b>${typeName}</div>
          <div><b>评分：</b>${ratingStars} (${poi.rating}/5)</div>
          <div><b>标签：</b>${poi.tags.join('、')}</div>
        </div>
      </div>
    `)
    marker.on('mouseover', () => marker.openPopup())
    marker.on('mouseout', () => marker.closePopup())
    personalDataLayer!.addLayer(marker)
  })

  // 自动适配视图
  const poiCoords = personalData.pois.map((p): L.LatLngTuple => [p.lat, p.lng])
  const poiBounds = L.latLngBounds(poiCoords as L.LatLngExpression[])
  mapInstance!.fitBounds(poiBounds, { padding: [60, 60] })
}

// --------------------------------------------
// 清除所有专题图层
// --------------------------------------------
function clearLayers() {
  if (geoJsonLayer) {
    geoJsonLayer.removeFrom(mapInstance!)
    geoJsonLayer = null
  }
  if (proportionalLayer) {
    proportionalLayer.removeFrom(mapInstance!)
    proportionalLayer = null
  }
  if (pointLayer) {
    pointLayer.removeFrom(mapInstance!)
    pointLayer = null
  }
  if (personalDataLayer) {
    personalDataLayer.removeFrom(mapInstance!)
    personalDataLayer = null
  }
  // 清除其他手动添加的 layerGroup
  mapInstance?.eachLayer((layer) => {
    if (layer instanceof L.LayerGroup && !(layer instanceof L.TileLayer)) {
      const isControl =
        layer instanceof L.Control ||
        (layer as any)._control ||
        (layer as any)._pathRoot
      if (!isControl) {
        mapInstance!.removeLayer(layer)
      }
    }
  })
}

// --------------------------------------------
// 根据当前视图模式渲染
// --------------------------------------------
function renderByMode() {
  if (!mapInstance) return

  switch (viewMode.value) {
    case 'choropleth':
      if (!geoData.value) return
      renderChoropleth(geoData.value)
      break
    case 'proportional':
      if (!geoData.value) return
      renderProportional(geoData.value)
      break
    case 'point':
      if (!geoData.value) return
      renderPointToLayer(geoData.value)
      break
    case 'filter':
      if (!geoData.value) return
      renderFiltered(geoData.value)
      break
    case 'footprints':
      renderFootprints()
      break
    case 'pois':
      renderPOIs()
      break
  }
}

// --------------------------------------------
// 加载 GeoJSON 数据
// --------------------------------------------
async function loadGeoJSON() {
  isLoading.value = true
  loadError.value = ''

  try {
    const response = await fetch('/data/chongqing-districts.geojson')
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }
    const data = (await response.json()) as GeoCollection
    geoData.value = data
    renderByMode()
  } catch (err) {
    loadError.value = err instanceof Error ? err.message : '加载失败'
    console.error('[GeoAnalysis] 加载 GeoJSON 失败:', err)
  } finally {
    isLoading.value = false
  }
}

// --------------------------------------------
// 地图初始化
// --------------------------------------------
onMounted(() => {
  if (!mapContainer.value) return

  mapInstance = L.map(mapContainer.value, {
    center: [29.8, 107.5],
    zoom: 7,
    zoomControl: false,
  })

  // 添加默认底图
  baseMaps['高德标准']!.addTo(mapInstance!)

  // 添加底图切换控件
  L.control.layers(baseMaps, {}, {
    position: 'topright',
    collapsed: true,
  }).addTo(mapInstance)

  // 添加比例尺
  L.control.scale({ position: 'bottomright', metric: true, imperial: false }).addTo(mapInstance)

  // 加载数据
  loadGeoJSON()
})

onUnmounted(() => {
  if (mapInstance) {
    mapInstance.remove()
    mapInstance = null
  }
})

// 监听视图模式变化，重新渲染
watch(viewMode, () => {
  renderByMode()
})

// 监听过滤条件变化（仅在 filter 模式下生效）
watch([filterMinDensity, filterMinGdp], () => {
  if (viewMode.value === 'filter') {
    renderByMode()
  }
})

// --------------------------------------------
// 当前图例模式
// --------------------------------------------
const legendMode = computed(() => {
  if (viewMode.value === 'choropleth' || viewMode.value === 'filter') return 'choropleth'
  if (viewMode.value === 'proportional' || viewMode.value === 'point') return 'proportional'
  return 'choropleth'
})
</script>

<template>
  <div class="geo-analysis-view" :data-theme="themeStore.theme">
    <!-- 页面顶栏 -->
    <header class="view-header">
      <h1>🗺️ GIS 专题分析</h1>
      <button class="theme-toggle" @click="themeStore.toggleTheme">
        <span v-if="themeStore.theme === 'light'">🌙 深色</span>
        <span v-else>☀️ 浅色</span>
      </button>
    </header>

    <!-- 地图与分析面板 -->
    <div class="analysis-layout">
      <!-- 左侧控制面板 -->
      <aside class="control-panel">
        <section class="panel-section">
          <h2>分析模式</h2>
          <div class="mode-buttons">
            <button
              class="mode-btn"
              :class="{ active: viewMode === 'choropleth' }"
              @click="viewMode = 'choropleth'"
            >
              🎨 分级设色
            </button>
            <button
              class="mode-btn"
              :class="{ active: viewMode === 'proportional' }"
              @click="viewMode = 'proportional'"
            >
              ⭕ 比例符号
            </button>
            <button
              class="mode-btn"
              :class="{ active: viewMode === 'point' }"
              @click="viewMode = 'point'"
            >
              📍 点要素渲染
            </button>
            <button
              class="mode-btn"
              :class="{ active: viewMode === 'filter' }"
              @click="viewMode = 'filter'"
            >
              🔍 要素过滤
            </button>
          </div>
        </section>

        <!-- 个人数据展示按钮 -->
        <section class="panel-section">
          <h2>个人数据</h2>
          <div class="mode-buttons">
            <button
              class="mode-btn personal-btn"
              :class="{ active: viewMode === 'footprints' }"
              @click="viewMode = 'footprints'"
            >
              👣 个人足迹
            </button>
            <button
              class="mode-btn personal-btn"
              :class="{ active: viewMode === 'pois' }"
              @click="viewMode = 'pois'"
            >
              ❤️ 兴趣点
            </button>
          </div>
          <div class="data-info" v-if="viewMode === 'footprints'">
            <p><b>足迹数量：</b>{{ personalData.footprints.length }} 个城市</p>
            <p><b>时间跨度：</b>{{ personalData.footprints[0]?.year }} - {{ personalData.footprints[personalData.footprints.length - 1]?.year }}</p>
          </div>
          <div class="data-info" v-if="viewMode === 'pois'">
            <p><b>兴趣点数量：</b>{{ personalData.pois.length }} 个</p>
            <p><b>平均评分：</b>{{ (personalData.pois.reduce((sum, p) => sum + p.rating, 0) / personalData.pois.length).toFixed(1) }}/5</p>
          </div>
        </section>

        <section class="panel-section">
          <h2>数据说明</h2>
          <div class="data-info">
            <p><b>数据源：</b>阿里云 DataV GeoAtlas</p>
            <p><b>行政区：</b>重庆市 38 个区县</p>
            <p><b>统计字段：</b>人口、面积、GDP</p>
            <p class="hint">人口密度 = 人口 × 10000 / 面积（人/km²）</p>
          </div>
        </section>

        <!-- 过滤条件（仅在 filter 模式下显示） -->
        <section v-if="viewMode === 'filter'" class="panel-section filter-section">
          <h2>过滤条件</h2>
          <div class="filter-group">
            <label>最小人口密度（人/km²）</label>
            <input
              v-model.number="filterMinDensity"
              type="range"
              min="0"
              max="2000"
              step="50"
            />
            <span class="filter-value">{{ filterMinDensity }}</span>
          </div>
          <div class="filter-group">
            <label>最小 GDP（亿元）</label>
            <input
              v-model.number="filterMinGdp"
              type="range"
              min="0"
              max="2000"
              step="50"
            />
            <span class="filter-value">{{ filterMinGdp }}</span>
          </div>
          <p class="hint">
            当前显示满足两个条件的区县
          </p>
        </section>

        <section class="panel-section">
          <h2>技术实现</h2>
          <ul class="tech-list">
            <li>L.geoJSON 加载行政区边界</li>
            <li>style 回调实现分级设色</li>
            <li>onEachFeature 绑定 Popup</li>
            <li>mouseover / mouseout 高亮</li>
            <li>比例符号按 GDP 映射半径</li>
            <li>pointToLayer 自定义图标</li>
            <li>filter 回调过滤要素</li>
          </ul>
        </section>
      </aside>

      <!-- 地图主区域 -->
      <main class="map-area">
        <div ref="mapContainer" class="geo-map-container"></div>

        <!-- 加载状态 -->
        <div v-if="isLoading" class="map-overlay loading">
          <span>⏳ 加载 GeoJSON 数据中...</span>
        </div>
        <div v-if="loadError" class="map-overlay error">
          <span>⚠️ {{ loadError }}</span>
        </div>

        <!-- 图例（绝对定位在地图右下角） -->
        <div class="legend-wrapper">
          <MapLegend :mode="legendMode" />
        </div>
      </main>
    </div>
  </div>
</template>

<style scoped>
.geo-analysis-view {
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

/* 布局 */
.analysis-layout {
  display: grid;
  grid-template-columns: 280px 1fr;
  height: calc(100vh - var(--header-height));
  overflow: hidden;
}

/* 控制面板 */
.control-panel {
  background-color: var(--bg-sidebar);
  border-right: 1px solid var(--border-color);
  padding: 16px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.panel-section {
  background-color: var(--bg-main);
  border-radius: 8px;
  padding: 14px;
  border: 1px solid var(--border-color);
}

.panel-section h2 {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 10px;
}

.mode-buttons {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.mode-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background-color: var(--bg-sidebar);
  color: var(--text-primary);
  font-size: 13px;
  cursor: pointer;
  transition: all var(--transition-fast);
  text-align: left;
}

.mode-btn:hover {
  border-color: var(--accent-color);
  color: var(--accent-color);
}

.mode-btn.active {
  border-color: var(--accent-color);
  background-color: var(--accent-color);
  color: #ffffff;
}

/* 个人数据按钮特殊样式 */
.mode-btn.personal-btn {
  background: linear-gradient(135deg, #ec4899, #8b5cf6);
  border-color: #ec4899;
  color: #ffffff;
}

.mode-btn.personal-btn:hover {
  background: linear-gradient(135deg, #db2777, #7c3aed);
  border-color: #db2777;
  transform: translateY(-2px);
}

.mode-btn.personal-btn.active {
  background: linear-gradient(135deg, #be185d, #6d28d9);
  border-color: #be185d;
  box-shadow: 0 4px 12px rgba(236, 72, 153, 0.4);
}

.data-info {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.7;
}

.data-info p {
  margin-bottom: 4px;
}

.hint {
  font-size: 11px;
  color: var(--text-muted);
  margin-top: 6px;
  font-style: italic;
}

/* 过滤面板 */
.filter-group {
  margin-bottom: 12px;
}

.filter-group label {
  display: block;
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 4px;
}

.filter-group input[type='range'] {
  width: 100%;
  accent-color: var(--accent-color);
}

.filter-value {
  font-size: 12px;
  color: var(--accent-color);
  font-weight: 600;
  font-family: 'Consolas', monospace;
}

/* 技术列表 */
.tech-list {
  list-style: none;
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.8;
}

.tech-list li::before {
  content: '• ';
  color: var(--accent-color);
}

/* 地图区域 */
.map-area {
  position: relative;
  overflow: hidden;
}

.geo-map-container {
  width: 100%;
  height: 100%;
}

/* 地图覆盖层 */
.map-overlay {
  position: absolute;
  top: 16px;
  left: 50%;
  transform: translateX(-50%);
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  z-index: 500;
  pointer-events: none;
}

.map-overlay.loading {
  background-color: rgba(37, 99, 235, 0.9);
  color: #fff;
}

.map-overlay.error {
  background-color: rgba(239, 68, 68, 0.9);
  color: #fff;
}

/* 图例定位 */
.legend-wrapper {
  position: absolute;
  right: 16px;
  bottom: 48px;
  z-index: 500;
}

/* 响应式 */
@media (max-width: 768px) {
  .analysis-layout {
    grid-template-columns: 1fr;
    grid-template-rows: auto 1fr;
  }

  .control-panel {
    max-height: 200px;
    border-right: none;
    border-bottom: 1px solid var(--border-color);
  }
}
</style>
