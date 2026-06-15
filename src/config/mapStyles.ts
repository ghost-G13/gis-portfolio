/**
 * MapLibre 地图样式预设配置
 * ============================================
 * 提供多套底图样式，支持 setStyle 快速切换。
 * 每套样式均为合法的 MapLibre Style Specification (v8)。
 * ============================================
 */

import type { StyleSpecification } from 'maplibre-gl'

export type StylePreset = 'amap-vec' | 'amap-sat' | 'osm' | 'dark'

export const STYLE_PRESETS: Record<
  StylePreset,
  { name: string; icon: string; style: StyleSpecification | string }
> = {
  'amap-vec': {
    name: '高德矢量',
    icon: '🗺️',
    style: {
      version: 8,
      name: 'Amap Vector',
      sources: {
        'amap-vec': {
          type: 'raster',
          tiles: [
            'https://webrd01.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}',
            'https://webrd02.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}',
            'https://webrd03.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}',
            'https://webrd04.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}',
          ],
          tileSize: 256,
          attribution: '&copy; <a href="https://www.amap.com">高德地图</a>',
        },
      },
      layers: [
        {
          id: 'amap-vec-layer',
          type: 'raster',
          source: 'amap-vec',
          minzoom: 0,
          maxzoom: 18,
        },
      ],
    },
  },

  'amap-sat': {
    name: '高德卫星',
    icon: '🛰️',
    style: {
      version: 8,
      name: 'Amap Satellite',
      sources: {
        'amap-sat': {
          type: 'raster',
          tiles: [
            'https://webst01.is.autonavi.com/appmaptile?style=6&x={x}&y={y}&z={z}',
            'https://webst02.is.autonavi.com/appmaptile?style=6&x={x}&y={y}&z={z}',
            'https://webst03.is.autonavi.com/appmaptile?style=6&x={x}&y={y}&z={z}',
            'https://webst04.is.autonavi.com/appmaptile?style=6&x={x}&y={y}&z={z}',
          ],
          tileSize: 256,
          attribution: '&copy; <a href="https://www.amap.com">高德地图</a>',
        },
        'amap-road': {
          type: 'raster',
          tiles: [
            'https://webst01.is.autonavi.com/appmaptile?style=8&x={x}&y={y}&z={z}',
            'https://webst02.is.autonavi.com/appmaptile?style=8&x={x}&y={y}&z={z}',
            'https://webst03.is.autonavi.com/appmaptile?style=8&x={x}&y={y}&z={z}',
            'https://webst04.is.autonavi.com/appmaptile?style=8&x={x}&y={y}&z={z}',
          ],
          tileSize: 256,
          attribution: '&copy; <a href="https://www.amap.com">高德地图</a>',
        },
      },
      layers: [
        {
          id: 'amap-sat-layer',
          type: 'raster',
          source: 'amap-sat',
          minzoom: 0,
          maxzoom: 18,
        },
        {
          id: 'amap-road-layer',
          type: 'raster',
          source: 'amap-road',
          minzoom: 0,
          maxzoom: 18,
        },
      ],
    },
  },

  osm: {
    name: 'OpenStreetMap',
    icon: '🌍',
    style: {
      version: 8,
      name: 'OSM',
      sources: {
        osm: {
          type: 'raster',
          tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
          tileSize: 256,
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        },
      },
      layers: [
        {
          id: 'osm-layer',
          type: 'raster',
          source: 'osm',
          minzoom: 0,
          maxzoom: 19,
        },
      ],
    },
  },

  dark: {
    name: '暗色主题',
    icon: '🌑',
    // CartoDB Dark Matter 可通过 raster 方式接入，或者使用 MapTiler 的 dark style
    // 这里使用 CartoDB 的 dark_all 作为 raster 底图
    style: {
      version: 8,
      name: 'Dark Matter',
      sources: {
        'carto-dark': {
          type: 'raster',
          tiles: [
            'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
            'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
            'https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
            'https://d.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
          ],
          tileSize: 256,
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
        },
      },
      layers: [
        {
          id: 'carto-dark-layer',
          type: 'raster',
          source: 'carto-dark',
          minzoom: 0,
          maxzoom: 19,
        },
      ],
    },
  },
}

export const DEFAULT_STYLE_PRESET: StylePreset = 'amap-vec'
