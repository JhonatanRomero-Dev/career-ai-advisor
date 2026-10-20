import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: [".trycloudflare.com"],
    proxy: {
      "/api": {
        target: "http://[::1]:3000",
        changeOrigin: true,
      },
    },
  },
  preview: {
    proxy: {
      "/api": {
        target: "http://[::1]:3000",
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          const normalizedId = id.replaceAll("\\", "/");

          if (/node_modules\/(react|react-dom|react-router|react-router-dom)\//.test(normalizedId)) return "react-vendor";
          if (normalizedId.includes("/framer-motion/")) return "motion-vendor";
          if (normalizedId.includes("/@tanstack/")) return "query-vendor";
          if (normalizedId.includes("/@radix-ui/")) return "radix-vendor";
          if (normalizedId.includes("/lucide-react/")) return "icons-vendor";

          return undefined;
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
