import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base is set for GitHub Pages project sites; override with BASE_PATH env.
export default defineConfig({
  plugins: [react()],
  base: process.env.BASE_PATH ?? '/',
})
