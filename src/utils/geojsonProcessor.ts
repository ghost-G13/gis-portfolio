/**
 * ============================================================
 * GeoJSON 处理模块 (geojsonProcessor.ts)
 * ============================================================
 * 封装 GeoJSON 的解析、过滤、统计等常用操作。
 * 使用 ES6 模块化导出（named exports）。
 * 大量使用解构赋值、展开运算符、数组高阶函数（map/filter/reduce）。
 * ============================================================
 */

import type { GeoJSONFeature, GeoJSONFeatureCollection, GeoJSONGeometry } from './geojsonLoader'
import { calculateDistance, calculatePolygonArea, formatArea, type LatLng } from './gisTools'

// --------------------------------------------------
// 1. 解析与验证
// --------------------------------------------------

/**
 * 验证对象是否为合法的 GeoJSON FeatureCollection
 * @param data 待验证的数据
 * @returns 验证结果与错误信息
 */
export function validateFeatureCollection(data: unknown): { valid: boolean; error?: string } {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: '数据为空或不是对象' }
  }

  const collection = data as Record<string, unknown>

  if (collection.type !== 'FeatureCollection') {
    return { valid: false, error: `类型不是 FeatureCollection，而是 ${collection.type}` }
  }

  if (!Array.isArray(collection.features)) {
    return { valid: false, error: '缺少 features 数组' }
  }

  return { valid: true }
}

/**
 * 获取要素集合的基本统计信息
 * @param collection GeoJSON FeatureCollection
 * @returns 统计对象
 */
export function getCollectionStats(collection: GeoJSONFeatureCollection) {
  const { features } = collection

  // 使用解构 + 展开运算符提取几何类型
  const geometryTypes = [...new Set(features.map((f) => f.geometry?.type).filter(Boolean))]

  // 使用 reduce 统计各几何类型的数量
  const typeCounts = features.reduce((acc, feature) => {
    const type = feature.geometry?.type ?? 'null'
    acc[type] = (acc[type] ?? 0) + 1
    return acc
  }, {} as Record<string, number>)

  // 使用 map + filter + reduce 统计属性字段数量
  const totalProperties = features.reduce((sum, f) => sum + Object.keys(f.properties).length, 0)

  return {
    featureCount: features.length,
    geometryTypes,
    typeCounts,
    avgPropertiesPerFeature: features.length > 0 ? +(totalProperties / features.length).toFixed(2) : 0,
  }
}

// --------------------------------------------------
// 2. 过滤操作
// --------------------------------------------------

/**
 * 按几何类型过滤要素
 * @param collection 要素集合
 * @param geometryType 目标几何类型，如 'Point'、'Polygon'
 * @returns 过滤后的新集合（不修改原数据）
 */
export function filterByGeometryType(
  collection: GeoJSONFeatureCollection,
  geometryType: string
): GeoJSONFeatureCollection {
  // 使用 filter 高阶函数，结合展开运算符复制对象
  return {
    ...collection,
    features: collection.features.filter((f) => f.geometry?.type === geometryType),
  }
}

/**
 * 按属性条件过滤要素
 * @param collection 要素集合
 * @param key 属性名
 * @param value 属性值
 * @returns 过滤后的新集合
 */
export function filterByProperty(
  collection: GeoJSONFeatureCollection,
  key: string,
  value: unknown
): GeoJSONFeatureCollection {
  return {
    ...collection,
    features: collection.features.filter((f) => f.properties[key] === value),
  }
}

/**
 * 按属性值范围过滤（支持数值比较）
 * @param collection 要素集合
 * @param key 数值属性名
 * @param min 最小值（含）
 * @param max 最大值（含）
 * @returns 过滤后的新集合
 */
export function filterByNumericRange(
  collection: GeoJSONFeatureCollection,
  key: string,
  min: number,
  max: number
): GeoJSONFeatureCollection {
  return {
    ...collection,
    features: collection.features.filter((f) => {
      const val = f.properties[key]
      return typeof val === 'number' && val >= min && val <= max
    }),
  }
}

/**
 * 按边界框空间过滤（保留与边界框相交的要素）
 * @param collection 要素集合
 * @param bbox 边界框 [minLng, minLat, maxLng, maxLat]
 * @returns 过滤后的新集合
 */
export function filterByBBox(
  collection: GeoJSONFeatureCollection,
  bbox: [number, number, number, number]
): GeoJSONFeatureCollection {
  const [minLng, minLat, maxLng, maxLat] = bbox

  return {
    ...collection,
    features: collection.features.filter((f) => {
      if (!f.geometry) return false
      const coords = extractCoordinates(f.geometry)
      if (!coords.length) return false
      // 只要有一个点在边界框内就保留
      return coords.some(([lng, lat]) =>
        lng >= minLng && lng <= maxLng && lat >= minLat && lat <= maxLat
      )
    }),
  }
}

// --------------------------------------------------
// 3. 统计操作
// --------------------------------------------------

/**
 * 统计所有 Point 要素之间的距离矩阵
 * @param collection 要素集合
 * @returns 距离矩阵（单位：米）
 */
