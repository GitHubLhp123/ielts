<script setup lang="ts">
/**
 * 学习状态跟踪 —— 忠实还原 daily-status/学习状态跟踪.html（第一版骨架）。
 * 已实现：Hero(JSON 导入导出) + 顶部 Todo + 六 Tab 容器。
 * 增量规划见 web/docs/study-tracker/PORT-NOTES.md。
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import './styles/legacy-full.css'
import StudyTable from './components/StudyTable.vue'
import StudyReview from './components/StudyReview.vue'
import StudyAccounting from './components/StudyAccounting.vue'
import StudyCharts from './components/StudyCharts.vue'
import { DEFAULT_GROUPS, DEFAULT_PROJECT_COLUMNS, DEFAULT_NOTE_FIELDS, SAMPLE_ROWS } from './model/defaults'
import { deserializeRow, normalizeRows, serializeRows, createEmptyRow, getTodayText, type StudyRow, type StudyColumn, type NoteField } from './model/tableModel'

const STORAGE_KEY = 'daily-learning-tracker-state-v4'
const STORAGE_META_KEY = 'daily-learning-tracker-state-meta-v1'
const TODO_PRIORITY_OPTIONS = ['高', '中', '低', '长期'] as const
const TODO_PRIORITY_RANK: Record<string, number> = { 高: 0, 中: 1, 低: 2, 长期: 3 }

type TodoPriority = (typeof TODO_PRIORITY_OPTIONS)[number]

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
  localStorage.setItem(STORAGE_KEY, JSON.stringify(buildPersistPayload()))
  const meta = JSON.parse(localStorage.getItem(STORAGE_META_KEY) || '{}') as Record<string, any>
  meta.savedAt = Date.now()
  meta.app = 'daily-learning-tracker-web'
  localStorage.setItem(STORAGE_META_KEY, JSON.stringify(meta))
}

function schedulePersist() {
  if (persistTimer) clearTimeout(persistTimer)
  persistTimer = setTimeout(persistNow, 300)
}

/* ---------- Todo ---------- */
const newTodoText = computed({
  get: () => state.value.newTodoText as string,
  set: (v: string) => {
    state.value.newTodoText = v
  },
})
const newTodoPriority = computed({
  get: () => state.value.newTodoPriority as TodoPriority,
  set: (v: TodoPriority) => {
    state.value.newTodoPriority = v
  },
})

const todoItems = computed(() => (state.value.todoItems ?? []) as TodoItem[])
const completedTodoCount = computed(() => todoItems.value.filter((t) => t.done).length)
const pendingTodoItems = computed(() =>
  todoItems.value
    .filter((t) => !t.done)
    .sort((a, b) => TODO_PRIORITY_RANK[a.priority] - TODO_PRIORITY_RANK[b.priority] || String(a.createdAt).localeCompare(String(b.createdAt))),
)
const completedTodoItems = computed(() =>
  todoItems.value
    .filter((t) => t.done)
    .sort((a, b) => String(b.completedAt).localeCompare(String(a.completedAt))),
)

const todoEditingText = ref('')
const todoEditingPriority = ref<TodoPriority>('中')
const todoEditingId = ref('')
const completedCollapsed = ref(false)

