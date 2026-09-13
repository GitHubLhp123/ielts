<script setup lang="ts">
/**
 * 学习状态跟踪 —— 迁移自 legacy/daily-status/学习状态跟踪.html。
 * 行为规格和移植决策见 web/docs/study-tracker/。
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import { downloadText } from '@/shared/files/download'
import { readLearningEvents, summarizeLearningEvents } from '@/shared/learning-events/events'
import { readLocalStorageValue, writeLocalStorageValue } from '@/shared/storage/chunked-local-storage'

import './styles/legacy-full.css'
import StudyTable from './components/StudyTable.vue'
import StudyReview from './components/StudyReview.vue'
import StudyAccounting from './components/StudyAccounting.vue'
import StudyCharts from './components/StudyCharts.vue'
import { DEFAULT_GROUPS, DEFAULT_PROJECT_COLUMNS, DEFAULT_NOTE_FIELDS, SAMPLE_ROWS } from './model/defaults'
import { deserializeRow, normalizeRows, serializeRows, createEmptyRow, getTodayText, type StudyRow, type StudyColumn, type NoteField } from './model/tableModel'

const STORAGE_KEY = 'daily-learning-tracker-state-v4'
const STORAGE_META_KEY = 'daily-learning-tracker-state-meta-v1'
const TODO_PRIORITY_RANK: Record<string, number> = { 高: 0, 中: 1, 低: 2, 长期: 3 }
const storageStatus = ref('本地自动保存')

type TodoPriority = '高' | '中' | '低' | '长期'

interface TodoItem {
  id: string
  text: string
  priority: TodoPriority
  done: boolean
  createdAt: string
  completedAt: string
}

function createInitialState() {
  return {
    activeTab: 'overview',
    notesCollapsed: true,
    groups: DEFAULT_GROUPS.map((g) => ({ ...g })),
    projectColumns: DEFAULT_PROJECT_COLUMNS.map((c) => ({ ...c })),
    noteFields: DEFAULT_NOTE_FIELDS.map((f) => ({ ...f })),
    tableData: SAMPLE_ROWS.map((r) => ({ ...r, metrics: { ...r.metrics }, notes: { ...r.notes } })),
    newTodoText: '',
    newTodoPriority: '中' as TodoPriority,
    todoEditingId: '',
    todoEditingText: '',
    todoEditingPriority: '中' as TodoPriority,
    todoCompletedCollapseActive: [] as string[],
    todoItems: [] as TodoItem[],
    lastExportAt: '',
    tableFilter: { dateRange: [], keyword: '', groupId: 'all', onlyLowScore: false, onlyIncomplete: false, sortMode: 'date-asc' },
    reviewFilter: { dateRange: [], keyword: '' },
    reminderConfig: { enabled: false, time: '21:30', permission: 'unsupported', lastSentDate: '' },
    bookkeepingVisibleCount: 10,
    bookkeepingUnlockedEntryIds: [] as string[],
  }
}

/* ---------- 状态（整树持久化，保留旧字段） ---------- */
const state = ref<Record<string, any>>(createInitialState())
let persistTimer: ReturnType<typeof setTimeout> | null = null

function deepMergeState(stored: unknown) {
  const base = createInitialState()
  if (!stored || typeof stored !== 'object' || Array.isArray(stored)) return
  const src = stored as Record<string, any>
  for (const key of Object.keys(base) as (keyof typeof base)[]) {
    if (src[key] === undefined) continue
    const baseVal = base[key]
    const srcVal = src[key]
    if (Array.isArray(baseVal)) {
      state.value[key] = Array.isArray(srcVal) ? srcVal : baseVal
    } else if (baseVal !== null && typeof baseVal === 'object') {
      state.value[key] = { ...baseVal, ...(srcVal && typeof srcVal === 'object' ? srcVal : {}) }
    } else {
      state.value[key] = srcVal
    }
  }
  hydrateTableState()
}

