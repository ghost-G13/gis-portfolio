<script setup lang="ts">
/**
 * MapLibreMap.vue
 * ============================================
 * 基于 MapLibre GL JS 的矢量瓦片地图组件
 * 功能：
 *   - 加载矢量瓦片底图（Style JSON）
 *   - 支持多套底图样式切换（高德矢量/卫星/OSM/暗色）
 *   - 动态添加 GeoJSON Source / Layer
 *   - 数据驱动样式（match / step / interpolate 表达式）
 *   - 暴露缩放、重置、定位、样式切换等方法供父组件调用
 * ============================================
 */

import { ref, onMounted, onUnmounted, watch } from 'vue'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { STYLE_PRESETS, DEFAULT_STYLE_PRESET, type StylePreset } from '@/config/mapStyles'
import type { Feature, FeatureCollection } from 'geojson'

// --------------------------------------------
// Props 定义
// --------------------------------------------
interface Props {
  latitude?: number
  longitude?: number
  zoom?: number
  styleUrl?: string
  stylePreset?: StylePreset
  geojsonData?: FeatureCollection
}

const props = withDefaults(defineProps<Props>(), {
  latitude: 29.5630,
  longitude: 106.5516,
  zoom: 12,
  styleUrl: '',
  stylePreset: DEFAULT_STYLE_PRESET,
  geojsonData: undefined,
})

// --------------------------------------------
// Emits
// --------------------------------------------
const emit = defineEmits<{
  (e: 'update:center', lat: number, lng: number): void
  (e: 'update:zoom', zoom: number): void
  (e: 'update:mouse', lat: number, lng: number): void
  (e: 'feature:click', feature: Feature): void
}>()

// --------------------------------------------
// 响应式引用
// --------------------------------------------
const mapContainer = ref<HTMLDivElement | null>(null)
let mapInstance: maplibregl.Map | null = null
const isMapLoaded = ref(false)

// GeoJSON Source / Layer 常量
const GEOJSON_SOURCE_ID = 'geojson-data-source'
const GEOJSON_BUILDING_SOURCE_ID = 'geojson-building-source'
const LAYER_POINT = 'geojson-point-layer'
const LAYER_POINT_LABEL = 'geojson-point-label-layer'
const LAYER_POLYGON_FILL = 'geojson-polygon-fill-layer'
const LAYER_POLYGON_LINE = 'geojson-polygon-line-layer'
const LAYER_POLYGON_EXTRUSION = 'geojson-polygon-extrusion-layer'
const LAYER_CLUSTER = 'geojson-cluster-layer'
const LAYER_CLUSTER_LABEL = 'geojson-cluster-label-layer'

// --------------------------------------------
// 获取当前应使用的 Style
// --------------------------------------------
function resolveStyle() {
  if (props.styleUrl) {
    return props.styleUrl
  }
  const preset = STYLE_PRESETS[props.stylePreset]
  return preset ? preset.style : STYLE_PRESETS[DEFAULT_STYLE_PRESET].style
}

// --------------------------------------------
// 添加 GeoJSON Source（必须先 addSource 再 addLayer）
// --------------------------------------------
function addGeoJSONSource() {
  if (!mapInstance || !props.geojsonData) return

  // 1. Point Source：开启 cluster（仅对 Point 生效）
  if (!mapInstance.getSource(GEOJSON_SOURCE_ID)) {
    mapInstance.addSource(GEOJSON_SOURCE_ID, {
      type: 'geojson',
      data: props.geojsonData,
      cluster: true,
      clusterRadius: 50,
      clusterMaxZoom: 14,
    })
  }

  // 2. Building Source：仅含 Polygon，不开启 cluster，避免影响 3D 拉伸
  if (!mapInstance.getSource(GEOJSON_BUILDING_SOURCE_ID)) {
    const polygonFeatures = props.geojsonData.features.filter(
      (f) => f.geometry?.type === 'Polygon'
    )
    mapInstance.addSource(GEOJSON_BUILDING_SOURCE_ID, {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: polygonFeatures,
      },
    })
  }
}

