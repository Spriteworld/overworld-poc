/**
 * Lazy-loaded trainer/NPC sprite factories, keyed by filename without extension.
 * Values are `() => Promise<string>` (Vite `import.meta.glob` lazy factories).
 * Call `factory()` to get the resolved URL, then pass it to `scene.load.spritesheet`.
 */
const _glob = import.meta.glob('./*.png', { eager: false, query: '?url', import: 'default' });

export default Object.fromEntries(
  Object.entries(_glob).map(([path, factory]) => [
    path.slice(2).replace('.png', ''), // './red_bike.png' → 'red_bike'
    factory,
  ])
);