function hydrateTableState() {
  const st = state.value
  // groups：确保存在未分组且位于头部
  let groups = Array.isArray(st.groups) ? (st.groups as any[]) : []
  if (!groups.some((g) => g && g.id === 'group-ungrouped')) {
    groups = [{ id: 'group-ungrouped', name: '未分组' }, ...groups]
  }
  st.groups = groups
  // columns
  const columns: StudyColumn[] = Array.isArray(st.projectColumns)
    ? (st.projectColumns as StudyColumn[])
    : DEFAULT_PROJECT_COLUMNS.map((c) => ({ ...c }))
  st.projectColumns = columns.map((c) => ({
    ...c,
    width: Number(c.width) || 100,
    targetValue: (c.targetValue as any) === undefined || c.targetValue === null || (c.targetValue as any) === '' ? null : Number(c.targetValue) || null,
  }))
  // noteFields
  const noteFields: NoteField[] = Array.isArray(st.noteFields) ? (st.noteFields as NoteField[]) : DEFAULT_NOTE_FIELDS.map((f) => ({ ...f }))
  st.noteFields = noteFields
  // rows：解码嵌套 metrics -> 扁平
  const rawRows = Array.isArray(st.tableData) ? st.tableData : []
  let rows: StudyRow[] = rawRows.map((r: any) => deserializeRow(r, columns))
  for (const row of rows) {
    for (const field of noteFields) {
      if (row.notes[field.id] === undefined) row.notes[field.id] = ''
    }
  }
  rows = normalizeRows(rows)
  if (!rows.length) {
    rows = [createEmptyRow(columns, noteFields, [])]
  }
  if (!rows.some((r) => r.date === getTodayText())) {
    rows.push(createEmptyRow(columns, noteFields, rows.map((r) => r.id)))
    rows[rows.length - 1].date = getTodayText()
  }
  st.tableData = rows
}

function buildPersistPayload(): Record<string, any> {
  return {
    ...state.value,
    tableData: serializeRows(state.value.tableData as StudyRow[], state.value.projectColumns as StudyColumn[]),
  }
}

function persistNow() {
  const stateResult = writeLocalStorageValue(STORAGE_KEY, JSON.stringify(buildPersistPayload()))
  if (!stateResult.ok) {
    storageStatus.value = '本地保存失败，请先导出备份并清理浏览器空间'
    return
  }
  let meta: Record<string, any> = {}
  try {
    meta = JSON.parse(readLocalStorageValue(STORAGE_META_KEY) || '{}') as Record<string, any>
  } catch {
    // 元数据损坏不影响主数据保存，下一次写入会重建。
  }
  meta.savedAt = Date.now()
  meta.app = 'daily-learning-tracker-web'
  const metaResult = writeLocalStorageValue(STORAGE_META_KEY, JSON.stringify(meta))
  storageStatus.value = metaResult.ok ? '本地自动保存' : '主数据已保存，保存时间标记失败'
}

function schedulePersist() {
  if (persistTimer) clearTimeout(persistTimer)
  persistTimer = setTimeout(persistNow, 300)
}

/* ---------- Todo ---------- */
const todoItems = computed(() => (state.value.todoItems ?? []) as TodoItem[])
const pendingTodoItems = computed(() =>
  todoItems.value
    .filter((t) => !t.done)
    .sort((a, b) => TODO_PRIORITY_RANK[a.priority] - TODO_PRIORITY_RANK[b.priority] || String(a.createdAt).localeCompare(String(b.createdAt))),
)

/* ---------- 导入导出 ---------- */
function exportExcel() {
  const columns: any[] = state.value.projectColumns ?? []
  const noteFieldsArr: any[] = state.value.noteFields ?? []
  const rows: any[] = (state.value.tableData ?? []).filter((r: any) => r.date).sort((a: any, b: any) => a.date.localeCompare(b.date))
  const groupName = (id: string) => {
    const found = (state.value.groups ?? []).find((g: any) => g.id === id)
    return found ? found.name : '未分组'
  }
  const esc = (v: unknown) =>
    String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  const headerCells = ['日期', '时长（分钟）']
  for (const c of columns) headerCells.push(`${c.name}（${groupName(c.groupId)}）`)
  for (const f of noteFieldsArr) headerCells.push(f.name)
  const headerHtml = headerCells.map((h) => `<th>${esc(h)}</th>`).join('')
  const bodyHtml = rows
    .map((row) => {
      const cells = [row.date, row.durationMinutes ?? '']
      for (const c of columns) cells.push(row.metrics?.[c.id] ?? '')
      for (const f of noteFieldsArr) cells.push(row.notes?.[f.id] ?? '')
      return `<tr>${cells.map((v) => `<td>${esc(v)}</td>`).join('')}</tr>`
    })
    .join('')
  const tableHtml = `<table border="1"><thead><tr>${headerHtml}</tr></thead><tbody>${bodyHtml}</tbody></table>`
  const day = new Date().toISOString().slice(0, 10)
  downloadText(`学习状态跟踪-${day}.xls`, tableHtml, 'application/vnd.ms-excel')
  state.value.lastExportAt = new Date().toISOString()
  persistNow()
}

