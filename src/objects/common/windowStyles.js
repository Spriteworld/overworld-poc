import skins from '@Data/windowSkins.json';

export const WINDOW_STYLES = {
  default: {
    label: 'Default',
    texture: null,
    padL: 0, padR: 0, padY: 0,
  },
};

for (const skin of skins) {
  WINDOW_STYLES[skin.key] = {
    label: skin.label,
    texture: `win_${skin.key}`,
    leftWidth: skin.leftWidth,
    rightWidth: skin.rightWidth,
    topHeight: skin.topHeight,
    bottomHeight: skin.bottomHeight,
    textboxTextColor: skin.textColor,
    padL: Math.round(skin.leftWidth * 0.35),
    padR: Math.round(skin.rightWidth * 0.35),
    padY: Math.round(Math.max(skin.topHeight, skin.bottomHeight) * 0.4),
  };
}

export const WINDOW_STYLE_KEYS = Object.keys(WINDOW_STYLES);
