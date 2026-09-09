<script setup lang="ts">
/**
 * 学习页 —— 组合库导航 / 预设词源 / 搜索 / 练习工作台 / 队列预览。
 */
import { computed, nextTick, onMounted, onBeforeUnmount, ref, watch } from 'vue'

import { useVocabularyStore } from '../stores/vocabulary'
import { library } from '../data/library'
import { resolveSynonymGroups } from '../data/synonyms'
import { getWordSourceFlags, buildWordSourceLabels } from '../data/sources'
import { getSearchResults, hasSearchFilters } from '../domain/search'
import { resolveCorpusMatches, getCorpusWordLookup } from '../data/corpus'
import { formatReviewDueText, normalizeLexeme } from '../utils'
import type { SessionWord, VocabWord, CorpusItem } from '../types'

const store = useVocabularyStore()

/* ---------- 库导航 ---------- */
const chapterNames = computed(() => library.chapters.map((c) => c.chapter))
const chapterGroups = computed(() => {
  const chapter = library.chapters.find((c) => c.chapter === store.data.selectedLibraryChapter)
  return chapter?.groups ?? library.chapters[0]?.groups ?? []
})

/* ---------- 预设词源 ---------- */
const presetCounts = computed(() => ({
  reading538: store.presetSourceWords('reading538').length,
  listening179: store.presetSourceWords('listening179').length,
  core: store.presetSourceWords('core').length,
}))

/** 语料词源计数（懒加载后填充） */
const corpusPresetCount = ref<number | null>(null)
async function refreshCorpusPresetCount() {
  await store.ensureCorpus()
  const lookup = await getCorpusWordLookup()
  corpusPresetCount.value = library.allWords.filter((w) => lookup.has(normalizeLexeme(w.word))).length
}

/* ---------- 搜索 ---------- */
const searchQuery = computed({
  get: () => store.data.searchQuery,
  set: (v: string) => {
    store.data.searchQuery = v
  },
})
const searchAssist = computed({
  get: () => store.data.searchAssistQuery,
  set: (v: string) => {
    store.data.searchAssistQuery = v
  },
})
const searchChapter = computed({
  get: () => store.data.searchChapterFilter,
  set: (v: string) => {
    store.data.searchChapterFilter = v
  },
})
const hasFilters = computed(() => hasSearchFilters(searchQuery.value, searchChapter.value, searchAssist.value))
const searchResults = computed(() => (hasFilters.value ? getSearchResults(searchQuery.value, searchChapter.value, searchAssist.value) : []))
const searchPreview = computed(() => searchResults.value.slice(0, 24))

function clearSearch() {
  store.data.searchQuery = ''
  store.data.searchAssistQuery = ''
  store.data.searchChapterFilter = 'all'
}

/* ---------- 当前词 ---------- */
const word = computed(() => store.currentWord)
const flags = computed(() => getWordSourceFlags(word.value ?? {}))
const sourceLabels = computed(() => buildWordSourceLabels(flags.value))
const difficultEntry = computed(() => (word.value ? store.data.difficultWords[word.value.key] : undefined))
const isMastered = computed(() => (word.value ? Boolean(store.data.wordStats[word.value.key]?.mastered) : false))
const stat = computed(() => (word.value ? store.data.wordStats[word.value.key] : undefined))
const mode = computed(() => store.data.practice.mode)
const currentTotal = computed(() => {
  const session = store.session
  if (!session) return 0
  return session.items.length
})
const revealMeaning = computed(() => mode.value === 'standard' || (mode.value === 'quiz' && store.data.practice.quiz.answered))
const revealWord = computed(() => mode.value !== 'spell' && store.data.practice.showWord)

const synonymGroups = computed(() => {
  if (!word.value || !store.data.settings.showSynonym) return []
  const enabled = store.data.settings.enabledSynonymSources
  return resolveSynonymGroups(word.value.word, enabled).map((group) => ({
    id: group.id,
    source: group.source,
    terms: group.terms.map((term) => {
      const matched =
        library.allWords.find(
          (w) => w.key !== word.value!.key && w.word.toLowerCase() === term.displayWord.toLowerCase(),
        ) ?? null
      return { ...term, matched }
    }),
  }))
})

