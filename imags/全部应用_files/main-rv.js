/*
 * Copyright (c) 2022 Institute of Software Chinese Academy of Sciences (ISCAS)
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { createApp } from '/node_modules/.vite/deps/vue.js?v=0414b03c'
import App from '/src/deskbuild/App-rv.vue'
import { throttle } from '/src/utils/help.ts'
import '/src/assets/css/common.css'
import '/src/assets/css/index.css'
import '/src/assets/css/common-new.css'
import '/src/assets/css/style.css'
import '/src/assets/css/button.scss'
import '/src/assets/css/font.css'
import installElementPlus from '/src/plugins/element.js'
import router from '/src/deskbuild/router/index.js?t=1707368219670'
import i18n from '/src/language/index.js'
import '/src/deskbuild/utils/JSEncryptLong.ts'
import { setRvUser } from '/src/utils/rvUtils.ts'

//rv用户环境变量
setRvUser()

let app = createApp(App)
installElementPlus(app)

import { loading } from '/src/components/loading/index.js'

app.directive('request', loading)

// 添加路由守卫
router.beforeEach(async (to, from, next) => {
  const { title, icon } = to.meta
  if (title) {
    document.title = title
  }
  if (icon) {
    const link = document.querySelector('link[rel*="icon"]')
    link.href = icon
  }

  next()
})
/**
 * 添加节流指令
 */
app.directive('throttle', {
  mounted(el, binding, vnode) {
    if (el._vei && el._vei.onClick && !el._vei.onClick._throttle) {
      let wrapClick = throttle(el._vei.onClick.value, isNaN(binding.value) ? 100 : binding.value)
      el._vei.onClick.value = wrapClick
      el._vei.onClick._throttle = true
    }
  }
})

/**
 * 添加计算布局指令
 */
app.directive('rect', {
  mounted(el, binding, vnode) {
    let rect = el.getBoundingClientRect()
    let fn = binding.value
    if (typeof fn === 'function') {
      fn(el, rect)
    }
  }
})

app.use(i18n).use(router).mount('#app')
