<script setup lang="ts">
/**
 * 记账本（tab=accounting）—— 忠实还原 legacy accounting pane（核心：录入/类别/明细/月历/周期草稿）。
 * 统计图（周/月/类别）在图表轮接入。
 */
import { computed, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'

const props = defineProps<{ state: any }>()
const st = computed(() => props.state)

const DEFAULT_CATEGORIES = ['餐饮', '早餐', '午餐', '晚餐', '咖啡茶饮', '水果零食', '交通', '打车', '地铁公交', '共享单车', '加油停车', '学习', '书籍', '课程', '订阅', '办公文具', '房租水电', '物业', '水电网燃气', '话费宽带', '其他']

interface Entry {
  id: string
  time: string // yyyy-MM-dd
  amount: number | null
  item: string
  category: string
  reason: string
  isDraft: boolean
  generatedFromRuleId?: string
}

interface Rule {
  id: string
  dayOfMonth: number
  amount: number | null
  item: string
  category: string
  reason: string
}

const visibleCount = computed({
  get: () => Number(st.value.bookkeepingVisibleCount) || 10,
  set: (v: number) => {
    st.value.bookkeepingVisibleCount = v
  },
})

const categories = computed<string[]>(() => st.value.bookkeepingCategories ?? [])
const entries = computed<Entry[]>(() => st.value.bookkeepingEntries ?? [])
const rules = computed<Rule[]>(() => st.value.recurringRules ?? [])

const selectedDate = computed({
  get: () => {
    const raw = st.value.selectedAccountingDate
    const date = raw ? new Date(raw) : new Date()
    return formatDate(date)
  },
  set: (v: string) => {
    st.value.selectedAccountingDate = v
  },
})

const monthText = computed({
  get: () => (selectedDate.value ? selectedDate.value.slice(0, 7) : todayText().slice(0, 7)),
  set: (v: string) => {
    // 保持同月 1 日或当天
    const day = selectedDate.value ? selectedDate.value.slice(8) : String(new Date().getDate()).padStart(2, '0')
    const chosen = `${v}-${day}`
    if (new Date(chosen + 'T00:00:00').getDate() === Number(day)) st.value.selectedAccountingDate = chosen
    else st.value.selectedAccountingDate = `${v}-01`
  },
})

function formatDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function todayText(): string {
  return formatDate(new Date())
}

function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

/* 类别 */
function ensureDefaultCategories() {
  if (!Array.isArray(categories.value) || categories.value.length === 0) {
    st.value.bookkeepingCategories = [...DEFAULT_CATEGORIES]
  }
}

const newCategory = ref('')

function addCategory() {
  const name = String(newCategory.value).trim()
  if (!name) return
  if (categories.value.includes(name)) {
    ElMessage.warning('类别已存在')
    return
  }
  st.value.bookkeepingCategories = [...categories.value, name]
  newCategory.value = ''
}

async function removeCategory(category: string) {
  const used = entries.value.filter((e) => e.category === category).length + rules.value.filter((r) => r.category === category).length
  if (used) {
    const ok = await ElMessageBox.confirm(`「${category}」仍被 ${used} 条记录/规则使用，删除会一并清空它们的类别，继续吗？`, '提示', {
      confirmButtonText: '确定',
      type: 'warning',
    }).catch(() => false)
    if (!ok) return
  }
  st.value.bookkeepingCategories = categories.value.filter((c) => c !== category)
  for (const e of entries.value) {
    if (e.category === category) e.category = ''
  }
  for (const r of rules.value) {
    if (r.category === category) r.category = ''
  }
}

/* 表单 */
const form = ref({ amount: null as number | null, item: '', category: '', reason: '' })

function addEntry() {
  const amount = form.value.amount
  const item = String(form.value.item).trim()
  if (amount === null || amount === undefined || !Number.isFinite(Number(amount)) || Number(amount) <= 0) {
    ElMessage.warning('请输入有效的金额')
    return
  }
  if (!item) {
    ElMessage.warning('请输入事项')
    return
  }
  let category = String(form.value.category).trim()
  if (category && !categories.value.includes(category)) {
    st.value.bookkeepingCategories = [...categories.value, category]
  }
  if (!category) category = '未分类'
  entries.value.unshift({
    id: createId('bk'),
    time: selectedDate.value,
    amount: Number(amount),
    item,
    category,
    reason: String(form.value.reason || '').trim(),
    isDraft: false,
  })
  form.value = { amount: null, item: '', category: '', reason: '' }
  ElMessage.success('已记录')
}

/* 明细 */
const sortedEntries = computed(() => [...entries.value].sort((a, b) => b.time.localeCompare(a.time)))
const visibleEntries = computed(() => sortedEntries.value.slice(0, visibleCount.value))

function loadMore() {
  visibleCount.value += 10
}

async function removeEntry(entry: Entry) {
  if (entry.time < todayText()) {
    const ok = await ElMessageBox.confirm('这是一条历史记录，确定删除吗？', '提示', { confirmButtonText: '确定', type: 'warning' }).catch(() => false)
    if (!ok) return
  }
  const index = entries.value.findIndex((e) => e.id === entry.id)
  if (index !== -1) entries.value.splice(index, 1)
}

function confirmDraft(entry: Entry) {
  entry.isDraft = false
  ElMessage.success('已确认为正式记录')
}

/* 汇总 */
const totalAmount = computed(() => entries.value.reduce((sum, e) => sum + (Number(e.amount) || 0), 0))
const currentMonthAmount = computed(() =>
  entries.value.filter((e) => e.time.startsWith(monthText.value)).reduce((sum, e) => sum + (Number(e.amount) || 0), 0),
)
const currentMonthCount = computed(() => entries.value.filter((e) => e.time.startsWith(monthText.value)).length)
const selectedDateEntries = computed(() =>
  sortedEntries.value.filter((e) => e.time === selectedDate.value),
)
const selectedDateTotal = computed(() => selectedDateEntries.value.reduce((sum, e) => sum + (Number(e.amount) || 0), 0))

/* 月历 */
interface CalendarDay {
  key: string
  day: number
  inMonth: boolean
  spend: number
  count: number
  isToday: boolean
  isSelected: boolean
}

const calendarDays = computed<CalendarDay[]>(() => {
  const [year, mon] = monthText.value.split('-').map(Number)
  const daysInMonth = new Date(year, mon, 0).getDate()
  const firstWeekday = new Date(year, mon - 1, 1).getDay() // 0=周日
  const result: CalendarDay[] = []
  for (let i = 0; i < firstWeekday; i += 1) {
    result.push({ key: `pad-${i}`, day: 0, inMonth: false, spend: 0, count: 0, isToday: false, isSelected: false })
  }
  const dayMap = new Map<string, { spend: number; count: number }>()
  for (const e of entries.value) {
    if (!e.time.startsWith(monthText.value)) continue
    const cur = dayMap.get(e.time) ?? { spend: 0, count: 0 }
    cur.spend += Number(e.amount) || 0
    cur.count += 1
    dayMap.set(e.time, cur)
  }
  const today = todayText()
  for (let d = 1; d <= daysInMonth; d += 1) {
    const key = `${monthText.value}-${String(d).padStart(2, '0')}`
    const info = dayMap.get(key)
    result.push({
      key,
      day: d,
      inMonth: true,
      spend: info?.spend ?? 0,
      count: info?.count ?? 0,
      isToday: key === today,
      isSelected: key === selectedDate.value,
    })
  }
  return result
})

/* 周期规则 */
const ruleForm = ref({ dayOfMonth: 1, amount: null as number | null, item: '', category: '', reason: '' })

function getRecurringTargetDate(rule: Rule, month: string): string {
  const day = String(rule.dayOfMonth).padStart(2, '0')
  return `${month}-${day}`
}

function ensureDraftsForMonth(month: string) {
  for (const rule of rules.value) {
    const target = getRecurringTargetDate(rule, month)
    if (entries.value.some((e) => e.generatedFromRuleId === rule.id && e.time === target)) continue
    entries.value.push({
      id: createId('bk-draft'),
      time: target,
      amount: Number(rule.amount) || null,
      item: rule.item,
      category: rule.category,
      reason: rule.reason,
      isDraft: true,
      generatedFromRuleId: rule.id,
    })
  }
}

function addRule() {
  const amount = ruleForm.value.amount
  const item = String(ruleForm.value.item).trim()
  if (amount === null || amount === undefined || !Number.isFinite(Number(amount)) || Number(amount) <= 0) {
    ElMessage.warning('请输入有效的金额')
    return
  }
  if (!item) {
    ElMessage.warning('请输入事项')
    return
  }
  let day = Math.round(Number(ruleForm.value.dayOfMonth))
  if (!Number.isFinite(day)) day = 1
  day = Math.min(28, Math.max(1, day))
  const rule: Rule = {
    id: createId('rule'),
    dayOfMonth: day,
    amount: Number(amount),
    item,
    category: String(ruleForm.value.category || '').trim() || '未分类',
    reason: String(ruleForm.value.reason || '').trim(),
  }
  if (rule.category && !categories.value.includes(rule.category)) {
    st.value.bookkeepingCategories = [...categories.value, rule.category]
  }
  st.value.recurringRules = [...rules.value, rule]
  ensureDraftsForMonth(monthText.value)
  ruleForm.value = { dayOfMonth: 1, amount: null, item: '', category: '', reason: '' }
  ElMessage.success(`已创建每月 ${day} 日周期规则`)
}

async function removeRule(rule: Rule) {
  const ok = await ElMessageBox.confirm('删除该周期规则会同时删除其未确认草稿，继续吗？', '提示', { confirmButtonText: '确定', type: 'warning' }).catch(() => false)
  if (!ok) return
  st.value.recurringRules = rules.value.filter((r) => r.id !== rule.id)
  st.value.bookkeepingEntries = entries.value.filter((e) => !(e.generatedFromRuleId === rule.id && e.isDraft))
}

ensureDefaultCategories()
if (typeof st.value.selectedAccountingDate !== 'string' || !st.value.selectedAccountingDate) {
  st.value.selectedAccountingDate = todayText()
}
ensureDraftsForMonth(monthText.value)
</script>

<template>
  <div class="tab-pane-block accounting-layout">
    <!-- 汇总 -->
    <div class="accounting-summary">
      <div class="stats-card overview-card">
        <div class="stats-label">累计支出</div>
        <div class="stats-value">{{ totalAmount.toFixed(2) }}</div>
        <div class="stats-sub">全部记账</div>
      </div>
      <div class="stats-card overview-card">
        <div class="stats-label">本月支出（{{ monthText }}）</div>
        <div class="stats-value">{{ currentMonthAmount.toFixed(2) }}</div>
        <div class="stats-sub">{{ currentMonthCount }} 笔</div>
      </div>
      <div class="stats-card overview-card">
        <div class="stats-label">选中日 {{ selectedDate }}</div>
        <div class="stats-value">{{ selectedDateTotal.toFixed(2) }}</div>
        <div class="stats-sub">{{ selectedDateEntries.length }} 笔 · 点击下方日历切换</div>
      </div>
    </div>

    <!-- 类别管理 -->
    <div class="section-card">
      <div class="toolbar">
        <div>
          <div class="toolbar-title">类别管理</div>
          <div class="toolbar-note">新增类别会自动进入下拉；删除类别会清空关联记录/规则上的类别。</div>
        </div>
      </div>
      <div class="category-manager" style="margin-top: 10px;">
        <input v-model="newCategory" class="ep-input" placeholder="新类别名称" style="width: 200px;" @keyup.enter="addCategory" />
        <button class="ep-mini-btn primary" type="button" @click="addCategory">新增类别</button>
        <div class="ep-tag-row">
          <span v-for="c in categories" :key="c" class="ep-tag cat-tag">
            {{ c }}
            <span class="cat-remove" @click="removeCategory(c)">✕</span>
          </span>
          <span v-if="!categories.length" class="dim">暂无类别，使用下方录入会自动新建</span>
        </div>
      </div>
    </div>

    <!-- 录入 -->
    <div class="section-card">
      <div class="toolbar">
        <div>
          <div class="toolbar-title">新增支出</div>
          <div class="toolbar-note">日期取上方日历选中日（当前 {{ selectedDate }}）。</div>
        </div>
      </div>
      <div class="accounting-form-row" style="margin-top: 10px; display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
        <input v-model.number="form.amount" class="ep-input" type="number" min="0" step="0.01" placeholder="金额" style="width: 110px;" />
        <input v-model="form.item" class="ep-input" placeholder="事项" style="width: 170px;" />
        <input v-model="form.category" class="ep-input" list="category-options" placeholder="类别" style="width: 150px;" />
        <datalist id="category-options">
          <option v-for="c in categories" :key="c" :value="c" />
        </datalist>
        <input v-model="form.reason" class="ep-input" placeholder="原因（可选）" style="width: 180px;" />
        <button class="ep-mini-btn primary" type="button" @click="addEntry">记一笔</button>
      </div>
    </div>

    <!-- 明细表 -->
    <div class="section-card">
      <div class="toolbar">
        <div>
          <div class="toolbar-title">明细（按日期倒序）</div>
          <div class="toolbar-note">草稿行来自周期规则，可确认或删除。</div>
        </div>
        <div class="toolbar-actions"><span class="dim">显示 {{ visibleEntries.length }} / {{ entries.length }}</span></div>
      </div>
      <table class="core-table bk-table">
        <thead>
          <tr>
            <th>日期</th>
            <th>金额</th>
            <th>事项</th>
            <th>类别</th>
            <th>原因</th>
            <th>状态</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="entry in visibleEntries" :key="entry.id" :class="{ 'bk-draft': entry.isDraft }">
            <td><input v-model="entry.time" class="ep-input bk-input" type="date" /></td>
            <td><input v-model.number="entry.amount" class="ep-input bk-input" type="number" step="0.01" /></td>
            <td><input v-model="entry.item" class="ep-input bk-input" placeholder="事项" /></td>
            <td>
              <input v-model="entry.category" class="ep-input bk-input" list="category-options" />
            </td>
            <td><input v-model="entry.reason" class="ep-input bk-input" placeholder="原因" /></td>
            <td>
              <span v-if="entry.isDraft" class="ep-tag type-低">草稿</span>
              <span v-else class="ep-tag type-中">已确认</span>
            </td>
            <td>
              <button v-if="entry.isDraft" class="ep-mini-btn primary" type="button" @click="confirmDraft(entry)">确认</button>
              <button class="ep-mini-btn danger" type="button" @click="removeEntry(entry)">删除</button>
            </td>
          </tr>
          <tr v-if="!visibleEntries.length"><td colspan="7" class="empty-row">还没有记账记录。</td></tr>
        </tbody>
      </table>
      <div style="margin-top: 8px; text-align: center;">
        <button v-if="visibleEntries.length < entries.length" class="ep-mini-btn" type="button" @click="loadMore">加载更多（+10）</button>
      </div>
    </div>

    <!-- 月历 + 周期规则 -->
    <div class="accounting-lower">
      <div class="section-card">
        <div class="toolbar">
          <div>
            <div class="toolbar-title">月历</div>
            <div class="toolbar-note">点击日期查看当日支出；底部为选中日明细。</div>
          </div>
          <input v-model="monthText" class="ep-input" type="month" style="width: 150px;" />
        </div>
        <div class="calendar-grid">
          <span v-for="w in ['日', '一', '二', '三', '四', '五', '六']" :key="w" class="cal-week">周{{ w }}</span>
          <button
            v-for="cell in calendarDays"
            :key="cell.key"
            type="button"
            class="cal-day"
            :class="{ selected: cell.isSelected, today: cell.isToday, outside: !cell.inMonth }"
            :disabled="!cell.inMonth"
            @click="selectedDate = cell.key"
          >
            <span class="cal-day-num">{{ cell.day || '' }}</span>
            <span v-if="cell.inMonth && cell.count" class="cal-day-spend">￥{{ cell.spend.toFixed(1) }}</span>
            <span v-else-if="cell.inMonth" class="cal-day-spend dim">—</span>
            <span v-if="cell.inMonth && cell.count" class="cal-day-count">{{ cell.count }} 笔</span>
          </button>
        </div>
        <div class="dim" style="margin-top: 8px;">
          {{ monthText }} 合计 {{ currentMonthAmount.toFixed(2) }} 元 · {{ currentMonthCount }} 笔
        </div>
      </div>

      <div class="section-card">
        <div class="toolbar">
          <div>
            <div class="toolbar-title">周期规则</div>
            <div class="toolbar-note">每月固定支出自动生成草稿（如房租/订阅）。</div>
          </div>
        </div>
        <div class="accounting-form-row" style="margin-top: 10px; display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
          <span class="dim">每月</span>
          <input v-model.number="ruleForm.dayOfMonth" class="ep-input" type="number" min="1" max="28" style="width: 70px;" />
          <span class="dim">日</span>
          <input v-model.number="ruleForm.amount" class="ep-input" type="number" step="0.01" placeholder="金额" style="width: 110px;" />
          <input v-model="ruleForm.item" class="ep-input" placeholder="事项" style="width: 150px;" />
          <input v-model="ruleForm.category" class="ep-input" list="category-options" placeholder="类别" style="width: 130px;" />
          <button class="ep-mini-btn primary" type="button" @click="addRule">新增规则</button>
        </div>
        <div v-if="rules.length" class="rule-list">
          <div v-for="rule in rules" :key="rule.id" class="rule-item">
            <span class="dim">每月 {{ rule.dayOfMonth }} 日</span>
            <strong>{{ rule.item }}</strong>
            <span class="dim">￥{{ Number(rule.amount || 0).toFixed(2) }} · {{ rule.category }}</span>
            <button class="ep-mini-btn danger" type="button" @click="removeRule(rule)">删除</button>
          </div>
        </div>
        <div v-else class="dim" style="margin-top: 8px;">暂无周期规则。</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.accounting-layout {
  display: grid;
  gap: 12px;
}

.accounting-summary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 10px;
}

