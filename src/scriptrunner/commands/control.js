// Avoid a circular import: ScriptRunner ← index.js ← (this file).
// At call time the runner instance is passed in, so we can read its constructor.

export default {
  /**
   * Run a list of sub-scripts concurrently. Resumes the parent script only
   * after every branch completes. Use it for things like "all three Zubats
   * play their exclamation at the same time" instead of sequentially.
   *
   *   {
   *     "cmd": "parallel",
   *     "branches": [
   *       [{"cmd": "show_exclamation", "target": "MtMoonF1Zubat1"}],
   *       [{"cmd": "show_exclamation", "target": "MtMoonF1Zubat2"}],
   *       [{"cmd": "show_exclamation", "target": "MtMoonF1Zubat3"}]
   *     ]
   *   }
   *
   * Each branch is its own command queue with full ScriptRunner semantics
   * (yes_no / if_flag / nested parallel all work). Branches share the
   * scene with the parent but run as child runners — they don't claim
   * `_activeScriptRunner` and don't emit script-runner-start/end, so the
   * parent stays the single owner of those signals.
   */
  parallel(runner, cmd) {
    const branches = Array.isArray(cmd.branches) ? cmd.branches : [];
    if (branches.length === 0) { runner._step(); return; }

    const Runner   = runner.constructor;
    let remaining  = branches.length;
    const onBranchDone = () => {
      remaining -= 1;
      if (remaining === 0) runner._step();
    };

    for (const branch of branches) {
      const cmds = Array.isArray(branch) ? branch : [];
      new Runner(runner._scene, [...cmds], { child: true }).run(onBranchDone);
    }
  },
};