const queuePreview = computed(() => {
  const session = store.session
  if (!session?.items.length) return [] as { word: string; subtitle: string; current: boolean }[]
  const items = session.items as SessionWord[]
  const ordered = [items[session.currentIndex], ...items.filter((_, i) => i !== session.currentIndex)]
  return ordered.slice(0, 40).map((item, pos) => {
    const isCurrent = pos === 0
    const learned = (store.data.wordStats[item.key]?.count || 0) > 0
    return {
      word: item.word,
      subtitle: isCurrent
        ? '当前激活'
        : `${item.chapter}·${item.group} 第 ${item.wordIndex + 1} 词${learned ? ' · 已学' : ''}`,
      current: isCurrent,
    }
  })
})

function speakWord(wordArg: SessionWord | VocabWord) {
  void store.speakWord(wordArg, false, undefined, true)
}

/* ---------- spell ---------- */
const spellInput = ref('')
const spellInputRef = ref<{ focus?: () => void } | null>(null)

function submitSpell() {
  store.submitSpellAnswer(spellInput.value)
  spellInput.value = ''
  // 答对会自动前进到新词；保持拼写输入焦点便于连续作答
  const el = document.activeElement as HTMLElement | null
  if (el?.tagName === 'INPUT') void nextTick(() => el.focus())
}

function replaySpell() {
  if (word.value?.eng_sound) void store.speakWord(word.value, true)
}

/** 拼写模式下自动聚焦输入框（legacy renderSpellPanel 行为） */
watch(
  () => [mode.value === 'spell', word.value?.key] as const,
  ([inSpell]) => {
    if (inSpell) void nextTick(() => spellInputRef.value?.focus?.())
  },
  { flush: 'post' },
)

/* ---------- 听力语料匹配卡（懒加载） ---------- */
const corpusMatches = ref<CorpusItem[]>([])
let corpusWatchActive = true

async function refreshCorpusMatches() {
  const currentWord = word.value
  if (!currentWord || !store.data.settings.showListeningCorpus || !corpusWatchActive) {
    corpusMatches.value = []
    return
  }
  await store.ensureCorpus()
  if (!corpusWatchActive || word.value?.key !== currentWord.key) return
  corpusMatches.value = await resolveCorpusMatches(currentWord.word, 24)
}

onMounted(() => {
  void store.ensureCorpus()
  if (store.data.settings.showListeningCorpus) {
    void refreshCorpusPresetCount()
  }
})

onBeforeUnmount(() => {
  corpusWatchActive = false
})

watch(
  () => [word.value?.key, store.data.settings.showListeningCorpus] as const,
  ([, showCorpus]) => {
    corpusMatches.value = []
    if (showCorpus && corpusPresetCount.value === null) void refreshCorpusPresetCount()
    void refreshCorpusMatches()
  },
  { flush: 'post' },
)

/* ---------- 起始序号跳转 ---------- */
const startIndexInput = ref('')
function jumpToStartIndex() {
  const value = Number(startIndexInput.value.trim())
  if (!Number.isFinite(value) || value < 1) {
    store.setStatus('请输入 ≥1 的序号', true)
    return
  }
  store.jumpToIndex(value)
}
</script>

