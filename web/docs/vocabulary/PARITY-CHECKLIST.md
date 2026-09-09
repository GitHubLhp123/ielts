# 词汇模块重构 · Parity 清单与文件地图（study_words.html → web）

> 目标：把 `words/study_words.html`（2.4MB 单文件）1:1 重构为 Vue3 模块化实现。
> legacy 侧三份分析报告：`legacy-STATE-DATA-REPORT.md` / `legacy-BEHAVIOR-REPORT.md` / `legacy-UI-STRUCTURE-REPORT.md`。

## 数据层（已完成，等价性已断言）
- `web/scripts/sync-vocab-data.mjs`：从 `words/data`（manifest + word_groups + synonyms + vocabulary 预设词表）确定性重建：
  - `web/src/data/vocabulary/library.json`（EMBEDDED_DATA 同构，词=5 字段投影）
  - `web/src/data/vocabulary/synonyms.json`（normalize_group 清洗）
  - `web/src/data/vocabulary/presets.json`（reading/listening/core）
- legacy 页面存在时逐项与内联数据深度相等断言（`npm run data:vocab`）。已验证 ✓
- 注：听力语料（`window.LISTENING_WORD_AUDIO_DATA`）**尚未**纳入同步脚本 —— 待 listening 模块数据层统一接入。

## 代码分层（`web/src/features/vocabulary/`）
| 层 | 文件 | 状态 |
| --- | --- | --- |
| 类型 | `types.ts` | 完成（与 legacy 字段同名） |
| 常量 | `constants.ts` | 完成 |
| 工具 | `utils/index.ts` | 完成（函数逐字对应） |
| 词库 | `data/library.ts` / `data/sources.ts` | 完成 |
| 同义词 | `data/synonyms.ts` | 完成（索引/源规范化/过滤） |
| 快照模型 | `model/snapshot.ts` / `model/studyLog.ts` | 完成 |
| 领域 | `domain/review.ts` `domain/stats.ts` `domain/search.ts` `domain/quiz.ts` | 完成 |
| 持久化 | `persist/idb.ts` `defaults.ts` `state-io.ts` | 完成（IDB 主 + localStorage 兜底/迁移） |
| 音频 | `lib/audio.ts` | 完成（mp3 单例 + token 竞态） |
| Store | `stores/vocabulary.ts` | 完成（会话/播放/练习/难词/搜索/统计/备份动作） |
| 视图 | `VocabularyModule.vue` + `components/{OverviewPane,StudyPane,DifficultPane,SettingsDialog,HeatmapGrid}.vue` | 首版完成 |

## 功能 parity 状态
已完成：
- 三 tab（总览/学习页/难词页）、章节-分组导航、会话队列预览（已学优先排序）
- 三种练习模式（standard/quiz/spell），quiz 干扰项=全词库释义 3+1
- 自动播放引擎（倍速/间隔/重复/静音/手动发音 ignoreMute）
- recordExposure / studyLog / mastered 幂等 / 难词 6 档复习调度 + due 到期文案
- 搜索（词/义/章节/音标 assist、Enter 开始、前 24 预览）、预设词源（reading/listening/core）
- 备份导出/导入（{state} 与裸 state 兼容）、7 天备份提醒
- 全局快捷键（←/→/↑/Enter/Space/Ctrl+Space 重听）、输入框与 composition 守卫
- 总览：今日卡、7 天 ECharts 折线、词库覆盖率、30 天热力图（DOM）
- 设置弹窗（播放参数/显示开关/同义词源启用过滤/备份）

待补（下一阶段，见 legacy-BEHAVIOR-REPORT §12 亦同）：
- [ ] 听力语料卡（当前词 ↔ 语料句子 token 匹配 + 语料 mp3 播放）与 listeningCorpus 词源
- [ ] 同义词 popover（chip 悬浮/钉住/复制/词卡按钮组），现为内联 chip（点击已命中词发音）
- [ ] 起始序号跳转输入、难度页"练习选中"与列表同屏联动细节
- [ ] spell 输入自动聚焦 / quiz 选项键盘选择等焦点细节
- [ ] 迁移后首次运行对旧 localStorage / IDB（apple-word-trainer-v4）读取冒烟测试（同源同 key 直接兼容）
- [ ] 图标/样式收敛为 legacy 的玻璃拟态主题 tokens（可选，非功能 parity）

## 运行
```bash
cd web
npm run data:vocab     # 重建数据产物（含 legacy 断言）
npm run dev            # http://127.0.0.1:5173/#/vocabulary
```
