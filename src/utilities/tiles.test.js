import { checkOnlyIf } from './tiles.js';

// ─── helpers ──────────────────────────────────────────────────────────────────

function onlyIf(type, comparison, value) {
  return { type, comparison, value };
}

// ─── null / empty guard ───────────────────────────────────────────────────────

describe('checkOnlyIf — null / empty', () => {
  test('returns true when onlyIf is null', () => {
    expect(checkOnlyIf(null, {})).toBe(true);
  });

  test('returns true when onlyIf has no value array', () => {
    expect(checkOnlyIf({ type: 'flag', comparison: 'eq' }, {})).toBe(true);
  });

  test('returns true when value array is empty', () => {
    expect(checkOnlyIf(onlyIf('flag', 'eq', []), {})).toBe(true);
  });
});

// ─── type='flag' ──────────────────────────────────────────────────────────────

describe("checkOnlyIf — type='flag'", () => {
  describe("comparison='eq' (every flag truthy)", () => {
    test('passes when all flags are set', () => {
      expect(checkOnlyIf(onlyIf('flag', 'eq', ['a', 'b']), { a: true, b: 1 })).toBe(true);
    });

    test('fails when any flag is missing', () => {
      expect(checkOnlyIf(onlyIf('flag', 'eq', ['a', 'b']), { a: true })).toBe(false);
    });

    test('fails when a flag is falsy', () => {
      expect(checkOnlyIf(onlyIf('flag', 'eq', ['a']), { a: false })).toBe(false);
    });

    test('defaults to eq when comparison is omitted', () => {
      expect(checkOnlyIf({ type: 'flag', value: ['a'] }, { a: true })).toBe(true);
    });

    test('defaults to flag type when type is omitted', () => {
      expect(checkOnlyIf({ comparison: 'eq', value: ['a'] }, { a: true })).toBe(true);
    });
  });

  describe("comparison='neq' (every flag falsy)", () => {
    test('passes when all flags are unset', () => {
      expect(checkOnlyIf(onlyIf('flag', 'neq', ['a', 'b']), {})).toBe(true);
    });

    test('fails when any flag is truthy', () => {
      expect(checkOnlyIf(onlyIf('flag', 'neq', ['a', 'b']), { a: true })).toBe(false);
    });
  });

  describe("comparison='in' (at least one flag truthy)", () => {
    test('passes when one of multiple flags is set', () => {
      expect(checkOnlyIf(onlyIf('flag', 'in', ['a', 'b']), { b: true })).toBe(true);
    });

    test('passes when all flags are set', () => {
      expect(checkOnlyIf(onlyIf('flag', 'in', ['a', 'b']), { a: true, b: true })).toBe(true);
    });

    test('fails when no flags are set', () => {
      expect(checkOnlyIf(onlyIf('flag', 'in', ['a', 'b']), {})).toBe(false);
    });
  });

  describe("comparison='nin' (no flag truthy)", () => {
    test('passes when no flags are set', () => {
      expect(checkOnlyIf(onlyIf('flag', 'nin', ['a', 'b']), {})).toBe(true);
    });

    test('fails when any flag is set', () => {
      expect(checkOnlyIf(onlyIf('flag', 'nin', ['a', 'b']), { a: true })).toBe(false);
    });
  });
});

// ─── type='variable' ──────────────────────────────────────────────────────────

