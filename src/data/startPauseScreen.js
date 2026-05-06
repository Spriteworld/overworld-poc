let _screen = null;

export function getStartPauseScreen() { return _screen; }
export function setStartPauseScreen(name) { _screen = name || null; }
export function clearStartPauseScreen() { _screen = null; }
