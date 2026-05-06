/**
 * Valid trainer-class / AI-type strings accepted by the battle engine.
 * Mirrors `@spriteworld/battle/src/objects/enums/TrainerClass.js`.
 */
export const AI_TYPES = [
  'wild',
  'trainer',
  'gym_leader',
  'elite_four',
  'champions',
  'gen_1', 'gen_2', 'gen_3', 'gen_4',
  'gen_5', 'gen_6', 'gen_7', 'gen_8',
];

export const DEFAULT_WILD_AI    = 'wild';
export const DEFAULT_TRAINER_AI = 'trainer';

/**
 * Normalize and validate an AI-type value. Returns the valid AI string on
 * success, or `fallback` when `value` is missing or unrecognized.
 * Unrecognized values log a warning so the caller doesn't silently mis-fire.
 */
export function resolveAiType(value, fallback) {
  if (value == null || value === '') return fallback;
  const v = String(value).toLowerCase();
  if (AI_TYPES.includes(v)) return v;
  console.warn(`[aiTypes] unknown ai_type "${value}" — falling back to "${fallback}". Valid: ${AI_TYPES.join(', ')}`);
  return fallback;
}
