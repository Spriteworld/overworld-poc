import { defineConfig } from 'vite';
import { resolve } from 'path';
import { execFileSync } from 'child_process';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';


const MAP_REBUILDS = [
  ['kanto/master/maps/kanto.json', 'kanto/master/maps/update_kanto.py', 'worlds'],
  ['kanto/master/maps/kanto_inside.json', 'kanto/master/maps/update_kanto_insides.py', 'worlds'],
  ['kanto/master/maps/kanto_dungeons.json', 'kanto/master/maps/update_kanto_dungeons.py', 'worlds'],
  ['gavworld/master/maps/Gavworld.json', 'gavworld/master/maps/update_Gavworld.py', 'worlds'],
  ['gavworld/master/maps/Gavworld_inside.json', 'gavworld/master/maps/update_Gavworld_insides.py', 'worlds'],
  ['gavworld/master/maps/Gavworld_dungeons.json', 'gavworld/master/maps/update_Gavworld_dungeons.py', 'worlds'],
  ['spriteworld/spriteworld.json', 'spriteworld/update_spriteworld.py', 'src/maps'],
  ['spriteworld/spriteworld_inside.json', 'spriteworld/update_spriteworld_insides.py', 'src/maps'],
  ['spriteworld/spriteworld_dungeons.json', 'spriteworld/update_spriteworld_dungeons.py', 'src/maps'],
];

function mapRebuildPlugin() {
  return {
    name: 'map-rebuild',
    handleHotUpdate({ file, server }) {
      for (const [mapFile, script, baseDir] of MAP_REBUILDS) {
        const base = resolve(__dirname, baseDir);
        if (file === resolve(base, mapFile)) {
          const scriptPath = resolve(base, script);
          server.config.logger.info(`[map-rebuild] ${mapFile} changed — running ${script}`);
          try {
            execFileSync('python3', [scriptPath], { cwd: __dirname, stdio: 'inherit' });
            if (baseDir === 'worlds' && mapFile.startsWith('kanto/')) {
              execFileSync('python3', [resolve(base, 'kanto/master/maps/export_scripts.py')], { cwd: __dirname, stdio: 'inherit' });
            }

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
        file.includes('/worlds/') ||
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
      // Force every `import 'phaser'` to the root copy. Without this, the
      // nested copy at @spriteworld/battle/node_modules/phaser gets bundled
      // alongside the root one — esbuild emits Frame2/Text2 class duplicates
      // and Text instances created by one copy crash inside Frame methods
      // from the other (null `frame.data.drawImage`).
      phaser: resolve(__dirname, 'node_modules/phaser'),
      '@': resolve(__dirname, 'src'),
      '@Data': resolve(__dirname, 'src/data/'),
      '@Maps': resolve(__dirname, 'src/maps/'),
      '@Objects': resolve(__dirname, 'src/objects/'),
      '@Tileset': resolve(__dirname, 'src/tileset/'),
      '@Scenes': resolve(__dirname, 'src/scenes/'),
      '@Utilities': resolve(__dirname, 'src/utilities/'),
      '@Worlds': resolve(__dirname, 'worlds/'),
    }
  },
  server: {
    host: '0.0.0.0',
    port: 8085,
    allowedHosts: true,
    watch: {
      ignored: ['!**/src/**', '!**/worlds/**'],
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
