<script setup lang="ts">
import { computed } from 'vue'
import { ArrowRight } from '@element-plus/icons-vue'

import { modules } from '@/modules'

const doneCount = computed(() => modules.filter((module) => module.status === 'done').length)

const principles = [
  {
    number: '01',
    title: '学习过程统一沉淀',
    copy: '记录、练习、复盘与统计在同一入口汇合，减少工具切换，让每次投入都有连续上下文。',
  },
  {
    number: '02',
    title: '本地数据优先',
    copy: '学习进度保存在浏览器本地，常用模块无需账号即可进入，同时保留导入导出能力。',
  },
  {
    number: '03',
    title: '训练反馈可追踪',
    copy: '围绕听写、词汇和复盘组织状态与统计，把零散练习转化为可回看的学习轨迹。',
  },
]
</script>

<template>
  <div class="home">
    <section class="hero-section">
      <div class="hero-glow" aria-hidden="true"></div>
      <div class="hero-inner">
        <div class="hero-copy">
          <p class="hero-kicker"><span></span> IELTS DEV · LOCAL LEARNING WORKSPACE</p>
          <h1>
            让每一次学习<br />
            <em>都有迹可循</em>
          </h1>
          <p class="hero-description">
            为 IELTS 备考整合记录、词汇、听写与精听。把分散的练习工具收进一个本地优先、随开随用的学习工作台。
          </p>
          <div class="hero-actions">
            <RouterLink class="action-primary" to="/study-tracker">
              开始今日学习 <ArrowRight class="action-icon" />
            </RouterLink>
            <a class="action-secondary" href="#modules">浏览全部工具 <span>↓</span></a>
          </div>
          <p class="hero-focus">CORE FOCUS — 记录 / 词汇 / 听写 / 精听 / 复盘</p>
        </div>

        <div class="workspace-card" aria-label="学习工作台状态">
          <div class="workspace-bar">
            <span class="window-dots" aria-hidden="true"><i></i><i></i><i></i></span>
            <span>ielts-dev@workspace: ~/today</span>
            <b>LEARN</b>
          </div>
          <div class="workspace-body mono">
            <div class="command"><span>$</span> workspace --status</div>
            <div class="output"><strong>{{ doneCount }} / {{ modules.length }}</strong> 个学习模块已就绪</div>
            <div class="command"><span>$</span> storage --mode</div>
            <div class="output"><strong>LOCAL FIRST</strong> · 浏览器本地持久化</div>
            <div class="command"><span>$</span> next --recommend</div>
            <div class="output accent"><strong>READY</strong> · 从今日记录开始</div>
          </div>
          <div class="workspace-foot mono">
            <span>LEARNING.LOG</span>
            <span><i></i> SYSTEM AVAILABLE</span>
          </div>
        </div>
      </div>

      <div class="hero-stats">
        <div><strong>{{ modules.length }}</strong><span>学习模块</span></div>
        <div><strong>84</strong><span>自动化测试</span></div>
        <div><strong>3</strong><span>核心学习场景</span></div>
        <div><strong>1</strong><span>统一学习入口</span></div>
      </div>
    </section>

    <section class="principles-section">
      <div class="section-heading split-heading">
        <div>
          <p class="section-kicker">01 / LEARNING SYSTEM</p>
          <h2>把零散练习<br />组织成学习系统</h2>
        </div>
        <p class="heading-note mono">RECORD · PRACTICE · REVIEW<br />COMPOSED INTO ONE WORKSPACE.</p>
      </div>

      <div class="principle-grid">
        <article v-for="principle in principles" :key="principle.number" class="principle-card">
          <span class="principle-number mono">{{ principle.number }}</span>
          <h3>{{ principle.title }}</h3>
          <p>{{ principle.copy }}</p>
        </article>
      </div>
    </section>

    <section id="modules" class="modules-section">
      <div class="section-heading split-heading">
        <div>
          <p class="section-kicker">02 / LEARNING MODULES</p>
          <h2>选择今天的<br />学习入口</h2>
        </div>
        <p class="heading-note mono">EIGHT FOCUSED TOOLS<br />ONE CONTINUOUS ROUTINE.</p>
      </div>

      <div class="module-grid">
        <RouterLink
          v-for="(module, index) in modules"
          :key="module.id"
          class="module-card"
          :to="`/${module.id}`"
        >
          <div class="module-topline">
            <span class="mono">MODULE / {{ String(index + 1).padStart(2, '0') }}</span>
            <span class="module-status"><i></i> READY</span>
          </div>

          <div class="module-title-row">
            <span class="module-icon">
              <el-icon :size="22"><component :is="module.icon" /></el-icon>
            </span>
            <div>
              <h3>{{ module.title }}</h3>
              <p>{{ module.subtitle }}</p>
            </div>
          </div>

          <p class="module-summary">{{ module.summary }}</p>

          <div class="feature-list">
            <span v-for="feature in module.features.slice(0, 3)" :key="feature">{{ feature }}</span>
          </div>

          <div class="module-link">
            打开学习模块
            <ArrowRight />
          </div>
        </RouterLink>
      </div>
    </section>

    <section class="closing-section">
      <div>
        <p class="section-kicker">03 / START TODAY</p>
        <h2>今天的进步，<br />从一条记录开始。</h2>
        <p>打开学习状态跟踪，建立今天的任务、投入和复盘。</p>
      </div>
      <RouterLink class="closing-action" to="/study-tracker">
        进入学习记录 <ArrowRight />
      </RouterLink>
    </section>
  </div>
