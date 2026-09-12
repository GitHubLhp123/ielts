<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { HomeFilled } from '@element-plus/icons-vue'

import { modules } from '@/modules'

const route = useRoute()

const headerTitle = computed(() => {
  const title = route.meta.title
  return typeof title === 'string' ? title : 'IELTS 学习工具集'
})
</script>

<template>
  <el-container class="shell">
    <el-aside width="236px" class="aside">
      <div class="brand">
        <div class="brand-title">IELTS Tools</div>
        <div class="brand-sub">学习工具集 · 重构版</div>
      </div>

      <el-menu class="nav" router :default-active="route.path">
        <el-menu-item index="/">
          <el-icon><HomeFilled /></el-icon>
          <span>总览</span>
        </el-menu-item>
        <el-menu-item v-for="m in modules" :key="m.id" :index="`/${m.id}`">
          <el-icon><component :is="m.icon" /></el-icon>
          <span>{{ m.title }}</span>
        </el-menu-item>
      </el-menu>

      <div class="aside-foot">
        <el-tag size="small" effect="dark" type="info">Vue 3 · 本地优先</el-tag>
      </div>
    </el-aside>

    <el-container class="body">
      <el-header class="hdr" height="60px">
        <div>
          <div class="hdr-title">{{ headerTitle }}</div>
          <div class="hdr-sub">8 个学习模块 · 本地数据 · 二开基线</div>
        </div>
        <el-tag size="small" effect="plain">v0.1 · 8 modules</el-tag>
      </el-header>

      <el-main class="main">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<style scoped>
.shell {
  height: 100%;
}

.aside {
  display: flex;
  flex-direction: column;
  background: linear-gradient(180deg, #0b1f33 0%, #0a1a2b 100%);
  overflow: hidden;
}

.brand {
  padding: 18px 20px 14px;
  color: #fff;
}

.brand-title {
  font-size: 19px;
  font-weight: 700;
  letter-spacing: 0.4px;
}

.brand-sub {
  margin-top: 4px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.45);
}

.nav {
  flex: 1;
  border-right: none;
  background: transparent;
  overflow-y: auto;
}

.nav :deep(.el-menu-item) {
  color: rgba(255, 255, 255, 0.66);
  height: 46px;
  line-height: 46px;
  margin: 2px 10px;
  border-radius: 8px;
}

.nav :deep(.el-menu-item:hover) {
  background-color: rgba(255, 255, 255, 0.06);
  color: #fff;
}

.nav :deep(.el-menu-item.is-active) {
  background-color: rgba(64, 158, 255, 0.22);
  color: #7db6ff;
}

.aside-foot {
  padding: 14px 20px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.body {
  min-width: 0;
}

.hdr {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #fff;
  border-bottom: 1px solid #e4e7ed;
  padding: 0 24px;
}

.hdr-title {
  font-size: 17px;
  font-weight: 600;
  color: #1f2d3d;
}

.hdr-sub {
  margin-top: 2px;
  font-size: 12px;
  color: #909399;
}

.main {
  background: #f2f4f8;
  overflow-y: auto;
}
</style>
