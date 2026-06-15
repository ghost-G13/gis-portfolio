<script setup lang="ts">
/**
 * LayerList.vue
 * ============================================
 * 图层列表组件
 * 功能：
 *   - 使用 v-for 渲染图层列表
 *   - 通过 Props/Emit 实现父子组件通信
 *   - 支持 v-model 风格的显隐控制（单向数据流：props 传入 + emit 更新）
 *   - 支持按名称搜索过滤图层
 *   - 内部使用 computed 统计可见图层数量并回传父组件
 * ============================================
 */

import { ref, computed, watch } from 'vue'

// --------------------------------------------------
// 类型定义
// --------------------------------------------------

/** 单个图层项的数据结构 */
export interface LayerItem {
  /** 图层唯一标识 */
  id: string
  /** 图层显示名称 */
  name: string
  /** 图层图标 */
  icon: string
  /** 是否可见（受控状态） */
  visible: boolean
  /** 可选：图层类型描述 */
  type?: string
}

// --------------------------------------------------
// Props 定义：父组件传入图层列表数据
// --------------------------------------------------
interface Props {
  /** 图层列表数组 */
  layers: LayerItem[]
  /** 搜索关键词（支持双向绑定） */
  searchKeyword?: string
}

const props = withDefaults(defineProps<Props>(), {
  searchKeyword: ''
})

// --------------------------------------------------
// Emits 定义：向父组件通知状态变化
// --------------------------------------------------
const emit = defineEmits<{
  /** 通知父组件某图层的可见性发生变化 */
  (e: 'update:layer', id: string, visible: boolean): void
  /** 通知父组件可见图层数量变化 */
  (e: 'update:visibleCount', count: number): void
  /** 通知父组件搜索关键词变化（支持 v-model:searchKeyword） */
  (e: 'update:searchKeyword', value: string): void
}>()

// --------------------------------------------------
// 内部状态
// --------------------------------------------------

// 本地搜索输入框的值（用于模板绑定）
const localSearch = ref(props.searchKeyword)

// 当 props.searchKeyword 外部变化时，同步本地值
watch(() => props.searchKeyword, (val) => {
  localSearch.value = val
})

// --------------------------------------------------
// 搜索过滤 — 使用 computed 计算属性
// --------------------------------------------------

/**
 * 经过搜索过滤后的图层列表
 * 使用 computed 缓存结果，只有 layers 或 searchKeyword 变化时才重新计算
 */
const filteredLayers = computed(() => {
  const keyword = localSearch.value.trim().toLowerCase()
  if (!keyword) {
    return props.layers
  }
  // 使用 filter 高阶函数按名称过滤
  return props.layers.filter((layer) =>
    layer.name.toLowerCase().includes(keyword)
  )
})

// --------------------------------------------------
// 可见图层统计 — 使用 computed 自动计算
// --------------------------------------------------

/**
 * 当前可见图层的数量
 * 从原始 props.layers 中统计（而非 filteredLayers，确保统计的是全部图层）
 */
const visibleCount = computed(() => {
  return props.layers.filter((layer) => layer.visible).length
})

/**
 * 监听 visibleCount 变化，通过 emit 通知父组件
 * 这样父组件无需自己计算，直接使用子组件回传的数据
 */
watch(visibleCount, (newCount) => {
  emit('update:visibleCount', newCount)
}, { immediate: true })

// --------------------------------------------------
// 事件处理
// --------------------------------------------------

/**
 * 处理单个图层的显隐切换
 * @param layer 目标图层
 */
function toggleLayerVisibility(layer: LayerItem) {
  // 通过 emit 通知父组件更新，遵循 Vue 单向数据流原则
  emit('update:layer', layer.id, !layer.visible)
}

/**
 * 处理搜索输入
 * @param event 输入事件
 */
function handleSearchInput(event: Event) {
  const target = event.target as HTMLInputElement
  localSearch.value = target.value
  // 同时 emit 给父组件，支持 v-model:searchKeyword 双向绑定
  emit('update:searchKeyword', target.value)
}

/**
 * 一键显示所有图层
 */
function showAll() {
  props.layers.forEach((layer) => {
    if (!layer.visible) {
      emit('update:layer', layer.id, true)
    }
  })
}

/**
 * 一键隐藏所有图层
 */
function hideAll() {
  props.layers.forEach((layer) => {
    if (layer.visible) {
      emit('update:layer', layer.id, false)
    }
  })
}
</script>