function loadScriptOnce(src: string): Promise<boolean> {
  return new Promise((resolve) => {
    if ((window as any).__scriptLoaded?.[src]) {
      resolve(true)
      return
    }
    const script = document.createElement('script')
    script.src = src
    script.onload = () => {
      ;((window as any).__scriptLoaded = (window as any).__scriptLoaded || {})[src] = true
      resolve(true)
    }
    script.onerror = () => resolve(false)
    document.head.appendChild(script)
  })
}

async function exportPdfReport(period: 'week' | 'month') {
  const html2canvasLib = (window as any).html2canvas
  const jsPdfLib = (window as any).jspdf?.jsPDF
  if (!html2canvasLib) {
    const ok = await loadScriptOnce('https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js')
    if (!ok) {
      alert('加载 PDF 组件失败，请检查网络')
      return
    }
  }
  if (!jsPdfLib) {
    const ok = await loadScriptOnce('https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js')
    if (!ok) {
      alert('加载 PDF 组件失败，请检查网络')
      return
    }
  }
  const html2canvas: any = (window as any).html2canvas
  const jsPDF: any = (window as any).jspdf?.jsPDF
  if (!html2canvas || !jsPDF) return
  const today = new Date()
  const todayTextFn = () => {
    const y = today.getFullYear()
    const m = String(today.getMonth() + 1).padStart(2, '0')
    const d = String(today.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  const columns: any[] = state.value.projectColumns ?? []
  const noteFieldsArr: any[] = state.value.noteFields ?? []
  const rows: any[] = (state.value.tableData ?? []).filter((r: any) => r.date)
  const start = period === 'week' ? shiftDateText(6) : todayTextFn().slice(0, 7)
  const inRange = (date: string) => (period === 'week' ? date >= start && date <= todayTextFn() : date.startsWith(start))
  const scopeRows = rows.filter((r: any) => inRange(r.date)).sort((a: any, b: any) => a.date.localeCompare(b.date))
  let sum = 0
  let count = 0
  for (const row of scopeRows) {
    for (const c of columns) {
      const v = String(row.metrics?.[c.id] ?? '')
      if (/^\d+(\.\d)?$/.test(v)) {
        sum += Number(v)
        count += 1
      }
    }
  }
  const avgScore = count ? (sum / count).toFixed(1) : '—'
  const durationSum = scopeRows.reduce((s: number, r: any) => s + (Number(r.durationMinutes) || 0), 0)
  const esc = (v: unknown) =>
    String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const rowHtml = scopeRows
    .map((row) => {
      const cells = [`<td>${esc(row.date)}</td>`, `<td>${row.durationMinutes ?? ''}</td>`]
      for (const c of columns) cells.push(`<td>${esc(row.metrics?.[c.id] ?? '')}</td>`)
      for (const f of noteFieldsArr) cells.push(`<td>${esc(row.notes?.[f.id] ?? '')}</td>`)
      return `<tr>${cells.join('')}</tr>`
    })
    .join('')
  const headCells = ['日期', '时长(分)'].concat(
    columns.map((c: any) => esc(c.name)),
    noteFieldsArr.map((f: any) => esc(f.name)),
  )
  const wrapper = document.createElement('div')
  wrapper.style.cssText = 'position:fixed;left:-99999px;top:0;width:900px;background:#fff;padding:24px;font-family:-apple-system,PingFang SC,sans-serif;color:#111827;'
  wrapper.innerHTML =
    `<h2 style="margin:0 0 4px;">学习状态跟踪 · ${period === 'week' ? '周报' : '月报'}</h2>` +
    `<p style="margin:0 0 12px;color:#556171;font-size:12px;">周期：${start} ~ ${period === 'week' ? todayTextFn() : start + ' 全月'} · 均分 ${avgScore} · 总时长 ${durationSum} 分钟</p>` +
    `<table style="border-collapse:collapse;width:100%;font-size:10px;"><thead><tr>` +
    headCells.map((h: string) => `<th style="border:1px solid #d8dee9;padding:4px;background:#eef3fb;">${h}</th>`).join('') +
    `</tr></thead><tbody>${rowHtml || '<tr><td style="border:1px solid #d8dee9;padding:8px;" colspan="' + headCells.length + '">该周期暂无学习记录</td></tr>'}</tbody></table>`
  document.body.appendChild(wrapper)
  try {
    const canvas = await html2canvas(wrapper, { scale: 2, backgroundColor: '#ffffff' })
    const doc = new jsPDF('p', 'pt', 'a4')
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    const margin = 24
    const imgHeight = (canvas.height * pageWidth) / canvas.width
    let heightLeft = imgHeight
    let position = margin
    doc.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, position, pageWidth, imgHeight)
    heightLeft -= pageHeight - margin * 2
    while (heightLeft > 0) {
      position = heightLeft - imgHeight + margin
      doc.addPage()
      doc.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, position, pageWidth, imgHeight)
      heightLeft -= pageHeight - margin * 2
    }
    doc.save(`学习状态跟踪-${period === 'week' ? '周报' : '月报'}-${todayTextFn()}.pdf`)
  } catch (error) {
    alert(`PDF 生成失败：${(error as Error).message}`)
  } finally {
    wrapper.remove()
  }
  state.value.lastExportAt = new Date().toISOString()
  persistNow()
}