// --------------------------------------------
// 添加数据驱动样式的 Layers
// --------------------------------------------
function addGeoJSONLayers() {
  if (!mapInstance) return

  // ---------- Cluster：聚合圆点图层 ----------
  // 使用 filter: ['has', 'point_count'] 只显示聚合点
  // 数据驱动样式：Step 表达式按聚合数量分颜色、分大小
  if (!mapInstance.getLayer(LAYER_CLUSTER)) {
    mapInstance.addLayer({
      id: LAYER_CLUSTER,
      type: 'circle',
      source: GEOJSON_SOURCE_ID,
      filter: ['has', 'point_count'],
      paint: {
        'circle-color': [
          'step',
          ['get', 'point_count'],
          '#51bbd6', // < 10
          10, '#f1f075',
          50, '#f28cb1',
          100, '#e55e5e',
        ],
        'circle-radius': [
          'step',
          ['get', 'point_count'],
          18, // < 10
          10, 24,
          50, 30,
          100, 36,
        ],
        'circle-opacity': 0.85,
        'circle-stroke-width': 2,
        'circle-stroke-color': '#ffffff',
        'circle-stroke-opacity': 0.9,
      },
    })
  }

  // ---------- Cluster：聚合数量文本 ----------
  if (!mapInstance.getLayer(LAYER_CLUSTER_LABEL)) {
    mapInstance.addLayer({
      id: LAYER_CLUSTER_LABEL,
      type: 'symbol',
      source: GEOJSON_SOURCE_ID,
      filter: ['has', 'point_count'],
      layout: {
        'text-field': ['get', 'point_count_abbreviated'],
        'text-font': ['Noto Sans Regular'],
        'text-size': 13,
        'text-allow-overlap': true,
      },
      paint: {
        'text-color': '#1f2937',
        'text-halo-color': '#ffffff',
        'text-halo-width': 2,
      },
    })
  }

  // ---------- Point：非聚合圆点图层 ----------
  // filter: ['!has', 'point_count'] 排除聚合点，只显示原始散点
  if (!mapInstance.getLayer(LAYER_POINT)) {
    mapInstance.addLayer({
      id: LAYER_POINT,
      type: 'circle',
      source: GEOJSON_SOURCE_ID,
      filter: ['all', ['==', '$type', 'Point'], ['!has', 'point_count']],
      paint: {
        'circle-color': [
          'match',
          ['get', 'category'],
          '一线城市', '#e11d48',
          '新一线城市', '#f59e0b',
          '二线城市', '#10b981',
          '中心城区', '#3b82f6',
          /* fallback */ '#6b7280',
        ],
        'circle-radius': [
          'interpolate',
          ['linear'],
          ['get', 'population'],
          100, 8,
          500, 14,
          1000, 20,
          2000, 28,
        ],
        'circle-opacity': 0.85,
        'circle-stroke-width': 2,
        'circle-stroke-color': '#ffffff',
        'circle-stroke-opacity': 0.9,
      },
    })
  }

  // ---------- Point：非聚合文字标注 ----------
  if (!mapInstance.getLayer(LAYER_POINT_LABEL)) {
    mapInstance.addLayer({
      id: LAYER_POINT_LABEL,
      type: 'symbol',
      source: GEOJSON_SOURCE_ID,
      filter: ['all', ['==', '$type', 'Point'], ['!has', 'point_count']],
      layout: {
        'text-field': ['get', 'name'],
        'text-font': ['Noto Sans Regular'],
        'text-size': 12,
        'text-offset': [0, 1.5],
        'text-anchor': 'top',
        'text-allow-overlap': false,
        'text-ignore-placement': false,
      },
      paint: {
        'text-color': '#1f2937',
        'text-halo-color': '#ffffff',
        'text-halo-width': 2,
      },
    })
  }

  // ---------- Polygon：填充图层（作为 3D 建筑的底部投影） ----------
  if (!mapInstance.getLayer(LAYER_POLYGON_FILL)) {
    mapInstance.addLayer({
      id: LAYER_POLYGON_FILL,
      type: 'fill',
      source: GEOJSON_BUILDING_SOURCE_ID,
      paint: {
        'fill-color': '#93c5fd',
        'fill-opacity': 0.3, // 增加透明度，作为 3D 建筑底部
        'fill-outline-color': '#1e3a8a',
      },
    })
  }

  // ---------- Polygon：边界线图层 ----------
  if (!mapInstance.getLayer(LAYER_POLYGON_LINE)) {
    mapInstance.addLayer({
      id: LAYER_POLYGON_LINE,
      type: 'line',
      source: GEOJSON_BUILDING_SOURCE_ID,
      paint: {
        'line-color': '#1e3a8a',
        'line-width': 1.5,
        'line-opacity': 0.6,
      },
    })
  }

  // ---------- Polygon：3D 拉伸图层（fill-extrusion） ----------
  // 放在最后，确保渲染在最上层
  // 使用独立的 building source，避免 cluster 干扰 3D 渲染
  // 注意：fill-extrusion 必须在有 pitch（倾斜角度）的视图下才能看到效果
  if (!mapInstance.getLayer(LAYER_POLYGON_EXTRUSION)) {
    mapInstance.addLayer({
      id: LAYER_POLYGON_EXTRUSION,
      type: 'fill-extrusion',
      source: GEOJSON_BUILDING_SOURCE_ID,
      minzoom: 12, // 仅在缩放级别 >= 12 时显示 3D 建筑
      paint: {
        'fill-extrusion-color': '#2563eb', // 蓝色，更醒目
        // 使用 population 属性计算高度，确保 3D 效果明显可见
        // 人口 * 10，人口 1000 的建筑高度为 10000（单位：米）
        'fill-extrusion-height': ['*', ['get', 'population'], 10],
        'fill-extrusion-base': 0,
        'fill-extrusion-opacity': 0.9,
        'fill-extrusion-vertical-gradient': true, // 启用垂直渐变，增加立体感
      },
    })
  }

  // ---------- 调试日志：确认所有图层和 pitch ----------
  const allLayers = mapInstance.getStyle().layers.map((l: { id: string; type: string }) => ({ id: l.id, type: l.type }))
  console.log('[MapLibreMap] 当前所有图层:', allLayers)
  console.log('[MapLibreMap] fill-extrusion 图层存在?', !!mapInstance.getLayer(LAYER_POLYGON_EXTRUSION))
  console.log('[MapLibreMap] 当前 pitch:', mapInstance.getPitch())

  // ---------- 点击事件：聚合点展开 ----------
  mapInstance.off('click', LAYER_CLUSTER, onClusterClick)
  mapInstance.on('click', LAYER_CLUSTER, onClusterClick)

  // ---------- 点击事件：要素选择 ----------
  mapInstance.off('click', LAYER_POINT, onFeatureClick)
  mapInstance.off('click', LAYER_POLYGON_FILL, onFeatureClick)
  mapInstance.on('click', LAYER_POINT, onFeatureClick)
  mapInstance.on('click', LAYER_POLYGON_FILL, onFeatureClick)

  // 鼠标悬停变手型
  mapInstance.off('mouseenter', LAYER_CLUSTER, onFeatureMouseEnter)
  mapInstance.off('mouseleave', LAYER_CLUSTER, onFeatureMouseLeave)
  mapInstance.off('mouseenter', LAYER_POINT, onFeatureMouseEnter)
  mapInstance.off('mouseleave', LAYER_POINT, onFeatureMouseLeave)
  mapInstance.off('mouseenter', LAYER_POLYGON_FILL, onFeatureMouseEnter)
  mapInstance.off('mouseleave', LAYER_POLYGON_FILL, onFeatureMouseLeave)
  mapInstance.on('mouseenter', LAYER_CLUSTER, onFeatureMouseEnter)
  mapInstance.on('mouseleave', LAYER_CLUSTER, onFeatureMouseLeave)
  mapInstance.on('mouseenter', LAYER_POINT, onFeatureMouseEnter)
  mapInstance.on('mouseleave', LAYER_POINT, onFeatureMouseLeave)
  mapInstance.on('mouseenter', LAYER_POLYGON_FILL, onFeatureMouseEnter)
  mapInstance.on('mouseleave', LAYER_POLYGON_FILL, onFeatureMouseLeave)
}

