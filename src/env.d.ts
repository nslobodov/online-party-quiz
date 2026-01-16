// env.d.ts
/// <reference types="vite/client" />

declare module '*.vue' {
    import type { DefineComponent } from 'vue'
    const component: DefineComponent<{}, {}, any>
    export default component
}

// Переменные окружения Vite
interface ImportMetaEnv {
    readonly VITE_SOCKET_URL: string
    readonly VITE_API_URL: string
}

interface ImportMeta {
    readonly env: ImportMetaEnv
}