const TRACKER_TABS = ['overview', 'table', 'charts', 'review', 'accounting'] as const
const activeTab = computed({
  get: () => TRACKER_TABS.includes(state.value.activeTab as (typeof TRACKER_TABS)[number]) ? state.value.activeTab as string : 'overview',
  set: (v: string) => {
    state.value.activeTab = v
    schedulePersist()
  },
})

const learningEvents = ref(readLearningEvents())
const learningSummary = computed(() => summarizeLearningEvents(learningEvents.value))

function formatLearningDuration(seconds: number): string {
  if (seconds > 0 && seconds < 60) return '<1 分钟'
  return `${Math.round(seconds / 60)} 分钟`
}


/* ---------- Overview 数据 ---------- */
interface OverviewStat {
  label: string
  value: string
}

const overviewCards = computed<OverviewStat[]>(() => {
  const today = getTodayText()
  const rowsToday = (state.value.tableData ?? []).filter((r: any) => r.date === today)
  const row = rowsToday[0]
  let todayScore = '—'
  if (row) {
    const values = (state.value.projectColumns ?? []).map((c: any) => row.metrics?.[c.id]).filter((v: string) => /^\d+(\.\d)?$/.test(String(v)))
    if (values.length) todayScore = (values.reduce((s: number, v: string) => s + Number(v), 0) / values.length).toFixed(1)
  }
  const entries: any[] = state.value.bookkeepingEntries ?? []
  const month = today.slice(0, 7)
  return [
    { label: '本周平均分', value: trendSummary.value.currentScore === null ? '—' : trendSummary.value.currentScore.toFixed(1) },
    { label: '周均时长', value: `${trendSummary.value.currentDurationMinutes.toFixed(0)} 分钟` },
    { label: '今日记录', value: rowsToday.length ? todayScore : '未填' },
    { label: '本月支出', value: entries.filter((e: any) => String(e.time).startsWith(month)).reduce((s: number, e: any) => s + (Number(e.amount) || 0), 0).toFixed(0) },
    { label: '风险项目', value: String(riskColumns.value.length) },
  ]
})

