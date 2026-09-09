# IELTS Tool

一个面向雅思词汇学习的本地前端工具集合仓库，包含以下四类核心能力：

1. 每日学习状态跟踪与复盘
2. 发音与听写练习
3. 语料库听写训练（章节化）
4. 词汇学习与难词复习（含同义词与统计）
5. 本地音频顺序播放与变速复读

本仓库的主要特点：

- 以单文件 HTML 页面为主，开箱即用，适合本地长期使用。
- 词汇类模块配套数据生成脚本，支持从源数据到前端内联的一体化维护。
- 多模块均提供 version/release 文档，便于持续审查与版本回溯。

---

## 0. Web 前端重构（进行中 · v0.1 "web init"）

> 仓库于 2026-09 启动现代化重构：旧「单文件 HTML（Vue2 / Element UI / ECharts CDN 时代）」应用
> 全部备份于仓库外（`~/Desktop/ielts-dev-backup-20260909-205928/`，含 `.git`），
> 正在用 **Vue 3 + Vite + TypeScript + Pinia + Vue Router + Element Plus + ECharts** 重构为单一现代应用，代码位于 `web/`。

| 新路由（web/） | 模块 | 旧页面（重构源） | 状态 |
| --- | --- | --- | --- |
| `/study-tracker` | 学习状态跟踪 | `daily-status/学习状态跟踪.html` | 待重构 |
| `/pronunciation` | 单词精听器 | `dictionary/发音.html` | 待重构 |
| `/dictation` | 单词听写（双模式） | `dictionary/发音和听写.html`（+ `发音/发音和听写.html` 待比对稿） | 待重构 |
| `/corpus-dictation` | 语料库章节听写 | `listening-word/王璐语料库_源码.html` | 待重构 |
| `/vocabulary` | 词汇学习 | `words/study_words.html` | 待重构 |
| `/synonyms` | 同义替换学习 | `同义词学习/同义词学习.html` | 待重构 |
| `/audio-player` | 音频顺序播放器 | `audio-playlist-player/音频顺序播放器.html` | 待重构 |

模块注册表（单一路由/菜单/卡片/占位数据源）：`web/src/modules.ts`；每个模块一个独立视图文件
`web/src/views/modules/<id>.vue`，重构时逐个替换其占位内容即可。

运行方式：

```bash
cd web
npm install        # 首次安装依赖
npm run dev        # 开发服务器 → http://127.0.0.1:5173
npm run build      # 类型检查（vue-tsc）+ 产物输出 web/dist/
npm run preview    # 本地预览构建产物
```

说明：若在沙箱环境执行 npm，请先 `export npm_config_cache="$PWD/.npm-cache"`（本仓库根目录，
已在 .gitignore 中忽略）。

---

---

## 1. 项目结构总览

根目录按功能模块拆分：

- daily-status：学习状态跟踪页面与版本文档
- dictionary：发音和听写页面
- listening-word：语料库听写页面、音频下载脚本、音频资源
- words：词汇学习主页面、数据源、生成产物、音频资源、维护脚本
- audio-playlist-player：本地音频顺序播放器，支持上传、逐项倍速/次数配置、定时自动暂停
- data：共享或集中管理的数据目录（含 generated/source）
- web：新版前端应用（Vue 3 + Vite + TS），正在逐一替换上面各模块的旧 HTML 页面（见第 0 节）

你可以把仓库理解为“前端页面层 + 数据构建层 + 版本审查层”三层结构：

1. 页面层：daily-status、dictionary、listening-word、words 下的 HTML
2. 构建层：words/scripts、listening-word/scripts
3. 审查层：各模块的 version.md / release.md / docs

补充：audio-playlist-player 模块当前是纯页面入口，不依赖额外构建脚本。

---

## 2. 各模块说明

### 2.1 daily-status（学习状态跟踪）

主页面：

- daily-status/学习状态跟踪.html

核心功能：

