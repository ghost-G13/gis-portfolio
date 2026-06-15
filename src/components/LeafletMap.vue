<script setup lang="ts">
/**
 * LeafletMap.vue
 * ============================================
 * 基于 Vue 3 + TypeScript + Leaflet 的地图初始化组件
 * 功能：渲染交互式地图，支持工具栏操作、主题切换、状态回传
 * ============================================
 */

import { ref, onMounted, onUnmounted, watch } from 'vue'
import L from 'leaflet'
import type { Map as LeafletMapType, TileLayer, Polyline, Polygon, Marker, LayerGroup } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { calculatePathLength, calculatePolygonArea, formatArea } from '@/utils/gisTools'
import type { LatLng } from '@/utils/gisTools'
import type { LayerItem } from './LayerList.vue'

// --------------------------------------------
// Props 定义
// --------------------------------------------
interface Props {
  latitude?: number
  longitude?: number
  zoom?: number
  theme?: 'light' | 'dark'
  /** 图层列表 —— 根据 visible 状态控制地图上对应图层的显示与隐藏 */
  layers?: LayerItem[]
}

const props = withDefaults(defineProps<Props>(), {
  latitude: 29.5630,
  longitude: 106.5516,
  zoom: 12,
  theme: 'light',
  layers: () => []
})

// --------------------------------------------
// Emits 定义：向父组件回传状态
// --------------------------------------------
const emit = defineEmits<{
  (e: 'update:center', lat: number, lng: number): void
  (e: 'update:zoom', zoom: number): void
  (e: 'update:mouse', lat: number, lng: number): void
  (e: 'measure:result', type: 'distance' | 'area', value: string): void
}>()

// --------------------------------------------
// 响应式引用
// --------------------------------------------
const mapContainer = ref<HTMLDivElement | null>(null)
let mapInstance: LeafletMapType | null = null

// --------------------------------------------
// 动态图层管理：id -> Leaflet LayerGroup
// --------------------------------------------
const layerGroupMap = new Map<string, LayerGroup>()