<template>
  <div class="study">
    <el-row :gutter="12">
      <el-col :md="17" :xs="24">
        <!-- 库导航 / 预设 / 搜索 -->
        <el-card shadow="never" class="panel">
          <div class="library-bar">
            <b>词库导航</b>
            <el-select v-model="store.data.selectedLibraryChapter" size="small" class="chapter-select" @change="store.setGroupSession(chapterGroups[0]?.id ?? '', true)">
              <el-option v-for="c in chapterNames" :key="c" :value="c" :label="c" />
            </el-select>
            <el-select v-model="store.data.selectedGroupId" size="small" class="group-select" @change="store.setGroupSession($event, true)">
              <el-option v-for="g in chapterGroups" :key="g.id" :value="g.id" :label="`${g.group}（${g.words.length}）`" />
            </el-select>
          </div>

          <div class="preset-row">
            <el-button size="small" :disabled="!presetCounts.reading538" @click="store.startPresetSourcePractice('reading538')">
              学习阅读538 ({{ presetCounts.reading538 }})
            </el-button>
            <el-button size="small" :disabled="!presetCounts.listening179" @click="store.startPresetSourcePractice('listening179')">
              学习听力179 ({{ presetCounts.listening179 }})
            </el-button>
            <el-button size="small" :disabled="!presetCounts.core" @click="store.startPresetSourcePractice('core')">
              学习核心词汇 ({{ presetCounts.core }})
            </el-button>
            <el-button
              size="small"
              :disabled="!store.data.settings.showListeningCorpus || !(corpusPresetCount ?? 0)"
              @click="store.startPresetSourcePractice('listeningCorpus')"
            >
              学习听力语料词 {{ corpusPresetCount === null ? '（加载中…）' : `(${corpusPresetCount})` }}
            </el-button>
          </div>

          <el-divider content-position="left">搜索</el-divider>
          <div class="search-row">
            <el-input v-model="searchQuery" size="small" placeholder="英文 / 中文 / 章节 / 词组" clearable @keyup.enter="store.startSearchPractice()" />
            <el-input v-model="searchAssist" size="small" placeholder="音标（如 ˈæt）" clearable @keyup.enter="store.startSearchPractice()" />
            <el-select v-model="searchChapter" size="small" class="chapter-select">
              <el-option value="all" label="全部章节" />
              <el-option v-for="c in chapterNames" :key="c" :value="c" :label="c" />
            </el-select>
            <el-button size="small" type="primary" :disabled="!searchResults.length" @click="store.startSearchPractice()">开始练习</el-button>
            <el-button size="small" @click="clearSearch">清空</el-button>
          </div>

          <div v-if="searchPreview.length" class="search-results">
            <div v-for="r in searchPreview" :key="r.key" class="search-item">
              <b>{{ r.word }}</b>
              <span class="dim ellipsis">{{ r.meaning }}</span>
              <span class="dim mono ellipsis">{{ r.eng_phonetic }}</span>
              <span class="dim ellipsis">{{ r.chapter }} · {{ r.group }}</span>
            </div>
            <div class="search-meta dim">
              匹配 {{ searchResults.length }} 条，显示前 {{ searchPreview.length }} 条
            </div>
          </div>
          <div v-else-if="hasFilters" class="search-empty">无匹配结果</div>
        </el-card>

        <!-- 单词工作台 -->
        <el-card v-if="word" shadow="never" class="panel word-card">
          <div class="word-head">
            <div>
              <div class="word-context"><b>{{ word.chapter }} · {{ word.group }}</b></div>
              <div class="dim">
                第 {{ word.wordIndex + 1 }} / {{ currentTotal }} 词 · {{ store.sessionModeLabel || '分组练习' }}
              </div>
            </div>
            <div class="badges">
              <el-tag v-for="s in sourceLabels" :key="s" size="small" type="warning" effect="light">{{ s }}</el-tag>
              <el-tag v-if="isMastered" size="small" type="success" effect="light">已学会</el-tag>
              <el-tag v-if="difficultEntry" size="small" type="danger" effect="light">
                难词 Lv{{ difficultEntry.difficultyLevel }} · 第 {{ difficultEntry.reviewStage + 1 }} 轮
              </el-tag>
            </div>
          </div>

          <div v-if="mode === 'quiz' && !store.data.practice.quiz.answered" class="quiz-prompt">从 4 个中文释义中选择正确的</div>

          <div v-if="revealWord" class="word-main">
            <div class="word-text">{{ word.word }}</div>
            <div v-if="word.eng_phonetic && mode !== 'spell'" class="word-phonetic">{{ word.eng_phonetic }}</div>
          </div>
          <div v-else-if="mode === 'spell'" class="word-main word-mask">• • • • •</div>

          <div v-if="revealMeaning" class="word-meaning">{{ word.meaning }}</div>
          <div v-else-if="mode === 'quiz' && store.data.practice.quiz.answered" class="word-meaning" :class="{ correct: store.data.practice.quiz.correct }">
            {{ store.data.practice.quiz.correct ? '回答正确 ✓' : `正确答案：${word.meaning}` }}
          </div>

          <div v-if="mode === 'quiz'" class="quiz-options">
            <button
              v-for="opt in store.data.practice.quiz.options"
              :key="opt"
              class="quiz-option"
              :class="{
                correct: store.data.practice.quiz.answered && opt === word.meaning,
                wrong: store.data.practice.quiz.answered && opt === store.data.practice.quiz.selectedMeaning && !store.data.practice.quiz.correct,
              }"
              :disabled="store.data.practice.quiz.answered"
              @click="store.submitQuizAnswer(opt)"
            >
              {{ opt }}
            </button>
          </div>

          <div v-if="mode === 'spell'" class="spell-row">
            <el-input ref="spellInputRef" v-model="spellInput" size="small" placeholder="输入单词拼写后回车" class="spell-input" @keyup.enter="submitSpell" />
            <el-button size="small" :disabled="!word.eng_sound" @click="replaySpell">重听发音</el-button>
            <el-button size="small" type="primary" @click="submitSpell">提交</el-button>
          </div>

          <div class="action-row">
            <el-button-group>
              <el-button size="small" @click="store.toggleWordDifficulty(word.key)">{{ difficultEntry ? '移出难词' : '加入难词' }}</el-button>
              <el-button size="small" @click="store.toggleWordMastered(word.key)">{{ isMastered ? '取消学会' : '标记学会' }}</el-button>
              <el-button v-if="difficultEntry" size="small" @click="store.adjustCurrentWordDifficultyLevel(-1)">难度 −</el-button>
              <el-button v-if="difficultEntry" size="small" @click="store.adjustCurrentWordDifficultyLevel(1)">难度 +</el-button>
              <el-button size="small" @click="store.moveRelative(1, true)">跳过</el-button>
            </el-button-group>
            <el-input
              :model-value="store.data.wordNotes[word.key] || ''"
              size="small"
              class="note-input"
              placeholder="添加笔记…"
              @update:model-value="store.handleWordNoteInput"
            />
          </div>

          <div v-if="synonymGroups.length" class="synonym-block">
            <div v-for="group in synonymGroups" :key="group.id" class="synonym-group">
              <span class="synonym-source">{{ group.source }}</span>
              <el-tag
                v-for="term in group.terms"
                :key="term.normalized"
                size="small"
                :type="term.displayWord.toLowerCase() === word.word.toLowerCase() ? 'primary' : 'info'"
                effect="plain"
                class="synonym-chip"
                :class="{ linked: term.matched }"
                @click="term.matched ? speakWord(term.matched) : undefined"
              >
                {{ term.displayWord }}
              </el-tag>
            </div>
          </div>

          <div v-if="store.data.settings.showListeningCorpus && corpusMatches.length" class="corpus-block">
            <div class="corpus-title">听力语料库</div>
            <div v-for="(item, idx) in corpusMatches" :key="`${item.mp3Path}-${idx}`" class="corpus-row">
              <button class="corpus-play" type="button" title="播放" @click="store.playCorpusAudio(item.mp3Path)">▶</button>
              <div class="corpus-body">
                <div>{{ item.content }}</div>
                <div class="dim">{{ item.chapterTitle }}</div>
              </div>
            </div>
          </div>

          <div class="word-foot dim">
            <span>已学 {{ stat?.count || 0 }} 次 · 最近：{{ stat?.lastStudiedAt ? new Date(stat.lastStudiedAt).toLocaleString() : '—' }}</span>
            <span v-if="difficultEntry">下次复习：{{ formatReviewDueText(difficultEntry.nextReviewAt) }}</span>
          </div>
        </el-card>

        <!-- 传输控制 -->
        <el-card shadow="never" class="panel transport">
          <div class="transport-row">
            <el-button-group>
              <el-button size="small" :disabled="!store.hasWord" @click="store.moveRelative(-1, true)">◀ 上一个</el-button>
              <el-button size="small" type="primary" :disabled="!store.hasWord" @click="store.togglePlayback()">
                {{ store.data.practice.autoRunning ? '⏸ 暂停' : '▶ 播放' }}
              </el-button>
              <el-button size="small" :disabled="!store.hasWord" @click="store.moveRelative(1, true)">下一个 ▶</el-button>
              <el-button size="small" :disabled="!store.hasWord || !word" @click="word && speakWord(word)">🔊 发音</el-button>
            </el-button-group>
            <el-switch
              v-model="store.data.settings.muted"
              size="small"
              inline-prompt
              active-text="静音"
              inactive-text="有声"
              @change="store.updateSetting('muted', $event)"
            />
          </div>
          <div class="slider-row">
            <span class="slider-label">倍速 {{ store.data.settings.playbackRate.toFixed(1) }}x</span>
            <el-slider v-model="store.data.settings.playbackRate" :min="0.6" :max="2" :step="0.1" size="small" class="slider" @change="store.updateSetting('playbackRate', $event)" />
            <span class="slider-label">间隔 {{ store.data.settings.intervalSeconds }}s</span>
            <el-slider v-model="store.data.settings.intervalSeconds" :min="0" :max="5" :step="1" size="small" class="slider" @change="store.updateSetting('intervalSeconds', $event)" />
            <span class="slider-label">重复 {{ store.data.settings.repeatCount }} 次</span>
            <el-slider v-model="store.data.settings.repeatCount" :min="1" :max="5" :step="1" size="small" class="slider" @change="store.updateSetting('repeatCount', $event)" />
          </div>
          <div class="transport-sub">
            <div class="transport-jump">
              <span v-if="store.session" class="dim">{{ store.session.label }} · {{ store.session.items.length }} 词</span>
              <el-input v-model="startIndexInput" size="small" class="start-input" placeholder="起始序号(1-based)" @keyup.enter="jumpToStartIndex" />
              <el-button size="small" @click="jumpToStartIndex">跳转</el-button>
            </div>
            <div class="transport-actions">
              <el-button v-if="store.session?.mode === 'group'" size="small" text @click="store.resetGroupPosition()">回到组首</el-button>
            </div>
          </div>
        </el-card>

        <el-empty v-if="!word" description="暂无学习内容，请先选择分组或开始搜索练习" />
      </el-col>

      <el-col :md="7" :xs="24">
        <el-card shadow="never" class="panel">
          <div class="side-head">
            <b>队列预览</b>
            <el-button size="small" text @click="store.ui.queueCollapsed = !store.ui.queueCollapsed">
              {{ store.ui.queueCollapsed ? '展开' : '折叠' }}
            </el-button>
          </div>
          <div v-if="!store.ui.queueCollapsed" class="queue-list">
            <div v-for="(item, idx) in queuePreview" :key="`${item.word}-${idx}`" class="queue-item" :class="{ current: item.current }">
              <b>{{ item.word }}</b>
              <span class="dim">{{ item.subtitle }}</span>
            </div>
            <div v-if="!queuePreview.length" class="dim">暂无队列</div>
          </div>
        </el-card>

        <el-card shadow="never" class="panel">
          <div class="quick-col">
            <el-button size="small" type="primary" plain @click="store.startDifficultPractice(store.data.selectedLibraryChapter, { onlyDue: true })">
              当前章节到期复习
            </el-button>
            <el-button size="small" @click="store.setActiveTab('difficult')">前往难词页</el-button>
            <el-button size="small" @click="store.setActiveTab('overview')">前往总览</el-button>
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<style scoped>
.study {
  max-width: 1200px;
  margin: 0 auto;
}

