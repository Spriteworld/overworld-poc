/**
 * Flag raised while a scenario is running under the test harness.
 * When set, `saveGame` is a no-op so test party/bag/flag mutations never
 * reach localStorage and overwrite a real save.
 */
let _testMode = false;

export function isTestMode()   { return _testMode; }
export function setTestMode(v) { _testMode = !!v; }
export function clearTestMode() { _testMode = false; }
