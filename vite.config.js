import { defineConfig } from 'vite';
import { resolve } from 'path';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [
    vue(),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@Data': resolve(__dirname, 'src/data/'),
      '@Maps': resolve(__dirname, 'src/maps/'),
      '@Objects': resolve(__dirname, 'src/objects/'),
      '@Tileset': resolve(__dirname, 'src/tileset/'),
      '@Scenes': resolve(__dirname, 'src/scenes/'),
      '@Utilities': resolve(__dirname, 'src/utilities/')
    }
  },
  server: {
    host: '0.0.0.0',
    port: 8085,
    allowedHosts: true,
  },
  define: {
    'process.env': {}
  },
  build: {
    assetsInlineLimit: 0,
    minify: true,
    rollupOptions: {
      output: {
        manualChunks: () => 'app',
        entryFileNames: `assets/[name]-[hash].js`,
        // chunkFileNames: `assets/[name].js`,
        assetFileNames: `assets/[name]-[hash].[ext]`
      }
    }
  },

  clearScreen: false,
});
