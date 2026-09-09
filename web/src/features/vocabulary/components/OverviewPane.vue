<script setup lang="ts">
/**
 * 总览页 —— 对应 legacy renderOverviewInsights/renderGlobalStats/renderDailyInsights/renderLearningFootprints。
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as echarts from 'echarts'

import { useVocabularyStore } from '../stores/vocabulary'
import { library } from '../data/library'
import { computeDailySeries, computeCurrentStudyStreak } from '../domain/stats'
import { isDifficultyDue } from '../domain/review'
import { formatDateTime } from '../utils'
import HeatmapGrid from './HeatmapGrid.vue'

const store = useVocabularyStore()
const chartEl = ref<HTMLDivElement | null>(null)
let chart: echarts.ECharts | null = null

const wordStats = computed(() => store.data.wordStats)
const masteredCount = computed(() => Object.values(wordStats.value).filter((s) => s.mastered).length)
const coveredWords = computed(() => Object.values(wordStats.value).filter((s) => s.count > 0).length)
const libraryTotal = computed(() => library.allWords.length)
const streak = computed(() => computeCurrentStudyStreak(store.data.studyLog))
const dailySeries = computed(() => computeDailySeries(store.data.studyLog, 7))
const today = computed(() => dailySeries.value[dailySeries.value.length - 1])

const dueCount = computed(() => {
  let due = 0
  for (const key of Object.keys(store.data.difficultWords)) {
    if (isDifficultyDue(store.data.difficultWords[key])) due += 1
  }
  return due
})

const recentActiveDays = computed(() => dailySeries.value.filter((r) => r.learned + r.mastered + r.reviewed > 0).length)

const lastStudyText = computed(() => {
  const values = Object.values(wordStats.value)
    .map((s) => s.lastStudiedAt)
    .filter(Boolean)
    .sort()
    .reverse()
  return values[0] ? formatDateTime(values[0]) : '尚未学习'
})

function renderChart() {
  if (!chartEl.value) return
  if (!chart) {
    try {
      chart = echarts.init(chartEl.value, undefined, { renderer: 'canvas' })
    } catch {
      return
    }
  }
  chart.setOption({
    grid: { left: 36, right: 18, top: 28, bottom: 24 },
    tooltip: { trigger: 'axis' },
    legend: { top: 0, data: ['学习', '掌握', '复习'] },
    xAxis: { type: 'category', data: dailySeries.value.map((d) => d.label) },
    yAxis: { type: 'value', minInterval: 1 },
    series: [
      { name: '学习', type: 'line', smooth: true, data: dailySeries.value.map((d) => d.learned), itemStyle: { color: '#1473ff' }, lineStyle: { color: '#1473ff' }, areaStyle: { opacity: 0.06 } },
      { name: '掌握', type: 'line', smooth: true, data: dailySeries.value.map((d) => d.mastered), itemStyle: { color: '#17b26a' }, lineStyle: { color: '#17b26a' }, areaStyle: { opacity: 0.06 } },
      { name: '复习', type: 'line', smooth: true, data: dailySeries.value.map((d) => d.reviewed), itemStyle: { color: '#f1b53d' }, lineStyle: { color: '#f1b53d' }, areaStyle: { opacity: 0.06 } },
    ],
  })
}

function onResize() {
  chart?.resize()
}

onMounted(() => {
  renderChart()
  window.addEventListener('resize', onResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
  chart?.dispose()
  chart = null
})

watch(dailySeries, () => renderChart(), { deep: true })
</script>

<template>
  <div class="overview">
    <el-row :gutter="12">
      <el-col v-for="card in [
        { label: '今日学习', value: today?.learned ?? 0 },
        { label: '今日掌握', value: today?.mastered ?? 0 },
        { label: '今日复习', value: today?.reviewed ?? 0 },
        { label: '连续学习', value: streak },
      ]" :key="card.label" :xs="12" :md="6">
        <el-card shadow="never" class="stat-card">
          <div class="stat-label">{{ card.label }}</div>
          <div class="stat-value">{{ card.value }}</div>
        </el-card>
      </el-col>
    </el-row>

    <el-card shadow="never" class="panel">
      <template #header>
        <div class="panel-head"><b>近 7 天趋势</b><span class="sub">学习 / 掌握 / 复习</span></div>
      </template>
      <div ref="chartEl" class="daily-chart" />
    </el-card>

    <el-row :gutter="12">
      <el-col :md="10" :xs="24">
        <el-card shadow="never" class="panel">
          <template #header><b>总览统计</b></template>
          <el-descriptions :column="1" size="small" border>
            <el-descriptions-item label="词库覆盖率">
              {{ coveredWords }} / {{ libraryTotal }}（{{ libraryTotal ? Math.round((coveredWords / libraryTotal) * 100) : 0 }}%）
            </el-descriptions-item>
            <el-descriptions-item label="已掌握">{{ masteredCount }}</el-descriptions-item>
            <el-descriptions-item label="近 7 天活跃">{{ recentActiveDays }} 天</el-descriptions-item>
            <el-descriptions-item label="难词数（到期）">{{ Object.keys(store.data.difficultWords).length }}（{{ dueCount }} 到期）</el-descriptions-item>
            <el-descriptions-item label="最近学习">{{ lastStudyText }}</el-descriptions-item>
          </el-descriptions>
        </el-card>
      </el-col>
      <el-col :md="14" :xs="24">
        <el-card shadow="never" class="panel">
          <template #header><b>近 30 天学习热力图</b></template>
          <HeatmapGrid :days="30" />
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<style scoped>
.overview {
  max-width: 1120px;
  margin: 0 auto;
}

.stat-card {
  border-radius: 10px;
  margin-bottom: 12px;
}

.stat-label {
  color: #909399;
  font-size: 12px;
}

.stat-value {
  font-size: 26px;
  font-weight: 700;
  color: #1f2d3d;
  margin-top: 4px;
}

.panel {
  border-radius: 10px;
  margin-bottom: 12px;
}

.panel-head {
  display: flex;
  align-items: baseline;
  gap: 10px;
}

.sub {
  color: #909399;
  font-size: 12px;
  font-weight: 400;
}

.daily-chart {
  height: 230px;
  width: 100%;
}
</style>