/**
 * 点击聚合点：使用 getClusterExpansionZoom 展开到对应缩放级别
 */
async function onClusterClick(e: maplibregl.MapMouseEvent & { features?: Feature[] }) {
  if (!mapInstance || !e.features || e.features.length === 0) return
  const feature = e.features[0]
  if (!feature || !feature.properties) return

  const clusterId = feature.properties.cluster_id as number
  const source = mapInstance.getSource(GEOJSON_SOURCE_ID) as maplibregl.GeoJSONSource | undefined
  if (!source) return

  try {
    const zoom = await source.getClusterExpansionZoom(clusterId)
    if (!mapInstance) return
    mapInstance.flyTo({
      center: (feature.geometry as GeoJSON.Point).coordinates as [number, number],
      zoom,
      speed: 1.5,
    })
  } catch {
    // 聚合展开失败时静默忽略
  }
}

function onFeatureClick(e: maplibregl.MapMouseEvent & { features?: Feature[] }) {
  if (!e.features || e.features.length === 0) return
  const feature = e.features[0]
  if (!feature) return
  emit('feature:click', feature)

  // 高亮效果：弹出一个简单的 Popup
  if (mapInstance && feature.geometry) {
    const coords =
      feature.geometry.type === 'Point'
        ? (feature.geometry as GeoJSON.Point).coordinates
        : (e.lngLat as maplibregl.LngLatLike)
    const popupContent = createPopupHTML(feature)
    new maplibregl.Popup({ closeButton: true, closeOnClick: true })
      .setLngLat(coords as maplibregl.LngLatLike)
      .setHTML(popupContent)
      .addTo(mapInstance)
  }
}