function addTodo() {
  const text = String(newTodoText.value).trim()
  if (!text) return
  const now = new Date().toISOString()
  state.value.todoItems.push({
    id: `todo-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    text,
    priority: newTodoPriority.value,
    done: false,
    createdAt: now,
    completedAt: '',
  })
  newTodoText.value = ''
  schedulePersist()
}

function handleTodoToggle(item: TodoItem) {
  item.completedAt = item.done ? new Date().toISOString() : ''
  schedulePersist()
}

function removeTodo(id: string) {
  state.value.todoItems = todoItems.value.filter((t) => t.id !== id)
  schedulePersist()
}

function startTodoEdit(item: TodoItem) {
  todoEditingId.value = item.id
  todoEditingText.value = item.text
  todoEditingPriority.value = item.priority
}

function saveTodoEdit(id: string) {
  const item = todoItems.value.find((t) => t.id === id)
  const text = String(todoEditingText.value).trim()
  if (item && text) {
    item.text = text
    item.priority = todoEditingPriority.value
  }
  todoEditingId.value = ''
  schedulePersist()
}

function cancelTodoEdit() {
  todoEditingId.value = ''
}

const TAB_LABELS: Record<string, string> = {
  table: '学习记录表',
  charts: '学习统计',
  review: '复盘信息展览表',
  accounting: '记账本',
  tips: '记录建议',
}

function tabLabelOf(key: string): string {
  return TAB_LABELS[key] ?? key
}

function formatDateTime(value: string): string {
  if (!value) return ''
  const d = new Date(value)
  if (!Number.isFinite(d.getTime())) return ''
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/* ---------- 导入导出 ---------- */
function download(filename: string, text: string, type = 'application/json') {
  const blob = new Blob([text], { type })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

function exportData() {
  state.value.lastExportAt = new Date().toISOString()
  const payload = { version: 4, exportedAt: new Date().toISOString(), state: buildPersistPayload() }
  const day = new Date().toISOString().slice(0, 10)
  download(`学习状态跟踪-完整数据-${day}.json`, JSON.stringify(payload, null, 2))
  persistNow()
}

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
  download(`学习状态跟踪-${day}.xls`, tableHtml, 'application/vnd.ms-excel')
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

function triggerDataImport() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'application/json,.json'
  input.onchange = () => {
    const file = input.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result))
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('bad')
        state.value = { ...createInitialState() }
        deepMergeState(parsed)
        persistNow()
      } catch {
        alert('导入失败：不是有效的状态文件')
      }
    }
    reader.readAsText(file)
  }
  input.click()
}

const lastExportAtText = computed(() => (state.value.lastExportAt ? formatDateTime(state.value.lastExportAt) : ''))

const activeTab = computed({
  get: () => state.value.activeTab as string,
  set: (v: string) => {
    state.value.activeTab = v
    schedulePersist()
  },
})


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

onMounted(() => {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (raw) {
    try {
      deepMergeState(JSON.parse(raw))
    } catch {
      /* ignore */
    }
  }
  hydrateTableState()
  persistNow()
})

onBeforeUnmount(() => {
  if (persistTimer) {
    clearTimeout(persistTimer)
    persistNow()
  }
})
</script>

<template>
  <div class="study-tracker-app">
    <div id="app" class="page-shell">
      <div class="container">
        <!-- Hero -->
        <section class="hero-card">
          <div class="hero-main">
            <h1 class="hero-title">每日学习状态跟踪</h1>
            <p class="hero-desc">按天记录学习与身心状态，统一查看记录、图表、复盘表和待办事项。页面会自动保存在本地，也支持导入导出。</p>
          </div>
          <div class="hero-side">
            <div class="toolbar-note" style="text-align: right; max-width: 420px;">本页所有导入导出入口统一放在这里，包含整页数据、Excel 和周期 PDF（Excel/PDF 将随记录表轮次接入）。</div>
            <div class="hero-actions">
              <button class="ep-mini-btn" type="button" @click="exportData">⬇ 导出数据</button>
              <button class="ep-mini-btn" type="button" @click="triggerDataImport">⬆ 导入数据</button>
              <button class="ep-mini-btn" type="button" @click="exportExcel">📊 导出 Excel</button>
              <button class="ep-mini-btn" type="button" @click="exportPdfReport('week')">📄 周报 PDF</button>
              <button class="ep-mini-btn" type="button" @click="exportPdfReport('month')">📄 月报 PDF</button>
            </div>
            <div class="hero-tags">
              <span class="hero-tag">本地自动保存</span>
              <span class="hero-tag">动态列配置</span>
              <span class="hero-tag">复盘展览表</span>
              <span class="hero-tag">统一数据导入导出</span>
            </div>
          </div>
        </section>

        <!-- Todo -->
        <section class="content-card top-todo-card">
          <div class="todo-toolbar">
            <div>
              <div class="toolbar-title">Todo List</div>
              <div class="toolbar-note">固定放在页面顶部，支持直接录入、编辑、勾选完成。已完成任务会保留并折叠，不会删除，仍会跟随整页数据一起持久化。</div>
            </div>
            <div class="toolbar-actions">
              <span v-if="lastExportAtText" class="ep-tag-info">上次备份 {{ lastExportAtText }}</span>
            </div>
          </div>
          <div class="todo-input-row">
            <input v-model="newTodoText" class="ep-input" placeholder="直接填写待办内容，按回车或点击新增" @keyup.enter="addTodo" />
            <select v-model="newTodoPriority" class="todo-priority-select ep-input" aria-label="优先级">
              <option v-for="p in TODO_PRIORITY_OPTIONS" :key="p" :value="p">{{ p }}</option>
            </select>
            <button class="ep-btn-primary" type="button" @click="addTodo">新增待办</button>
          </div>
          <div class="todo-summary">共 {{ todoItems.length }} 条，已完成 {{ completedTodoCount }} 条，未完成 {{ pendingTodoItems.length }} 条。</div>

          <div v-if="pendingTodoItems.length" class="todo-list" style="margin-top: 14px;">
            <div v-for="item in pendingTodoItems" :key="item.id" class="todo-item">
              <div class="todo-main">
                <input type="checkbox" class="ep-checkbox" :checked="item.done" @change="handleTodoToggle(item)" />
                <div class="todo-content">
                  <template v-if="todoEditingId === item.id">
                    <input v-model="todoEditingText" class="ep-input todo-edit-input" @keyup.enter="saveTodoEdit(item.id)" @keyup.esc="cancelTodoEdit" />
                    <select v-model="todoEditingPriority" class="ep-input" style="margin-top: 6px;">
                      <option v-for="p in TODO_PRIORITY_OPTIONS" :key="p" :value="p">{{ p }}</option>
                    </select>
                  </template>
                  <template v-else>
                    <div class="todo-text">{{ item.text }}</div>
                    <div class="todo-meta">
                      <span class="ep-tag" :class="`type-${item.priority}`">{{ item.priority }}</span>
                      <span class="todo-priority-tag">优先级</span>
                      创建于 {{ formatDateTime(item.createdAt) }}
                    </div>
                  </template>
                </div>
              </div>
              <div class="todo-actions">
                <template v-if="todoEditingId === item.id">
                  <button class="ep-mini-btn primary" type="button" @click="saveTodoEdit(item.id)">保存</button>
                  <button class="ep-mini-btn" type="button" @click="cancelTodoEdit">取消</button>
                </template>
                <template v-else>
                  <button class="ep-mini-btn" type="button" @click="startTodoEdit(item)">✎ 编辑</button>
                </template>
                <button class="ep-mini-btn danger" type="button" @click="removeTodo(item.id)">🗑 删除</button>
              </div>
            </div>
          </div>
          <div v-else class="todo-empty">当前没有未完成 Todo，可以直接新增今天的执行动作。</div>

          <div v-if="completedTodoItems.length" class="todo-completed-panel">
            <button class="ep-mini-btn" type="button" @click="completedCollapsed = !completedCollapsed">
              {{ completedCollapsed ? '展开' : '折叠' }} 已完成（{{ completedTodoItems.length }}）
            </button>
            <div v-if="!completedCollapsed" class="todo-list" style="margin-top: 8px;">
              <div v-for="item in completedTodoItems" :key="item.id" class="todo-item is-done">
                <div class="todo-main">
                  <input type="checkbox" class="ep-checkbox" :checked="item.done" @change="handleTodoToggle(item)" />
                  <div class="todo-content">
                    <div class="todo-text">{{ item.text }}</div>
                    <div class="todo-meta">
                      <span class="ep-tag" :class="`type-${item.priority}`">{{ item.priority }}</span>
                      <span class="todo-priority-tag">优先级</span>
                      创建于 {{ formatDateTime(item.createdAt) }}
                      <template v-if="item.completedAt"> · 完成于 {{ formatDateTime(item.completedAt) }}</template>
                    </div>
                  </div>
                </div>
                <div class="todo-actions">
                  <button class="ep-mini-btn" type="button" @click="startTodoEdit(item)">✎ 编辑</button>
                  <button class="ep-mini-btn danger" type="button" @click="removeTodo(item.id)">🗑 删除</button>
                </div>
              </div>
            </div>
            <div class="todo-meta" style="margin-top: 6px;">已完成保留</div>
          </div>
        </section>

        <!-- Tabs -->
        <section class="content-card">
          <div class="native-tabs">
            <button
              v-for="tab in [
                { key: 'overview', label: 'Overview' },
                { key: 'table', label: '学习记录表' },
                { key: 'charts', label: '学习统计' },
                { key: 'review', label: '复盘信息展览表' },
                { key: 'accounting', label: '记账本' },
                { key: 'tips', label: '记录建议' },
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
                    <div class="toolbar-note">来自顶部 Todo 的未完成项。</div>
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
                  <input type="checkbox" :checked="!!state.reminderConfig?.enabled" @change="state.reminderConfig.enabled = ($event.target as HTMLInputElement).checked" />
                  <input type="time" :value="state.reminderConfig?.time || '21:30'" @change="state.reminderConfig.time = ($event.target as HTMLInputElement).value" class="ep-input" style="width: 110px;" />
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

          <!-- 记录建议 -->
          <template v-else-if="activeTab === 'tips'">
            <div class="tab-pane-block tips-layout">
              <div class="tips-card">
                <div class="toolbar-title">记录建议</div>
                <ul class="tips-list">
                  <li>每天打开页面先看一眼「今日动作」，把 Todo 里未完成的先落地。</li>
                  <li>得分尽量当天填：超过 24 小时回忆会失真，历史日期也会自动锁定。</li>
                  <li>低于 60 分的项目第二天优先安排，连续偏低会出现在风险提醒里。</li>
                </ul>
              </div>
              <div class="tips-card">
                <div class="toolbar-title">使用框架</div>
                <ul class="tips-list">
                  <li>记录：<b>时长（分钟）</b> + 各项目<b>得分（0–100，/ 表示未进行）</b>。</li>
                  <li>复盘：每天写<b>总结 / 弱项 / 明日计划</b>；明日计划可一键拆成 Todo。</li>
                  <li>周报 / 月报：导出 PDF 前会先按周期汇总均分、时长与类别支出。</li>
                  <li>定期用顶部「导出数据」做整页备份（推荐每周一次）。</li>
                </ul>
              </div>
            </div>
          </template>

          <!-- 其余 Tab：分轮实现 -->
          <div v-else class="tab-pane-block">
            <div class="section-card table-toolbar-card">
              <div class="toolbar">
                <div>
                  <div class="toolbar-title">{{ tabLabelOf(activeTab) }}</div>
                  <div class="toolbar-note">该区块将在后续移植轮次实现（见 web/docs/study-tracker/PORT-NOTES.md）。</div>
                </div>
              </div>
            </div>
          </div>
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

.ep-btn-primary {
  border: none;
  border-radius: 10px;
  padding: 9px 16px;
  color: #fff;
  cursor: pointer;
  background: linear-gradient(180deg, #2e90ff, #1677ff);
  font-weight: 600;
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

.ep-mini-btn.primary {
  color: #1677ff;
  border-color: rgba(22, 119, 255, 0.4);
}

.ep-mini-btn.danger {
  color: #d70015;
  border-color: rgba(215, 0, 21, 0.25);
}

.ep-mini-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.ep-checkbox {
  width: 17px;
  height: 17px;
  accent-color: #1677ff;
  flex: none;
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

.ep-tag-info {
  display: inline-block;
  font-size: 0.72rem;
  padding: 3px 10px;
  border-radius: 999px;
  background: #eef5ff;
  color: #0a84ff;
}

.todo-priority-select {
  width: 130px;
  flex: none;
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

.todo-edit-input {
  width: 60%;
}

.todo-item.is-done .todo-text {
  text-decoration: line-through;
  color: #98a2b3;
}
.tips-layout {
  display: grid;
  gap: 12px;
}

.tips-card {
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: 16px;
  padding: 16px 18px;
}

.tips-list {
  margin: 10px 0 0;
  padding-left: 20px;
  line-height: 1.9;
  color: #44546a;
  font-size: 0.9rem;
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
</style>
