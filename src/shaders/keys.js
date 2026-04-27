// Shader key constants split out from index.js so non-shader code can
// reference them without dragging the .ts pipeline modules into Jest's
// resolver (Jest doesn't transpile .ts by default in this project).

export const SHADER_KEYS = {
  GRADIENT:     'fx_gradient',
  DARKNESS:     'fx_darkness',
  WATER:        'fx_water',
  RAIN:         'fx_rain',
  FOG:          'fx_fog',
  SANDSTORM:    'fx_sandstorm',
  SNOW:         'fx_snow',
  SUNLIGHT:     'fx_sunlight',
  TIME_OVERLAY: 'fx_time_overlay',
};
