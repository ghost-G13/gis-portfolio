/**
 * ============================================================
 * 重庆市各区县统计数据（模拟数据，基于公开统计年鉴量级）
 * ============================================================
 * 用于 GIS 专题分析实验：分级设色图、比例符号图
 *
 * 字段说明：
 *   - population: 常住人口（万人）
 *   - area: 行政区划面积（平方千米）
 *   - gdp: 地区生产总值（亿元）
 *   - density = population * 10000 / area （人/平方千米）
 * ============================================================
 */

export interface DistrictStat {
  population: number // 万人
  area: number // 平方千米
  gdp: number // 亿元
}

export const districtStats: Record<string, DistrictStat> = {
  '500101': { population: 156, area: 3457, gdp: 1050 }, // 万州区
  '500102': { population: 117, area: 2941, gdp: 1450 }, // 涪陵区
  '500103': { population: 59, area: 23, gdp: 1580 }, // 渝中区
  '500104': { population: 42, area: 103, gdp: 320 }, // 大渡口区
  '500105': { population: 93, area: 221, gdp: 1680 }, // 江北区
  '500106': { population: 148, area: 396, gdp: 1180 }, // 沙坪坝区
  '500107': { population: 153, area: 432, gdp: 1780 }, // 九龙坡区
  '500108': { population: 120, area: 263, gdp: 940 }, // 南岸区
  '500109': { population: 84, area: 755, gdp: 720 }, // 北碚区
  '500110': { population: 101, area: 2747, gdp: 740 }, // 綦江区
  '500111': { population: 107, area: 1436, gdp: 820 }, // 大足区
  '500112': { population: 225, area: 1452, gdp: 2380 }, // 渝北区
  '500113': { population: 118, area: 1825, gdp: 1020 }, // 巴南区
  '500114': { population: 49, area: 2397, gdp: 310 }, // 黔江区
  '500115': { population: 69, area: 1423, gdp: 920 }, // 长寿区
  '500116': { population: 136, area: 3219, gdp: 1320 }, // 江津区
  '500117': { population: 125, area: 2344, gdp: 1050 }, // 合川区
  '500118': { population: 115, area: 1576, gdp: 1250 }, // 永川区
  '500119': { population: 57, area: 2602, gdp: 430 }, // 南川区
  '500120': { population: 76, area: 915, gdp: 940 }, // 璧山区
  '500151': { population: 69, area: 1343, gdp: 730 }, // 铜梁区
  '500152': { population: 68, area: 1585, gdp: 630 }, // 潼南区
  '500153': { population: 67, area: 1077, gdp: 820 }, // 荣昌区
  '500154': { population: 120, area: 3964, gdp: 640 }, // 开州区
  '500155': { population: 65, area: 1892, gdp: 620 }, // 梁平区
  '500156': { population: 35, area: 2901, gdp: 260 }, // 武隆区
  '500229': { population: 20, area: 3289, gdp: 110 }, // 城口县
  '500230': { population: 65, area: 2896, gdp: 420 }, // 丰都县
  '500231': { population: 65, area: 1518, gdp: 520 }, // 垫江县
  '500233': { population: 73, area: 2187, gdp: 530 }, // 忠县
  '500235': { population: 93, area: 3636, gdp: 540 }, // 云阳县
  '500236': { population: 75, area: 4098, gdp: 430 }, // 奉节县
  '500237': { population: 47, area: 2958, gdp: 220 }, // 巫山县
  '500238': { population: 39, area: 4030, gdp: 130 }, // 巫溪县
  '500240': { population: 39, area: 3014, gdp: 210 }, // 石柱土家族自治县
  '500241': { population: 50, area: 2462, gdp: 260 }, // 秀山土家族苗族自治县
  '500242': { population: 55, area: 5173, gdp: 240 }, // 酉阳土家族苗族自治县
  '500243': { population: 53, area: 3903, gdp: 290 }, // 彭水苗族土家族自治县
}

/** 计算人口密度（人/平方千米） */
export function getDensity(adcode: string): number {
  const stat = districtStats[adcode]
  if (!stat) return 0
  return Math.round((stat.population * 10000) / stat.area)
}

/** 获取所有密度的分级区间，用于图例 */
export function getDensityRanges(): { min: number; max: number; label: string }[] {
  return [
    { min: 2000, max: Infinity, label: '> 2000' },
    { min: 1000, max: 2000, label: '1000 - 2000' },
    { min: 500, max: 1000, label: '500 - 1000' },
    { min: 300, max: 500, label: '300 - 500' },
    { min: 100, max: 300, label: '100 - 300' },
    { min: 0, max: 100, label: '< 100' },
  ]
}

/** 分级设色颜色函数 —— 顺序色带 Blues (ColorBrewer) */
export function getChoroplethColor(density: number): string {
  if (density > 2000) return '#08519c'
  if (density > 1000) return '#3182bd'
  if (density > 500) return '#6baed6'
  if (density > 300) return '#9ecae1'
  if (density > 100) return '#c6dbef'
  return '#eff3ff'
}

/** GDP 比例符号半径映射（像素） */
export function getGdpRadius(gdp: number): number {
  // 使用平方根比例，避免大数值符号过于巨大
  const minR = 4
  const maxR = 28
  const minGdp = 100
  const maxGdp = 2400
  const t = Math.sqrt((gdp - minGdp) / (maxGdp - minGdp))
  return Math.max(minR, minR + t * (maxR - minR))
}

/** GDP 分级颜色 —— 发散色带 RdYlGn（高 GDP 绿色，低 GDP 红色） */
export function getGdpColor(gdp: number): string {
  if (gdp > 1500) return '#1a9850'
  if (gdp > 1000) return '#91cf60'
  if (gdp > 500) return '#d9ef8b'
  if (gdp > 300) return '#fee08b'
  if (gdp > 150) return '#fc8d59'
  return '#d73027'
}