describe("checkOnlyIf — type='variable'", () => {
  const mapVars = { score: 10 };

  test('eq — passes when values are equal', () => {
    expect(checkOnlyIf(onlyIf('variable', 'eq', ['score', '10']), {}, null, mapVars)).toBe(true);
  });

  test('eq — fails when values differ', () => {
    expect(checkOnlyIf(onlyIf('variable', 'eq', ['score', '5']), {}, null, mapVars)).toBe(false);
  });

  test('neq — passes when values differ', () => {
    expect(checkOnlyIf(onlyIf('variable', 'neq', ['score', '5']), {}, null, mapVars)).toBe(true);
  });

  test('lt — passes when current < target', () => {
    expect(checkOnlyIf(onlyIf('variable', 'lt', ['score', '20']), {}, null, mapVars)).toBe(true);
  });

  test('lt — fails when current >= target', () => {
    expect(checkOnlyIf(onlyIf('variable', 'lt', ['score', '10']), {}, null, mapVars)).toBe(false);
  });

  test('lte — passes when current <= target', () => {
    expect(checkOnlyIf(onlyIf('variable', 'lte', ['score', '10']), {}, null, mapVars)).toBe(true);
  });

  test('gt — passes when current > target', () => {
    expect(checkOnlyIf(onlyIf('variable', 'gt', ['score', '5']), {}, null, mapVars)).toBe(true);
  });

  test('gt — fails when current <= target', () => {
    expect(checkOnlyIf(onlyIf('variable', 'gt', ['score', '10']), {}, null, mapVars)).toBe(false);
  });

  test('gte — passes when current >= target', () => {
    expect(checkOnlyIf(onlyIf('variable', 'gte', ['score', '10']), {}, null, mapVars)).toBe(true);
  });

  test('defaults missing variable to 0', () => {
    expect(checkOnlyIf(onlyIf('variable', 'eq', ['missing', '0']), {}, null, {})).toBe(true);
  });

  test('coerces string variable values to numbers', () => {
    expect(checkOnlyIf(onlyIf('variable', 'gte', ['score', '10']), {}, null, { score: '10' })).toBe(true);
  });

  test('key field — uses key for lookup, value[0] as target', () => {
    expect(checkOnlyIf({ type: 'variable', key: 'score', comparison: 'eq', value: ['10'] }, {}, null, { score: 10 })).toBe(true);
  });
});

// ─── type='flag' key + false target ───────────────────────────────────────────

describe("checkOnlyIf — type='flag' key with false target", () => {
  test('eq false — passes when flag is falsy', () => {
    expect(checkOnlyIf({ type: 'flag', key: 'a', comparison: 'eq', value: [false] }, {})).toBe(true);
  });

  test('eq false — fails when flag is truthy', () => {
    expect(checkOnlyIf({ type: 'flag', key: 'a', comparison: 'eq', value: [false] }, { a: true })).toBe(false);
  });

  test("eq 'false' string — passes when flag is falsy", () => {
    expect(checkOnlyIf({ type: 'flag', key: 'a', comparison: 'eq', value: ['false'] }, {})).toBe(true);
  });

  test('eq — no value defaults to true target, fails when flag is falsy', () => {
    expect(checkOnlyIf({ type: 'flag', key: 'a', comparison: 'eq', value: [] }, {})).toBe(false);
  });
});

// ─── type='variant' ───────────────────────────────────────────────────────────

describe("checkOnlyIf — type='variant'", () => {
  test("eq — passes when variant is in the list", () => {
    expect(checkOnlyIf(onlyIf('variant', 'eq', ['pallet', 'cerulean']), {}, 'pallet')).toBe(true);
  });

  test("eq — fails when variant is not in the list", () => {
    expect(checkOnlyIf(onlyIf('variant', 'eq', ['pallet']), {}, 'cerulean')).toBe(false);
  });

  test("neq — passes when variant is not in the list", () => {
    expect(checkOnlyIf(onlyIf('variant', 'neq', ['pallet']), {}, 'cerulean')).toBe(true);
  });

  test("neq — fails when variant is in the list", () => {
    expect(checkOnlyIf(onlyIf('variant', 'neq', ['pallet']), {}, 'pallet')).toBe(false);
  });

  test("in — passes when variant is in the list", () => {
    expect(checkOnlyIf(onlyIf('variant', 'in', ['pallet', 'cerulean']), {}, 'cerulean')).toBe(true);
  });

  test("nin — passes when variant is not in the list", () => {
    expect(checkOnlyIf(onlyIf('variant', 'nin', ['pallet']), {}, 'cerulean')).toBe(true);
  });

  test("nin — fails when variant is in the list", () => {
    expect(checkOnlyIf(onlyIf('variant', 'nin', ['pallet']), {}, 'pallet')).toBe(false);
  });

  test('passes when variant is null (no variant set on scene)', () => {
    expect(checkOnlyIf(onlyIf('variant', 'eq', ['pallet']), {}, null)).toBe(true);
  });

  test('passes when variant argument is omitted', () => {
    expect(checkOnlyIf(onlyIf('variant', 'eq', ['pallet']), {})).toBe(true);
  });
});

// ─── unknown type ─────────────────────────────────────────────────────────────

describe('checkOnlyIf — unknown type', () => {
  test('passes through for unrecognised type', () => {
    expect(checkOnlyIf(onlyIf('future_type', 'eq', ['x']), {})).toBe(true);
  });
});
