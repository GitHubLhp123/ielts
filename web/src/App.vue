<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import { modules } from '@/modules'

const route = useRoute()
const mobileOpen = ref(false)
const toolMenu = ref<HTMLDetailsElement | null>(null)

const isHome = computed(() => route.path === '/')
const currentModule = computed(() => modules.find((module) => `/${module.id}` === route.path))
const primaryModules = ['study-tracker', 'vocabulary', 'corpus-dictation']
  .map((id) => modules.find((module) => module.id === id))
  .filter((module) => module !== undefined)
const moduleIndex = computed(() => {
  const index = modules.findIndex((module) => module.id === currentModule.value?.id)
  return index >= 0 ? String(index + 1).padStart(2, '0') : '00'
})

function closeNavigation() {
  mobileOpen.value = false
  if (toolMenu.value) toolMenu.value.open = false
}

watch(() => route.path, closeNavigation)
</script>

<template>
  <div class="site-shell">
    <header class="site-header">
      <div class="header-inner">
        <RouterLink class="brand" to="/" aria-label="返回 IELTS Dev 首页" @click="closeNavigation">
          <span class="brand-mark" aria-hidden="true">ID</span>
          <span class="brand-copy">
            <strong>IELTS DEV</strong>
            <small>LOCAL LEARNING WORKSPACE</small>
          </span>
        </RouterLink>

        <button
          class="nav-toggle"
          type="button"
          :aria-expanded="mobileOpen"
          aria-controls="site-navigation"
          aria-label="切换导航菜单"
          @click="mobileOpen = !mobileOpen"
        >
          <span></span>
          <span></span>
        </button>

        <div id="site-navigation" class="navigation" :class="{ 'is-open': mobileOpen }">
          <nav class="primary-nav" aria-label="主导航">
            <RouterLink to="/" exact-active-class="is-active" @click="closeNavigation">总览</RouterLink>
            <RouterLink
              v-for="module in primaryModules"
              :key="module.id"
              :to="`/${module.id}`"
              active-class="is-active"
              @click="closeNavigation"
            >
              {{ module.title }}
            </RouterLink>
          </nav>

          <details ref="toolMenu" class="tool-menu">
            <summary>全部工具 <span>{{ modules.length }}</span></summary>
            <div class="tool-panel">
              <RouterLink
                v-for="(module, index) in modules"
                :key="module.id"
                :to="`/${module.id}`"
                active-class="is-active"
                @click="closeNavigation"
              >
                <span class="tool-number">{{ String(index + 1).padStart(2, '0') }}</span>
                <span>
                  <strong>{{ module.title }}</strong>
                  <small>{{ module.subtitle }}</small>
                </span>
              </RouterLink>
            </div>
          </details>
        </div>
      </div>
    </header>

    <section v-if="!isHome && currentModule" class="route-masthead">
      <div class="route-masthead-inner">
        <div>
          <p class="section-kicker">MODULE / {{ moduleIndex }}</p>
          <h1>{{ currentModule.title }}</h1>
          <p>{{ currentModule.subtitle }}</p>
        </div>
        <RouterLink class="back-home" to="/"><span aria-hidden="true">←</span> 返回学习中心</RouterLink>
      </div>
    </section>

    <main class="site-main" :class="{ 'is-home': isHome }">
      <RouterView />
    </main>

    <footer class="site-footer">
      <div class="footer-inner">
        <span>© 2026 IELTS DEV · LOCAL-FIRST LEARNING SYSTEM</span>
        <nav aria-label="页脚导航">
          <RouterLink to="/">学习中心</RouterLink>
          <RouterLink to="/study-tracker">学习记录</RouterLink>
          <RouterLink to="/vocabulary">词汇学习</RouterLink>
        </nav>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.site-shell {
  min-height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--color-canvas);
}

.site-header {
  position: sticky;
  z-index: 100;
  top: 0;
  height: 72px;
  border-bottom: 1px solid var(--color-line);
  background: rgba(248, 247, 244, 0.92);
  backdrop-filter: blur(18px);
}

.header-inner {
  width: min(calc(100% - 48px), var(--site-width));
  height: 100%;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 28px;
}

.brand {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  flex: none;
}

.brand-mark {
  width: 38px;
  height: 38px;
  display: grid;
  place-items: center;
  border-radius: 11px;
  background: linear-gradient(145deg, #5675ff, #7869ef);
  box-shadow: 0 9px 24px rgba(82, 101, 238, 0.28);
  color: #fff;
  font-family: var(--font-mono);
  font-size: 12px;
  letter-spacing: 0.08em;
}

.brand-copy {
  display: grid;
  gap: 2px;
}

.brand-copy strong {
  color: var(--color-ink);
  font-size: 13px;
  letter-spacing: 0.22em;
}

.brand-copy small {
  color: var(--color-muted);
  font-family: var(--font-mono);
  font-size: 8px;
  letter-spacing: 0.16em;
}

.navigation,
.primary-nav {
  display: flex;
  align-items: center;
}

.navigation {
  gap: 34px;
}

.primary-nav {
  gap: 28px;
}

.primary-nav a {
  position: relative;
  padding: 26px 0 24px;
  color: #4e4c49;
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
}

.primary-nav a::after {
  position: absolute;
  right: 0;
  bottom: 17px;
  left: 0;
  height: 2px;
  border-radius: 999px;
  background: var(--color-accent);
  content: '';
  opacity: 0;
  transform: scaleX(0.2);
  transition: 180ms ease;
}

.primary-nav a:hover,
.primary-nav a.is-active {
  color: var(--color-ink);
}

.primary-nav a.is-active::after {
  opacity: 1;
  transform: scaleX(1);
}

.tool-menu {
  position: relative;
}

.tool-menu summary {
  min-width: 108px;
  padding: 10px 15px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 9px;
  border-radius: 999px;
  background: var(--color-ink);
  box-shadow: 0 8px 22px rgba(17, 19, 24, 0.16);
  color: #fff;
  cursor: pointer;
  font-size: 13px;
  font-weight: 650;
  list-style: none;
}

.tool-menu summary::-webkit-details-marker {
  display: none;
}

.tool-menu summary span {
  display: grid;
  min-width: 19px;
  height: 19px;
  place-items: center;
  border-radius: 50%;
  background: var(--color-accent);
  font-family: var(--font-mono);
  font-size: 9px;
}

.tool-panel {
  position: absolute;
  top: calc(100% + 12px);
  right: 0;
  width: min(520px, calc(100vw - 32px));
  padding: 10px;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 4px;
  border: 1px solid var(--color-line);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.98);
  box-shadow: var(--shadow-float);
}