/** 为指定图层 id 创建对应的 Leaflet 图层内容（重庆地区示例数据） */
function createLayerContent(id: string): LayerGroup | null {
  if (!mapInstance) return null
  const group = L.layerGroup()

  switch (id) {
    case 'poi': {
      // POI 兴趣点：重庆市核心区域真实地标（数据来源：OpenStreetMap）
      const pois = [
        { lat: 29.5630, lng: 106.5516, name: '解放碑', category: '地标' },
        { lat: 29.5710, lng: 106.5820, name: '洪崖洞民俗风貌区', category: '景点' },
        { lat: 29.5880, lng: 106.5910, name: '朝天门广场', category: '地标' },
        { lat: 29.5820, lng: 106.5080, name: '磁器口古镇', category: '景点' },
        { lat: 29.5660, lng: 106.5550, name: '重庆国泰艺术中心', category: '文化' },
        { lat: 29.5610, lng: 106.5830, name: '罗汉寺', category: '宗教' },
        { lat: 29.5580, lng: 106.5850, name: '长江索道', category: '交通' },
        { lat: 29.5650, lng: 106.5490, name: '八一路好吃街', category: '美食' },
        { lat: 29.5600, lng: 106.5780, name: '湖广会馆', category: '文化' },
        { lat: 29.5550, lng: 106.5750, name: '南滨路', category: '休闲' },
      ]
      pois.forEach((p) => {
        const iconHtml = `<div style="width:28px;height:28px;background:#e11d48;color:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:bold;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.3);">${p.name.charAt(0)}</div>`
        const icon = L.divIcon({
          html: iconHtml,
          className: 'custom-poi-icon',
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        })
        L.marker([p.lat, p.lng], { icon })
          .bindPopup(`<b style="font-size:14px;">${p.name}</b><br><span style="color:#666;font-size:12px;">${p.category}</span>`)
          .addTo(group)
      })
      break
    }
    case 'range': {
      // 覆盖范围：多个不同半径的半透明圆
      const ranges = [
        { lat: 29.5630, lng: 106.5516, r: 3000, label: '3km 覆盖圈' },
        { lat: 29.5300, lng: 106.5800, r: 2000, label: '2km 覆盖圈' },
        { lat: 29.5900, lng: 106.5200, r: 1500, label: '1.5km 覆盖圈' },
      ]
      ranges.forEach((r) => {
        L.circle([r.lat, r.lng], { radius: r.r, color: '#7c3aed', fillColor: '#7c3aed', fillOpacity: 0.15, weight: 2 })
          .bindPopup(r.label).addTo(group)
      })
      break
    }
    case 'road': {
      // 道路网：重庆渝中区核心区域真实道路（数据来源：OpenStreetMap）
      const roads = [
        {
          name: '民族路',
          latlngs: [[29.5615, 106.5500], [29.5620, 106.5508], [29.5625, 106.5515], [29.5630, 106.5520], [29.5635, 106.5525], [29.5640, 106.5530], [29.5650, 106.5535]] as [number, number][],
        },
        {
          name: '新华路',
          latlngs: [[29.5600, 106.5510], [29.5605, 106.5520], [29.5610, 106.5530], [29.5615, 106.5540], [29.5620, 106.5550], [29.5630, 106.5560]] as [number, number][],
        },
        {
          name: '邹容路',
          latlngs: [[29.5620, 106.5480], [29.5625, 106.5490], [29.5630, 106.5500], [29.5635, 106.5510], [29.5640, 106.5520]] as [number, number][],
        },
        {
          name: '八一路',
          latlngs: [[29.5635, 106.5490], [29.5640, 106.5500], [29.5645, 106.5510], [29.5650, 106.5520], [29.5660, 106.5530]] as [number, number][],
        },
        {
          name: '五一路',
          latlngs: [[29.5640, 106.5495], [29.5645, 106.5505], [29.5650, 106.5515], [29.5655, 106.5525]] as [number, number][],
        },
        {
          name: '中华路',
          latlngs: [[29.5610, 106.5525], [29.5615, 106.5535], [29.5620, 106.5545], [29.5625, 106.5555]] as [number, number][],
        },
      ]
      roads.forEach((r) => {
        L.polyline(r.latlngs, { color: '#f59e0b', weight: 3, opacity: 0.85 })
          .bindPopup(`<b>${r.name}</b>`).addTo(group)
      })
      break
    }
    case 'building': {
      // 建筑物：几个模拟的多边形（矩形建筑群）
      const buildings = [
        { latlngs: [[29.5620, 106.5500], [29.5620, 106.5530], [29.5640, 106.5530], [29.5640, 106.5500]], name: '商业区 A' },
        { latlngs: [[29.5600, 106.5490], [29.5600, 106.5520], [29.5615, 106.5520], [29.5615, 106.5490]], name: '住宅区 B' },
      ]
      buildings.forEach((b) => {
        L.polygon(b.latlngs as [number, number][], { color: '#10b981', fillColor: '#10b981', fillOpacity: 0.3, weight: 2 })
          .bindPopup(b.name).addTo(group)
      })
      break
    }
    case 'river': {
      // 水系分布：一条蜿蜒的蓝色折线模拟河流（嘉陵江/长江示意）
      const riverPath: [number, number][] = [
        [29.5200, 106.5000], [29.5350, 106.5150], [29.5500, 106.5300],
        [29.5550, 106.5450], [29.5600, 106.5550], [29.5650, 106.5700], [29.5750, 106.5900]
      ]
      L.polyline(riverPath, { color: '#0ea5e9', weight: 5, opacity: 0.7 }).bindPopup('嘉陵江示意').addTo(group)
      break
    }
    case 'terrain': {
      // 地形高程：一组同心圆模拟等高线（山城重庆）
      const center: [number, number] = [29.6000, 106.5800]
      const contours = [1000, 2000, 3500, 5000]
      contours.forEach((r, i) => {
        L.circle(center, {
          radius: r, color: '#84cc16', fillColor: '#84cc16',
          fillOpacity: 0.05 + i * 0.03, weight: 1.5, dashArray: '6, 4'
        }).bindPopup(`等高线 ${i + 1}`).addTo(group)
      })
      break
    }
    default:
      return null
  }
  return group
}

/** 根据图层列表更新地图上各图层的显示状态 */
function updateMapLayers(layers: LayerItem[]) {
  const map = mapInstance
  if (!map) return
  layers.forEach((layer) => {
    const existing = layerGroupMap.get(layer.id)
    if (layer.visible) {
      if (!existing) {
        const group = createLayerContent(layer.id)
        if (group) {
          group.addTo(map)
          layerGroupMap.set(layer.id, group)
        }
      }
    } else {
      if (existing) {
        map.removeLayer(existing)
        layerGroupMap.delete(layer.id)
      }
    }
  })
}

// --------------------------------------------
// 测量功能状态
// --------------------------------------------
const measureMode = ref<'none' | 'distance' | 'area'>('none')
let measurePoints: LatLng[] = []
let measureLayerGroup: LayerGroup | null = null
let measurePolyline: Polyline | null = null
let measurePolygon: Polygon | null = null
let measureMarkers: Marker[] = []

// --------------------------------------------
// 底图（Base Layers）配置 —— 供 L.control.layers 切换使用
// --------------------------------------------

