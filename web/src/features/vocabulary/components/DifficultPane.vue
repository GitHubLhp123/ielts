<script setup lang="ts">
/**
 * 难词页 —— 对应 legacy renderDifficultyFilterOptions/renderDifficultyList(5250–5390)。
 */
import { computed, ref } from 'vue'

import { useVocabularyStore } from '../stores/vocabulary'
import { library } from '../data/library'
import { getFilteredDifficultWords, countMatchingDifficultWords } from '../domain/search'
import { isDifficultyDue } from '../domain/review'
import { formatReviewDate, formatReviewDueText } from '../utils'

const store = useVocabularyStore()

const chapterNames = computed(() => library.chapters.map((c) => c.chapter))
const chapterFilter = ref<string>(store.data.selectedLibraryChapter || '全部章节')

const difficultyQuery = computed({
  get: () => store.data.difficultyQuery,
  set: (v: string) => {
    store.data.difficultyQuery = v
    store.data.difficultyVisibleCount = 24
  },
})

const sortMode = computed({
  get: () => store.data.difficultySortMode,
  set: (v: 'default' | 'levelDesc' | 'levelAsc') => {
    store.data.difficultySortMode = v
    store.data.difficultyVisibleCount = 24
  },
})

const visibleCount = computed(() => store.data.difficultyVisibleCount)

const filterOptions = computed(() => ({
  chapter: chapterFilter.value === '全部章节' ? null : chapterFilter.value,
  query: difficultyQuery.value,
  sortMode: sortMode.value,
}))

const totalMatches = computed(() => countMatchingDifficultWords(store.data.difficultWords, filterOptions.value))

const visibleItems = computed(() => {
  const all = getFilteredDifficultWords(store.data.difficultWords, filterOptions.value)
  return all.slice(0, store.data.difficultyVisibleCount)
})

const totalItems = computed(() => Object.keys(store.data.difficultWords).length)
const dueOnlyCount = computed(() => {
  let due = 0
  for (const key of Object.keys(store.data.difficultWords)) {
    if (isDifficultyDue(store.data.difficultWords[key])) due += 1
  }
  return due
})
const selectedCount = computed(() => store.data.selectedDifficultKeys.length)

function toggleSelect(key: string) {
  store.toggleSelectedDifficultKey(key)
}

function removeWord(key: string) {
  if (window.confirm('确定移出难词表吗？此操作不可撤销。')) {
    store.removeDifficultWord(key)
  }
}

function loadMore() {
  store.data.difficultyVisibleCount += 24
}
</script>

<template>
  <div class="difficult">
    <el-card shadow="never" class="panel">
      <div class="filter-row">
        <el-select v-model="chapterFilter" size="small" class="chapter-select">
          <el-option value="全部章节" label="全部章节" />
          <el-option v-for="c in chapterNames" :key="c" :value="c" :label="c" />
        </el-select>
        <el-input v-model="difficultyQuery" size="small" placeholder="搜索难词 / 释义 / 章节 / 分组" clearable class="query-input" />
        <el-select v-model="sortMode" size="small" class="sort-select">
          <el-option value="default" label="默认排序" />
          <el-option value="levelDesc" label="难度从高到低" />
          <el-option value="levelAsc" label="难度从低到高" />
        </el-select>
      </div>

      <div class="action-row">
        <el-button size="small" type="primary" :disabled="!selectedCount" @click="store.startSelectedDifficultPractice()">
          练习选中难词（{{ selectedCount }}）
        </el-button>
        <el-button size="small" :disabled="!dueOnlyCount" @click="store.startDifficultPractice(chapterFilter === '全部章节' ? null : chapterFilter, { onlyDue: true })">
          到期复习（{{ dueOnlyCount }}）
        </el-button>
        <el-button size="small" :disabled="!totalMatches" @click="store.startDifficultPractice(chapterFilter === '全部章节' ? null : chapterFilter)">
          练习筛选结果（{{ totalMatches }}）
        </el-button>
        <el-button size="small" :disabled="!totalItems" @click="store.startDifficultPractice(null)">全部难词（{{ totalItems }}）</el-button>
      </div>

      <div class="list-head dim">
        难词总数 {{ totalItems }} · 已显示 {{ Math.min(visibleCount, visibleItems.length) }} / {{ visibleItems.length }}
        <template v-if="filterOptions.chapter || difficultyQuery">（筛选后 {{ totalMatches }}）</template>
      </div>

      <div class="word-list">
        <div v-for="entry in visibleItems" :key="entry.key" class="word-row" :class="{ due: isDifficultyDue(entry) }">
          <el-checkbox
            :model-value="store.data.selectedDifficultKeys.includes(entry.key)"
            @change="toggleSelect(entry.key)"
          />
          <div class="word-main">
            <div class="line1">
              <b>{{ entry.word }}</b>
              <el-tag v-if="isDifficultyDue(entry)" size="small" type="danger" effect="light">今日到期</el-tag>
              <el-tag size="small" type="warning" effect="plain">Lv{{ entry.difficultyLevel }}</el-tag>
              <el-tag size="small" type="info" effect="plain">第 {{ entry.reviewStage + 1 }} 轮</el-tag>
              <el-tag size="small" type="info" effect="plain">已学 {{ entry.count }} 次</el-tag>
              <el-tag v-if="entry.reviewFailures" size="small" type="danger" effect="plain">失败 {{ entry.reviewFailures }}</el-tag>
            </div>
            <div class="line2 dim">{{ entry.meaning }}</div>
            <div class="line3 dim">
              {{ entry.chapter }} · {{ entry.group }} · 下次：{{ formatReviewDueText(entry.nextReviewAt) }}（{{ formatReviewDate(entry.nextReviewAt) }}）
            </div>
          </div>
          <div class="row-actions">
            <el-button size="small" text @click="store.toggleWordMastered(entry.key)">{{ entry.mastered ? '取消学会' : '标记学会' }}</el-button>
            <el-button size="small" text type="danger" @click="removeWord(entry.key)">移出</el-button>
          </div>
        </div>
        <el-empty v-if="!visibleItems.length" description="暂无难词" />
      </div>

      <div v-if="visibleItems.length < totalMatches" class="more-row">
        <el-button size="small" @click="loadMore">加载更多（+24）</el-button>
      </div>
    </el-card>
  </div>
</template>

<style scoped>
.difficult {
  max-width: 960px;
  margin: 0 auto;
}

.panel {
  border-radius: 10px;
}

.filter-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.chapter-select {
  width: 260px;
}

.query-input {
  width: 300px;
}

.sort-select {
  width: 160px;
}

.action-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}

.list-head {
  margin: 12px 0 6px;
}

.word-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.word-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid #ebeef5;
  background: #fff;
}

.word-row.due {
  border-color: #f56c6c;
  background: #fef9f9;
}

.word-main {
  flex: 1;
  min-width: 0;
}

.line1 {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.line2 {
  margin-top: 4px;
}

.line3 {
  margin-top: 2px;
}

.row-actions {
  flex: none;
  display: flex;
  gap: 2px;
}

.more-row {
  text-align: center;
  margin-top: 12px;
}

.dim {
  color: #909399;
  font-size: 12px;
}
</style>
