<script setup lang="ts">
/**
 * 学习记录表（tab=table）—— 忠实还原 legacy 表格面板（本轮的表格核心）。
 */
import { computed, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'

import { LOW_SCORE_THRESHOLD, DEFAULT_NOTE_FIELDS } from '../model/defaults'
import {
  sanitizeMetric,
  isNumericMetric,
  normalizeRows,
  createEmptyRow,
  rowAverage,
  rowIncompleteCount,
  getTodayText,
  isPastDate,
  type StudyRow,
  type StudyColumn,
  type NoteField,
} from '../model/tableModel'

const props = defineProps<{ state: any }>()

const st = computed(() => props.state)

const groups = computed<{ id: string; name: string }[]>(() => st.value.groups ?? [])
const columns = computed<StudyColumn[]>(() => st.value.projectColumns ?? [])
const noteFields = computed<NoteField[]>(() => st.value.noteFields ?? DEFAULT_NOTE_FIELDS)
const rows = computed<StudyRow[]>(() => st.value.tableData ?? [])
const notesCollapsed = computed({
  get: () => Boolean(st.value.notesCollapsed),
  set: (v: boolean) => {
    st.value.notesCollapsed = v
  },
})
const filter = computed(() => st.value.tableFilter)

/* 分组名映射 */
function groupNameOf(groupId: string): string {
  return groups.value.find((g) => g.id === groupId)?.name || '未分组'
}

function groupDisplayed(groupId: string): StudyColumn[] {
  const gid = filter.value.groupId
  if (gid !== 'all' && gid !== groupId) return []
  return columns.value.filter((c) => c.groupId === groupId)
}

/* 筛选 */
function rowSearchText(row: StudyRow): string {
  const parts = [row.date, row.durationMinutes ?? '']
  for (const column of columns.value) {
    if (row.metrics[column.id]) parts.push(`${column.name}${row.metrics[column.id]}`)
  }
  for (const field of noteFields.value) {
    if (row.notes[field.id]) parts.push(row.notes[field.id])
  }
  return parts.join(' ').toLowerCase()
}

function compareRows(a: StudyRow, b: StudyRow): number {
  const mode = filter.value.sortMode
  const dateCmp = (x: StudyRow, y: StudyRow) => {
    if (x.date && y.date) return x.date.localeCompare(y.date)
    return x.date ? -1 : y.date ? 1 : 0
  }
  if (mode === 'date-asc') return dateCmp(a, b)
  if (mode === 'date-desc') return dateCmp(b, a)
  const durationA = a.durationMinutes ?? -1
  const durationB = b.durationMinutes ?? -1
  if (mode === 'duration-desc') return durationB - durationA
  const avgA = rowAverage(a, activeColumns.value) ?? -1
  const avgB = rowAverage(b, activeColumns.value) ?? -1
  if (mode === 'average-desc') return avgB - avgA
  if (mode === 'incomplete-first') return rowIncompleteCount(a, activeColumns.value) - rowIncompleteCount(b, activeColumns.value)
  return dateCmp(a, b)
}

const activeColumns = computed(() =>
  filter.value.groupId === 'all' ? columns.value : columns.value.filter((c) => c.groupId === filter.value.groupId),
)

const filteredRows = computed(() => {
  const keyword = String(filter.value.keyword || '').trim().toLowerCase()
  const [start, end] = filter.value.dateRange ?? []
  const result = rows.value.filter((row) => {
    if (row.date && start && row.date < String(start).slice(0, 10)) return false
    if (row.date && end && row.date > String(end).slice(0, 10)) return false
    if (keyword && !rowSearchText(row).includes(keyword)) return false
    if (filter.value.onlyLowScore) {
      const avg = rowAverage(row, activeColumns.value)
      if (avg === null || avg >= LOW_SCORE_THRESHOLD) return false
    }
    if (filter.value.onlyIncomplete && rowIncompleteCount(row, activeColumns.value) === 0) return false
    return true
  })
  return [...result].sort(compareRows)
})

/* 日期重复检查 */
function isDuplicateDate(date: string, excludeId?: string): boolean {
  return rows.value.some((r) => r.date === date && r.id !== excludeId)
}


/* ---------- 单元格编辑 ---------- */
function onMetricInput(row: StudyRow, column: StudyColumn, value: string) {
  const clean = sanitizeMetric(value)
  row.metrics[column.id] = clean
}

function onMetricBlur(row: StudyRow, column: StudyColumn) {
  const current = row.metrics[column.id]
  if (/^\d+\.$/.test(current)) row.metrics[column.id] = String(Number(current.slice(0, -1)))
}

function onDurationInput(row: StudyRow, value: string | number | null) {
  if (value === null || value === '') {
    row.durationMinutes = null
    return
  }
  const num = Number(value)
  row.durationMinutes = Number.isNaN(num) || num < 0 ? null : num
}

function onDateChange(row: StudyRow, value: string) {
  const date = String(value || '').slice(0, 10)
  if (date && isDuplicateDate(date, row.id)) {
    ElMessage.warning('同一天只能保留一条记录，已拦截')
    return
  }
  row.date = date
  st.value.tableData = normalizeRows(rows.value)
}

function onNoteInput(row: StudyRow, fieldId: string, value: string) {
  row.notes[fieldId] = value
}

/* ---------- 行操作 ---------- */
function ensureTodayRecord() {
  const today = getTodayText()
  if (rows.value.some((r) => r.date === today)) {
    ElMessage.info('今天的记录已存在')
    return
  }
  rows.value.push(createEmptyRow(columns.value, noteFields.value, rows.value.map((r) => r.id)))
  const created = rows.value[rows.value.length - 1]
  created.date = today
  st.value.tableData = normalizeRows(rows.value)
  ElMessage.success('已补上今天的空记录')
}

function addBlankRow() {
  const emptyCount = rows.value.filter((r) => !r.date).length
  if (emptyCount >= 3) {
    ElMessage.warning('空白行最多保留 3 行')
    return
  }
  rows.value.push(createEmptyRow(columns.value, noteFields.value, rows.value.map((r) => r.id)))
  st.value.tableData = normalizeRows(rows.value)
}

function copyRow(row: StudyRow) {
  const copy = {
    ...row,
    id: `row-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    date: '',
  }
  copy.metrics = { ...row.metrics }
  copy.notes = { ...row.notes }
  rows.value.push(copy)
  st.value.tableData = normalizeRows(rows.value)
}

async function removeRow(row: StudyRow) {
  if (isPastDate(row.date)) {
    ElMessage.warning('历史记录不可删除')
    return
  }
  try {
    await ElMessageBox.confirm('确认删除这一行吗？', '提示', { confirmButtonText: '确定', type: 'warning' })
  } catch {
    return
  }
  const index = rows.value.findIndex((r) => r.id === row.id)
  if (index === -1) return
  rows.value.splice(index, 1)
  if (!rows.value.length) {
    rows.value.push(createEmptyRow(columns.value, noteFields.value, []))
  }
  st.value.tableData = normalizeRows(rows.value)
}

function isPlanLike(name: string): boolean {
  return /计划|plan|next/i.test(name)
}

function appendPlanTodos(items: string[]) {
  const existing = new Set((st.value.todoItems ?? []).filter((t: any) => !t.done).map((t: any) => t.text.trim().toLowerCase().replace(/\s+/g, ' ')))
  const todoList = st.value.todoItems ?? []
  const now = new Date().toISOString()
  let added = 0
  for (const text of items) {
    const key = text.trim().toLowerCase().replace(/\s+/g, ' ')
    if (!key || existing.has(key)) continue
    existing.add(key)
    todoList.unshift({
      id: `todo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      text: text.trim(),
      priority: '中',
      done: false,
      createdAt: now,
      completedAt: '',
    })
    added += 1
  }
  st.value.todoItems = todoList
  return added
}

