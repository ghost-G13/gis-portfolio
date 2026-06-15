/**
 * ============================================================
 * GIS 数据处理工具函数库 (gisTools.ts)
 * ============================================================
 * 使用 ES6+ 语法编写，包含：
 *   - 距离计算（Haversine 公式）
 *   - 坐标格式化
 *   - 面积统计
 *   - 其他空间辅助函数
 * 所有函数均以命名导出（named exports）方式提供。
 * ============================================================
 */

// --------------------------------------------------
// 类型定义
// --------------------------------------------------

/** 经纬度坐标点 */
export interface LatLng {
  lat: number
  lng: number
}

/** GeoJSON 坐标（经度, 纬度） */
export type GeoJsonCoord = [number, number]

/** GeoJSON Polygon 坐标环 */
export type GeoJsonRing = GeoJsonCoord[]

// --------------------------------------------------
// 1. 距离计算 — Haversine 公式
// --------------------------------------------------

/**
 * 将角度转换为弧度
 * @param deg 角度值
 * @returns 弧度值
 */
const toRad = (deg: number): number => (deg * Math.PI) / 180

/**
 * 使用 Haversine 公式计算地球表面两点间的球面距离
 * @param p1 起点坐标
 * @param p2 终点坐标
 * @returns 距离（单位：米）
 *
 * 原理：Haversine 公式通过球面三角学计算大圆距离，
 * 假设地球为完美球体（半径 R ≈ 6371000 米），精度足以满足一般 GIS 应用。
 */
export function calculateDistance(p1: LatLng, p2: LatLng): number {
  const R = 6371000 // 地球平均半径，单位：米
  const dLat = toRad(p2.lat - p1.lat)
  const dLng = toRad(p2.lng - p1.lng)

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(p1.lat)) * Math.cos(toRad(p2.lat)) * Math.sin(dLng / 2) ** 2

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

/**
 * 批量计算一组坐标点依次相连的总路径长度
 * @param points 坐标点数组
 * @returns 总长度（单位：米）
 */
export function calculatePathLength(points: LatLng[]): number {
  // 使用 reduce 高阶函数累加相邻点之间的距离
  // prev 是上一个点，curr 是当前点，i 是当前索引
  return points.reduce((total, curr, i) => {
    if (i === 0) return total
    const prev = points[i - 1]!
    return total + calculateDistance(prev, curr)
  }, 0)
}

// --------------------------------------------------
// 2. 坐标格式化
// --------------------------------------------------

/**
 * 将十进制度数格式化为 "度°分′秒″" 的字符串形式
 * @param decimal 十进制度数
 * @param isLatitude 是否为纬度（决定输出 N/S）
 * @returns 格式化后的坐标字符串，如 "23°07′44″N"
 */
export function formatDMS(decimal: number, isLatitude: boolean): string {
  const absolute = Math.abs(decimal)
  const degrees = Math.floor(absolute)
  const minutesFloat = (absolute - degrees) * 60
  const minutes = Math.floor(minutesFloat)
  const seconds = ((minutesFloat - minutes) * 60).toFixed(2)

  const direction = isLatitude
    ? decimal >= 0 ? 'N' : 'S'
    : decimal >= 0 ? 'E' : 'W'

  return `${degrees}°${minutes}′${seconds}″${direction}`
}

/**
 * 将坐标点格式化为完整的度分秒字符串
 * @param point 经纬度坐标点
 * @returns 如 "23°07′44″N, 113°15′52″E"
 */
export function formatLatLngDMS(point: LatLng): string {
  return `${formatDMS(point.lat, true)}, ${formatDMS(point.lng, false)}`
}

/**
 * 将坐标格式化为固定小数位的十进制度数字符串
 * @param point 经纬度坐标点
 * @param digits 小数位数，默认 4
 * @returns 如 "23.1291°N, 113.2644°E"
 */
export function formatLatLngDecimal(point: LatLng, digits = 4): string {
  const latStr = `${Math.abs(point.lat).toFixed(digits)}°${point.lat >= 0 ? 'N' : 'S'}`
  const lngStr = `${Math.abs(point.lng).toFixed(digits)}°${point.lng >= 0 ? 'E' : 'W'}`
  return `${latStr}, ${lngStr}`
}

// --------------------------------------------------
// 3. 面积统计 — 球面多边形面积（基于梯形法近似）
// --------------------------------------------------

/**
 * 使用梯形法（Shoelace 公式的球面扩展）计算多边形面积
 * @param ring 多边形外环坐标数组（闭合环，首尾坐标相同）
 * @returns 面积（单位：平方米）
 *
 * 注：本函数适用于小范围平面近似，大范围请使用专业库如 Turf.js。
 */
export function calculatePolygonArea(ring: GeoJsonRing): number {
  // 过滤掉闭合环的最后一个重复点
  const last = ring[ring.length - 1]!
  const first = ring[0]!
  const coords = last[0] === first[0] && last[1] === first[1]
    ? ring.slice(0, -1)
    : [...ring]

  // 使用 reduce 实现 Shoelace 公式（鞋带公式）
  const sum = coords.reduce((acc, curr, i) => {
    const next = coords[(i + 1) % coords.length]!
    // 经度差 × 平均纬度（转换为弧度后）
    return acc + (next[0] - curr[0]) * toRad((next[1] + curr[1]) / 2)
  }, 0)

  // 将结果转换为平方米（近似）
  return Math.abs(sum) * (6371000 ** 2)
}

/**
 * 格式化面积为易读形式（自动选择 m² / km² / ha）
 * @param areaM2 面积（平方米）
 * @returns 格式化字符串，如 "1.25 km²"
 */
export function formatArea(areaM2: number): string {
  if (areaM2 >= 1_000_000) {
    return `${(areaM2 / 1_000_000).toFixed(2)} km²`
  }
  if (areaM2 >= 10_000) {
    return `${(areaM2 / 10_000).toFixed(2)} ha`
  }
  return `${areaM2.toFixed(2)} m²`
}

// --------------------------------------------------
// 4. 其他辅助函数
// --------------------------------------------------

/**
 * 判断点是否在矩形边界框内
 * @param point 待判断的点
 * @param bbox 边界框 [minLng, minLat, maxLng, maxLat]
 * @returns 是否在框内
 */
export function isPointInBBox(point: LatLng, bbox: [number, number, number, number]): boolean {
  const [minLng, minLat, maxLng, maxLat] = bbox
  return (
    point.lng >= minLng &&
    point.lng <= maxLng &&
    point.lat >= minLat &&
    point.lat <= maxLat
  )
}

/**
 * 计算一组点的边界框
 * @param points 坐标点数组
 * @returns [minLng, minLat, maxLng, maxLat]
 */
export function calculateBBox(points: LatLng[]): [number, number, number, number] {
  // 使用解构配合展开运算符获取所有纬度和经度
  const lats = points.map(({ lat }) => lat)
  const lngs = points.map(({ lng }) => lng)

  return [
    Math.min(...lngs),
    Math.min(...lats),
    Math.max(...lngs),
    Math.max(...lats),
  ]
}
