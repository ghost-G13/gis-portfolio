<script setup lang="ts">
/**
 * MapLegend.vue
 * ============================================
 * 地图图例组件
 * 支持两种图例模式：
 *   - choropleth: 分级设色图例（颜色块 + 数值区间）
 *   - proportional: 比例符号图例（圆点大小 + 数值）
 * ============================================
 */

import { computed } from 'vue'
import { getDensityRanges, getChoroplethColor, getGdpRadius, getGdpColor } from '@/data/chongqingStats'

type LegendMode = 'choropleth' | 'proportional'

interface Props {
  mode: LegendMode
}

const props = defineProps<Props>()

// 分级设色图例数据
const densityRanges = computed(() => {
  return getDensityRanges().map((range) => ({
    ...range,
    color: getChoroplethColor(range.min + 1),
  }))
})

// 比例符号图例数据（选取几个代表性的 GDP 值）
const proportionalSamples = computed(() => {
  const samples = [2000, 1000, 500, 200]
  return samples.map((gdp) => ({
    gdp,
    radius: getGdpRadius(gdp),
    color: getGdpColor(gdp),
  }))
})
</script>

<template>
  <div class="map-legend" :data-mode="props.mode">
    <h3 class="legend-title">
      {{ props.mode === 'choropleth' ? '人口密度（人/km²）' : 'GDP 规模（亿元）' }}
    </h3>

    <!-- 分级设色图例 -->
    <div v-if="props.mode === 'choropleth'" class="legend-choropleth">
      <div
        v-for="item in densityRanges"
        :key="item.label"
        class="legend-item"
      >
        <span class="color-box" :style="{ backgroundColor: item.color }"></span>
        <span class="label">{{ item.label }}</span>
      </div>
    </div>

    <!-- 比例符号图例 -->
    <div v-else class="legend-proportional">
      <div
        v-for="item in proportionalSamples"
        :key="item.gdp"
        class="prop-item"
      >
        <span class="circle-wrapper">
          <span
            class="circle"
            :style="{
              width: item.radius * 2 + 'px',
              height: item.radius * 2 + 'px',
              backgroundColor: item.color,
            }"
          ></span>
        </span>
        <span class="label">{{ item.gdp }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.map-legend {
  background-color: rgba(255, 255, 255, 0.95);
  border-radius: 8px;
  padding: 12px 14px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  font-size: 12px;
  min-width: 160px;
  backdrop-filter: blur(4px);
}

.legend-title {
  font-size: 13px;
  font-weight: 600;
  color: #333;
  margin-bottom: 10px;
  padding-bottom: 6px;
  border-bottom: 1px solid #eee;
}

/* 分级设色图例 */
.legend-choropleth {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.color-box {
  width: 20px;
  height: 14px;
  border-radius: 3px;
  border: 1px solid rgba(0, 0, 0, 0.1);
  flex-shrink: 0;
}

.label {
  color: #555;
  font-size: 12px;
}

/* 比例符号图例 */
.legend-proportional {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.prop-item {
  display: flex;
  align-items: center;
  gap: 10px;
}

.circle-wrapper {
  width: 56px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.circle {
  display: inline-block;
  border-radius: 50%;
  opacity: 0.75;
  border: 1px solid rgba(0, 0, 0, 0.15);
}
</style>
