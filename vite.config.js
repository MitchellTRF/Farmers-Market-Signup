import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // ⚠️  Change '/market-signup/' to match your GitHub repository name exactly
  // e.g. if your repo is github.com/steve/farmers-market → base: '/farmers-market/'
  base:  '/Farmers-Market-Signup/',
})
