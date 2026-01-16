import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Increase the warning limit to 1000kb (1MB) to silence the noise
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        // Automatically put heavy libraries in their own file
        manualChunks: {
          vendor: ['react', 'react-dom'],
          mantine: ['@mantine/core', '@mantine/hooks', '@mantine/notifications'],
          icons: ['@tabler/icons-react']
        }
      }
    }
  }
})
