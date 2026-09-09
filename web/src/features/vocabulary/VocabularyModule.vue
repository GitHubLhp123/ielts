<script setup lang="ts">
/**
 * 词汇学习模块外壳 —— 顶栏（tab / 模式 / 状态 / 备份与设置入口）+ 内容面板。
 * 装载时初始化 store（load → hydrate → 初始会话）。
 */
import { onBeforeUnmount, onMounted } from 'vue'

import { useVocabularyStore } from './stores/vocabulary'
import { MODE_LABELS } from './constants'
import './styles/legacy-theme.css'
import OverviewPane from './components/OverviewPane.vue'
import StudyPane from './components/StudyPane.vue'
import DifficultPane from './components/DifficultPane.vue'
import SettingsDialog from './components/SettingsDialog.vue'

const store = useVocabularyStore()

onMounted(() => {
  if (!store.ready) void store.init()
  document.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown)
  store.stopPlayback(false)
})

const editableTag = (target: EventTarget | null) => {
  const el = target as HTMLElement | null
  if (!el) return false
  return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable
}

function onKeydown(event: KeyboardEvent) {
  if (!store.ready) return
  const inEditable = editableTag(event.target)
  // spell 模式下 Ctrl/Cmd+Space 重听（任意焦点，最优先）
  if ((event.ctrlKey || event.metaKey) && event.code === 'Space' && store.data.practice.mode === 'spell') {
    event.preventDefault()
    const word = store.currentWord
    if (word?.eng_sound) void store.speakWord(word, true)
    return
  }
  if (event.isComposing) return
  if (inEditable) return
  const key = event.key
  if (key === 'ArrowLeft') {
    event.preventDefault()
    store.moveRelative(-1, true)
  } else if (key === 'ArrowRight') {
    event.preventDefault()
    store.moveRelative(1, true)
  } else if (key === 'ArrowUp') {
    event.preventDefault()
    const word = store.currentWord
    if (word) void store.speakWord(word, false, undefined, true)
  } else if (key === 'Enter') {
    event.preventDefault()
    store.moveRelative(1, true)
  } else if (key === ' ') {
    event.preventDefault()
    store.togglePlayback()
  }
}
</script>

<template>
  <div class="vocab vocab-app" v-loading="!store.ready">
    <el-alert
      v-if="store.ui.hasBackupBanner"
      type="warning"
      show-icon
      title="距离上次备份已超过 7 天"
      description="建议及时导出备份，避免本地数据丢失。"
      class="backup-banner"
      :closable="false"
    />

    <el-card shadow="never" class="toolbar panel">
      <div class="toolbar-row">
        <el-radio-group :model-value="store.data.activeTab" size="small" @update:model-value="store.setActiveTab($event)">
          <el-radio-button value="overview">总览</el-radio-button>
          <el-radio-button value="study">学习页</el-radio-button>
          <el-radio-button value="difficult">难词页</el-radio-button>
        </el-radio-group>

        <el-button-group class="mode-group">
          <el-button
            size="small"
            :type="store.data.practice.mode === 'standard' ? 'primary' : 'default'"
            @click="store.setPracticeMode('standard')"
          >
            单词模式
          </el-button>
          <el-button
            size="small"
            :type="store.data.practice.mode === 'quiz' ? 'primary' : 'default'"
            @click="store.setPracticeMode('quiz')"
          >
            选中文
          </el-button>
          <el-button
            size="small"
            :type="store.data.practice.mode === 'spell' ? 'primary' : 'default'"
            @click="store.setPracticeMode('spell')"
          >
            拼写模式
          </el-button>
        </el-button-group>

        <div class="spacer" />

        <div class="status-area">
          <span v-if="store.data.practice.autoRunning" class="pill running">● 自动播放中</span>
          <span v-if="store.ui.savedFlash" class="pill saved">✓ 已保存到浏览器</span>
          <span v-if="store.ui.statusText" class="pill status" :class="{ error: store.ui.statusError }">{{ store.ui.statusText }}</span>
          <el-button size="small" circle title="设置与备份" @click="store.ui.modalSettings = true">
            <el-icon><Setting /></el-icon>
          </el-button>
        </div>
      </div>
      <div class="toolbar-sub dim">
        {{ store.session ? `${store.session.label} · ${MODE_LABELS[store.data.practice.mode]}` : '未选择内容' }}
      </div>
    </el-card>

    <OverviewPane v-if="store.data.activeTab === 'overview'" />
    <StudyPane v-else-if="store.data.activeTab === 'study'" />
    <DifficultPane v-else-if="store.data.activeTab === 'difficult'" />

    <SettingsDialog />
  </div>
</template>

<style scoped>
/* .vocab 负责全幅渐变底（见 legacy-theme.css 中 .vocab-app）；内容容器由各 pane 限宽 */
.vocab {
  width: auto;
}

.backup-banner {
  margin-bottom: 10px;
  border-radius: 8px;
}

.toolbar {
  border-radius: 10px;
  margin-bottom: 12px;
}

.toolbar-row {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.mode-group {
  margin-left: 4px;
}

.spacer {
  flex: 1;
}

.status-area {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.pill {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 999px;
  background: #f0f2f5;
  color: #606266;
}

.pill.running {
  background: #ecf5ff;
  color: #1473ff;
}

.pill.saved {
  background: #e8f8f0;
  color: #17b26a;
}

.pill.status.error {
  background: #fef0f0;
  color: #f56c6c;
}

.toolbar-sub {
  margin-top: 6px;
}

.dim {
  color: #909399;
  font-size: 12px;
}
</style>