</template>

<style scoped>
.home {
  overflow: hidden;
}

.hero-section {
  position: relative;
  isolation: isolate;
  overflow: hidden;
  background: #0b0e15;
  color: #fff;
}

.hero-section::before {
  position: absolute;
  z-index: -1;
  inset: 0;
  background-image: radial-gradient(rgba(255, 255, 255, 0.1) 0.8px, transparent 0.8px);
  background-size: 20px 20px;
  content: '';
  opacity: 0.34;
}

.hero-glow {
  position: absolute;
  z-index: -1;
  top: -260px;
  left: 44%;
  width: 820px;
  height: 720px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(73, 96, 255, 0.42), rgba(34, 43, 112, 0.16) 42%, transparent 70%);
  filter: blur(10px);
}

.hero-inner,
.hero-stats,
.principles-section,
.modules-section,
.closing-section {
  width: min(calc(100% - 48px), var(--site-width));
  margin: 0 auto;
}

.hero-inner {
  min-height: 650px;
  padding: 88px 0 72px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(430px, 0.88fr);
  align-items: center;
  gap: clamp(48px, 7vw, 110px);
}

.hero-kicker,
.section-kicker {
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.2em;
}

.hero-kicker {
  margin: 0 0 28px;
  display: flex;
  align-items: center;
  gap: 11px;
  color: rgba(255, 255, 255, 0.54);
}

.hero-kicker span {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #57c986;
  box-shadow: 0 0 0 5px rgba(87, 201, 134, 0.1);
}

.hero-copy h1 {
  margin: 0;
  font-size: clamp(54px, 6.7vw, 94px);
  font-weight: 760;
  letter-spacing: -0.075em;
  line-height: 0.98;
}

