<script setup lang="ts">
/**
 * 词汇学习模块外壳 —— 结构复刻 legacy study_words.html：
 * .vocab-app（渐变底）> .shell > [.page-tabs | backup-banner | page-section* | footer-card]
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import { useVocabularyStore } from './stores/vocabulary'
import { library } from './data/library'
import { SESSION_MODE_LABELS } from './constants'
import './styles/legacy-full.css'
import OverviewPane from './components/OverviewPane.vue'
import StudyPane from './components/StudyPane.vue'
import DifficultPane from './components/DifficultPane.vue'
import SettingsDialog from './components/SettingsDialog.vue'

const store = useVocabularyStore()
const importFileInput = ref<HTMLInputElement | null>(null)

const heroModeStat = computed(() => {
  if (!store.session) return '待选择'
  return SESSION_MODE_LABELS[store.session.mode] ?? '待选择'
})

const heroSelection = computed(() => store.session?.label ?? '请选择一个组开始')

const heroDatasetStat = computed(() => (store.session?.items.length ? String(store.session.items.length) : String(library.totalWords)))

const savedBadgeVisible = computed(() => store.ui.savedFlash)
const updatedBadgeText = computed(() => {
  const last = store.data.backup.lastBackupAt
  return last ? `上次备份 ${new Date(last).toLocaleDateString()}` : '尚未开始'
})

function triggerImport() {
  importFileInput.value?.click()
}

async function onFilePicked(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) await store.importBackup(file)
  input.value = ''
}

const editableTag = (target: EventTarget | null) => {
  const el = target as HTMLElement | null
  if (!el) return false
  return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable
}

function onKeydown(event: KeyboardEvent) {
  if (!store.ready) return
  if ((event.ctrlKey || event.metaKey) && event.code === 'Space' && store.data.practice.mode === 'spell') {
    event.preventDefault()
    const word = store.currentWord
    if (word?.eng_sound) void store.speakWord(word, true)
    return
  }
  if (event.isComposing || editableTag(event.target)) return
  if (event.key === 'ArrowLeft') {
    event.preventDefault()
    store.moveRelative(-1, true)
  } else if (event.key === 'ArrowRight') {
    event.preventDefault()
    store.moveRelative(1, true)
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    const word = store.currentWord
    if (word) void store.speakWord(word, false, undefined, true)
  } else if (event.key === 'Enter') {
    event.preventDefault()
    store.moveRelative(1, true)
  } else if (event.key === ' ') {
    event.preventDefault()
    store.togglePlayback()
  }
}

onMounted(() => {
  if (!store.ready) void store.init()
  document.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown)
  store.stopPlayback(false)
})

function selectTab(tab: 'overview' | 'study' | 'difficult') {
  store.setActiveTab(tab)
}
</script>

<template>
  <div class="vocab-app" v-loading="!store.ready">
    <div class="shell">
      <!-- 顶栏：页签 + 状态 pills + 导入导出/设置 -->
      <section class="page-tabs glass">
        <div class="tab-row">
          <button class="tab-btn" :class="{ active: store.data.activeTab === 'overview' }" type="button" @click="selectTab('overview')">总览</button>
          <button class="tab-btn" :class="{ active: store.data.activeTab === 'study' }" type="button" @click="selectTab('study')">学习页</button>
          <button class="tab-btn" :class="{ active: store.data.activeTab === 'difficult' }" type="button" @click="selectTab('difficult')">难词页</button>
        </div>
        <div class="page-tabs-right">
          <div class="pill-row">
            <span class="pill" :title="store.session ? '当前会话词数' : '词库总词数'">{{ heroDatasetStat }}</span>
            <span class="pill">{{ heroModeStat }}</span>
            <span class="pill active">{{ heroSelection }}</span>
            <span v-if="store.ui.statusText" class="chip" :class="{ error: store.ui.statusError }">{{ store.ui.statusText }}</span>
          </div>
          <div class="top-actions">
            <button class="top-settings-btn" type="button" aria-label="打开设置" @click="store.ui.modalSettings = true">⚙</button>
            <button class="segment-btn" type="button" @click="triggerImport">导入记录</button>
            <button class="control-btn primary" type="button" @click="store.exportBackup">导出记录</button>
            <input ref="importFileInput" type="file" accept="application/json,.json" hidden @change="onFilePicked" />
          </div>
        </div>
      </section>

      <!-- 备份提醒 -->
      <section v-if="store.ui.hasBackupBanner" class="backup-banner glass">
        <div>
          <div class="section-label">Backup Reminder</div>
          <div class="backup-banner-text">备份时间已超过 7 天，请先导出学习记录。</div>
        </div>
        <div class="backup-actions">
          <button class="control-btn primary" type="button" @click="store.exportBackup">立即备份</button>
          <button class="segment-btn" type="button" @click="triggerImport">导入备份</button>
        </div>
      </section>

      <!-- 三个页签 -->
      <OverviewPane v-if="store.data.activeTab === 'overview'" />
      <StudyPane v-else-if="store.data.activeTab === 'study'" />
      <DifficultPane v-else-if="store.data.activeTab === 'difficult'" />

      <!-- 页脚 -->
      <section class="footer-card glass">
        <p class="footer-copy">
          学习计数、当前组位置、显示状态、播放设置、难词列表全部保存在浏览器。所有数据可随时导出备份 JSON。
        </p>
        <div class="pill-row">
          <span v-if="savedBadgeVisible" class="chip active">✓ 已保存到浏览器</span>
          <span v-else class="chip">已自动保存</span>
          <span class="chip">{{ updatedBadgeText }}</span>
        </div>
      </section>
    </div>

    <SettingsDialog />
  </div>
</template>