function syncTodayPlanToTodos() {
  const source = rows.value.find((r) => r.date === getTodayText()) ?? [...rows.value].reverse().find((r) => r.date)
  if (!source) {
    ElMessage.info('还没有学习记录行')
    return
  }
  const items: string[] = []
  for (const field of noteFields.value) {
    if (!isPlanLike(field.name)) continue
    const text = source.notes[field.id] || ''
    for (const rawLine of text.split(/\r?\n/)) {
      const cleaned = rawLine.replace(/^\s*(?:[-•*]|\d+[.、)）])\s*/, '').trim()
      if (cleaned) items.push(cleaned)
    }
  }
  const added = appendPlanTodos(items)
  ElMessage.success(`已同步 ${added} 条到 Todo${added ? '' : '（无新增）'}`)
}

/* 明日记录 */
function createTomorrowRecord() {
  const source = rows.value.find((r) => r.date === getTodayText()) ?? [...rows.value].reverse().find((r) => r.date)
  const tomorrow = getTodayText(1)
  if (rows.value.some((r) => r.date === tomorrow)) {
    ElMessage.info('明天的记录已存在')
    return
  }
  const row = createEmptyRow(columns.value, noteFields.value, rows.value.map((r) => r.id))
  row.date = tomorrow
  const planItems: string[] = []
  if (source) {
    for (const field of noteFields.value) {
      if (isPlanLike(field.name) && source.notes[field.id]) {
        row.notes[field.id] = source.notes[field.id]
        planItems.push(...source.notes[field.id].split(/\r?\n/))
      }
    }
  }
  rows.value.push(row)
  st.value.tableData = normalizeRows(rows.value)
  const added = appendPlanTodos(planItems)
  ElMessage.success(`已生成明天空记录${added ? `，并同步 ${added} 条 Todo` : ''}`)
}

