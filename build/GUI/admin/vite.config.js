import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // 只要是 /menu 開頭的請求，全部轉發給 4000
      "/menu": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
      // 如果還有其他 api 開頭的，也轉發
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
      "/order": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
      "/admin": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
    },
  },
})

