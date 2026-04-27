/**
 * Normalize a command array from either format:
 *   - Flat JSON:   { "cmd": "text", "text": "..." }
 *   - Tiled class: { "propertytype": "cmd-text", "type": "class", "value": { "text": "..." } }
 *
 * Recursively normalizes nested branch arrays (then/else/yes/no).
 */
export function normalize(cmds) {
  return cmds.map(item => {
    const flat = (item?.type === 'class' && typeof item.propertytype === 'string' && item.propertytype.startsWith('cmd-'))
      ? { cmd: item.propertytype.slice(4), ...item.value }
      : item;
    if (!flat || typeof flat !== 'object') return flat;
    for (const key of ['then', 'else', 'yes', 'no']) {
      if (Array.isArray(flat[key])) flat[key] = normalize(flat[key]);
    }
    // `parallel.branches` is an array where each entry is a sub-script.
    // Accept several authoring shapes:
    //   - raw array of commands (JSON-only):    [[cmd, cmd], [cmd]]
    //   - Tiled `branch` wrapper class:         [{type:'class', propertytype:'branch', value:{commands:[...]}}]
    //   - already-normalized branch wrapper:    [{commands:[cmd, cmd]}]
    //   - single-command shorthand (Tiled UX):  [cmd, cmd, cmd]  → each cmd becomes its own one-command branch
    if (Array.isArray(flat.branches)) {
      flat.branches = flat.branches.map(b => {
        if (b?.type === 'class' && b?.propertytype === 'branch') {
          return Array.isArray(b.value?.commands) ? normalize(b.value.commands) : [];
        }
        if (b && Array.isArray(b.commands)) return normalize(b.commands);
        if (Array.isArray(b)) return normalize(b);
        return normalize([b]);
      });
    }
    return flat;
  });
}

/**
 * Validate a command array and return an array of warning strings.
 * Recurses into then/else/yes/no branches.
 */
export function validate(commands, path = 'root') {
  const KNOWN = new Set([
    'text', 'yes_no', 'give_item', 'remove_item', 'set_flag', 'if_flag',
    'if_has_item', 'give_pokemon', 'give_starter', 'enable_input', 'disable_input',
    'move_player', 'move_npc', 'walk_to_char', 'spawn_npc', 'spawn_pkmn', 'remove_npc',
    'move_to_box', 'if_party_count', 'teach_move', 'warp_player', 'warp_npc',
    'walk_warp_continue', 'teleport_to_pokecenter', 'escape_rope', 'wait',
    'wait_input', 'set_var', 'if_var', 'if_variant', 'if_facing', 'if_npc_at', 'heal_party',
    'show_exclamation', 'knockback', 'look', 'face_char', 'movement_behavior',
    'play_sound', 'stop_sound', 'bgm_start', 'bgm_stop',
    'fade_out', 'fade_in', 'camera_pan',
    'camera_follow_player', 'camera_follow_npc',
    'start_battle',
    'parallel',
    'darkness_enable', 'darkness_disable', 'darkness_set_radius',
    'add_light', 'remove_light', 'set_light',
  ]);
  const REQUIRED = {
    text:              ['text'],
    yes_no:            ['text'],
    give_item:         ['item'],
    remove_item:       ['item'],
    set_flag:          ['key'],
    if_flag:           ['key'],
    if_has_item:       ['item'],
    give_pokemon:      ['species'],
    give_starter:      ['index'],
    move_npc:          ['character'],
    walk_to_char:      ['character1', 'character2', 'side'],
    spawn_npc:         ['name', 'texture'],
    spawn_pkmn:        ['name', 'texture'],
    remove_npc:        ['name'],
    if_party_count:    ['count'],
    teach_move:        ['move'],
    warp_player:       ['map'],
    warp_npc:          ['character'],
    walk_warp_continue: ['map'],
    set_var:           ['key', 'value'],
    if_var:            ['key', 'value'],
    if_variant:        ['value'],
    if_facing:         ['direction'],
    if_npc_at:         ['name'],
    look:              ['direction'],
    face_char:         ['character1', 'character2'],
    movement_behavior: ['character1', 'value'],
    play_sound:        ['key'],
    bgm_start:         ['key'],
    camera_follow_npc: ['name'],
    start_battle:      ['team'],
    darkness_set_radius: ['radius'],
    add_light:           ['name'],
    remove_light:        ['name'],
    set_light:           ['name'],
  };
  const warnings = [];
  commands.forEach((cmd, i) => {
    const loc = `${path}[${i}]`;
    if (!cmd.cmd) { warnings.push(`${loc}: missing "cmd" field`); return; }
    if (!KNOWN.has(cmd.cmd)) { warnings.push(`${loc}: unknown command "${cmd.cmd}"`); return; }
    for (const field of (REQUIRED[cmd.cmd] ?? [])) {
      if (cmd[field] == null) { warnings.push(`${loc} (${cmd.cmd}): missing required field "${field}"`); }
    }
    for (const key of ['then', 'else', 'yes', 'no']) {
      if (Array.isArray(cmd[key])) { warnings.push(...validate(cmd[key], `${loc}.${key}`)); }
    }
    if (Array.isArray(cmd.branches)) {
      cmd.branches.forEach((b, j) => {
        if (Array.isArray(b)) warnings.push(...validate(b, `${loc}.branches[${j}]`));
      });
    }
  });
  return warnings;
}