function todayAvgText(): string {
  const row = rows.value.find((r) => r.date === getTodayText())
  if (!row) return '—'
  const avg = rowAverage(row, activeColumns.value)
  return avg === null ? '—' : avg.toFixed(1)
}

function rowAvg(row: StudyRow): string {
  const avg = rowAverage(row, columns.value)
  return avg === null ? '—' : avg.toFixed(1)
}

function incompleteText(row: StudyRow): string {
  return String(rowIncompleteCount(row, columns.value))
}

function groupMeta(groupId: string) {
  const cols = columns.value.filter((c) => c.groupId === groupId)
  const targets = cols.filter((c) => c.targetValue !== null && c.targetValue !== undefined)
  return {
    cols,
    target: targets.length ? `${targets[0].targetValue} 分` : '',
    name: groupNameOf(groupId),
  }
}

function onRangeStart(input: HTMLInputElement) {
  dateRange.value = [input.value, dateRange.value[1] || '']
}

function onRangeEnd(input: HTMLInputElement) {
  dateRange.value = [dateRange.value[0] || '', input.value]
}

/* ---------- 分组 / 复盘栏位配置弹窗 ---------- */
const showGroupConfig = ref(false)
const showNoteFieldsConfig = ref(false)
const newGroupName = ref('')
const newColumnName = ref('')
const newColumnGroup = ref('group-study')
const newNoteFieldName = ref('')

function addGroup() {
  const name = String(newGroupName.value).trim()
  if (!name) return
  const list = st.value.groups ?? []
  if (list.some((g: any) => g.name === name)) { alert('分组名已存在'); return }
  list.push({ id: `group-${Date.now().toString(36)}`, name })
  newGroupName.value = ''
}

function removeGroup(id: string) {
  if (id === 'group-ungrouped') { alert('未分组不能删除'); return }
  if (!window.confirm('删除分组会把其下项目移到未分组，继续吗？')) return
  st.value.groups = (st.value.groups ?? []).filter((g: any) => g.id !== id)
  for (const c of st.value.projectColumns ?? []) if (c.groupId === id) c.groupId = 'group-ungrouped'
}

