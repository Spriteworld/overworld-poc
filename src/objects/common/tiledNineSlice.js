/**
 * Creates a Phaser Image with a 9-slice window background.
 *
 * - Corners: drawn once at `scale` × source size
 * - Top / bottom edges: tiled horizontally at `scale`
 * - Left / right edges: stretched vertically (the border art has smooth
 *   vertical gradients that don't tile, but stretch cleanly)
 * - Center: filled with the source texture's center pixel color
 *
 * The canvas is rendered at `width*scale × height*scale` so pixel art
 * stays crisp when the parent container is scaled. The returned Image
 * is set to `1/scale` so it occupies `width × height` in authored space.
 *
 * @param {Phaser.Scene} scene
 * @param {string} textureKey
 * @param {number} width  - Target width in authored units
 * @param {number} height - Target height in authored units
 * @param {{leftWidth:number, rightWidth:number, topHeight:number, bottomHeight:number}} borders
 * @param {number} [scale=1] - Render multiplier for crisp upscaling
 * @returns {Phaser.GameObjects.Image}
 */
export default function tiledNineSlice(scene, textureKey, width, height, borders, scale) {
  const s = Math.max(1, Math.round(scale || 1));
  const l = borders.leftWidth | 0;
  const r = borders.rightWidth | 0;
  const t = borders.topHeight | 0;
  const b = borders.bottomHeight | 0;
  const w = (width * s) | 0;
  const h = (height * s) | 0;

  const sl = l * s;
  const sr = r * s;
  const st = t * s;
  const sb = b * s;

  const source = scene.textures.get(textureKey).getSourceImage();
  const sw = source.width;
  const sh = source.height;

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  const cw = sw - l - r; // source center strip width
  const ch = sh - t - b; // source center strip height
  const tw = w - sl - sr; // target center width
  const th = h - st - sb; // target center height

  if (cw <= 0 || ch <= 0) return scene.add.image(0, 0, textureKey).setOrigin(0, 0);

  // ── Center fill ──────────────────────────────────────────────────────
  const tmp = document.createElement('canvas');
  tmp.width = sw;
  tmp.height = sh;
  const tmpCtx = tmp.getContext('2d');
  tmpCtx.drawImage(source, 0, 0);
  const [cr, cg, cb, ca] = tmpCtx.getImageData(sw >> 1, sh >> 1, 1, 1).data;
  ctx.fillStyle = `rgba(${cr},${cg},${cb},${ca / 255})`;
  ctx.fillRect(sl, st, tw, th);

  // ── Corners (drawn once at scale, never tiled) ──────────────────────
  if (l > 0 && t > 0) ctx.drawImage(source, 0, 0, l, t, 0, 0, sl, st);
  if (r > 0 && t > 0) ctx.drawImage(source, sw - r, 0, r, t, w - sr, 0, sr, st);
  if (l > 0 && b > 0) ctx.drawImage(source, 0, sh - b, l, b, 0, h - sb, sl, sb);
  if (r > 0 && b > 0) ctx.drawImage(source, sw - r, sh - b, r, b, w - sr, h - sb, sr, sb);

  // ── Top edge (tile horizontally at scale) ───────────────────────────
  const scw = cw * s;
  if (t > 0 && tw > 0) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(sl, 0, tw, st);
    ctx.clip();
    for (let x = 0; x < tw; x += scw) {
      ctx.drawImage(source, l, 0, cw, t, sl + x, 0, scw, st);
    }
    ctx.restore();
  }

  // ── Bottom edge (tile horizontally at scale) ────────────────────────
  if (b > 0 && tw > 0) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(sl, h - sb, tw, sb);
    ctx.clip();
    for (let x = 0; x < tw; x += scw) {
      ctx.drawImage(source, l, sh - b, cw, b, sl + x, h - sb, scw, sb);
    }
    ctx.restore();
  }

  // ── Left edge (stretch vertically at scale) ─────────────────────────
  if (l > 0 && th > 0) {
    ctx.drawImage(source, 0, t, l, ch, 0, st, sl, th);
  }

  // ── Right edge (stretch vertically at scale) ────────────────────────
  if (r > 0 && th > 0) {
    ctx.drawImage(source, sw - r, t, r, ch, w - sr, st, sr, th);
  }

  const key = `_t9s_${textureKey}_${w}x${h}`;
  if (scene.textures.exists(key)) scene.textures.remove(key);
  scene.textures.addCanvas(key, canvas);

  const img = scene.add.image(0, 0, key).setOrigin(0, 0);
  if (s > 1) img.setScale(1 / s);
  return img;
}