function createPopupHTML(feature: Feature): string {
  const p = feature.properties || {}
  const rows = Object.entries(p)
    .map(([k, v]) => `<div style="margin:2px 0;"><strong>${k}:</strong> ${v}</div>`)
    .join('')
  return `<div style="font-size:13px;max-width:220px;">${rows}</div>`
}

function onFeatureMouseEnter() {
  if (mapInstance) mapInstance.getCanvas().style.cursor = 'pointer'
}
function onFeatureMouseLeave() {
  if (mapInstance) mapInstance.getCanvas().style.cursor = ''
}

// --------------------------------------------
// 更新 GeoJSON 数据（使用 setData，不重建 Source/Layer）
// --------------------------------------------
function updateGeoJSONData() {
  if (!mapInstance || !props.geojsonData) return
  const source = mapInstance.getSource(GEOJSON_SOURCE_ID) as maplibregl.GeoJSONSource | undefined
  const buildingSource = mapInstance.getSource(GEOJSON_BUILDING_SOURCE_ID) as maplibregl.GeoJSONSource | undefined
  if (source) {
    source.setData(props.geojsonData)
  }
  if (buildingSource) {
    const polygonFeatures = props.geojsonData.features.filter(
      (f) => f.geometry?.type === 'Polygon'
    )
    buildingSource.setData({ type: 'FeatureCollection', features: polygonFeatures })
  }
  if (!source && isMapLoaded.value) {
    // Source 不存在但地图已加载：首次添加
    addGeoJSONSource()
    addGeoJSONLayers()
  }
}