function removeColumn(columnId: string) {
  if (!window.confirm('删除项目会连同该列记录数据一起移除，继续吗？')) return
  st.value.projectColumns = (st.value.projectColumns ?? []).filter((c: any) => c.id !== columnId)
  for (const row of st.value.tableData ?? []) if (row.metrics) delete row.metrics[columnId]
}

function addColumn() {
  const name = String(newColumnName.value).trim()
  if (!name) return
  const cols = st.value.projectColumns ?? []
  if (cols.some((c: any) => c.name === name)) { alert('项目名已存在'); return }
  const column = { id: `col-${Date.now().toString(36)}`, name, groupId: newColumnGroup.value, width: 100, targetValue: 60 }
  cols.push(column)
  for (const row of st.value.tableData ?? []) if (row.metrics) row.metrics[column.id] = ''
  newColumnName.value = ''
}

function addNoteField() {
  const name = String(newNoteFieldName.value).trim()
  if (!name) return
  const fields = st.value.noteFields ?? []
  if (fields.some((f: any) => f.name === name)) { alert('栏位名已存在'); return }
  const field = { id: `nf-${Date.now().toString(36)}`, name }
  fields.push(field)
  for (const row of st.value.tableData ?? []) if (row.notes) row.notes[field.id] = ''
  newNoteFieldName.value = ''
}

function removeNoteField(fieldId: string) {
  if (!window.confirm('删除栏位会清空各行该栏内容，继续吗？')) return
  st.value.noteFields = (st.value.noteFields ?? []).filter((f: any) => f.id !== fieldId)
  for (const row of st.value.tableData ?? []) if (row.notes) delete row.notes[fieldId]
}

/* 排序/筛选/日期选择默认值 */
const dateRange = computed({
  get: () => filter.value.dateRange,
  set: (v: string[]) => {
    st.value.tableFilter.dateRange = v
  },
})
const keyword = computed({
  get: () => filter.value.keyword,
  set: (v: string) => {
    st.value.tableFilter.keyword = v
  },
})
const groupFilter = computed({
  get: () => filter.value.groupId,
  set: (v: string) => {
    st.value.tableFilter.groupId = v
  },
})
const onlyLowScore = computed({
  get: () => filter.value.onlyLowScore,
  set: (v: boolean) => {
    st.value.tableFilter.onlyLowScore = v
  },
})
const onlyIncomplete = computed({
  get: () => filter.value.onlyIncomplete,
  set: (v: boolean) => {
    st.value.tableFilter.onlyIncomplete = v
  },
})
const sortMode = computed({
  get: () => filter.value.sortMode,
  set: (v: string) => {
    st.value.tableFilter.sortMode = v
  },
})

function resetFilters() {
  st.value.tableFilter = { dateRange: [], keyword: '', groupId: 'all', onlyLowScore: false, onlyIncomplete: false, sortMode: 'date-asc' }
}

</script>

