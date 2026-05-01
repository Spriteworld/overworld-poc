let _state = null;

export function getStartFlags() { return _state; }
export function setStartFlags(state) {
  if (!state) { _state = null; return; }
  _state = { ...state };
  if (state.flags) _state.flags = { ...state.flags };
  if (state.game)  _state.game  = { ...state.game };
}
export function clearStartFlags() { _state = null; }
