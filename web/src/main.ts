import { createPinia } from 'pinia'
import { createApp } from 'vue'

import {
  ElAlert,
  ElButton,
  ElCard,
  ElCheckbox,
  ElDescriptions,
  ElDescriptionsItem,
  ElDialog,
  ElDivider,
  ElEmpty,
  ElForm,
  ElFormItem,
  ElIcon,
  ElInput,
  ElLoading,
  ElOption,
  ElSelect,
  ElSlider,
  ElSwitch,
  ElTag,
} from 'element-plus'

import 'element-plus/dist/index.css'
import '@/style.css'

import App from '@/App.vue'
import router from '@/router'

const app = createApp(App)

app.use(createPinia())
app.use(router)

for (const component of [
  ElAlert,
  ElButton,
  ElCard,
  ElCheckbox,
  ElDescriptions,
  ElDescriptionsItem,
  ElDialog,
  ElDivider,
  ElEmpty,
  ElForm,
  ElFormItem,
  ElIcon,
  ElInput,
  ElLoading,
  ElOption,
  ElSelect,
  ElSlider,
  ElSwitch,
  ElTag,
]) {
  app.use(component)
}

app.mount('#app')
