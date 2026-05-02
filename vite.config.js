import { defineConfig } from 'vite';
import { resolve } from 'path';
import { execFileSync } from 'child_process';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';


const MAP_REBUILDS = [
  ['kanto/kanto.json',              'kanto/update_kanto.py'],
  ['kanto/kanto_inside.json',       'kanto/update_kanto_insides.py'],
  ['kanto/kanto_dungeons.json',     'kanto/update_kanto_dungeons.py'],
  ['Gavworld/Gavworld.json',       'Gavworld/update_Gavworld.py'],
  ['Gavworld/Gavworld_inside.json', 'Gavworld/update_Gavworld_insides.py'],
  ['Gavworld/Gavworld_dungeons.json','Gavworld/update_Gavworld_dungeons.py'],
  ['spriteworld/spriteworld.json',         'spriteworld/update_spriteworld.py'],
  ['spriteworld/spriteworld_inside.json',  'spriteworld/update_spriteworld_insides.py'],
  ['spriteworld/spriteworld_dungeons.json','spriteworld/update_spriteworld_dungeons.py'],
];

function mapRebuildPlugin() {
  const mapsDir = resolve(__dirname, 'src/maps');
  return {
    name: 'map-rebuild',
    handleHotUpdate({ file, server }) {
      for (const [mapFile, script] of MAP_REBUILDS) {
        if (file === resolve(mapsDir, mapFile)) {
          const scriptPath = resolve(mapsDir, script);
          server.config.logger.info(`[map-rebuild] ${mapFile} changed — running ${script}`);
          try {
            execFileSync('python3', [scriptPath], { cwd: __dirname, stdio: 'inherit' });
            server.config.logger.info(`[map-rebuild] ${mapFile}: done`);
          } catch (e) {
            server.config.logger.error(`[map-rebuild] ${mapFile}: script failed (exit ${e.status})`);
          }
          return;
        }
      }
    },
  };
}

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
    tailwindcss(),
    vue(),
    mapRebuildPlugin(),
    phaserHmrPlugin(),
  ],
  resolve: {
    dedupe: ['phaser'],
    alias: {
      '@': resolve(__dirname, 'src'),
      '@Data': resolve(__dirname, 'src/data/'),
      '@Maps': resolve(__dirname, 'src/maps/'),
      '@Objects': resolve(__dirname, 'src/objects/'),
      '@Tileset': resolve(__dirname, 'src/tileset/'),
      '@Scenes': resolve(__dirname, 'src/scenes/'),
      '@Utilities': resolve(__dirname, 'src/utilities/'),
    }
  },
  server: {
    host: '0.0.0.0',
    port: 8085,
    allowedHosts: true,
    watch: {
      ignored: ['!**/src/**'],
    },
  },
  define: {
    'process.env': {}
  },
  build: {
    assetsInlineLimit: 0,
    minify: true,
    rollupOptions: {
      input: {
        main:         resolve(__dirname, 'index.html'),
        test:         resolve(__dirname, 'test.html'),
        scripteditor: resolve(__dirname, 'scripteditor/index.html'),
      },
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      }
    }
  },

  clearScreen: false,
});