// --------------------------------------------
// 移除 GeoJSON Source / Layers
// --------------------------------------------
function removeGeoJSONLayers() {
  if (!mapInstance) return
  ;[
    LAYER_CLUSTER_LABEL,
    LAYER_CLUSTER,
    LAYER_POINT_LABEL,
    LAYER_POINT,
    LAYER_POLYGON_EXTRUSION,
    LAYER_POLYGON_LINE,
    LAYER_POLYGON_FILL,
  ].forEach((id) => {
    if (mapInstance!.getLayer(id)) {
      mapInstance!.removeLayer(id)
    }
  })
  if (mapInstance.getSource(GEOJSON_SOURCE_ID)) {
    mapInstance.removeSource(GEOJSON_SOURCE_ID)
  }
  if (mapInstance.getSource(GEOJSON_BUILDING_SOURCE_ID)) {
    mapInstance.removeSource(GEOJSON_BUILDING_SOURCE_ID)
  }
}

// --------------------------------------------
// 地图初始化
// --------------------------------------------
onMounted(() => {
  if (!mapContainer.value) return

  mapInstance = new maplibregl.Map({
    container: mapContainer.value,
    style: resolveStyle(),
    center: [props.longitude, props.latitude],
    zoom: props.zoom,
    pitch: 45, // 设置初始倾斜角度为 45°，才能看到 3D 拉伸效果
    bearing: 0, // 初始方位角
    attributionControl: false,
  })

  // 添加导航控件（放大/缩小/旋转）
  mapInstance.addControl(new maplibregl.NavigationControl(), 'top-right')

  // 添加比例尺
  mapInstance.addControl(
    new maplibregl.ScaleControl({ maxWidth: 120, unit: 'metric' }),
    'bottom-right'
  )

  // 添加全屏控件
  mapInstance.addControl(new maplibregl.FullscreenControl(), 'top-right')

  // 地图加载完成后初始化 GeoJSON 与光照
  mapInstance.on('load', () => {
    isMapLoaded.value = true

    // 配置光源，使 fill-extrusion 3D 拉伸效果更逼真
    mapInstance!.setLight({
      anchor: 'viewport',
      position: [1.15, 210, 30],
      color: '#ffffff',
      intensity: 0.6,
    })

    if (props.geojsonData) {
      addGeoJSONSource()
      addGeoJSONLayers()
    }
  })

  // 监听移动结束，回传中心坐标
  mapInstance.on('moveend', () => {
    const center = mapInstance!.getCenter()
    emit('update:center', parseFloat(center.lat.toFixed(4)), parseFloat(center.lng.toFixed(4)))
  })

  // 监听缩放结束，回传缩放级别
  mapInstance.on('zoomend', () => {
    emit('update:zoom', mapInstance!.getZoom())
  })

  // 监听鼠标移动，回传鼠标坐标
  mapInstance.on('mousemove', (e) => {
    emit('update:mouse', parseFloat(e.lngLat.lat.toFixed(6)), parseFloat(e.lngLat.lng.toFixed(6)))
  })

  // 初始状态回传
  emit('update:center', props.latitude, props.longitude)
  emit('update:zoom', props.zoom)
})

// --------------------------------------------
// 清理资源
// --------------------------------------------
onUnmounted(() => {
  if (mapInstance) {
    mapInstance.remove()
    mapInstance = null
  }
})

// --------------------------------------------
// Watch：GeoJSON 数据变化时动态更新
// --------------------------------------------
watch(() => props.geojsonData, (newVal, oldVal) => {
  if (!mapInstance) return
  if (newVal && isMapLoaded.value) {
    if (!oldVal) {
      // 从无到有：需要创建 Source + Layer
      addGeoJSONSource()
      addGeoJSONLayers()
    } else {
      // 已有 Source：仅更新数据
      updateGeoJSONData()
    }
  } else if (!newVal && oldVal) {
    // 从有到无：移除 Source + Layer
    removeGeoJSONLayers()
  }
}, { deep: true })

