#!/usr/bin/env python3
"""
Export every named map-event script to a text file under
`src/maps/kanto/scripts/`. One file per event, named `{eventName}.txt`.

Walks the master map JSONs (kanto.json, kanto_inside.json, kanto_dungeons.json).
Any interactable object with a `name` and a `script` property is written out
as pretty-printed JSON of the script array (or, for the multiline-string
authoring form, the raw string).

Per-zone JSONs (route1.json, viridian_city.json, …) are skipped by default —
they're derived from the masters by the update_kanto*.py sync scripts and
would just produce identical duplicates. Pass `--include-zones` to back them
up too (useful when investigating a desync between master and zone files).

Re-runnable — overwrites existing files. Name collisions fall back to
`{mapStem}__{eventName}.txt`.

Usage:
    python export_scripts.py
    python export_scripts.py --include-zones
"""
import json
import sys
from pathlib import Path

HERE        = Path(__file__).parent
SCRIPTS_DIR = HERE / 'scripts'

# Master files first so they win the bare-name slot in collisions; per-zone
# JSONs are derived and would just duplicate.
MASTERS  = ['kanto.json', 'kanto_inside.json', 'kanto_dungeons.json']
EXCLUDED = set(MASTERS) | {
    # Tileset / index artefacts that happen to have .json extensions.
    'gid_map.json', 'dungeon_gid_map.json', 'inside_gid_map.json',
    'kanto_to_gen3.json',
}


def find_scripted_objects(data, results):
    """Recursively walk Tiled JSON, collecting (name, scriptValue) pairs for
    every object whose `properties` array contains an entry named `script`."""
    if isinstance(data, dict):
        # Object with name + properties[name=script]?
        name = data.get('name')
        props = data.get('properties')
        if name and isinstance(props, list):
            for p in props:
                if isinstance(p, dict) and p.get('name') == 'script':
                    results.append((name, p.get('value')))
                    break
        for value in data.values():
            find_scripted_objects(value, results)
    elif isinstance(data, list):
        for item in data:
            find_scripted_objects(item, results)


def dump_script(value):
    """Serialise a script value to a string. Lists/dicts → pretty JSON;
    strings (the multiline-string authoring form) → returned as-is."""
    if isinstance(value, str):
        return value
    return json.dumps(value, indent=2, ensure_ascii=False)


def safe_filename(name):
    """Trim characters that don't survive on Windows filesystems."""
    bad = '<>:"/\\|?*'
    return ''.join('_' if c in bad else c for c in name).strip() or 'unnamed'


def export_from(path, owners):
    """Read one map JSON and write its scripts. `owners` maps event name →
    map stem of the first file that exported it (so we can detect collisions
    on later files)."""
    try:
        with path.open(encoding='utf-8') as f:
            data = json.load(f)
    except Exception as e:
        print(f'  skip {path.name}: {e}')
        return 0

    found = []
    find_scripted_objects(data, found)
    written = 0
    for name, value in found:
        if value is None:
            continue
        base = safe_filename(name)
        if name in owners and owners[name] != path.stem:
            # Collision across maps — disambiguate later files.
            base = f'{path.stem}__{base}'
        else:
            owners.setdefault(name, path.stem)

        out_path = SCRIPTS_DIR / f'{base}.txt'
        out_path.write_text(dump_script(value), encoding='utf-8')
        written += 1
    print(f'{path.name}: {written} scripts')
    return written


def main():
    include_zones = '--include-zones' in sys.argv

    SCRIPTS_DIR.mkdir(exist_ok=True)
    # Wipe stale exports so a renamed/deleted event doesn't linger.
    for old in SCRIPTS_DIR.glob('*.txt'):
        old.unlink()

    owners = {}
    total  = 0

    for name in MASTERS:
        p = HERE / name
        if p.exists():
            total += export_from(p, owners)

    if include_zones:
        for p in sorted(HERE.glob('*.json')):
            if p.name in EXCLUDED:
                continue
            total += export_from(p, owners)

    extra = '' if include_zones else ' (run with --include-zones to also export per-zone files)'
    print(f'\nDone — wrote {total} script file(s) under {SCRIPTS_DIR}/{extra}')


if __name__ == '__main__':
    sys.exit(main() or 0)
