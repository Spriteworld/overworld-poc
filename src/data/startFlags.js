let _flags = null;

export function getStartFlags() { return _flags; }
export function setStartFlags(flags) { _flags = flags ? { ...flags } : null; }
export function clearStartFlags() { _flags = null; }