- 学习记录表（日期、时长、分项指标、复盘字段）
- Todo 管理（优先级、状态排序、明日计划同步）
- Overview 总览（周均、本月、风险项、提醒状态）
- 记账本（分类、周期规则、图表、日历联动）
- 导入导出（JSON/Excel/PDF）
- 统计图与学习热力图

相关文档：

- daily-status/docs/version.md
- daily-status/docs/release.md

---

### 2.2 dictionary（发音/听写）

页面：

- dictionary/发音.html
- dictionary/发音和听写.html

用途：

- 作为轻量发音和听写练习入口。
- 适合快速练耳、口语模仿与基础拼写训练。

---

### 2.3 listening-word（语料库听写）

主页面：

- listening-word/王璐语料库_源码.html

核心能力：

- 章节词库匹配与练习队列管理
- 听写模式/听音模式
- 错词本、词级统计、章节统计
- 备份导入导出
- 本地存储与音频缓存

音频下载脚本：

- listening-word/scripts/download_audio.js
- listening-word/scripts/download_audio.rb

版本文档：

- listening-word/version.md（索引）
- listening-word/docs/version.md（详细）
- listening-word/release.md（索引）
- listening-word/docs/release.md（详细）

---

### 2.4 words（词汇学习主模块）

主页面：

- words/study_words.html

核心能力：

- 章节与分组学习
- 三种练习模式（标准/选择题/拼写）
- 搜索（英文、中文、章节、音标）
- 难词复习（阶段、到期、失败次数）
- 同义词与关联词
- 学习统计与热力图
- 备份导入导出与本地状态持久化

脚本目录：

- words/scripts/fetch_words.py
- words/scripts/generate_manifest.py
- words/scripts/generate_synonym_bundle.py
- words/scripts/refresh_study_words_inline_data.py
- words/scripts/refresh_study_words_inline_data.command
- words/scripts/download_word_audio.py

数据目录分层：

- words/data/source：原始词表/章节/同义词等源数据
- words/data/generated：分组 JSON、manifest、同义词 bundle、内联中间产物
- words/assets/audio：音频文件与 manifest

版本文档：

- words/version.md
- words/release.md
- words/docs/version.md
- words/docs/release.md

### 2.5 audio-playlist-player（音频顺序播放器）

主页面：

- audio-playlist-player/音频顺序播放器.html

核心能力：

- 上传本地 mp3 / m4a / wav / aac / ogg 文件
- 自动生成播放清单，并支持手动新增、复制、上移下移、删除
- 每个播放项单独配置倍速和播放次数
- 全局默认倍速/次数，以及同步到全部条目的批量操作
- 定时自动暂停，支持小数分钟配置

适用场景：

- 同一音频按不同倍速和次数反复播放
- 多个本地音频按固定顺序连播

---

## 3. 运行方式

## 3.1 页面运行

本仓库大多数页面是纯前端单文件，可直接双击打开或拖入浏览器。

推荐方式：

1. 在 VS Code 中打开仓库。
2. 使用 Live Server（可选）或直接浏览器打开 HTML 文件。
3. 首次使用建议先导出一份本地备份 JSON。

说明：

- 某些图表或外部库依赖 CDN，离线环境会出现降级。
- 音频播放能力受远程源可用性和网络环境影响。

## 3.2 Python 脚本运行环境（words）

建议在 words 模块下建立并使用虚拟环境：

```bash
cd words
python3 -m venv .venv
source .venv/bin/activate
pip install requests
```

其中 fetch_words.py 依赖 requests。

---

## 4. words 模块数据维护流程（推荐）

这是最常用、最完整的一条维护链路。

### 步骤 1：抓取章节分组词汇

脚本：words/scripts/fetch_words.py

环境变量：

- GUIXUE_AUTH_TOKEN：接口授权 token（必需）
- GUIXUE_BOOK_ID：书本 ID（可选，默认 10174）

示例：

```bash
cd words
source .venv/bin/activate
export GUIXUE_AUTH_TOKEN="你的token"
python scripts/fetch_words.py
```

产物目录：

- words/data/generated/word_groups

### 步骤 2：生成分组清单 manifest

脚本：words/scripts/generate_manifest.py

