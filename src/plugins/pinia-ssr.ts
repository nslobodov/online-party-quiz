import { createPinia } from 'pinia'

export default defineNuxtPlugin((nuxtApp) => {
  const pinia = createPinia()
  nuxtApp.vueApp.use(pinia)
  
  if (process.server) {
    nuxtApp.payload.pinia = pinia.state.value
  }
  
  if (process.client && nuxtApp.payload.pinia) {
    pinia.state.value = nuxtApp.payload.pinia
  }
})