import { defineConfig } from 'vite';
import { resolve } from 'path';
import vue from '@vitejs/plugin-vue';

/** Force a full page reload for any Phaser scene/object file to avoid
 *  "scene.plugins.get(...) is null" errors caused by Phaser's plugin system
 *  being torn down mid-update during HMR. */
function phaserHmrPlugin() {
  return {
    name: 'phaser-hmr-full-reload',
    handleHotUpdate({ file, server }) {
      if (
        file.includes('/scenes/') ||
        file.includes('/objects/') ||
        file.includes('/data/config') ||
        file.includes('@spriteworld')
      ) {
        server.ws.send({ type: 'full-reload' });
        return [];
      }
    },
  };
}

export default defineConfig({
  plugins: [
    vue(),
    phaserHmrPlugin(),
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