.panel {
  border-radius: 10px;
  margin-bottom: 12px;
}

.library-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.chapter-select {
  width: 340px;
}

.group-select {
  width: 220px;
}

.preset-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
}

.search-row {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}

.search-results {
  margin-top: 8px;
  max-height: 240px;
  overflow-y: auto;
}

.search-item {
  display: flex;
  gap: 10px;
  align-items: center;
  padding: 5px 6px;
  border-radius: 6px;
}

.search-item:hover {
  background: #f2f6fc;
}

.search-meta {
  padding: 6px 4px 0;
}

.ellipsis {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 240px;
}

.search-empty {
  color: #909399;
  font-size: 12px;
  margin-top: 8px;
}

.word-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 10px;
  flex-wrap: wrap;
}

.badges {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.word-context {
  font-size: 13px;
  color: #4a5a6a;
}

.word-main {
  padding: 8px 0 2px;
}

.word-text {
  font-size: 34px;
  font-weight: 700;
  color: #1f2d3d;
  letter-spacing: 0.5px;
}

.word-mask {
  letter-spacing: 4px;
  font-size: 30px;
  color: #909399;
}

.word-phonetic {
  color: #7b8794;
  margin-top: 4px;
}

.word-meaning {
  color: #4a5a6a;
  font-size: 15px;
  line-height: 1.8;
  margin-top: 8px;
}

.word-meaning.correct {
  color: #17b26a;
}

.quiz-prompt {
  color: #909399;
  font-size: 12px;
  margin-top: 8px;
}

.quiz-options {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 12px 0;
}

.quiz-option {
  text-align: left;
  padding: 9px 12px;
  border-radius: 8px;
  border: 1px solid #dcdfe6;
  background: #fff;
  cursor: pointer;
  font-size: 14px;
}

.quiz-option:hover:not(:disabled) {
  border-color: #1473ff;
  color: #1473ff;
}

.quiz-option.correct {
  border-color: #17b26a;
  background: #e8f8f0;
  color: #17b26a;
}

.quiz-option.wrong {
  border-color: #f56c6c;
  background: #fef0f0;
  color: #f56c6c;
}

.spell-row {
  display: flex;
  gap: 8px;
  margin: 12px 0;
}

.spell-input {
  max-width: 320px;
}

.action-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 14px 0 4px;
  flex-wrap: wrap;
}