// --------------------------------------------
// Watch：底图样式 Preset 变化时切换
// --------------------------------------------
watch(() => props.stylePreset, (newPreset, oldPreset) => {
  if (!mapInstance || newPreset === oldPreset) return
  switchStyle(newPreset)
})

// --------------------------------------------
// 暴露方法给父组件
// --------------------------------------------
function zoomIn() {
  mapInstance?.zoomIn()
}
function zoomOut() {
  mapInstance?.zoomOut()
}
function resetView() {
  mapInstance?.flyTo({
    center: [props.longitude, props.latitude],
    zoom: props.zoom,
    duration: 1500,
  })
}
function locateMe() {
  if (!mapInstance) return
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      mapInstance?.flyTo({
        center: [pos.coords.longitude, pos.coords.latitude],
        zoom: 16,
        duration: 1500,
      })
    },
    () => {
      console.warn('[MapLibreMap] 定位失败')
    }
  )
}
function flyTo(lat: number, lng: number, zoom?: number, pitch?: number) {
  mapInstance?.flyTo({
    center: [lng, lat],
    zoom: zoom ?? mapInstance.getZoom(),
    pitch: pitch ?? mapInstance.getPitch(),
    duration: 1500,
  })
}

/** 重新计算地图尺寸（切换引擎时必须调用） */
function resize() {
  mapInstance?.resize()
}

/**
 * 切换底图样式（setStyle 全量替换）
 * 注意：setStyle 会清空所有 Source 和 Layer，因此需要在 style.load 后重新添加 GeoJSON。
 */
function switchStyle(preset: StylePreset) {
  if (!mapInstance) return
  const config = STYLE_PRESETS[preset]
  if (!config) {
    console.warn(`[MapLibreMap] 未知样式预设: ${preset}`)
    return
  }

  const needRestoreGeoJSON = !!props.geojsonData && mapInstance.getSource(GEOJSON_SOURCE_ID) !== undefined

  mapInstance.setStyle(config.style)

  // setStyle 是异步的，等待新样式加载完成后重建 light、source、layer
  mapInstance.once('style.load', () => {
    mapInstance!.setLight({
      anchor: 'viewport',
      position: [1.15, 210, 30],
      color: '#ffffff',
      intensity: 0.6,
    })
    if (needRestoreGeoJSON && props.geojsonData) {
      addGeoJSONSource()
      addGeoJSONLayers()
    }
  })
}

/**
 * 增量修改图层配色（setPaintProperty）
 * 适用于仅改变配色而不切换底图的场景。
 */
function setLayerPaintProperty(
  layerId: string,
  prop: string,
  value: unknown
) {
  if (!mapInstance || !mapInstance.getLayer(layerId)) {
    console.warn(`[MapLibreMap] Layer ${layerId} 不存在，无法设置 paint property`)
    return
  }
  mapInstance.setPaintProperty(layerId, prop, value)
}

/**
 * 获取当前已添加的 GeoJSON Feature（用于调试或外部查询）
 */
function queryRenderedFeatures(
  geometry?: maplibregl.PointLike,
  options?: maplibregl.QueryRenderedFeaturesOptions
) {
  return mapInstance?.queryRenderedFeatures(geometry, options) ?? []
}

defineExpose({
  zoomIn,
  zoomOut,
  resetView,
  locateMe,
  flyTo,
  resize,
  switchStyle,
  setLayerPaintProperty,
  queryRenderedFeatures,
})
</script>

<template>
  <div ref="mapContainer" class="maplibre-map-container"></div>
</template>

<style scoped>
.maplibre-map-container {
  width: 100%;
  height: 100%;
  border-radius: 0;
  overflow: hidden;
}
</style>
