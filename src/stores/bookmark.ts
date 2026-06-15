/**
 * ============================================================
 * Bookmark Store — 地图书签/视角定位管理 (Pinia)
 * ============================================================
 * 职责：
 *   - 管理用户保存的地图书签列表
 *   - 支持添加、删除、重命名书签
 *   - 使用 pinia-plugin-persistedstate 持久化到 localStorage
 * ============================================================
 */

import { ref, computed } from 'vue'
import { defineStore } from 'pinia'

/** 单个地图书签的数据结构 */
export interface MapBookmark {
  /** 唯一标识 */
  id: string
  /** 书签名称（用户自定义） */
  name: string
  /** 纬度 */
  lat: number
  /** 经度 */
  lng: number
  /** 缩放级别 */
  zoom: number
  /** 创建时间戳 */
  createdAt: number
}

export const useBookmarkStore = defineStore('bookmark', () => {
  // --------------------------------------------------
  // State
  // --------------------------------------------------

  /** 书签列表 */
  const bookmarks = ref<MapBookmark[]>([])

  // --------------------------------------------------
  // Getters
  // --------------------------------------------------

  /** 书签总数 */
  const count = computed(() => bookmarks.value.length)

  /** 按创建时间倒序排列的书签列表（最新在前） */
  const sortedBookmarks = computed(() => {
    return [...bookmarks.value].sort((a, b) => b.createdAt - a.createdAt)
  })

  // --------------------------------------------------
  // Actions
  // --------------------------------------------------

  /** 生成唯一 ID */
  function generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
  }

  /** 添加书签 */
  function addBookmark(name: string, lat: number, lng: number, zoom: number): MapBookmark {
    const bookmark: MapBookmark = {
      id: generateId(),
      name,
      lat,
      lng,
      zoom,
      createdAt: Date.now(),
    }
    bookmarks.value.push(bookmark)
    return bookmark
  }

  /** 删除书签 */
  function removeBookmark(id: string) {
    const index = bookmarks.value.findIndex((b) => b.id === id)
    if (index !== -1) {
      bookmarks.value.splice(index, 1)
    }
  }

  /** 重命名书签 */
  function renameBookmark(id: string, newName: string) {
    const bookmark = bookmarks.value.find((b) => b.id === id)
    if (bookmark) {
      bookmark.name = newName.trim()
    }
  }

  /** 清空所有书签 */
  function clearAll() {
    bookmarks.value = []
  }

  return {
    bookmarks,
    count,
    sortedBookmarks,
    addBookmark,
    removeBookmark,
    renameBookmark,
    clearAll,
  }
}, {
  persist: {
    key: 'gis-bookmarks',
    pick: ['bookmarks'],
  },
})