.section-card {
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: 16px;
  padding: 14px 16px;
}

.ep-mini-label,
.dim {
  color: var(--text-secondary, #556171);
  font-size: 0.76rem;
}

.ep-input {
  padding: 7px 9px;
  border-radius: 9px;
  border: 1px solid rgba(15, 23, 42, 0.1);
  background: #fff;
  font: inherit;
  outline: none;
}

.ep-input:focus {
  border-color: rgba(20, 115, 255, 0.5);
  box-shadow: 0 0 0 3px rgba(20, 115, 255, 0.1);
}

.ep-mini-btn {
  border: 1px solid rgba(15, 23, 42, 0.12);
  background: #fff;
  border-radius: 9px;
  padding: 6px 12px;
  cursor: pointer;
  font-size: 0.82rem;
}

.ep-mini-btn.primary {
  color: #fff;
  border: none;
  background: linear-gradient(180deg, #2e90ff, #1677ff);
}

.ep-mini-btn.danger {
  color: #d70015;
  border-color: rgba(215, 0, 21, 0.25);
}

.ep-tag-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}

.ep-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.75rem;
  padding: 3px 10px;
  border-radius: 999px;
  background: #eef2f6;
  color: #556171;
}

.ep-tag.type-高 { background: rgba(215, 0, 21, 0.1); color: #d70015; }
.ep-tag.type-中 { background: rgba(241, 181, 61, 0.16); color: #b7791f; }
.ep-tag.type-低 { background: #eef2f6; color: #556171; }

.cat-remove {
  cursor: pointer;
  opacity: 0.6;
  margin-left: 2px;
}

.cat-remove:hover {
  opacity: 1;
}

.bk-table {
  margin-top: 10px;
}

.core-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.8rem;
}

.core-table th,
.core-table td {
  border: 1px solid rgba(15, 23, 42, 0.07);
  padding: 6px;
}

.core-table thead th {
  background: linear-gradient(180deg, rgba(240, 246, 255, 0.9), rgba(234, 242, 255, 0.7));
  color: #334155;
  font-weight: 600;
}

.bk-input {
  width: 100%;
  min-width: 70px;
}

.bk-draft > td {
  background: rgba(255, 244, 214, 0.5);
}

.empty-row {
  text-align: center;
  color: #98a2b3;
  padding: 16px;
}

.accounting-lower {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 5px;
  margin-top: 10px;
}

.cal-week {
  text-align: center;
  font-size: 0.72rem;
  color: var(--text-secondary, #556171);
  padding: 4px 0;
}

.cal-day {
  border: 1px solid rgba(15, 23, 42, 0.07);
  background: #fff;
  border-radius: 9px;
  padding: 6px 4px;
  min-height: 58px;
  cursor: pointer;
  display: grid;
  gap: 2px;
  align-content: start;
}

.cal-day.outside {
  background: rgba(255, 255, 255, 0.4);
  visibility: hidden;
}

.cal-day.today {
  border-color: rgba(20, 115, 255, 0.6);
}

.cal-day.selected {
  box-shadow: 0 0 0 2px rgba(20, 115, 255, 0.55);
}

.cal-day-num {
  font-size: 0.78rem;
  color: #334155;
}

.cal-day-spend {
  font-size: 0.68rem;
  color: #b7791f;
}

.cal-day-count {
  font-size: 0.62rem;
  color: #98a2b3;
}

.rule-list {
  margin-top: 10px;
  display: grid;
  gap: 6px;
}

.rule-item {
  display: flex;
  align-items: center;
  gap: 10px;
  border: 1px solid rgba(15, 23, 42, 0.07);
  background: rgba(255, 255, 255, 0.85);
  border-radius: 10px;
  padding: 8px 10px;
  font-size: 0.85rem;
}

@media (max-width: 900px) {
  .accounting-lower {
    grid-template-columns: 1fr;
  }
}
</style>
