const _glob = import.meta.glob('./*.png', { eager: false, query: '?url', import: 'default' });

export default Object.fromEntries(
  Object.entries(_glob).map(([path, factory]) => [
    path.slice(2).replace('.png', ''),
    factory,
  ])
);
