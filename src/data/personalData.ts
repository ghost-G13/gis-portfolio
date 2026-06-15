// personalData.ts
// ============================================
// 个人数据模块
// 包含：个人足迹、兴趣点等信息
// ============================================

export interface Footprint {
  id: number
  name: string
  lng: number
  lat: number
  year: number
  season: '春' | '夏' | '秋' | '冬'
  duration: number
  description: string
}

export interface POI {
  id: number
  name: string
  type: 'scenic' | 'food' | 'shopping' | 'culture'
  lng: number
  lat: number
  rating: number
  tags: string[]
}

export const personalData = {
  // 1. 个人足迹（旅行过的城市/国家）
  footprints: [
    { id: 1, name: '北京', lng: 116.4074, lat: 39.9042, year: 2019, season: '秋', duration: 5, description: '第一次来北京，爬了长城' },
    { id: 2, name: '上海', lng: 121.4737, lat: 31.2304, year: 2020, season: '夏', duration: 3, description: '外滩夜景很美' },
    { id: 3, name: '重庆', lng: 106.5044, lat: 29.5582, year: 2021, season: '春', duration: 4, description: '火锅超好吃' },
    { id: 4, name: '成都', lng: 104.0668, lat: 30.5728, year: 2022, season: '秋', duration: 3, description: '大熊猫太可爱了' },
    { id: 5, name: '西安', lng: 108.9402, lat: 34.3416, year: 2023, season: '冬', duration: 4, description: '兵马俑很震撼' },
    { id: 6, name: '杭州', lng: 120.1936, lat: 30.2741, year: 2024, season: '春', duration: 3, description: '西湖泛舟很惬意' },
    { id: 7, name: '厦门', lng: 118.0894, lat: 24.4798, year: 2024, season: '夏', duration: 4, description: '鼓浪屿很文艺' },
  ],

  // 2. 兴趣点（常去的地方/推荐地点）
  pois: [
    { id: 1, name: '故宫博物院', type: 'scenic', lng: 116.397, lat: 39.918, rating: 5, tags: ['历史', '文化'] },
    { id: 2, name: '南锣鼓巷', type: 'food', lng: 116.404, lat: 39.937, rating: 4, tags: ['美食', '逛街'] },
    { id: 3, name: '洪崖洞', type: 'scenic', lng: 106.584, lat: 29.556, rating: 5, tags: ['夜景', '打卡'] },
    { id: 4, name: '宽窄巷子', type: 'food', lng: 104.060, lat: 30.663, rating: 4, tags: ['美食', '文化'] },
    { id: 5, name: '兵马俑', type: 'scenic', lng: 109.279, lat: 34.389, rating: 5, tags: ['历史', '文化'] },
    { id: 6, name: '西湖', type: 'scenic', lng: 120.155, lat: 30.287, rating: 5, tags: ['自然', '风景'] },
    { id: 7, name: '鼓浪屿', type: 'scenic', lng: 118.067, lat: 24.467, rating: 4, tags: ['文艺', '海岛'] },
    { id: 8, name: '锦里', type: 'food', lng: 104.054, lat: 30.657, rating: 4, tags: ['美食', '夜市'] },
  ],
}

// 获取类型中文名称
export function getPOITypeName(type: POI['type']): string {
  const typeMap: Record<POI['type'], string> = {
    scenic: '景点',
    food: '美食',
    shopping: '购物',
    culture: '文化',
  }
  return typeMap[type] || type
}

// 获取季节图标
export function getSeasonIcon(season: Footprint['season']): string {
  const iconMap: Record<Footprint['season'], string> = {
    春: '🌸',
    夏: '☀️',
    秋: '🍂',
    冬: '❄️',
  }
  return iconMap[season] || ''
}