<template>
  <div class="tab-pane-block">
    <div class="section-card table-toolbar-card">
      <div class="table-toolbar-head">
        <div>
          <div class="toolbar-title">核心数据表格</div>
          <div class="toolbar-note">按天记录各项得分（0–100，可输入 / 表示跳过）。历史日期自动锁定，今天与未来可编辑。</div>
        </div>
        <div class="table-toolbar-meta">
          <span>本地自动保存</span>
          <span>记录行 {{ rows.length }}</span>
          <span>今日平均分 {{ todayAvgText() }}</span>
        </div>
        <div class="toolbar-actions">
          <button class="ep-mini-btn" type="button" @click="syncTodayPlanToTodos">明日计划同步 Todo</button>
                <button class="ep-mini-btn" type="button" @click="showGroupConfig = true">分组与组项目</button>
                <button class="ep-mini-btn" type="button" @click="showNoteFieldsConfig = true">复盘栏位</button>
          <button class="ep-mini-btn" type="button" @click="notesCollapsed = !notesCollapsed">
            {{ notesCollapsed ? '展开' : '折叠' }} 复盘栏
          </button>
        </div>
      </div>
      <p class="table-guideline">得分规则：整数或一位小数；「/」表示未进行；留空表示未补齐。低于 {{ LOW_SCORE_THRESHOLD }} 分将计入低分风险。</p>

      <div class="table-toolbar-meta" style="margin-top: 8px; gap: 6px; flex-wrap: wrap; display: flex; align-items: center;">
        <label class="ep-mini-label">日期区间
          <input class="ep-input" type="date" :value="dateRange[0] || ''" @change="onRangeStart(($event as InputEvent).target as HTMLInputElement)" />
          ~
          <input class="ep-input" type="date" :value="dateRange[1] || ''" @change="onRangeEnd(($event as InputEvent).target as HTMLInputElement)" />
        </label>
        <label class="ep-mini-label">关键词
          <input v-model="keyword" class="ep-input" placeholder="日期/项目/复盘…" style="width: 170px;" />
        </label>
        <label class="ep-mini-label">分组
          <select v-model="groupFilter" class="ep-input">
            <option value="all">全部分组</option>
            <option v-for="g in groups" :key="g.id" :value="g.id">{{ g.name }}</option>
          </select>
        </label>
        <label class="ep-mini-label"><input type="checkbox" v-model="onlyLowScore" /> 仅看低于 {{ LOW_SCORE_THRESHOLD }}</label>
        <label class="ep-mini-label"><input type="checkbox" v-model="onlyIncomplete" /> 仅看未补齐</label>
        <select v-model="sortMode" class="ep-input">
          <option value="date-asc">日期升序</option>
          <option value="date-desc">日期降序</option>
          <option value="duration-desc">时长降序</option>
          <option value="average-desc">均分降序</option>
          <option value="incomplete-first">未补齐优先</option>
        </select>
        <button class="ep-mini-btn" type="button" @click="resetFilters">重置筛选</button>
      </div>

      <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-top: 10px;">
        <button class="ep-mini-btn primary" type="button" @click="ensureTodayRecord">定位/补今天</button>
        <button class="ep-mini-btn" type="button" @click="addBlankRow">新增空白行</button>
        <button class="ep-mini-btn" type="button" @click="createTomorrowRecord">新增明天记录</button>
      </div>
    </div>

    <!-- 核心表 -->
    <div class="core-table-wrapper table-wrapper" style="margin-top: 12px;">
      <table class="core-table">
        <thead>
          <tr class="group-head">
            <th class="date-col">日期</th>
            <th class="duration-col">时长(分)</th>
            <th v-for="group in groups.filter((g) => groupDisplayed(g.id).length)" :key="group.id" :colspan="groupDisplayed(group.id).length">
              {{ group.name }}<template v-if="groupMeta(group.id).target"> · 目标 {{ groupMeta(group.id).target }}</template>
            </th>
            <th class="notes-col">{{ notesCollapsed ? '复盘栏（折叠，悬停查看）' : '复盘栏' }}</th>
            <th class="action-col">操作</th>
          </tr>
          <tr class="column-head">
            <th></th>
            <th></th>
            <th v-for="column in activeColumns" :key="column.id">{{ column.name }}</th>
            <th></th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in filteredRows"
            :key="row.id"
            :class="{
              'study-row-today': row.date === getTodayText(),
              'locked-row': row.date ? isPastDate(row.date) : false,
            }"
          >
            <td class="date-col">
              <input
                type="date"
                class="ep-input date-input"
                :value="row.date"
                :disabled="Boolean(row.date) && isPastDate(row.date)"
                @change="onDateChange(row, ($event.target as HTMLInputElement).value)"
              />
            </td>
            <td class="duration-col">
              <input
                type="number"
                min="0"
                class="ep-input duration-input"
                :value="row.durationMinutes ?? ''"
                :disabled="row.date ? isPastDate(row.date) : false"
                @input="onDurationInput(row, ($event.target as HTMLInputElement).value)"
              />
            </td>
            <td v-for="column in activeColumns" :key="column.id" class="metric-cell">
              <template v-if="columns.some((c) => c.id === column.id)">
                <input
                  :class="['ep-input score-input', { 'score-danger': isNumericMetric(row.metrics[column.id]) && Number(row.metrics[column.id]) < LOW_SCORE_THRESHOLD }]"
                  maxlength="5"
                  :value="row.metrics[column.id] ?? ''"
                  :disabled="row.date ? isPastDate(row.date) : false"
                  @input="onMetricInput(row, column, ($event.target as HTMLInputElement).value)"
                  @blur="onMetricBlur(row, column)"
                />
              </template>
            </td>
            <td class="notes-col">
              <template v-if="!notesCollapsed">
                <div v-for="field in noteFields" :key="field.id" class="notes-editor-item">
                  <span class="notes-editor-label">{{ field.name }}</span>
                  <textarea
                    class="ep-input notes-textarea"
                    :value="row.notes[field.id] ?? ''"
                    :disabled="row.date ? isPastDate(row.date) : false"
                    @input="onNoteInput(row, field.id, ($event.target as HTMLTextAreaElement).value)"
                  ></textarea>
                </div>
              </template>
              <template v-else>
                <div class="dim">
                  {{ noteFields.filter((f) => (row.notes[f.id] || '').trim()).map((f) => `${f.name}✓`).join(' · ') || '无复盘内容' }}
                </div>
              </template>
            </td>
            <td class="action-col">
              <div class="row-action-buttons">
                <template v-if="row.date && isPastDate(row.date)">
                  <span class="row-lock-indicator" title="历史记录已锁定">🔒</span>
                  <span class="dim">均分 {{ rowAvg(row) }}</span>
                </template>
                <template v-else>
                  <span class="dim">均分 {{ rowAvg(row) }} · 未补齐 {{ incompleteText(row) }}</span>
                  <button class="ep-mini-btn" type="button" @click="copyRow(row)">复制</button>
                  <button class="ep-mini-btn danger" type="button" @click="removeRow(row)">删除</button>
                </template>
              </div>
            </td>
          </tr>
          <tr v-if="!filteredRows.length">
            <td :colspan="3 + activeColumns.length + 2" class="empty-row">没有符合条件的记录。</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 配置弹窗 -->
    <div v-if="showGroupConfig" class="modal-mask">
      <div class="modal-card">
        <div class="modal-head">
          <strong>分组与组项目</strong>
          <button class="ep-mini-btn" type="button" @click="showGroupConfig = false">✕</button>
        </div>
        <div class="modal-body">
          <div v-for="group in groups" :key="group.id" class="cfg-group">
            <div class="cfg-group-head">
              <input v-model="group.name" class="ep-input" style="width: 140px;" />
              <button v-if="group.id !== 'group-ungrouped'" class="ep-mini-btn danger" type="button" @click="removeGroup(group.id)">删除分组</button>
            </div>
            <div v-for="column in columns.filter((c) => c.groupId === group.id)" :key="column.id" class="cfg-col-row">
              <input v-model="column.name" class="ep-input" style="width: 110px;" />
              <select v-model="column.groupId" class="ep-input" style="width: 110px;">
                <option v-for="g in groups" :key="g.id" :value="g.id">{{ g.name }}</option>
              </select>
              <input v-model.number="column.targetValue" class="ep-input" type="number" min="0" max="100" style="width: 70px;" title="目标分" />
              <button class="ep-mini-btn danger" type="button" @click="removeColumn(column.id)">删列</button>
            </div>
          </div>
          <div class="cfg-add-row">
            <input v-model="newGroupName" class="ep-input" placeholder="新分组名" style="width: 140px;" @keyup.enter="addGroup" />
            <button class="ep-mini-btn" type="button" @click="addGroup">新增分组</button>
            <input v-model="newColumnName" class="ep-input" placeholder="新项目名" style="width: 140px;" @keyup.enter="addColumn" />
            <select v-model="newColumnGroup" class="ep-input" style="width: 120px;">
              <option v-for="g in groups" :key="g.id" :value="g.id">{{ g.name }}</option>
            </select>
            <button class="ep-mini-btn" type="button" @click="addColumn">新增项目</button>
          </div>
          <p class="dim">项目名与分组名可直接改名；目标分用于折线图虚线。</p>
        </div>
      </div>
    </div>

    <div v-if="showNoteFieldsConfig" class="modal-mask">
      <div class="modal-card">
        <div class="modal-head">
          <strong>复盘栏位</strong>
          <button class="ep-mini-btn" type="button" @click="showNoteFieldsConfig = false">✕</button>
        </div>
        <div class="modal-body">
          <div v-for="field in noteFields" :key="field.id" class="cfg-col-row">
            <input v-model="field.name" class="ep-input" style="width: 200px;" />
            <button class="ep-mini-btn danger" type="button" @click="removeNoteField(field.id)">删除栏位</button>
          </div>
          <div class="cfg-add-row">
            <input v-model="newNoteFieldName" class="ep-input" placeholder="新栏位名，如：心情" style="width: 220px;" @keyup.enter="addNoteField" />
            <button class="ep-mini-btn" type="button" @click="addNoteField">新增栏位</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ep-mini-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.78rem;
  color: var(--text-secondary, #556171);
  white-space: nowrap;
}

