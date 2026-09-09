# IELTS Web（重构版）

用现代 Web 技术重构「IELTS 学习工具集」仓库中的单文件 HTML 应用。

## 技术栈

Vue 3.5 · Vite 8 · TypeScript · Pinia · Vue Router（hash 模式）· Element Plus · ECharts 6

## 快速开始

```bash
npm install
npm run dev      # http://127.0.0.1:5173
npm run build    # vue-tsc 类型检查 + 产物 dist/
npm run preview  # 预览构建产物
```

## 目录结构

```
src/
  main.ts                 # 入口：Pinia / Router / Element Plus（zh-cn）
  App.vue                 # 应用外壳：侧边栏 + 顶栏 + 内容区
  modules.ts              # ★ 模块注册表：新路由 ⇄ 旧 HTML 的映射（单一事实来源）
  router/index.ts         # 路由（hash），由 modules.ts 生成
  views/
    HomeView.vue          # 总览页：全部模块卡片 + 重构进度
    modules/<id>.vue      # 每个模块一个视图，逐一替换占位实现
  components/
    ModulePlaceholder.vue # 通用占位页（展示功能验收清单与旧页面）
```

## 重构约定

1. 每个模块对应 `src/views/modules/<id>.vue`，当前为占位实现。
2. 重构某模块时：实现其视图 → 在 `src/modules.ts` 将 `status` 置为 `'done'` → 从仓库移除对应旧 HTML → 更新根 README 的迁移表。
3. 数据源优先复用仓库既有 JSON 源（`words/data`、`listening-word/word.json` 等），
   以构建期静态导入 + schema 化前端状态为准，不再内联进页面。