/** 底图配置列表：名称 -> 瓦片图层 */
const baseMaps: Record<string, TileLayer> = {
  '高德标准地图': L.tileLayer('https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}', {
    attribution: '&copy; <a href="https://www.amap.com">高德地图</a>',
    subdomains: '1234',
    maxZoom: 18,
  }),
  '高德卫星地图': L.tileLayer('https://webst0{s}.is.autonavi.com/appmaptile?style=6&x={x}&y={y}&z={z}', {
    attribution: '&copy; <a href="https://www.amap.com">高德地图</a>',
    subdomains: '1234',
    maxZoom: 18,
  }),
  '街道图 (OSM)': L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
  }),
  '卫星图 (Esri)': L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: '&copy; <a href="https://www.esri.com">Esri</a>',
    maxZoom: 18,
  }),
  '地形图 (OpenTopoMap)': L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://opentopomap.org">OpenTopoMap</a> contributors',
    maxZoom: 17,
  }),
  '深色图 (CartoDB)': L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    maxZoom: 19,
  }),
}

// --------------------------------------------
// 地图初始化
// --------------------------------------------
onMounted(() => {
  if (!mapContainer.value) return

  mapInstance = L.map(mapContainer.value, {
    center: [props.latitude, props.longitude],
    zoom: props.zoom,
    zoomControl: false // 隐藏默认缩放控件，使用自定义工具栏
  })

  // 添加默认底图（高德标准地图）到地图上
  baseMaps['高德标准地图']!.addTo(mapInstance!)

  // 添加底图切换控件 —— Leaflet 内置的 L.control.layers
  // 第一参数 baseMaps 是互斥底图（只能同时选中一个）
  // 第二参数 {} 为空，表示暂时没有非互斥的覆盖图层（覆盖图层通过开关控制）
  L.control.layers(baseMaps, {}, {
    position: 'topright',   // 控件位置：右上角
    collapsed: true,        // 默认折叠，点击展开
    autoZIndex: true,       // 自动管理图层 z-index
  }).addTo(mapInstance)

  // 添加比例尺
  L.control.scale({ position: 'bottomright', metric: true, imperial: false }).addTo(mapInstance)

  // 监听地图移动事件，回传状态给父组件
  mapInstance.on('moveend', () => {
    const center = mapInstance!.getCenter()
    emit('update:center', parseFloat(center.lat.toFixed(4)), parseFloat(center.lng.toFixed(4)))
  })
  mapInstance.on('zoomend', () => {
    emit('update:zoom', mapInstance!.getZoom())
  })

  // 实时追踪鼠标经纬度：监听 mousemove 事件，通过 emit 回传父组件
  mapInstance.on('mousemove', (e: L.LeafletMouseEvent) => {
    emit('update:mouse', parseFloat(e.latlng.lat.toFixed(6)), parseFloat(e.latlng.lng.toFixed(6)))
  })

  // 测量模式点击与双击事件
  mapInstance.on('click', handleMeasureClick)
  mapInstance.on('dblclick', handleMeasureDblClick)

  // 初始状态回传
  emit('update:center', props.latitude, props.longitude)
  emit('update:zoom', props.zoom)

  // 初始化图层：根据传入的 layers 创建对应的 Leaflet 图层
  updateMapLayers(props.layers)
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

// 监听图层列表变化，动态添加/移除地图上的 Leaflet 图层
watch(() => props.layers, (newLayers) => {
  updateMapLayers(newLayers)
}, { deep: true })

// --------------------------------------------
// 暴露方法给父组件（工具栏调用）
// --------------------------------------------
function zoomIn() {
  mapInstance?.zoomIn()
}
function zoomOut() {
  mapInstance?.zoomOut()
}
function resetView() {
  mapInstance?.flyTo([props.latitude, props.longitude], props.zoom, { duration: 1.5 })
}
function locateMe() {
  if (!mapInstance) return
  mapInstance.locate({ setView: true, maxZoom: 16 })
}

/** 飞行定位到指定位置（书签功能使用） */
function flyTo(lat: number, lng: number, zoom?: number) {
  mapInstance?.flyTo([lat, lng], zoom ?? mapInstance.getZoom(), { duration: 1.5 })
}

// --------------------------------------------
// 测量功能方法
// --------------------------------------------

/** 开始距离测量 */
function startMeasureDistance() {
  clearMeasure()
  measureMode.value = 'distance'
  if (mapInstance) {
    mapInstance.getContainer().style.cursor = 'crosshair'
  }
}

/** 开始面积测量 */
function startMeasureArea() {
  clearMeasure()
  measureMode.value = 'area'
  if (mapInstance) {
    mapInstance.getContainer().style.cursor = 'crosshair'
  }
}

/** 清除所有测量图层和状态 */
function clearMeasure() {
  measureMode.value = 'none'
  measurePoints = []
  if (measureLayerGroup && mapInstance) {
    mapInstance.removeLayer(measureLayerGroup)
  }
  measureLayerGroup = null
  measurePolyline = null
  measurePolygon = null
  measureMarkers = []
  if (mapInstance) {
    mapInstance.getContainer().style.cursor = ''
  }
}

/** 格式化距离显示 */
function formatDistance(meters: number): string {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(2)} km`
  }
  return `${meters.toFixed(1)} m`
}

/** 处理测量模式下的地图点击 */
function handleMeasureClick(e: L.LeafletMouseEvent) {
  if (measureMode.value === 'none') return
  if (!mapInstance) return

  // 初始化图层组
  if (!measureLayerGroup) {
    measureLayerGroup = L.layerGroup().addTo(mapInstance)
  }

  const point: LatLng = { lat: e.latlng.lat, lng: e.latlng.lng }
  measurePoints.push(point)

  // 添加标记点
  const marker = L.circleMarker([point.lat, point.lng], {
    radius: 5,
    color: '#ff4444',
    fillColor: '#ff4444',
    fillOpacity: 1,
    weight: 2
  }).addTo(measureLayerGroup)
  measureMarkers.push(marker as unknown as Marker)

  if (measureMode.value === 'distance') {
    updateDistanceMeasure()
  } else if (measureMode.value === 'area') {
    updateAreaMeasure()
  }
}

/** 更新距离测量折线和结果 */
function updateDistanceMeasure() {
  if (!measureLayerGroup || !mapInstance) return

  const latlngs = measurePoints.map(p => [p.lat, p.lng] as [number, number])

  // 更新或创建折线
  if (measurePolyline) {
    measurePolyline.setLatLngs(latlngs)
  } else {
    measurePolyline = L.polyline(latlngs, {
      color: '#ff4444',
      weight: 3,
      dashArray: '10, 6'
    }).addTo(measureLayerGroup)
  }

  // 计算总距离
  if (measurePoints.length >= 2) {
    const totalDistance = calculatePathLength(measurePoints)
    const formatted = formatDistance(totalDistance)
    emit('measure:result', 'distance', formatted)

    // 在最后一个点显示 tooltip
    const lastPoint = measurePoints[measurePoints.length - 1]!
    measurePolyline.bindTooltip(`总距离: ${formatted}`, {
      permanent: true,
      direction: 'top',
      className: 'measure-tooltip'
    }).openTooltip([lastPoint.lat, lastPoint.lng])
  }
}

/** 更新面积测量多边形和结果 */
function updateAreaMeasure() {
  if (!measureLayerGroup || !mapInstance) return
  if (measurePoints.length < 3) return

  const latlngs = measurePoints.map(p => [p.lat, p.lng] as [number, number])

  // 转换为 GeoJSON 坐标格式 [lng, lat]
  const geoJsonRing = measurePoints.map(p => [p.lng, p.lat] as [number, number])
  // 闭合环
  geoJsonRing.push(geoJsonRing[0]!)

  // 更新或创建多边形
  if (measurePolygon) {
    measurePolygon.setLatLngs(latlngs)
  } else {
    measurePolygon = L.polygon(latlngs, {
      color: '#ff4444',
      fillColor: '#ff4444',
      fillOpacity: 0.2,
      weight: 2,
      dashArray: '10, 6'
    }).addTo(measureLayerGroup)
  }

  // 计算面积
  const area = calculatePolygonArea(geoJsonRing)
  const formatted = formatArea(area)
  emit('measure:result', 'area', formatted)

  // 在多边形中心显示面积
  measurePolygon.bindTooltip(`面积: ${formatted}`, {
    permanent: true,
    direction: 'center',
    className: 'measure-tooltip'
  }).openTooltip()
}

/** 双击结束测量 */
function handleMeasureDblClick() {
  if (measureMode.value === 'none') return
  // 结束测量模式但保留图层显示
  measureMode.value = 'none'
  if (mapInstance) {
    mapInstance.getContainer().style.cursor = ''
  }
}

// 通过 defineExpose 向父组件暴露方法
defineExpose({ zoomIn, zoomOut, resetView, locateMe, flyTo, startMeasureDistance, startMeasureArea, clearMeasure })
</script>

<template>
  <!-- 地图容器 -->
  <div ref="mapContainer" class="leaflet-map-container"></div>
</template>

<style scoped>
.leaflet-map-container {
  width: 100%;
  height: 100%;
  border-radius: 0;
  overflow: hidden;
}
</style>