```bash
cd words
source .venv/bin/activate
python scripts/generate_manifest.py
```

输出：

- words/data/generated/manifests/word_groups_manifest.json

### 步骤 3：生成同义词 bundle（按需）

脚本：words/scripts/generate_synonym_bundle.py

```bash
cd words
source .venv/bin/activate
python scripts/generate_synonym_bundle.py
```

说明：

- 当前 study_words.html 已支持同义词内联；外部 bundle 仍可用于分离式加载方案。

### 步骤 4：刷新 study_words.html 内联数据

脚本：words/scripts/refresh_study_words_inline_data.py

```bash
cd words
source .venv/bin/activate
python scripts/refresh_study_words_inline_data.py
```

或使用快捷命令（依赖 words/.venv/bin/python）：

```bash
cd words/scripts
./refresh_study_words_inline_data.command
```

### 步骤 5：下载词汇音频（可选）

脚本：words/scripts/download_word_audio.py

```bash
cd words
source .venv/bin/activate
python scripts/download_word_audio.py --workers 8 --retries 3
```

常用参数：

- --source-dir：词汇分组 JSON 目录
- --output-dir：原始命名音频目录
- --word-output-dir：按单词名导出的音频目录
- --manifest-file：输出清单路径
- --force：强制重下

---

## 5. listening-word 音频下载流程

listening-word 模块提供 Node.js 与 Ruby 两种下载脚本。

## 5.1 Node.js 版本

脚本：listening-word/scripts/download_audio.js

```bash
cd listening-word
node scripts/download_audio.js --help
node scripts/download_audio.js --chapter 31 --concurrency 6
```

## 5.2 Ruby 版本

脚本：listening-word/scripts/download_audio.rb

```bash
cd listening-word
ruby scripts/download_audio.rb --help
ruby scripts/download_audio.rb --chapter 31 --concurrency 6
```

默认输出目录：

- listening-word/assets/audio

---

## 6. 文档与版本管理约定

建议所有模块遵循以下文档职责：

1. version.md：当前版本功能面、关联关系、审查结论
2. release.md：本次发布改动、修复点、验证结果、已知风险
3. docs/version.md 或 docs/release.md：作为详细文档主体
4. 根目录 version/release（索引文件）：用于兼容路径访问与快速导航

建议每次功能改动后按以下顺序更新：

1. 更新代码
2. 做功能链路审查
3. 更新 version 文档
4. 更新 release 文档
5. 最后回写 README（如果涉及流程变化）

---

## 7. 常见问题（FAQ）

### Q1：页面打开后部分图表不显示

可能原因：

- 当前网络无法访问 CDN。

处理建议：

- 检查网络；或将相关 CDN 依赖改为本地静态资源。

### Q2：音频无法播放

可能原因：

- 远程音频源不可达；
- 浏览器安全策略限制；
- 本地缓存异常。

处理建议：

- 切换网络重试；
- 使用下载脚本提前拉取本地音频；
- 清理缓存后重新加载页面。

### Q3：导入备份后状态异常

可能原因：

- 导入的 JSON 与当前版本字段不兼容；
- 数据被手工编辑后结构损坏。

处理建议：

- 优先导入同模块、同版本邻近周期导出的备份；
- 导入前先做一份当前状态导出。

---

## 8. 安全与稳定性建议

1. 不将含敏感信息的 token 写入仓库文件，使用环境变量注入。
2. 对导入 JSON 持续增强 schema 校验，降低脏数据污染风险。
3. 对 CDN 依赖准备本地兜底资源，支持离线环境。
4. 大规模音频下载建议分章节执行，控制失败重试成本。

---

## 9. 后续维护建议

1. 为核心页面增加轻量冒烟测试清单（打开、录入、导入导出、统计刷新）。
2. 统一模块文档模板（version/release 结构字段一致）。
3. 建立每周一次的数据与备份巡检流程。

如果你希望，我可以下一步直接补一份统一的“模块审查模板（version/release）”，让 daily-status、words、listening-word 三个模块后续审查都按同一格式输出。