.core-table-wrapper {
  overflow-x: auto;
  background: rgba(255, 255, 255, 0.9);
  border-radius: 14px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  padding: 6px;
}

.core-table {
  width: 100%;
  min-width: 900px;
  border-collapse: collapse;
  font-size: 0.8rem;
}

.core-table th,
.core-table td {
  border: 1px solid rgba(15, 23, 42, 0.07);
  padding: 6px 8px;
  text-align: center;
}

.core-table thead th {
  background: linear-gradient(180deg, rgba(240, 246, 255, 0.9), rgba(234, 242, 255, 0.7));
  color: #334155;
  font-weight: 600;
}

.study-row-today > td {
  background: rgba(226, 240, 255, 0.6) !important;
}

.locked-row > td {
  color: #98a2b3;
}

.date-input,
.duration-input {
  width: 150px;
}

.duration-input {
  width: 90px;
}

.score-input {
  width: 76px;
  text-align: center;
}

.score-danger {
  color: #d70015;
}

.notes-textarea {
  width: 100%;
  min-height: 34px;
  resize: vertical;
}

.notes-editor-item {
  display: grid;
  grid-template-columns: 74px 1fr;
  gap: 6px;
  align-items: start;
  margin-bottom: 6px;
}

.notes-editor-label {
  color: #556171;
  font-size: 0.75rem;
  padding-top: 6px;
}

.dim {
  color: var(--text-secondary, #556171);
  font-size: 0.75rem;
}

.row-action-buttons {
  display: flex;
  gap: 5px;
  align-items: center;
  flex-wrap: wrap;
}

.empty-row {
  color: #98a2b3;
  padding: 18px;
}
.modal-mask {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 500;
}

.modal-card {
  width: min(620px, 92vw);
  max-height: 82vh;
  overflow: auto;
  background: #fff;
  border-radius: 16px;
  padding: 14px 16px;
}

.modal-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-body {
  margin-top: 10px;
  display: grid;
  gap: 10px;
}

.cfg-group-head,
.cfg-col-row,
.cfg-add-row {
  display: flex;
  gap: 6px;
  align-items: center;
  flex-wrap: wrap;
}

.cfg-group-head {
  font-weight: 600;
  margin-top: 4px;
}

.cfg-group {
  border-bottom: 1px dashed rgba(15, 23, 42, 0.1);
  padding-bottom: 8px;
}
</style>
