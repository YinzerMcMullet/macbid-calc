import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// base './' so the build works on Cloudflare Pages, GitHub Pages, or any subpath
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
})
