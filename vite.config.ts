import type { ProxyOptions } from "vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vitest/config"

function ncProxy(prefix: string, target: string): ProxyOptions {
  return {
    target,
    changeOrigin: true,
    rewrite: (path) => path.replace(new RegExp(`^${prefix}`), ""),
    configure: (proxy) => {
      proxy.on("proxyReq", (proxyReq) => {
        proxyReq.setHeader("Referer", "https://aion2.plaync.com/en-us/characters/index")
        proxyReq.setHeader("Origin", "https://aion2.plaync.com")
      })
    },
  }
}

const proxy = {
  "/nc-search": ncProxy("/nc-search", "https://api-search.plaync.com"),
  "/nc-aion": ncProxy("/nc-aion", "https://aion2.plaync.com"),
  "/youtube": {
    target: "https://www.youtube.com",
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/youtube/, ""),
    configure: (youtubeProxy) => {
      youtubeProxy.on("proxyReq", (proxyReq) => {
        proxyReq.setHeader("Accept", "text/html")
        proxyReq.setHeader("Accept-Language", "en-US,en")
        proxyReq.setHeader("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
      })
    },
  } satisfies ProxyOptions,
}

export default defineConfig({
  plugins: [react()],
  server: { proxy, port: 5173 },
  preview: { proxy, port: 4173 },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
})