function shiftDateText(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

function scoreStatsInRange(rowsAny: any[], startDate: string, endDate: string) {
  const list = rowsAny.filter((r: any) => r.date && r.date >= startDate && r.date <= endDate)
  const columns: any[] = state.value.projectColumns ?? []
  let sum = 0
  let count = 0
  let duration = 0
  for (const row of list) {
    duration += Number(row.durationMinutes) || 0
    for (const c of columns) {
      const v = String(row.metrics?.[c.id] ?? '')
      if (/^\d+(\.\d)?$/.test(v)) {
        sum += Number(v)
        count += 1
      }
    }
  }
  return { avg: count ? sum / count : null, durationMinutes: duration, rows: list.length }
}

const trendSummary = computed(() => {
  const rowsAny = state.value.tableData ?? []
  const today = getTodayText()
  const current = scoreStatsInRange(rowsAny, shiftDateText(6), today)
  const previous = scoreStatsInRange(rowsAny, shiftDateText(13), shiftDateText(7))
  let change: string | null = null
  if (current.avg !== null && previous.avg !== null && previous.avg > 0) {
    const pct = ((current.avg - previous.avg) / previous.avg) * 100
    change = `${pct >= 0 ? '+' : ''}${pct.toFixed(0)}%`
  }
  return { currentScore: current.avg, currentDurationMinutes: current.durationMinutes, change }
})

/* 风险列：从最近日期向前连续 <60 且为数值的行数 ≥2 */
const riskColumns = computed<string[]>(() => {
  const rowsAny = (state.value.tableData ?? []).filter((r: any) => r.date).sort((a: any, b: any) => b.date.localeCompare(a.date))
  const low: string[] = []
  for (const c of state.value.projectColumns ?? []) {
    let count = 0
    for (const row of rowsAny) {
      const v = String(row.metrics?.[c.id] ?? '')
      if (!/^\d+(\.\d)?$/.test(v)) break
      if (Number(v) < 60) count += 1
      else break
    }
    if (count >= 2) low.push(`${c.name}（连续 ${count} 天）`)
  }
  return low
})

const recentReviews = computed(() => {
  const rowsAny = (state.value.tableData ?? []).filter((r: any) => r.date).sort((a: any, b: any) => b.date.localeCompare(a.date))
  const fields: any[] = state.value.noteFields ?? []
  const result: { date: string; preview: string }[] = []
  for (const row of rowsAny.slice(0, 6)) {
    const field = fields.find((f) => (row.notes?.[f.id] || '').trim())
    if (field) {
      const preview = String(row.notes[field.id]).trim()
      result.push({ date: row.date, preview: preview.length > 60 ? `${preview.slice(0, 60)}…` : preview })
    }
    if (result.length >= 3) break
  }
  return result
})

const recentBookkeeping = computed(() => {
  const entriesAny: any[] = state.value.bookkeepingEntries ?? []
  return [...entriesAny].sort((a, b) => String(b.time).localeCompare(String(a.time))).slice(0, 5)
})

watch(state, () => schedulePersist(), { deep: true })

/* ---------- 桌面提醒 ---------- */
let reminderTimer: ReturnType<typeof setInterval> | null = null

function todayDateKey(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function checkReminderTrigger() {
  const cfg = state.value.reminderConfig
  if (!cfg?.enabled || !cfg.time) return
  if (cfg.lastSentDate === todayDateKey()) return
  const now = new Date()
  const parts = String(cfg.time).split(':')
  const hh = Number(parts[0])
  const mm = Number(parts[1])
  if (now.getHours() === hh && now.getMinutes() === mm && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    new Notification('学习状态跟踪提醒', { body: '到点啦，今天的学习记录/复盘写了吗？' })
    cfg.lastSentDate = todayDateKey()
  }
}

async function handleReminderToggle(checked: boolean) {
  if (!('Notification' in window)) {
    alert('当前浏览器不支持桌面通知')
    checked = false
  } else if (checked && Notification.permission !== 'granted') {
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') {
      checked = false
      alert('通知权限未授予，无法开启提醒')
    }
  }
  state.value.reminderConfig.enabled = checked
  state.value.reminderConfig.permission = typeof Notification === 'undefined' ? 'unsupported' : Notification.permission
  setupReminderTimer()
  persistNow()
}

function setupReminderTimer() {
  if (reminderTimer) {
    clearInterval(reminderTimer)
    reminderTimer = null
  }
  if (state.value.reminderConfig?.enabled) {
    checkReminderTrigger()
    reminderTimer = setInterval(checkReminderTrigger, 30000)
  }
}

onMounted(() => {
  const raw = readLocalStorageValue(STORAGE_KEY)
  if (raw) {
    try {
      deepMergeState(JSON.parse(raw))
    } catch {
      /* ignore */
    }
  }
  hydrateTableState()
  persistNow()
  setupReminderTimer()
})

onBeforeUnmount(() => {
  if (persistTimer) {
    clearTimeout(persistTimer)
    persistNow()
  }
  if (reminderTimer) {
    clearInterval(reminderTimer)
    reminderTimer = null
  }
})
</script>

<template>
  <div class="study-tracker-app">
    <div id="app" class="page-shell">
      <div class="container">
        <header class="tracker-header">
          <div>
            <p class="tracker-kicker">RECORD & REVIEW</p>
            <h1>记录与复盘</h1>
            <p>训练事实由系统自动汇总；这里用于补充每日评分、复盘和长期趋势。</p>
          </div>
          <div class="tracker-header-actions">
            <button class="ep-mini-btn" type="button" @click="exportExcel">导出记录 Excel</button>
            <button class="ep-mini-btn" type="button" @click="exportPdfReport('week')">生成周报 PDF</button>
            <button class="ep-mini-btn" type="button" @click="exportPdfReport('month')">生成月报 PDF</button>
            <RouterLink class="tracker-settings-link" to="/settings">完整备份在全局设置 →</RouterLink>
          </div>
        </header>

        <section class="tracker-automatic-summary" aria-label="自动采集摘要">
          <div><span>今日自动训练</span><strong>{{ formatLearningDuration(learningSummary.todayDurationSeconds) }}</strong></div>
          <div><span>今日完成轮次</span><strong>{{ learningSummary.todayCompletedSessions }}</strong></div>
          <div><span>近 7 天错词</span><strong>{{ learningSummary.recentMistakeCount }}</strong></div>
          <div><span>待完成计划</span><strong>{{ pendingTodoItems.length }}</strong></div>
          <small>{{ storageStatus }}</small>
        </section>

        <!-- Tabs -->
        <section class="content-card">
          <div class="native-tabs">
            <button
              v-for="tab in [
                { key: 'overview', label: '总览' },
                { key: 'table', label: '每日记录' },
                { key: 'charts', label: '趋势统计' },
                { key: 'review', label: '复盘' },
                { key: 'accounting', label: '记账' },
              ]"
              :key="tab.key"
              class="native-tab"
              :class="{ active: activeTab === tab.key }"
              type="button"
              @click="activeTab = tab.key"
            >
              {{ tab.label }}
            </button>
          </div>

          <!-- Overview -->
          <div v-if="activeTab === 'overview'" class="tab-pane-block">
            <div class="overview-summary-grid">
              <div v-for="card in overviewCards" :key="card.label" class="stats-card overview-card">
                <div class="stats-label">{{ card.label }}</div>
                <div class="stats-value">{{ card.value }}</div>
                <div class="stats-sub">{{ card.label === '今日记录' ? '有数值列的平均分' : '自动统计' }}</div>
              </div>
            </div>
            <div class="overview-grid">
              <div class="section-card overview-panel">
                <div class="toolbar">
                  <div>
                    <div class="toolbar-title">今日动作面板</div>
                    <div class="toolbar-note">来自今日工作台的未完成计划。</div>
                  </div>
                </div>
                <div class="overview-list">
                  <div v-for="item in pendingTodoItems.slice(0, 5)" :key="item.id" class="overview-list-item">
                    <span class="ep-tag" :class="`type-${item.priority}`">{{ item.priority }}</span>
                    <span>{{ item.text }}</span>
                  </div>
                  <div v-if="!pendingTodoItems.length" class="overview-empty">当前没有未完成 Todo，可以把精力转到复盘或记账。</div>
                </div>
              </div>
              <div class="section-card overview-panel">
                <div class="toolbar">
                  <div>
                    <div class="toolbar-title">趋势摘要</div>
                    <div class="toolbar-note">近 7 天数据会自动汇总（学习记录表轮次后填充）。</div>
                  </div>
                </div>
                <div class="trend-lines">
                  <div class="trend-line"><span>近 7 天均分</span><strong>{{ trendSummary.currentScore === null ? '—' : trendSummary.currentScore.toFixed(1) }}</strong></div>
                  <div class="trend-line"><span>环比上周</span><strong>{{ trendSummary.change ?? '—' }}</strong></div>
                  <div class="trend-line"><span>近 7 天总时长</span><strong>{{ trendSummary.currentDurationMinutes }} 分钟</strong></div>
                </div>
                <div v-if="riskColumns.length" class="risk-list">
                  <div v-for="r in riskColumns" :key="r" class="risk-item">⚠️ {{ r }} 连续偏低</div>
                </div>
                <div v-else class="overview-empty">暂无明显风险项目。</div>
                <div class="reminder-mini">
                  <span class="dim">填写提醒</span>
                  <input type="checkbox" :checked="!!state.reminderConfig?.enabled" @change="handleReminderToggle(($event.target as HTMLInputElement).checked)" />
                  <input type="time" :value="state.reminderConfig?.time || '21:30'" @change="state.reminderConfig.time = ($event.target as HTMLInputElement).value; persistNow()" class="ep-input" style="width: 110px;" />
                </div>
              </div>
            </div>
            <div class="section-card overview-panel" style="margin-top: 12px;">
              <div class="toolbar">
                <div>
                  <div class="toolbar-title">最近复盘与支出</div>
                  <div class="toolbar-note">记录表 / 记账本轮次后展示。</div>
                </div>
              </div>
              <div class="overview-list">
                <template v-if="recentReviews.length">
                  <div v-for="review in recentReviews" :key="review.date" class="overview-list-item">
                    <span class="ep-tag type-中">{{ review.date }}</span>
                    <span>{{ review.preview }}</span>
                  </div>
                </template>
                <div v-else class="overview-empty">还没有可展示的复盘记录。</div>
                <template v-if="recentBookkeeping.length">
                  <div v-for="entry in recentBookkeeping" :key="entry.id" class="overview-list-item overview-finance-list">
                    <span class="dim">{{ entry.time }} · {{ entry.item }}</span>
                    <strong>￥{{ Number(entry.amount || 0).toFixed(1) }}</strong>
                  </div>
                </template>
                <div v-else class="overview-empty">还没有支出记录。</div>
              </div>
            </div>
          </div>

          <!-- 学习记录表 -->
          <StudyTable v-else-if="activeTab === 'table'" :state="state" />

          <!-- 复盘展览表 -->
          <StudyReview v-else-if="activeTab === 'review'" :state="state" />

          <!-- 记账本 -->
          <StudyAccounting v-else-if="activeTab === 'accounting'" :state="state" />

          <!-- 学习统计 -->
          <StudyCharts v-else-if="activeTab === 'charts'" :state="state" />

        </section>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 原 CSS 未覆盖的 EP 等价控件补充样式 */