export function calculateDistanceMatrix(collection: GeoJSONFeatureCollection): number[][] {
  // 提取所有 Point 要素的坐标
  const points: LatLng[] = collection.features
    .filter((f) => f.geometry?.type === 'Point')
    .map((f) => {
      const [lng, lat] = f.geometry!.coordinates as [number, number]
      return { lat, lng }
    })

  // 使用 map 嵌套生成距离矩阵
  return points.map((p1) =>
    points.map((p2) => calculateDistance(p1, p2))
  )
}

/**
 * 统计所有 Polygon 要素的面积
 * @param collection 要素集合
 * @returns 每个多边形的面积信息数组
 */
export function calculatePolygonAreas(
  collection: GeoJSONFeatureCollection
): { id?: string | number; name?: string; areaM2: number; areaFormatted: string }[] {
  return collection.features
    .filter((f) => f.geometry?.type === 'Polygon')
    .map((f) => {
      // 解构赋值提取几何坐标和属性
      const { geometry, properties, id } = f
      const coordinates = (geometry as GeoJSONGeometry).coordinates as number[][][]
      const exteriorRing = coordinates[0] as [number, number][] // 外环
      if (!exteriorRing) return { id, name: properties?.name as string | undefined, areaM2: 0, areaFormatted: '0 m²' }

      // 调用 gisTools 中的面积计算函数
      const areaM2 = calculatePolygonArea(exteriorRing)

      return {
        id,
        name: properties?.name as string | undefined,
        areaM2,
        areaFormatted: formatArea(areaM2),
      }
    })
}

/**
 * 统计数值属性的聚合信息（最小值、最大值、平均值、总和）
 * @param collection 要素集合
 * @param key 数值属性名
 * @returns 聚合统计结果
 */
export function aggregateNumericProperty(
  collection: GeoJSONFeatureCollection,
  key: string
): { min: number; max: number; avg: number; sum: number; count: number } | null {
  // 使用 map 提取数值，filter 过滤掉非数值
  const values = collection.features
    .map((f) => f.properties[key])
    .filter((v): v is number => typeof v === 'number')

  if (values.length === 0) return null

  // 使用展开运算符配合 Math.min/max
  const min = Math.min(...values)
  const max = Math.max(...values)
  // 使用 reduce 求和
  const sum = values.reduce((acc, v) => acc + v, 0)
  const avg = +(sum / values.length).toFixed(2)

  return { min, max, avg, sum, count: values.length }
}

// --------------------------------------------------
// 4. 转换操作
// --------------------------------------------------

/**
 * 将要素集合中的指定属性重命名
 * @param collection 要素集合
 * @param renameMap 重名映射 { 旧名: 新名 }
 * @returns 转换后的新集合
 */
export function renameProperties(
  collection: GeoJSONFeatureCollection,
  renameMap: Record<string, string>
): GeoJSONFeatureCollection {
  return {
    ...collection,
    features: collection.features.map((f) => {
      // 使用 Object.entries + reduce 构建新属性对象
      const newProperties = Object.entries(f.properties).reduce((acc, [key, val]) => {
        const newKey = renameMap[key] ?? key
        acc[newKey] = val
        return acc
      }, {} as Record<string, unknown>)

      return { ...f, properties: newProperties }
    }),
  }
}

/**
 * 为每个要素添加计算字段（如中心点坐标）
 * @param collection 要素集合
 * @returns 增强后的新集合
 */
export function addComputedFields(collection: GeoJSONFeatureCollection): GeoJSONFeatureCollection {
  return {
    ...collection,
    features: collection.features.map((f) => {
      const centroid = calculateCentroid(f.geometry)
      return {
        ...f,
        properties: {
          ...f.properties,
          _centroidLng: centroid?.lng,
          _centroidLat: centroid?.lat,
        },
      }
    }),
  }
}

// --------------------------------------------------
// 5. 内部辅助函数
// --------------------------------------------------

/**
 * 从几何体中提取所有坐标点（用于空间过滤）
 */
function extractCoordinates(geometry: GeoJSONGeometry): [number, number][] {
  switch (geometry.type) {
    case 'Point':
      return [geometry.coordinates as [number, number]]
    case 'LineString':
      return geometry.coordinates as [number, number][]
    case 'Polygon':
      return (geometry.coordinates as [number, number][][])[0] || []
    default:
      return []
  }
}

/**
 * 计算几何体的质心（简化版：取坐标平均值）
 */
function calculateCentroid(geometry: GeoJSONGeometry | null): LatLng | null {
  if (!geometry) return null

  const coords = extractCoordinates(geometry)
  if (coords.length === 0) return null

  // 使用 reduce 计算平均值
  const sumLng = coords.reduce((sum, [lng]) => sum + lng, 0)
  const sumLat = coords.reduce((sum, [, lat]) => sum + lat, 0)

  return {
    lng: +(sumLng / coords.length).toFixed(6),
    lat: +(sumLat / coords.length).toFixed(6),
  }
}
