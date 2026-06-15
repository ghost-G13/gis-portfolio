/**
 * ============================================================
 * GeoJSON 异步加载模块 (geojsonLoader.ts)
 * ============================================================
 * 使用 Promise 与 async/await 封装异步数据加载，
 * 支持 fetch API 从网络或本地路径加载 GeoJSON 数据。
 * ============================================================
 */

// --------------------------------------------------
// 类型定义
// --------------------------------------------------

/** GeoJSON 标准类型 */
export type GeoJSONType = 'FeatureCollection' | 'Feature' | 'Point' | 'LineString' | 'Polygon' | 'MultiPoint' | 'MultiLineString' | 'MultiPolygon' | 'GeometryCollection'

/** GeoJSON 几何体 */
export interface GeoJSONGeometry {
  type: Exclude<GeoJSONType, 'FeatureCollection' | 'Feature' | 'GeometryCollection'>
  coordinates: number[] | number[][] | number[][][] | number[][][][]
}

/** GeoJSON 要素 */
export interface GeoJSONFeature {
  type: 'Feature'
  geometry: GeoJSONGeometry | null
  properties: Record<string, unknown>
  id?: string | number
}

/** GeoJSON 要素集合 */
export interface GeoJSONFeatureCollection {
  type: 'FeatureCollection'
  features: GeoJSONFeature[]
  bbox?: [number, number, number, number]
}

/** 加载配置选项 */
export interface LoaderOptions {
  /** 超时时间（毫秒），默认 10000 */
  timeout?: number
  /** 请求头 */
  headers?: Record<string, string>
}

/** 加载结果封装 */
export interface LoadResult<T> {
  success: boolean
  data?: T
  error?: string
  duration: number // 加载耗时（毫秒）
}

// --------------------------------------------------
// 1. 核心加载函数 — 基于 Promise 的 fetch 封装
// --------------------------------------------------

/**
 * 异步加载 GeoJSON 数据
 * @param url 数据地址（支持 http / https / 相对路径）
 * @param options 可选配置（超时、请求头）
 * @returns Promise<LoadResult<GeoJSONFeatureCollection>>
 *
 * 实现要点：
 *   - 使用 fetch API 发起网络请求
 *   - 使用 Promise.race 实现请求超时控制
 *   - 使用 async/await 使异步代码具有同步的可读性
 */
export async function loadGeoJSON(
  url: string,
  options: LoaderOptions = {}
): Promise<LoadResult<GeoJSONFeatureCollection>> {
  const { timeout = 10000, headers = {} } = options
  const startTime = performance.now()

  try {
    // 创建 AbortController 用于超时取消请求
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    // 发起 fetch 请求
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/geo+json, application/json',
        ...headers,
      },
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    // 检查 HTTP 状态码
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    // 解析 JSON 数据
    const data = await response.json()

    // 简单校验 GeoJSON 结构
    if (data.type !== 'FeatureCollection') {
      throw new Error('返回数据不是有效的 GeoJSON FeatureCollection')
    }

    const duration = Math.round(performance.now() - startTime)

    return {
      success: true,
      data: data as GeoJSONFeatureCollection,
      duration,
    }
  } catch (err) {
    const duration = Math.round(performance.now() - startTime)
    const errorMessage = err instanceof Error ? err.message : '未知错误'

    return {
      success: false,
      error: errorMessage,
      duration,
    }
  }
}

// --------------------------------------------------
// 2. 批量加载 — 使用 Promise.all 并行加载多个 GeoJSON
// --------------------------------------------------

/**
 * 并行加载多个 GeoJSON 文件
 * @param urls URL 数组
 * @param options 可选配置
 * @returns 每个 URL 对应的 LoadResult 数组
 *
 * 使用 Promise.all 同时发起多个请求，总耗时由最慢的请求决定，
 * 效率远高于串行加载。
 */
export async function loadMultipleGeoJSON(
  urls: string[],
  options?: LoaderOptions
): Promise<LoadResult<GeoJSONFeatureCollection>[]> {
  // 使用 map 将每个 url 转换为 loadGeoJSON 的 Promise
  const promises = urls.map((url) => loadGeoJSON(url, options))
  // Promise.all 等待所有 Promise 完成
  return Promise.all(promises)
}

// --------------------------------------------------
// 3. 带重试机制的加载
// --------------------------------------------------

/**
 * 带重试机制的 GeoJSON 加载
 * @param url 数据地址
 * @param maxRetries 最大重试次数，默认 3
 * @param options 可选配置
 * @returns LoadResult
 */
export async function loadGeoJSONWithRetry(
  url: string,
  maxRetries = 3,
  options?: LoaderOptions
): Promise<LoadResult<GeoJSONFeatureCollection>> {
  let lastResult: LoadResult<GeoJSONFeatureCollection>

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    lastResult = await loadGeoJSON(url, options)

    if (lastResult.success) {
      console.log(`[GeoJSON Loader] 第 ${attempt} 次尝试加载成功，耗时 ${lastResult.duration}ms`)
      return lastResult
    }

    console.warn(`[GeoJSON Loader] 第 ${attempt} 次尝试失败: ${lastResult.error}`)

    // 如果不是最后一次尝试，则等待后重试（指数退避）
    if (attempt < maxRetries) {
      const delay = Math.min(1000 * 2 ** (attempt - 1), 5000)
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }

  return lastResult!
}

// --------------------------------------------------
// 4. 从本地字符串解析（用于测试或内嵌数据）
// --------------------------------------------------

/**
 * 同步解析 GeoJSON 字符串
 * @param jsonString JSON 字符串
 * @returns 解析后的 GeoJSONFeatureCollection
 */
export function parseGeoJSONString(jsonString: string): GeoJSONFeatureCollection {
  const parsed = JSON.parse(jsonString)
  if (parsed.type !== 'FeatureCollection') {
    throw new Error('解析结果不是有效的 GeoJSON FeatureCollection')
  }
  return parsed as GeoJSONFeatureCollection
}
