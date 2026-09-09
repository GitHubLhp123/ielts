<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'

import { modules } from '@/modules'

const router = useRouter()

const doneCount = computed(() => modules.filter((m) => m.status === 'done').length)

function open(id: string) {
  router.push(`/${id}`)
}

function statusLabel(status: string): string {
  if (status === 'done') return '已完成'
  if (status === 'active') return '重构中'
  return '待重构'
}

function statusTagType(status: string): 'success' | 'warning' | 'info' {
  if (status === 'done') return 'success'
  if (status === 'active') return 'warning'
  return 'info'
}
</script>

<template>
  <div class="home">
    <el-card shadow="never" class="hero">
      <div class="hero-inner">
        <div class="hero-title">
          IELTS 学习工具集
          <el-tag size="small" type="warning" effect="dark">重构中 · {{ doneCount }}/{{ modules.length }}</el-tag>
        </div>
        <p class="hero-desc">
          将 7 个「Vue2 / Element UI / ECharts CDN」时代的单文件 HTML 页面，逐步重构为
          <b>Vue 3 + Vite + TypeScript</b> 单一现代应用。旧页面与全部数据已在备份中完整保留，重构期间随时可对照回退。
        </p>
        <div class="stack">
          <el-tag v-for="s in ['Vue 3.5', 'Vite 8', 'TypeScript', 'Pinia', 'Vue Router 5', 'Element Plus', 'ECharts 6']" :key="s" size="small" effect="plain">{{ s }}</el-tag>
        </div>
      </div>
    </el-card>

    <el-row :gutter="16">
      <el-col v-for="m in modules" :key="m.id" :xs="24" :sm="12" :md="12" :xl="8">
        <el-card shadow="hover" class="mod-card" @click="open(m.id)">
          <div class="mod-head">
            <div class="mod-icon" :class="m.status">
              <el-icon :size="20"><component :is="m.icon" /></el-icon>
            </div>
            <div class="mod-titles">
              <div class="mod-title">
                {{ m.title }}
                <el-tag size="small" :type="statusTagType(m.status)" effect="light">
                  {{ statusLabel(m.status) }}
                </el-tag>
              </div>
              <div class="mod-sub">{{ m.subtitle }}</div>
            </div>
          </div>

          <p class="mod-summary">{{ m.summary }}</p>

          <ul class="mod-features">
            <li v-for="f in m.features.slice(0, 3)" :key="f">{{ f }}</li>
          </ul>

          <div class="mod-foot">
            <span class="mono legacy">{{ m.legacy.join(' · ') }}</span>
            <el-icon class="go"><ArrowRight /></el-icon>
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<style scoped>
.home {
  max-width: 1180px;
  margin: 0 auto;
}

.hero {
  border-radius: 12px;
  margin-bottom: 16px;
  background:
    radial-gradient(1200px 300px at 10% -40%, rgba(64, 158, 255, 0.14), transparent),
    #fff;
}

.hero-title {
  font-size: 22px;
  font-weight: 700;
  color: #1f2d3d;
  display: flex;
  align-items: center;
  gap: 10px;
}

.hero-desc {
  margin: 10px 0 14px;
  color: #5a6b7b;
  font-size: 14px;
  line-height: 1.8;
}

.stack {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.mod-card {
  margin-bottom: 16px;
  border-radius: 12px;
  cursor: pointer;
}

.mod-head {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.mod-icon {
  width: 42px;
  height: 42px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
  color: #fff;
}

.mod-icon.todo {
  background: linear-gradient(135deg, #3b82f6, #2563eb);
}

.mod-icon.done {
  background: linear-gradient(135deg, #22c55e, #16a34a);
}

.mod-title {
  font-size: 16px;
  font-weight: 600;
  color: #1f2d3d;
  display: flex;
  align-items: center;
  gap: 8px;
}

.mod-sub {
  margin-top: 3px;
  font-size: 12px;
  color: #909399;
}

.mod-summary {
  margin: 12px 0 10px;
  font-size: 13px;
  color: #5a6b7b;
  line-height: 1.7;
}

.mod-features {
  margin: 0 0 12px;
  padding-left: 18px;
  font-size: 13px;
  color: #606266;
  line-height: 1.8;
}

.mod-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-top: 1px dashed #ebeef5;
  padding-top: 10px;
}

.legacy {
  font-size: 11px;
  color: #a0a6ad;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.go {
  color: #909399;
  flex: none;
}
</style>
