# ielts

当前仓库按功能模块拆分：

- `daily-status/`：学习状态页面与版本记录
- `dictionary/`：发音与听写页面
- `listening-word/`：听力语料页面、下载脚本、音频资源
- `words/`：核心词库页面、原始数据、生成产物、音频资源与维护脚本

其中 `words/` 建议使用下面的分层约定：

- `study_words.html`：主页面入口
- `scripts/`：数据抓取、清单生成、音频下载、内联刷新脚本
- `data/source/`：原始词表、同义词、章节信息、参考数据
- `data/generated/`：分组 JSON、manifest、同义词 bundle、内联中间产物
- `assets/audio/`：本地音频与 manifest
- `docs/`：版本说明、发布记录、补充文档
