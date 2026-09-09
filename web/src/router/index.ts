import { createRouter, createWebHashHistory } from 'vue-router'

import { modules } from '@/modules'
import HomeView from '@/views/HomeView.vue'

/**
 * 采用 hash 模式：构建产物可部署到任意静态服务器，
 * 也兼容本地 file:// / 双击 dist/index.html 打开，无需服务端回退配置。
 */
const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
      meta: { title: '总览' },
    },
    ...modules.map((m) => ({
      path: `/${m.id}`,
      name: m.id,
      // 每个模块独立 view 文件：重构时直接替换对应视图即可
      component: () => import(`@/views/modules/${m.id}.vue`),
      meta: { title: m.title },
    })),
  ],
})

router.beforeEach((to) => {
  // 未认领的深链接一律回首页，避免空白
  if (!to.matched.length) return { path: '/' }
})

export default router