.hero-copy h1 em {
  background: linear-gradient(90deg, #ffffff 5%, #a6b0ff 42%, #7285ff 92%);
  background-clip: text;
  color: transparent;
  font-style: normal;
}

.hero-description {
  max-width: 610px;
  margin: 30px 0 0;
  color: rgba(255, 255, 255, 0.62);
  font-size: 16px;
  line-height: 1.9;
}

.hero-actions {
  margin-top: 34px;
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.action-primary,
.action-secondary {
  min-height: 44px;
  padding: 0 19px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 9px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 650;
  transition: transform 180ms ease, background-color 180ms ease;
}

.action-primary {
  background: #fff;
  color: #111318;
}

.action-secondary {
  border: 1px solid rgba(255, 255, 255, 0.16);
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.86);
}

.action-primary:hover,
.action-secondary:hover {
  transform: translateY(-2px);
}

.action-secondary:hover {
  background: rgba(255, 255, 255, 0.09);
}

.action-icon,
.module-link svg,
.closing-action svg {
  width: 14px;
}

.hero-focus {
  margin: 32px 0 0;
  color: rgba(255, 255, 255, 0.34);
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 0.14em;
}

.workspace-card {
  position: relative;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 20px;
  background: rgba(20, 23, 33, 0.9);
  box-shadow: 0 38px 90px rgba(0, 0, 0, 0.42);
  overflow: hidden;
  transform: perspective(900px) rotateY(-2deg) rotateX(1deg);
}

.workspace-card::after {
  position: absolute;
  top: -30px;
  right: -20px;
  width: 106px;
  height: 100px;
  border-radius: 18px;
  background: linear-gradient(145deg, #5b73ff, #7456e9);
  box-shadow: 0 14px 42px rgba(91, 115, 255, 0.36);
  content: 'IELTS\A DEV';
  padding: 36px 0 0 25px;
  color: #fff;
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.14em;
  line-height: 1.7;
  white-space: pre;
  transform: rotate(6deg);
}

.workspace-bar {
  min-height: 54px;
  padding: 0 22px;
  display: flex;
  align-items: center;
  gap: 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.35);
  font-family: var(--font-mono);
  font-size: 10px;
}

.workspace-bar b {
  margin-left: auto;
  padding-right: 72px;
  color: rgba(255, 255, 255, 0.54);
  font-size: 9px;
  letter-spacing: 0.12em;
}

.window-dots {
  display: flex;
  gap: 6px;
}

.window-dots i {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: #ff6363;
}

.window-dots i:nth-child(2) {
  background: #f6c454;
}

.window-dots i:nth-child(3) {
  background: #59c97b;
}

.workspace-body {
  padding: 26px 22px 30px;
  display: grid;
  gap: 12px;
  font-size: 11px;
}

.command {
  color: rgba(255, 255, 255, 0.64);
}

.command span {
  margin-right: 10px;
  color: #8293ff;
}

.output {
  margin-bottom: 5px;
  padding: 13px 15px;
  border: 1px solid rgba(255, 255, 255, 0.035);
  border-radius: 9px;
  background: rgba(4, 6, 11, 0.38);
  color: rgba(255, 255, 255, 0.54);
}

.output strong {
  color: #fff;
}

.output.accent strong {
  color: #6fd595;
}

.workspace-foot {
  padding: 13px 22px;
  display: flex;
  justify-content: space-between;
  border-top: 1px solid rgba(255, 255, 255, 0.07);
  color: rgba(255, 255, 255, 0.24);
  font-size: 8px;
  letter-spacing: 0.1em;
}

.workspace-foot span:last-child {
  color: #68ca88;
}

.workspace-foot i {
  width: 5px;
  height: 5px;
  margin-right: 5px;
  display: inline-block;
  border-radius: 50%;
  background: currentColor;
}

.hero-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.hero-stats div {
  min-height: 112px;
  padding: 28px 26px;
  display: grid;
  gap: 5px;
  border-right: 1px solid rgba(255, 255, 255, 0.1);
}

.hero-stats div:first-child {
  padding-left: 0;
}

.hero-stats div:last-child {
  border-right: 0;
}

.hero-stats strong {
  font-size: 28px;
  letter-spacing: -0.04em;
}

.hero-stats span {
  color: rgba(255, 255, 255, 0.4);
  font-size: 11px;
}

.principles-section,
.modules-section {
  padding: 112px 0;
}

.modules-section {
  border-top: 1px solid var(--color-line);
}

.split-heading {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 48px;
}

.section-kicker {
  margin: 0 0 20px;
  color: var(--color-accent);
}

.section-heading h2 {
  margin: 0;
  color: var(--color-ink);
  font-size: clamp(38px, 5vw, 62px);
  letter-spacing: -0.065em;
  line-height: 1.08;
}

.heading-note {
  margin: 0 0 5px;
  color: #aaa8a2;
  font-size: 9px;
  letter-spacing: 0.12em;
  line-height: 1.8;
  text-align: right;
}

.principle-grid {
  margin-top: 62px;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  border-top: 1px solid var(--color-line);
  border-bottom: 1px solid var(--color-line);
}

.principle-card {
  min-height: 250px;
  padding: 32px;
  border-right: 1px solid var(--color-line);
}

.principle-card:first-child {
  padding-left: 0;
}

.principle-card:last-child {
  border-right: 0;
}

.principle-number {
  color: var(--color-accent);
  font-size: 10px;
}

.principle-card h3 {
  margin: 52px 0 13px;
  color: var(--color-ink);
  font-size: 21px;
  letter-spacing: -0.03em;
}

.principle-card p {
  margin: 0;
  color: var(--color-muted);
  font-size: 13px;
  line-height: 1.85;
}

.module-grid {
  margin-top: 62px;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.module-card {
  min-height: 340px;
  padding: 30px;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--color-line);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.72);
  box-shadow: 0 1px 0 rgba(255, 255, 255, 0.86) inset;
  transition: transform 200ms ease, border-color 200ms ease, box-shadow 200ms ease;
}

.module-card:hover {
  border-color: rgba(88, 103, 231, 0.28);
  box-shadow: 0 24px 60px rgba(20, 24, 42, 0.08);
  transform: translateY(-5px);
}

