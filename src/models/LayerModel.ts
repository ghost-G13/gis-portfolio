/**
 * ============================================================
 * 图层数据模型 (LayerModel.ts)
 * ============================================================
 * 使用 ES6 Class 封装 GIS 图层的数据结构与业务逻辑。
 * 提供属性访问、要素增删、可见性控制、样式管理等功能。
 * ============================================================
 */

import type { GeoJSONFeature, GeoJSONFeatureCollection } from '@/utils/geojsonLoader'
import type { LatLng } from '@/utils/gisTools'
import {
  getCollectionStats,
  filterByGeometryType,
  filterByProperty,
  calculatePolygonAreas,
  aggregateNumericProperty,
} from '@/utils/geojsonProcessor'

// --------------------------------------------------
// 类型定义
// --------------------------------------------------

/** 图层样式配置 */
export interface LayerStyle {
  fillColor?: string
  fillOpacity?: number
  strokeColor?: string
  strokeWidth?: number
  strokeOpacity?: number
  radius?: number // 用于 Point
}

/** 图层元数据 */
export interface LayerMetadata {
  name: string
  description?: string
  createdAt: Date
  updatedAt: Date
  crs?: string // 坐标参考系统
  source?: string // 数据来源
}

// --------------------------------------------------
// LayerModel 类定义
// --------------------------------------------------

/**
 * GIS 图层数据模型
 * 封装一个地理数据图层的完整生命周期管理
 */
export class LayerModel {
  // ========== 私有属性 ==========

  /** 图层唯一标识 */
  private _id: string

  /** 图层元数据 */
  private _metadata: LayerMetadata

  /** GeoJSON 数据源 */
  private _data: GeoJSONFeatureCollection

  /** 图层可见性 */
  private _visible: boolean

  /** 图层样式配置 */
  private _style: LayerStyle

  /** 当前激活的过滤条件 */
  private _filterCache: GeoJSONFeatureCollection | null = null

  // ========== 构造函数 ==========

  /**
   * 创建图层实例
   * @param id 图层唯一标识
   * @param data GeoJSON 数据
   * @param metadata 可选的元数据
   * @param style 可选的样式配置
   */
  constructor(
    id: string,
    data: GeoJSONFeatureCollection,
    metadata?: Partial<LayerMetadata>,
    style?: Partial<LayerStyle>
  ) {
    this._id = id
    this._data = data
    this._visible = true
    this._metadata = {
      name: metadata?.name ?? `图层-${id}`,
      description: metadata?.description,
      createdAt: metadata?.createdAt ?? new Date(),
      updatedAt: new Date(),
      crs: metadata?.crs ?? 'EPSG:4326',
      source: metadata?.source,
    }
    this._style = {
      fillColor: '#2563eb',
      fillOpacity: 0.3,
      strokeColor: '#1d4ed8',
      strokeWidth: 2,
      strokeOpacity: 1,
      radius: 8,
      ...style, // 展开运算符合并默认样式与用户传入样式
    }
  }

  // ========== Getter 访问器 ==========

  get id(): string {
    return this._id
  }

  get name(): string {
    return this._metadata.name
  }

  get visible(): boolean {
    return this._visible
  }

  get featureCount(): number {
    return this._data.features.length
  }

  get metadata(): Readonly<LayerMetadata> {
    return { ...this._metadata } // 返回副本，防止外部直接修改
  }

  get style(): Readonly<LayerStyle> {
    return { ...this._style }
  }

  /**
   * 获取原始数据（完整要素集合）
   */
  get data(): GeoJSONFeatureCollection {
    return this._filterCache ?? this._data
  }

  // ========== Setter 方法 ==========

  set name(value: string) {
    this._metadata.name = value
    this._metadata.updatedAt = new Date()
  }

  set visible(value: boolean) {
    this._visible = value
  }

  /**
   * 更新样式（局部更新，使用展开运算符保留未修改项）
   */
  updateStyle(newStyle: Partial<LayerStyle>): void {
    this._style = { ...this._style, ...newStyle }
    this._metadata.updatedAt = new Date()
  }

