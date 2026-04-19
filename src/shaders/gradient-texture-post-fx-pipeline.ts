import { CustomPipeline } from './custom-pipeline';

const frag = `
#define SHADER_NAME GRADIENT_TEXTURE_POST_FX

#ifdef GL_ES
precision mediump float;
#endif

uniform sampler2D uMainSampler;
uniform sampler2D uGradientTexture;
uniform float uCutoff;
// coordinate from the vertex shader
varying vec2 outTexCoord;

// Single gradient-driven cutoff (Simoes part 2). Each gradient PNG's red
// channel encodes the order in which pixels are eaten by the transition:
// the lowest red values vanish to black first, the highest vanish last.
// All visual variety (wipe, bars, spiral, gooey, …) lives in the asset.
void main() {
  vec4 g = texture2D(uGradientTexture, outTexCoord);
  if (g.r < uCutoff) {
    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
  } else {
    gl_FragColor = texture2D(uMainSampler, outTexCoord);
  }
}
`;

export class GradientTexturePostFxPipeline extends CustomPipeline {
  protected _gradientTexture!: Phaser.Renderer.WebGL.Wrappers.WebGLTextureWrapper;
  // Stash the desired texture key separately so onBoot's bind respects whatever
  // the caller most recently asked for. Phaser may fire onBoot asynchronously
  // (after setPostPipeline returns) — so any setTexture() called in between
  // would otherwise be clobbered by onBoot's default.
  protected _gradientKey: string | null = null;

  constructor(game: Phaser.Game) {
    super(game, frag);
  }

  onBoot(): void {
    if (this._gradientKey) this._bindKey(this._gradientKey);
  }

  setTexture(key: string) {
    this._gradientKey = key;
    this._bindKey(key);
  }

  protected _bindKey(key: string) {
    const exists = this.game.textures.exists(key);
    const frame  = this.game.textures.getFrame(key);
    console.log('[GradientFx] _bindKey', { key, exists, hasFrame: !!frame, hasGlTexture: !!frame?.glTexture });
    if (!exists || !frame) {
      this._gradientTexture = undefined as unknown as Phaser.Renderer.WebGL.Wrappers.WebGLTextureWrapper;
      console.warn('[GradientTexturePostFxPipeline] missing texture for key:', key);
      return;
    }
    this._gradientTexture = frame.glTexture;
  }

  onPreRender(): void {
    super.onPreRender();
    this.set1i('uGradientTexture', 1);
  }

  onDraw(renderTarget: Phaser.Renderer.WebGL.RenderTarget) {
    if (this._gradientTexture) this.bindTexture(this._gradientTexture, 1);
    this.bindAndDraw(renderTarget);
  }
}
