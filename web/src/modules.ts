/**
 * 模块注册表：新路由 ⇄ 旧单文件 HTML 的一一映射。
 *
 * 这是重构的“单一事实来源”：
 * - 侧边栏菜单、首页卡片、路由、占位页均由这里驱动；
 * - 每个模块逐一完成后，将对应旧 HTML 从仓库移除，并把 status 置为 'done'。
 */
import type { Component } from 'vue'

import {
  DataAnalysis,
  EditPen,
  Headset,
  MagicStick,
  Mic,
  Notebook,
  VideoPlay,
} from '@element-plus/icons-vue'

export type ModuleStatus = 'todo' | 'active' | 'done'

export interface IeltsModule {
  /** 路由段与唯一标识，如 vocabulary */
  id: string
  /** 中文标题 */
  title: string
  /** 一句话副标题 */
  subtitle: string
  /** 被替换的旧单文件 HTML（相对仓库根） */
  legacy: string[]
  /** 模块简介 */
  summary: string
  /** 核心功能清单（重构验收依据） */
  features: string[]
  /** Element Plus 图标组件 */
  icon: Component
  /** 重构进度：todo = 待重构（占位页），active = 重构中，done = 已完成 */
  status: ModuleStatus
  /** 附加说明（如数据来源、多个旧稿待比对） */
  notes?: string
}

export const modules: IeltsModule[] = [
  {
    id: 'study-tracker',
    title: '学习状态跟踪',
    subtitle: '记录 / 复盘 / Todo / 记账',
    legacy: ['daily-status/学习状态跟踪.html'],
    summary:
      '每日学习记录与复盘工具：学习记录表、Todo、复盘、记账本，周/月统计与热力图，支持 JSON/Excel/PDF 导入导出。',
    features: [
      '学习记录表：日期、时长、分项指标、复盘字段',
      'Todo 管理：优先级、状态排序、明日计划同步',
      '记账本：分类、周期规则、图表、日历联动',
      'Overview 总览：周均、本月、风险项、提醒状态',
      'JSON / Excel / PDF 导入导出',
      '统计图与学习热力图',
    ],
    icon: DataAnalysis,
    status: 'todo',
  },
  {
    id: 'pronunciation',
    title: '单词精听器',
    subtitle: '纯正英音 · 批量播放',
    legacy: ['dictionary/发音.html'],
    summary: '轻量发音练习入口：按词批量播放英音，适合快速练耳与口语模仿。',
    features: ['批量粘贴词表（换行/逗号分隔）', '本地 TTS 精听（英音优先选声）', '语速可调 / 暂停 / 任意跳词', '单词清单点击即播'],
    icon: Mic,
    status: 'done',
    notes: '已忠实还原 dictionary/发音.html：原样式容器级移植（styles/legacy-full.css）+ 原结构重写。',
  },
  {
    id: 'dictation',
    title: '单词听写',
    subtitle: '听写 / 只听 双模式',
    legacy: ['dictionary/发音和听写.html', '发音/发音和听写.html'],
    summary:
      '雅思单词听写练习：听写 / 只听双模式切换。注意存在两个历史稿，重构时需比对合并。',
    features: ['听写模式', '只听模式', '练习数据本地持久化'],
    icon: EditPen,
    status: 'todo',
    notes:
      '仓库中存在两个同名旧稿：README 以 dictionary/发音和听写.html 为权威，根目录 发音/发音和听写.html 为更新的未提交稿（内容更大、日期更新），重构前需人工比对确定基线。',
  },
  {
    id: 'corpus-dictation',
    title: '语料库章节听写',
    subtitle: '章节词库 · 错词本',
    legacy: ['listening-word/王璐语料库_源码.html'],
    summary:
      '章节化语料听写训练：章节词库匹配、听写/听音模式、错词本、词级与章节统计、备份导入导出、IndexedDB 音频缓存。',
    features: [
      '章节词库匹配与练习队列管理',
      '听写模式 / 听音模式',
      '错词本、词级统计、章节统计',
      '备份导入导出',
      'localStorage + IndexedDB 音频缓存',
    ],
    icon: Headset,
    status: 'todo',
    notes:
      '数据来源：listening-word/word.json（章节 → 词条）与 listening-word/assets/audio（本地音频）。',
  },
  {
    id: 'vocabulary',
    title: '词汇学习',
    subtitle: '章节分组 · 三模式 · 难词复习',
    legacy: ['words/study_words.html'],
    summary:
      '词汇学习主模块：章节与分组学习、标准/选择题/拼写三种练习、多维搜索、难词阶段复习、同义词与关联词、统计与热力图。',
    features: [
      '章节与分组学习（22 章 + 多组）',
      '标准 / 选择题 / 拼写三种练习模式',
      '搜索：英文、中文、章节、音标',
      '难词复习：阶段、到期、失败次数',
      '同义词与关联词展示',
      '学习统计与热力图',
      '备份导入导出与本地状态持久化',
    ],
    icon: Notebook,
    status: 'done',
    notes:
      '已完成模块化重构（数据层/状态层/组件/视图分离 + 28 项单元测试）。数据链路：web/scripts/sync-vocab-data.mjs 从 words/data 重建并与 legacy 内联数据一致性断言；听力语料卡/词源已接入（corpus.json 懒加载）。待美化项：同义词 popover 精细交互、legacy 玻璃拟态主题 tokens（非功能差异）。',
  },
  {
    id: 'synonyms',
    title: '同义替换学习',
    subtitle: '极简学习 · 手动导航',
    legacy: ['同义词学习/同义词学习.html'],
    summary: 'IELTS 同义替换词学习页：极简交互、手动导航，辅助写作与阅读替换词积累。',
    features: ['同义替换词条学习', '手动导航浏览', '极简界面'],
    icon: MagicStick,
    status: 'todo',
    notes: '数据来源：words/data/source/synonyms/（同义词-gpt / google / other.json）。',
  },
  {
    id: 'audio-player',
    title: '音频顺序播放器',
    subtitle: '本地音频 · 倍速次数 · 定时暂停',
    legacy: ['audio-playlist-player/音频顺序播放器.html'],
    summary:
      '本地音频顺序播放与复读工具：上传音频自动成清单，逐项配置倍速与次数，支持定时自动暂停。',
    features: [
      '上传 mp3 / m4a / wav / aac / ogg，自动生成播放清单',
      '条目手动新增、复制、上移下移、删除',
      '逐项倍速与播放次数配置',
      '全局默认值 + 同步到全部条目',
      '定时自动暂停（支持小数分钟）',
    ],
    icon: VideoPlay,
    status: 'todo',
  },
]

export function getModule(id: string): IeltsModule | undefined {
  return modules.find((m) => m.id === id)
}
