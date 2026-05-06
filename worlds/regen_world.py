#!/usr/bin/env python3
"""
Regenerate derived map files for a world.

Runs the outdoor, inside, and dungeon update scripts in sequence for
the given world. Optionally runs export_scripts.py if present.

Usage:
    python worlds/regen_world.py kanto
    python worlds/regen_world.py gavworld
    python worlds/regen_world.py kanto --export-scripts
"""
import importlib.util
import sys
from pathlib import Path

WORLDS_DIR = Path(__file__).parent

WORLD_SCRIPTS = {
    'kanto': {
        'outdoor':  'kanto/master/maps/update_kanto.py',
        'inside':   'kanto/master/maps/update_kanto_insides.py',
        'dungeons': 'kanto/master/maps/update_kanto_dungeons.py',
        'export':   'kanto/master/maps/export_scripts.py',
    },
    'gavworld': {
        'outdoor':  'gavworld/master/maps/update_Gavworld.py',
        'inside':   'gavworld/master/maps/update_Gavworld_insides.py',
        'dungeons': 'gavworld/master/maps/update_Gavworld_dungeons.py',
    },
}


def run_script(script_path):
    """Import and run a script's main() function."""
    spec = importlib.util.spec_from_file_location('_script', script_path)
    mod = importlib.util.module_from_spec(spec)
    # Ensure the script's directory is on sys.path so relative imports work
    script_dir = str(script_path.parent)
    if script_dir not in sys.path:
        sys.path.insert(0, script_dir)
    spec.loader.exec_module(mod)
    if hasattr(mod, 'main'):
        mod.main()


def main():
    if len(sys.argv) < 2 or sys.argv[1] in ('-h', '--help'):
        print(f"Usage: {sys.argv[0]} <world> [--export-scripts]")
        print(f"Available worlds: {', '.join(sorted(WORLD_SCRIPTS.keys()))}")
        sys.exit(0 if '--help' in sys.argv else 1)

    world = sys.argv[1].lower()
    export_scripts = '--export-scripts' in sys.argv

    if world not in WORLD_SCRIPTS:
        print(f"Unknown world: {world}")
        print(f"Available: {', '.join(sorted(WORLD_SCRIPTS.keys()))}")
        sys.exit(1)

    scripts = WORLD_SCRIPTS[world]

    for step in ('outdoor', 'inside', 'dungeons'):
        if step not in scripts:
            continue
        path = WORLDS_DIR / scripts[step]
        if not path.exists():
            print(f"  [skip] {scripts[step]} (not found)")
            continue
        print(f"  [{step}] {scripts[step]}")
        run_script(path)

    if export_scripts and 'export' in scripts:
        path = WORLDS_DIR / scripts['export']
        if path.exists():
            print(f"  [export] {scripts['export']}")
            run_script(path)

    print(f"Done: {world}")


if __name__ == '__main__':
    main()