.note-input {
  max-width: 280px;
}

.synonym-block {
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.synonym-group {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.synonym-source {
  font-size: 11px;
  color: #a0a6ad;
}

.synonym-chip.linked {
  cursor: pointer;
}

.corpus-block {
  margin-top: 12px;
  border-top: 1px dashed #ebeef5;
  padding-top: 8px;
}

.corpus-title {
  font-size: 12px;
  font-weight: 600;
  color: #606266;
  margin-bottom: 6px;
}

.corpus-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 4px 0;
}

.corpus-play {
  flex: none;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 1px solid #c0c4cc;
  background: #fff;
  color: #1473ff;
  cursor: pointer;
  font-size: 11px;
  line-height: 1;
}

.corpus-play:hover {
  border-color: #1473ff;
}

.corpus-body {
  font-size: 13px;
  color: #4a5a6a;
  line-height: 1.6;
}

.word-foot {
  display: flex;
  gap: 16px;
  margin-top: 10px;
  border-top: 1px dashed #ebeef5;
  padding-top: 8px;
  font-size: 12px;
}

.transport-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
}

.slider-row {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-top: 10px;
  flex-wrap: wrap;
}

.slider {
  flex: 1;
  min-width: 90px;
  max-width: 190px;
}

.slider-label {
  font-size: 12px;
  color: #606266;
  white-space: nowrap;
}

.transport-sub {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  margin-top: 8px;
  flex-wrap: wrap;
}

.transport-jump {
  display: flex;
  align-items: center;
  gap: 8px;
}

.start-input {
  width: 150px;
}

.side-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.queue-list {
  max-height: 420px;
  overflow-y: auto;
}

.queue-item {
  padding: 5px 8px;
  border-radius: 6px;
  display: flex;
  justify-content: space-between;
  gap: 8px;
  font-size: 13px;
}

.queue-item.current {
  background: #ecf5ff;
}

.quick-col {
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: stretch;
}

.dim {
  color: #909399;
  font-size: 12px;
}

.mono {
  font-family: ui-monospace, Menlo, Consolas, monospace;
}
</style>
