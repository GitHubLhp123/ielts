<script setup lang="ts">
/**
 * 学习热力图（纯 DOM 网格，非 ECharts）——对应 legacy renderLearningHeatmap(4384)。
 */
import { computed } from 'vue'

import { useVocabularyStore } from '../stores/vocabulary'
import { computeDailySeries, resolveHeatmapLevel } from '../domain/stats'
import { formatDayKey } from '../utils'

const props = withDefaults(defineProps<{ days?: number }>(), { days: 30 })

const store = useVocabularyStore()

const cells = computed(() => {
  const series = computeDailySeries(store.data.studyLog, props.days)
  const totals = series.map((row) => row.learned + row.mastered + row.reviewed)
  const max = Math.max(...totals, 0)
  const todayKey = formatDayKey(new Date())
  return series.map((row, index) => {
    const value = totals[index]
    const recent = series.length - index <= 7
    return {
      key: row.key,
      label: `${row.label} · 学习 ${row.learned} · 掌握 ${row.mastered} · 复习 ${row.reviewed}`,
      level: resolveHeatmapLevel(value, max),
      active: value > 0,
      recent,
      isToday: row.key === todayKey,
    }
  })
})
</script>

<template>
  <div v-if="cells.some((c) => c.active)" class="heatmap" :class="{ compact: days <= 30 }">
    <div
      v-for="cell in cells"
      :key="cell.key"
      class="footprint-cell"
      :class="[`level-${cell.level}`, { 'recent-window': cell.recent, today: cell.isToday }]"
      :title="cell.label"
    />
  </div>
  <div v-else class="heatmap-empty">最近 {{ days }} 天还没有学习记录</div>
</template>

<style scoped>
.heatmap {
  display: grid;
  grid-auto-flow: column;
  grid-template-rows: repeat(7, 10px);
  gap: 3px;
  overflow-x: auto;
}

.footprint-cell {
  width: 10px;
  height: 10px;
  border-radius: 2px;
  background: #eceff3;
}

.footprint-cell.level-1 {
  background: #d7e8ff;
}
.footprint-cell.level-2 {
  background: #9dc4ff;
}
.footprint-cell.level-3 {
  background: #4f9bff;
}
.footprint-cell.level-4 {
  background: #1473ff;
}
.footprint-cell.recent-window {
  outline: 1px solid rgba(20, 115, 255, 0.35);
  outline-offset: 1px;
}
.footprint-cell.today {
  box-shadow: 0 0 0 1.5px #ffb400;
}

.heatmap-empty {
  color: #909399;
  font-size: 12px;
  padding: 8px 0;
}
</style>