<template>
  <div class="layer-list-component">
    <!-- 搜索框区域 -->
    <div class="layer-search">
      <input
        type="text"
        class="search-input"
        placeholder="搜索图层..."
        :value="localSearch"
        @input="handleSearchInput"
      />
      <span v-if="localSearch" class="search-clear" @click="localSearch = ''; emit('update:searchKeyword', '')">✕</span>
    </div>

    <!-- 统计信息栏 -->
    <div class="layer-stats">
      <span class="stats-text">
        可见 {{ visibleCount }} / 共 {{ layers.length }} 个图层
      </span>
      <div class="stats-actions">
        <button class="stats-btn" @click="showAll" title="显示全部">全显</button>
        <button class="stats-btn" @click="hideAll" title="隐藏全部">全隐</button>
      </div>
    </div>

    <!-- 图层列表 — 使用 v-for 渲染 -->
    <ul class="layer-items">
      <li
        v-for="layer in filteredLayers"
        :key="layer.id"
        class="layer-item"
        :class="{ 'layer-item-hidden': !layer.visible }"
      >
        <!-- 显隐切换开关 -->
        <label class="layer-toggle">
          <input
            type="checkbox"
            :checked="layer.visible"
            @change="toggleLayerVisibility(layer)"
          />
          <span class="toggle-slider"></span>
        </label>

        <!-- 图层图标与名称 -->
        <span class="layer-icon">{{ layer.icon }}</span>
        <span class="layer-name">{{ layer.name }}</span>

        <!-- 图层类型标签 -->
        <span v-if="layer.type" class="layer-type">{{ layer.type }}</span>
      </li>

      <!-- 搜索无结果提示 -->
      <li v-if="filteredLayers.length === 0" class="layer-empty">
        🔍 未找到匹配 "{{ localSearch }}" 的图层
      </li>
    </ul>
  </div>
</template>

<style scoped>
/* ============================================
   图层列表组件样式
   ============================================ */

.layer-list-component {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* 搜索框 */
.layer-search {
  position: relative;
}

.search-input {
  width: 100%;
  padding: 8px 28px 8px 10px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background-color: var(--bg-main);
  color: var(--text-primary);
  font-size: 13px;
  outline: none;
  transition: border-color var(--transition-fast);
}

.search-input:focus {
  border-color: var(--accent-color);
}

.search-input::placeholder {
  color: var(--text-muted);
}

.search-clear {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 12px;
  color: var(--text-muted);
  cursor: pointer;
  padding: 2px 4px;
  transition: color var(--transition-fast);
}

.search-clear:hover {
  color: var(--accent-color);
}

/* 统计栏 */
.layer-stats {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
}

.stats-text {
  color: var(--text-secondary);
}

.stats-actions {
  display: flex;
  gap: 6px;
}

.stats-btn {
  padding: 2px 8px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background-color: var(--bg-sidebar);
  color: var(--text-secondary);
  font-size: 11px;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.stats-btn:hover {
  border-color: var(--accent-color);
  color: var(--accent-color);
}

/* 图层列表 */
.layer-items {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 240px;
  overflow-y: auto;
}

.layer-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 6px;
  border-radius: 6px;
  font-size: 13px;
  color: var(--text-primary);
  cursor: pointer;
  transition: background-color var(--transition-fast), opacity var(--transition-fast);
}

.layer-item:hover {
  background-color: var(--bg-main);
}

/* 隐藏状态的图层：降低不透明度 */
.layer-item-hidden {
  opacity: 0.5;
}

.layer-item-hidden .layer-name {
  text-decoration: line-through;
  color: var(--text-muted);
}

/* 自定义开关样式 */
.layer-toggle {
  position: relative;
  display: inline-block;
  width: 32px;
  height: 18px;
  flex-shrink: 0;
}

.layer-toggle input {
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle-slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: var(--border-color);
  border-radius: 18px;
  transition: background-color var(--transition-fast);
}

.toggle-slider::before {
  position: absolute;
  content: '';
  height: 14px;
  width: 14px;
  left: 2px;
  bottom: 2px;
  background-color: white;
  border-radius: 50%;
  transition: transform var(--transition-fast);
}

.layer-toggle input:checked + .toggle-slider {
  background-color: var(--accent-color);
}

.layer-toggle input:checked + .toggle-slider::before {
  transform: translateX(14px);
}

.layer-icon {
  font-size: 16px;
  flex-shrink: 0;
}

.layer-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.layer-type {
  font-size: 9px;
  padding: 1px 5px;
  background-color: var(--bg-main);
  color: var(--text-muted);
  border-radius: 4px;
  flex-shrink: 0;
  /* 在较窄侧边栏中隐藏类型标签，避免挤占名称空间 */
  display: none;
}

/* 空状态 */
.layer-empty {
  padding: 16px;
  text-align: center;
  font-size: 13px;
  color: var(--text-muted);
}
</style>