.module-topline {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: #aaa8a2;
  font-size: 9px;
  letter-spacing: 0.13em;
}

.module-status {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #62a878;
  font-family: var(--font-mono);
}

.module-status i {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}

.module-title-row {
  margin-top: 30px;
  display: flex;
  align-items: center;
  gap: 15px;
}

.module-icon {
  width: 48px;
  height: 48px;
  display: grid;
  place-items: center;
  flex: none;
  border-radius: 14px;
  background: var(--color-soft-accent);
  color: var(--color-accent);
}

.module-title-row h3 {
  margin: 0;
  color: var(--color-ink);
  font-size: 23px;
  letter-spacing: -0.04em;
}

.module-title-row p {
  margin: 5px 0 0;
  color: var(--color-muted);
  font-size: 11px;
}

.module-summary {
  margin: 22px 0 18px;
  color: #686761;
  font-size: 13px;
  line-height: 1.8;
}

.feature-list {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
}

.feature-list span {
  max-width: 100%;
  padding: 5px 9px;
  overflow: hidden;
  border: 1px solid #e4e2dc;
  border-radius: 999px;
  color: #77756f;
  font-size: 9px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.module-link {
  margin-top: auto;
  padding-top: 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: var(--color-accent);
  font-size: 11px;
  font-weight: 650;
}

.closing-section {
  min-height: 400px;
  margin-bottom: 72px;
  padding: clamp(44px, 7vw, 86px);
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 48px;
  border-radius: 30px;
  background: radial-gradient(circle at 82% 0%, rgba(80, 103, 255, 0.38), transparent 38%), #0b0e15;
  color: #fff;
  overflow: hidden;
}

.closing-section .section-kicker {
  color: #8d9aff;
}

.closing-section h2 {
  margin: 0;
  font-size: clamp(40px, 5.4vw, 68px);
  letter-spacing: -0.065em;
  line-height: 1.06;
}

.closing-section p:last-child {
  margin: 22px 0 0;
  color: rgba(255, 255, 255, 0.5);
  font-size: 13px;
}

.closing-action {
  min-height: 48px;
  padding: 0 20px;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  flex: none;
  border-radius: 999px;
  background: #fff;
  color: #111318;
  font-size: 13px;
  font-weight: 650;
}

@media (max-width: 980px) {
  .hero-inner {
    min-height: auto;
    padding-top: 72px;
    grid-template-columns: 1fr;
  }

  .workspace-card {
    max-width: 650px;
    transform: none;
  }

  .principle-card {
    padding: 28px 22px;
  }

  .principle-card:first-child {
    padding-left: 22px;
  }
}

@media (max-width: 720px) {
  .hero-inner,
  .hero-stats,
  .principles-section,
  .modules-section,
  .closing-section {
    width: min(calc(100% - 32px), var(--site-width));
  }

  .hero-inner {
    padding: 58px 0 50px;
    gap: 44px;
  }

  .hero-copy h1 {
    font-size: clamp(47px, 14vw, 66px);
  }

  .hero-description {
    font-size: 14px;
  }

  .workspace-card::after,
  .workspace-bar b {
    display: none;
  }

  .hero-stats {
    grid-template-columns: repeat(2, 1fr);
  }

  .hero-stats div,
  .hero-stats div:first-child {
    min-height: 92px;
    padding: 22px 16px;
  }

  .hero-stats div:nth-child(2) {
    border-right: 0;
  }

  .hero-stats div:nth-child(-n + 2) {
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  .principles-section,
  .modules-section {
    padding: 78px 0;
  }

  .split-heading {
    align-items: flex-start;
    flex-direction: column;
    gap: 24px;
  }

  .heading-note {
    text-align: left;
  }

  .principle-grid,
  .module-grid {
    grid-template-columns: 1fr;
  }

  .principle-card {
    min-height: auto;
    border-right: 0;
    border-bottom: 1px solid var(--color-line);
  }

  .principle-card:last-child {
    border-bottom: 0;
  }

  .principle-card h3 {
    margin-top: 32px;
  }

  .module-card {
    min-height: 330px;
    padding: 24px;
  }

  .closing-section {
    min-height: 430px;
    margin-bottom: 32px;
    padding: 34px 26px;
    align-items: flex-start;
    flex-direction: column;
    justify-content: space-between;
    border-radius: 22px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .action-primary,
  .action-secondary,
  .module-card {
    transition: none;
  }
}
</style>
