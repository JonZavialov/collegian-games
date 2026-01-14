import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/archive": {
        target: "https://panewsarchive.psu.edu",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/archive/, ""),
      },
      "/rss": {
        target: "https://www.psucollegian.com",
        changeOrigin: true,
        rewrite: () => "/search/?f=rss&l=50&t=article",
      },
    },
  },
})