  // ========== 要素操作方法 ==========

  /**
   * 添加单个要素
   * @param feature GeoJSON 要素
   */
  addFeature(feature: GeoJSONFeature): void {
    // 使用展开运算符复制原数组并追加新要素
    this._data = {
      ...this._data,
      features: [...this._data.features, feature],
    }
    this._filterCache = null // 清除过滤缓存
    this._metadata.updatedAt = new Date()
  }

  /**
   * 批量添加要素
   * @param features 要素数组
   */
  addFeatures(features: GeoJSONFeature[]): void {
    this._data = {
      ...this._data,
      features: [...this._data.features, ...features], // 展开运算符拼接数组
    }
    this._filterCache = null
    this._metadata.updatedAt = new Date()
  }

  /**
   * 按 ID 删除要素
   * @param featureId 要素 ID
   */
  removeFeature(featureId: string | number): void {
    this._data = {
      ...this._data,
      features: this._data.features.filter((f) => f.id !== featureId),
    }
    this._filterCache = null
    this._metadata.updatedAt = new Date()
  }

  /**
   * 按索引删除要素
   * @param index 要素索引
   */
  removeFeatureAt(index: number): void {
    this._data = {
      ...this._data,
      features: [
        ...this._data.features.slice(0, index), // 展开前半部分
        ...this._data.features.slice(index + 1), // 展开后半部分
      ],
    }
    this._filterCache = null
    this._metadata.updatedAt = new Date()
  }

  // ========== 过滤方法（委托给 geojsonProcessor） ==========

  /**
   * 按几何类型过滤并缓存结果
   * @param geometryType 几何类型
   */
  filterByType(geometryType: string): void {
    this._filterCache = filterByGeometryType(this._data, geometryType)
  }

  /**
   * 按属性过滤并缓存结果
   * @param key 属性名
   * @param value 属性值
   */
  filterByProperty(key: string, value: unknown): void {
    this._filterCache = filterByProperty(this._data, key, value)
  }

  /**
   * 清除过滤条件，恢复原始数据视图
   */
  clearFilter(): void {
    this._filterCache = null
  }

  // ========== 统计方法（委托给 geojsonProcessor） ==========

  /**
   * 获取图层统计信息
   */
  getStats() {
    return getCollectionStats(this.data)
  }

  /**
   * 获取多边形面积统计
   */
  getAreaStats() {
    return calculatePolygonAreas(this.data)
  }

  /**
   * 获取数值属性聚合统计
   * @param key 数值属性名
   */
  getPropertyAggregate(key: string) {
    return aggregateNumericProperty(this.data, key)
  }

  // ========== 序列化与反序列化 ==========

  /**
   * 将图层导出为 GeoJSON FeatureCollection
   */
  toGeoJSON(): GeoJSONFeatureCollection {
    return this.data
  }

  /**
   * 将图层信息导出为纯对象（用于日志或存储）
   */
  toJSON(): object {
    return {
      id: this._id,
      metadata: this._metadata,
      style: this._style,
      visible: this._visible,
      featureCount: this.featureCount,
    }
  }

  /**
   * 从 GeoJSON 数据创建图层实例（工厂方法）
   */
  static fromGeoJSON(
    id: string,
    data: GeoJSONFeatureCollection,
    metadata?: Partial<LayerMetadata>
  ): LayerModel {
    return new LayerModel(id, data, metadata)
  }

  // ========== 调试输出 ==========

  /**
   * 在控制台打印图层摘要信息
   */
  logSummary(): void {
    const stats = this.getStats()
    console.group(`📊 图层 [${this._id}] ${this._metadata.name}`)
    console.log('要素数量:', stats.featureCount)
    console.log('几何类型:', stats.geometryTypes.join(', '))
    console.log('可见性:', this._visible ? '✅ 可见' : '❌ 隐藏')
    console.log('样式:', this._style)
    console.log('元数据:', this._metadata)
    console.groupEnd()
  }
}
