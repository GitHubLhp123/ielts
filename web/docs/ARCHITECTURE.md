# IELTS Web 架构文档

> 面向维护者的系统说明：目录/分层约定、数据链路、主题与移植工具、模块清单、命令。

## 1. 总览与技术栈
单仓库结构：**`web/` 现代前端应用** + **`legacy/` 归档的旧单文件 HTML 工具**。

- Vue 3.5 · Vite 8 · TypeScript 6 · Pinia 4 · Vue Router 5（hash 模式）
- Element Plus 2.14 · ECharts 6（按需懒加载，随模块分包）
- Vitest 5（单元测试）；无后端，全部本地存储

`web/src/views/modules/<id>.vue` 为路由入口，每模块实际实现位于
`web/src/features/<id>/`；路由与首页卡片由 `web/src/modules.ts`（模块注册表）驱动。

## 2. 目录结构
```
web/
  scripts/            # 数据与样式工具（维护者运行）
    sync-vocab-data.mjs    # 词汇模块数据（legacy/words/data → web/src/data/vocabulary/）
    sync-corpus-data.mjs   # 语料章节词集（legacy listening html → web/src/data/corpus/）
    scope-legacy-css.mjs   # 旧 <style> 容器化移植工具（postcss）
  src/
    modules.ts         # ★ 模块注册表（8 个模块：路由/标题/legacy 源/功能/状态）
    features/
      vocabulary/ study-tracker/ pronunciation/ dictation/ synonyms/ audio-player/
      corpus-dictation/ listen-dictation/
      # 每模块统一分层：data/ model/ domain/ persist/ stores/ lib/
      #                components/ styles/ __tests__/
    data/
      vocabulary/      # 词库/同义词/预设/听力音频索引（json，sync 生成）
      corpus/          # 语料章节词集（json，sync 生成）
    views/modules/     # 路由薄壳：转发到对应 features/<id>/<Id>Module.vue
  docs/                # 各模块 legacy 规格 + 移植决策 + 本架构文档
legacy/                # 归档：旧 HTML 页 + 数据源 + 脚本 + 各模块版本文档
  words/  daily-status/  dictionary/  listening-word/ 同义词学习/
  audio-playlist-player/ 发音/  _root/ (旧根脚本与数据)
```

## 3. 模块清单（8 个）
| 路由 | 标题 | legacy 源（现位于 legacy/） |
|---|---|---|
| `/study-tracker` | 学习状态跟踪 | daily-status/学习状态跟踪.html |
| `/vocabulary` | 词汇学习 | words/study_words.html |
| `/pronunciation` | 单词精听器 | dictionary/发音.html |
| `/dictation` | 单词听写 | dictionary/发音和听写.html |
| `/listen-dictation` | 只听循环听写 | 发音/发音和听写.html（变体） |
| `/synonyms` | 同义替换学习 | 同义词学习/同义词学习.html |
| `/audio-player` | 音频顺序播放器 | audio-playlist-player/音频顺序播放器.html |
| `/corpus-dictation` | 语料库章节听写 | listening-word/王璐语料库_源码.html |

每个模块 `legacy:` 字段保留可点击对照路径；模块内 `notes` 说明剩余打磨项。

## 4. 分层约定（features/<id>/）
- `types.ts` / `constants.ts`：类型与常量（尽量沿用 legacy 字段名便于对照）
- `data/`：从 `web/src/data/*.json` 装载 + 归一/索引（library/synonyms/corpus…）
- `model|domain/`：纯逻辑（归一化、复习/错词/统计规则、搜索排序）
- `persist/`：localStorage + IndexedDB 适配；key 与 legacy 一致（旧数据兼容）
- `stores/`：Pinia store（会话/练习/进度/备份动作）
- `components/`：视图组件；`<Id>Module.vue` 为路由挂载外壳
- `styles/legacy-full.css`：原页面 `<style>` 容器化产物（`scope-legacy-css.mjs` 生成），
  选择器全部限定在 `<scopeClass>-app` 下，避免跨模块冲突
- `__tests__/`：vitest 单测（数据/领域规则）

主题说明：每个模块外壳类名 = `<id>-app`（如 `.vocab-app`、`.study-tracker-app`），
其下直接用 legacy 同构类名享受原样式；Element Plus 变量可在容器内重映射。

## 5. 数据链路（重跑方式）
```bash
cd web
npm run data:vocab    # legacy/words/data → src/data/vocabulary/*.json
                      # （legacy 页面仍存在时自动做深度 parity 断言）
npm run data:corpus   # legacy listening HTML 的 CHAPTER_WORD_SETS → src/data/corpus/chapters.json
npm run test          # vitest（当前 38 项）
npm run build         # vue-tsc + vite
npm run dev           # http://127.0.0.1:5173
```
- 词汇模块数据产物由仓库源（manifest+分组/同义词/预设词表）确定性重建，改造 legacy 数据后重跑即可。
- 语料章节数据来自 legacy listening html 内嵌 `CHAPTER_WORD_SETS`；archive 移除后需切换到
  `legacy/listening-word/word.json` 等数据源（脚本内有 TODO 说明）。
- 样式移植（新 legacy → web）：`node scripts/scope-legacy-css.mjs <html> <scopeClass> <out.css>`
  （自动处理 tokens/body 光斑/前缀化/@media；见各模块 styles/legacy-full.css）。

## 6. 兼容性与迁移要点
- 沿用旧存储键：如 `apple-word-trainer-v4`（词汇）、`ielts-dictation-settings-v2` 等（语料）、
  `ielts_listen_repeat`（只听循环）、`daily-learning-tracker-state-v4`（状态跟踪）、
  IndexedDB 音频缓存等 —— 浏览器旧数据可直接延续。
- 导出文件信封遵循 legacy（如词汇备份 `{version:4,...}`、语料备份 v2、状态跟踪 `{version:4}`）。
- 全部模块为本地数据；无账号体系。

## 7. 质量
- 单元测试：词汇（28）+ 语料（10）= 38 项；关注数据规则（复习/错词等级/统计 accuracy/序列化）。
- 检查项：`npm run build` 无 TS 错误；测试全绿；工作树干净后再提交。

## 8. 迁移/重构资料
- `web/docs/*/legacy-*.md`、`PORT-NOTES.md`、`PARITY-CHECKLIST.md`：各模块 legacy 规范与决策
- `web/docs/audio-player/ENHANCER-PLAN.md`：audio 系统词库增强（数据驱动方案，待专项）
- 备份：legacy 页面整体保留于仓库 `legacy/`，另有 2026-09 的整库备份副本
  （`~/Desktop/ielts-dev-backup-20260909-205928/`）。