.ep-input {
  padding: 8px 10px;
  border-radius: 10px;
  border: 1px solid rgba(15, 23, 42, 0.1);
  background: #fff;
  font: inherit;
  outline: none;
  min-width: 0;
}

.ep-input:focus {
  border-color: rgba(20, 115, 255, 0.5);
  box-shadow: 0 0 0 3px rgba(20, 115, 255, 0.12);
}

.ep-mini-btn {
  border: 1px solid rgba(15, 23, 42, 0.12);
  background: #fff;
  border-radius: 9px;
  padding: 5px 11px;
  cursor: pointer;
  font-size: 0.82rem;
  color: #3b4a5a;
}

.ep-mini-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.ep-tag {
  display: inline-block;
  font-size: 0.72rem;
  padding: 2px 9px;
  border-radius: 999px;
  background: #eef2f6;
  color: #556171;
}

.ep-tag.type-高 {
  background: rgba(215, 0, 21, 0.1);
  color: #d70015;
}

.ep-tag.type-中 {
  background: rgba(241, 181, 61, 0.16);
  color: #b7791f;
}

.ep-tag.type-低 {
  background: #eef2f6;
  color: #556171;
}

.ep-tag.type-长期 {
  background: rgba(97, 95, 255, 0.12);
  color: #615fff;
}

