import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // host:true keeps the old "test it on your phone over WiFi" dev workflow working.
    host: true,
    port: 5173,
  },
})
