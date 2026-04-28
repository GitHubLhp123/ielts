# study_words.html 版本审查报告

- 审查日期: 2026-04-29
- 审查对象: words/study_words.html
- 审查范围: 功能导出、关联链路核对、交互与细节、缺陷与风险

## 1. 功能清单（当前版本）

1. 学习主流程
- 章节和分组切换（Chapter -> Group）
- 练习模式: 标准模式、选择题模式、拼写模式
- 上一词/下一词/自动播放/发音/加入难词/标记已学会
- 单词显示与中文显示开关
- 学习进度、当前会话进度、组内掌握进度

2. 搜索与筛选
- 英文关键词搜索、中文释义搜索
- 章节筛选
- 音标辅助筛选
- 搜索结果内发音
- 搜索结果一键开始练习

3. 难词系统
- 难词列表展示、章节筛选、关键词筛选
- 选择子集练习 / 当前筛选练习 / 全部难词练习 / 到期复习
- 艾宾浩斯阶段复习字段: reviewStage / nextReviewAt / reviewFailures
- 难词条目删除二次确认

4. 统计与可视化
- 今日学习/掌握/复习卡片
- 最近 7 天趋势图（ECharts）
- 学习热力图与连续学习天数
- 全局覆盖率、掌握率、活跃天数等指标

5. 数据持久化与备份
- 本地存储: localStorage
- 备份导出 JSON
- 备份导入 JSON
- 超过 7 天未备份提示

6. 关联词/同义词
- 手工关联词（WORD_RELATIONS）
- 同义词聚合（SYNONYM_SOURCE_DATA）
- 芯片 hover/focus/click 弹层
- 弹层内发音、加入/移出生词、标记/取消已学会

## 2. 依赖与关联链路核对

1. 数据链路
- EMBEDDED_DATA -> normalizeLibrary -> library/allWords/groupsById
- READING_538_DATA/LISTENING_179_DATA/CORE_VOCAB_DATA -> normalizeLexeme -> Set 查找
- SYNONYM_SOURCE_DATA -> buildSynonymLookup -> resolveSynonymGroups -> renderRelatedTerms

2. 状态链路
- loadState -> hydrateState -> renderAll
- setGroupSession/startSearchPractice/startDifficultPractice -> currentSession 切换
- recordExposure/markDifficultyReview/toggleWordMastered -> wordStats/difficultWords/studyLog 更新
- saveState -> localStorage

3. UI 事件链路
- 搜索输入、章节筛选、Enter 快捷练习
- 模式切换与播放控制
- 难词筛选、勾选、练习、删除
- 备份导入导出

结论: 主链路完整，数据结构与渲染层关联正确，关键交互事件绑定有效。

## 3. 本轮审查发现与修复

### 已修复

1. 搜索会话标题不完整
- 问题: 从搜索结果进入练习时，标题仅显示关键词，不包含章节/音标筛选。
- 修复: startSearchPractice 使用 buildSearchSessionLabel 统一生成会话标题。

2. 搜索练习按钮交互反馈不足
- 问题: 无筛选条件或无结果时，按钮仍可点击，反馈延迟到点击后。
- 修复: renderSearchResults 中根据筛选与结果状态动态禁用/启用按钮，并补充 title 提示。

3. 状态导入/恢复结构校验不够严格
- 问题: 部分字段若被污染为非对象（如字符串），会进入后续流程，造成异常状态。
- 修复:
  - loadState 对 wordNotes/progressByGroup/wordStats/difficultWords/backup/settings/practice 增加 plain object 校验。
  - applyImportedState 对同类字段增加同样校验。

4. 本地存储失败缺少可见提示
- 问题: localStorage 写入异常（配额或隐私模式）时用户无明确提示。
- 修复: saveState 增加 try/catch，失败时显示错误状态提示。

## 4. 全文审查结论

1. 正确性
- 主要功能正确可用，模式切换和状态流一致。
- 搜索、难词、统计、备份链路均可闭环。

2. 关联正确性
- 功能间关联（学习 -> 难词 -> 统计 -> 复习）连通性良好。
- 同义词与手工关联词聚合逻辑可用，词库内/外状态区分清晰。

3. 细节与交互
- 已补强搜索按钮状态反馈，减少无效点击。
- 仍可继续优化:
  - 搜索结果支持“加载更多”或虚拟列表（当前默认展示前 24 条）。
  - 备份导入前预览（防误导入）。
  - 离线场景下图表库与音频的降级文案再细化。

## 5. Bug 与漏洞审查

1. 高危漏洞
- 未发现可直接利用的高危注入或代码执行漏洞。

2. 中低风险
- 依赖 CDN 的 ECharts 在离线环境不可用（已有空态提示）。
- 音频依赖远程 URL，离线不可播放。
- localStorage 配额不足时会影响持久化（本轮已补充用户可见报错）。

3. 回归风险
- 搜索按钮禁用逻辑与结果渲染共用同一函数，回归风险低。
- 状态结构校验仅收紧输入，不改变正常结构，兼容性风险低。

## 6. 建议的下一步

1. 增加“搜索结果加载更多”以适配大词库筛选场景。
2. 增加“导入前预览 + 一键回滚”提升备份安全性。
3. 可选引入本地图表库与本地音频索引，支持完整离线模式。