.native-tabs {
  display: flex;
  gap: 4px;
  border-bottom: 1px solid rgba(15, 23, 42, 0.08);
  flex-wrap: wrap;
}

.native-tab {
  border: none;
  background: none;
  padding: 10px 16px;
  cursor: pointer;
  font-size: 0.9rem;
  color: #556171;
  border-bottom: 2px solid transparent;
}

.native-tab.active {
  color: #0a84ff;
  border-bottom-color: #0a84ff;
  font-weight: 600;
}

.tab-pane-block {
  padding-top: 14px;
}

.trend-lines {
  display: grid;
  gap: 6px;
  margin: 10px 0;
}

.trend-line {
  display: flex;
  justify-content: space-between;
  color: #44546a;
  font-size: 0.9rem;
}

.trend-line strong {
  color: #0a84ff;
}

.risk-list {
  display: grid;
  gap: 4px;
  margin-bottom: 8px;
}

.risk-item {
  font-size: 0.8rem;
  color: #d70015;
  background: rgba(215, 0, 21, 0.06);
  border-radius: 8px;
  padding: 5px 9px;
}

.reminder-mini {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
}

.overview-list-item {
  display: flex;
  gap: 10px;
  align-items: baseline;
}

.overview-finance-list {
  justify-content: space-between;
}