.tool-panel a {
  min-width: 0;
  padding: 12px;
  display: flex;
  align-items: flex-start;
  gap: 10px;
  border-radius: 12px;
  transition: background-color 160ms ease;
}

.tool-panel a:hover,
.tool-panel a.is-active {
  background: var(--color-soft-accent);
}

.tool-number {
  padding-top: 2px;
  color: var(--color-accent);
  font-family: var(--font-mono);
  font-size: 10px;
}

.tool-panel a > span:last-child {
  min-width: 0;
  display: grid;
  gap: 3px;
}

.tool-panel strong,
.tool-panel small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tool-panel strong {
  color: var(--color-ink);
  font-size: 13px;
}

.tool-panel small {
  color: var(--color-muted);
  font-size: 10px;
}

.nav-toggle {
  display: none;
}

.route-masthead {
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  background: radial-gradient(circle at 78% 0%, rgba(83, 105, 255, 0.28), transparent 32%), #0d1018;
  color: #fff;
}

.route-masthead-inner {
  width: min(calc(100% - 48px), var(--site-width));
  min-height: 188px;
  margin: 0 auto;
  padding: 44px 0;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 40px;
}

.section-kicker {
  margin: 0 0 14px;
  color: #8997ff;
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.2em;
}

.route-masthead h1 {
  margin: 0;
  font-size: clamp(30px, 4vw, 50px);
  letter-spacing: -0.05em;
}

.route-masthead p:last-child {
  margin: 9px 0 0;
  color: rgba(255, 255, 255, 0.54);
  font-size: 14px;
}

.back-home {
  padding: 10px 15px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 999px;
  color: rgba(255, 255, 255, 0.84);
  font-size: 12px;
  white-space: nowrap;
}

.back-home:hover {
  border-color: rgba(255, 255, 255, 0.42);
  color: #fff;
}

.site-main {
  width: 100%;
  flex: 1;
  padding: 24px;
  background: #eef2f7;
}

.site-main.is-home {
  padding: 0;
  background: var(--color-canvas);
}

.site-footer {
  border-top: 1px solid var(--color-line);
  background: var(--color-canvas);
}

.footer-inner {
  width: min(calc(100% - 48px), var(--site-width));
  min-height: 76px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  color: var(--color-muted);
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 0.11em;
}

.footer-inner nav {
  display: flex;
  gap: 22px;
}

.footer-inner a:hover {
  color: var(--color-ink);
}

@media (max-width: 960px) {
  .primary-nav {
    display: none;
  }
}

@media (max-width: 640px) {
  .site-header {
    height: 64px;
  }

  .header-inner,
  .route-masthead-inner,
  .footer-inner {
    width: min(calc(100% - 32px), var(--site-width));
  }

  .brand-mark {
    width: 34px;
    height: 34px;
  }

  .brand-copy small {
    display: none;
  }

  .nav-toggle {
    width: 40px;
    height: 40px;
    display: grid;
    place-content: center;
    gap: 6px;
    border: 1px solid var(--color-line);
    border-radius: 50%;
    background: #fff;
    cursor: pointer;
  }

  .nav-toggle span {
    width: 16px;
    height: 1px;
    display: block;
    background: var(--color-ink);
  }

  .navigation {
    position: absolute;
    top: 64px;
    right: 0;
    left: 0;
    padding: 16px;
    display: none;
    border-bottom: 1px solid var(--color-line);
    background: rgba(248, 247, 244, 0.98);
    box-shadow: 0 18px 30px rgba(17, 19, 24, 0.08);
  }

  .navigation.is-open {
    display: block;
  }

  .primary-nav {
    margin-bottom: 12px;
    display: grid;
  }

  .primary-nav a {
    padding: 12px;
    border-radius: 10px;
  }

  .primary-nav a::after {
    display: none;
  }

  .primary-nav a.is-active {
    background: var(--color-soft-accent);
  }

  .tool-menu summary {
    width: 100%;
    justify-content: space-between;
    border-radius: 11px;
  }

  .tool-panel {
    position: static;
    width: 100%;
    max-height: 50vh;
    margin-top: 8px;
    grid-template-columns: 1fr;
    overflow-y: auto;
    box-shadow: none;
  }

  .route-masthead-inner {
    min-height: 166px;
    padding: 32px 0;
    align-items: flex-start;
    flex-direction: column;
    gap: 24px;
  }

  .site-main {
    padding: 12px;
  }

  .footer-inner {
    padding: 24px 0;
    align-items: flex-start;
    flex-direction: column;
  }

  .footer-inner nav {
    flex-wrap: wrap;
  }
}
</style>