.tracker-header {
  margin-bottom: 14px;
  padding: 30px 32px;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 28px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: 18px;
  background: #fff;
}

:global(.study-tracker-app) {
  margin: 0;
  padding: 0;
  background: #f5f5f2;
}

:global(.study-tracker-app .page-shell) {
  min-height: auto;
  padding: 28px;
}

:global(.study-tracker-app .container) {
  max-width: 1180px;
}

:global(.study-tracker-app .content-card) {
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: 18px;
  background: #fff;
  box-shadow: none;
  backdrop-filter: none;
}

:global(.study-tracker-app .stats-card) {
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: 14px;
  background: #f8f8f7;
  box-shadow: none;
  backdrop-filter: none;
}

.tracker-kicker {
  margin: 0 0 9px;
  color: #5867e7;
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 650;
  letter-spacing: 0.16em;
}

.tracker-header h1 {
  margin: 0;
  font-size: clamp(34px, 5vw, 54px);
  letter-spacing: -0.055em;
  line-height: 1;
}

.tracker-header > div > p:last-child {
  max-width: 620px;
  margin: 14px 0 0;
  color: #6e6e73;
  line-height: 1.7;
}

.tracker-header-actions {
  max-width: 430px;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  flex-wrap: wrap;
}

.tracker-settings-link {
  width: 100%;
  color: #5867e7;
  font-size: 12px;
  font-weight: 650;
  text-align: right;
}

.tracker-automatic-summary {
  margin-bottom: 14px;
  padding: 18px 22px;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr)) auto;
  gap: 1px;
  align-items: center;
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: 16px;
  background: #fff;
}

.tracker-automatic-summary > div {
  padding: 2px 18px;
  display: grid;
  gap: 6px;
  border-left: 1px solid rgba(15, 23, 42, 0.08);
}

.tracker-automatic-summary > div:first-child {
  padding-left: 0;
  border-left: 0;
}

.tracker-automatic-summary span,
.tracker-automatic-summary small {
  color: #6e6e73;
  font-size: 11px;
}

.tracker-automatic-summary strong {
  font-size: 18px;
}

@media (max-width: 860px) {
  .tracker-header {
    align-items: flex-start;
    flex-direction: column;
  }

  .tracker-header-actions {
    max-width: none;
    justify-content: flex-start;
  }

  .tracker-settings-link {
    text-align: left;
  }

  .tracker-automatic-summary {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .tracker-automatic-summary > div,
  .tracker-automatic-summary > div:first-child {
    padding: 10px;
    border-left: 0;
  }

  .tracker-automatic-summary small {
    grid-column: 1 / -1;
  }
}

@media (max-width: 560px) {
  .tracker-header {
    padding: 22px;
  }

  .tracker-header-actions button {
    flex: 1;
  }
}
</style>
