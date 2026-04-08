#!/usr/bin/env python3
"""
Generate placeholder tile maps for all missing Kanto outdoor zones.

Creates individual map JSON files, adds zone objects to kanto.json's "maps"
layer, and updates kanto.world.

Tile GIDs used (kanto tileset, 1-indexed):
  Route grass (2x2):  even row = [5,6], odd row = [12,13]
  City grass  (2x2):  even row = [14,15], odd row = [21,22]
  Floor base:         1
  Water floor:        501
  Water surface:      503

After running this script, the individual JSON files can be fleshed out in
Tiled Editor and update_kanto.py can re-sync from kanto.json at any time.
"""

import json
import pathlib
import re

MAPS_DIR    = pathlib.Path(__file__).parent
OFFSET_X    = 2592    # kanto_pixel_x = world_x + OFFSET_X
OFFSET_Y    = 7616    # kanto_pixel_y = world_y + OFFSET_Y
TILE_PX     = 32

KANTO_TILESET = {'firstgid': 1, 'source': '../../tileset/maps/kanto.json'}

# ---------------------------------------------------------------------------
# Zone definitions: (name, world_x, world_y, world_w_px, world_h_px, terrain)
# terrain: 'route' | 'city' | 'water'
# ---------------------------------------------------------------------------
NEW_ZONES = [
    # --- South-of-Cerulean → Saffron → Vermillion corridor ---
    # Cerulean bottom: world y = -5760+1472 = -4288
    ('Route5',           7328, -4288, 1792,  640, 'route'),
    ('SaffronCity',      7328, -3648, 1792, 1472, 'city'),
    ('Route6',           7328, -2176, 1792,  640, 'route'),
    ('VermillionCity',   7328, -1536, 1792, 1472, 'city'),

    # --- East of Saffron → Lavender Town ---
    ('Route8',           9120, -3648, 1792,  640, 'route'),
    ('LavenderTown',    10912, -3648, 1280, 1280, 'city'),

    # --- East of Cerulean (Route 9 / Rock Tunnel approach) ---
    # Shares x=9120 start with Route25 (north of Cerulean) but at lower y
    ('Route9',           9120, -5760, 1792, 1472, 'route'),

    # --- East of Vermillion (Route 11) ---
    ('Route11',          9120, -1536, 2560,  640, 'route'),

    # --- Lavender south / east-coast corridor (Routes 12-15) ---
    ('Route12',         10912, -2368, 1280, 1312, 'route'),
    ('Route13',         11680, -2368,  640, 1472, 'route'),   # south pillar
    ('Route14',         11680,  -896,  640, 1472, 'route'),   # continues south
    ('Route15',          9120,   576, 2560,  640, 'route'),   # east of Fuchsia

    # --- West: Route 7 → Celadon → Cycling Road (Routes 16-18) ---
    # Route7 bridges Saffron (x=7328) ↔ Celadon (right edge x=6368)
    ('Route7',           6368, -3648,  960, 1472, 'route'),
    ('CeladonCity',      3968, -3968, 2400, 1760, 'city'),
    ('Route16',          2880, -3648, 1088,  640, 'route'),   # west of Celadon
    ('Route17',          2880, -3008,  640, 2048, 'route'),   # Cycling Road N↓S
    ('Route18',          2880,  -960, 1088,  640, 'route'),   # south of Cycling Road

    # --- Fuchsia City and south sea routes ---
    ('FuchsiaCity',      7328,   -64, 1792, 1472, 'city'),
    ('Route19',          7328,  1408, 1792,  640, 'water'),   # sea south of Fuchsia
    ('Route20',          3680,  1408, 3648,  640, 'water'),   # sea → Cinnabar
    ('CinnabarIsland',   3680,  2048, 1664, 1664, 'city'),    # island city

    # --- North of Viridian: Route 23 (Victory Road approach) ---
    # Fits above ViridianForest virtual area (world y: -6144 to -1280)
    ('Route23',         -1408, -7584, 1984, 1440, 'route'),
]

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def name_to_filename(name):
    snake = re.sub(r'(?<=[a-z0-9])(?=[A-Z])', '_', name).lower()
    return snake + '.json'


def make_grass_ground(w, h, terrain):
    """Return flat data array for the ground layer using 2×2 tile pattern."""
    data = []
    if terrain == 'water':
        # Water surface tile (kanto GID 503)
        return [503] * (w * h)
    if terrain == 'city':
        # City grass: even row=14,15  odd row=21,22
        for row in range(h):
            for col in range(w):
                if row % 2 == 0:
                    data.append(14 if col % 2 == 0 else 15)
                else:
                    data.append(21 if col % 2 == 0 else 22)
    else:
        # Route grass: even row=5,6  odd row=12,13
        for row in range(h):
            for col in range(w):
                if row % 2 == 0:
                    data.append(5 if col % 2 == 0 else 6)
                else:
                    data.append(12 if col % 2 == 0 else 13)
    return data


def make_floor(w, h, terrain):
    """Return flat data array for the floor layer."""
    if terrain == 'water':
        return [501] * (w * h)
    return [1] * (w * h)


def make_map(name, w, h, terrain):
    """Build a minimal Tiled JSON map structure for the given zone."""
    floor_data  = make_floor(w, h, terrain)
    ground_data = make_grass_ground(w, h, terrain)

    return {
        'compressionlevel': -1,
        'height':           h,
        'infinite':         False,
        'nextlayerid':      6,
        'nextobjectid':     1,
        'orientation':      'orthogonal',
        'renderorder':      'right-down',
        'tiledversion':     '1.12.1',
        'tileheight':       TILE_PX,
        'tilesets':         [KANTO_TILESET],
        'tilewidth':        TILE_PX,
        'type':             'map',
        'version':          '1.11',
        'width':            w,
        'layers': [
            {
                'data':    floor_data,
                'height':  h,
                'id':      1,
                'name':    'floor',
                'opacity': 1,
                'type':    'tilelayer',
                'visible': True,
                'width':   w,
                'x': 0, 'y': 0,
            },
            {
                'data':    ground_data,
                'height':  h,
                'id':      2,
                'name':    'ground',
                'opacity': 1,
                'properties': [
                    {'name': 'ge_charLayer', 'type': 'string', 'value': 'ground'}
                ],
                'type':    'tilelayer',
                'visible': True,
                'width':   w,
                'x': 0, 'y': 0,
            },
            {
                'data':    [0] * (w * h),
                'height':  h,
                'id':      3,
                'name':    'middle',
                'opacity': 1,
                'type':    'tilelayer',
                'visible': True,
                'width':   w,
                'x': 0, 'y': 0,
            },
            {
                'data':    [0] * (w * h),
                'height':  h,
                'id':      4,
                'name':    'top',
                'opacity': 1,
                'properties': [
                    {'name': 'ge_charLayer', 'type': 'string', 'value': 'top'}
                ],
                'type':    'tilelayer',
                'visible': True,
                'width':   w,
                'x': 0, 'y': 0,
            },
            {
                'draworder': 'topdown',
                'id':        5,
                'name':      'interactions',
                'objects':   [],
                'opacity':   1,
                'type':      'objectgroup',
                'visible':   True,
                'x': 0, 'y': 0,
            },
        ],
    }


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    kanto_path  = MAPS_DIR.parent.parent.parent / 'src' / 'maps' / 'kanto' / 'kanto.json'
    world_path  = MAPS_DIR / 'kanto.world'

    # --- Load existing kanto.json (latin-1 for the é in NPC text) ---
    with open(kanto_path, encoding='latin-1') as f:
        kanto = json.load(f)

    maps_layer = next(l for l in kanto['layers'] if l.get('name') == 'maps')
    existing_names = {obj['name'] for obj in maps_layer['objects']}

    # --- Load existing kanto.world ---
    with open(world_path) as f:
        world = json.load(f)
    existing_files = {e['fileName'] for e in world['maps']}

    # Track highest object id so far
    next_id = kanto.get('nextobjectid', max((o['id'] for o in maps_layer['objects']), default=0) + 1)

    new_map_objects   = []
    new_world_entries = []
    created_files     = []

    for (name, wx, wy, wpx_w, wpx_h, terrain) in NEW_ZONES:
        fname = name_to_filename(name)
        kanto_x = wx + OFFSET_X
        kanto_y = wy + OFFSET_Y
        w_tiles = wpx_w // TILE_PX
        h_tiles = wpx_h // TILE_PX

        # --- kanto.json maps-layer object ---
        if name not in existing_names:
            obj = {
                'height':  wpx_h,
                'id':      next_id,
                'name':    name,
                'opacity': 1,
                'rotation': 0,
                'type':    'location',
                'visible': True,
                'width':   wpx_w,
                'x':       kanto_x,
                'y':       kanto_y,
            }
            new_map_objects.append(obj)
            next_id += 1

        # --- kanto.world entry ---
        if fname not in existing_files:
            new_world_entries.append({
                'fileName': fname,
                'x': wx,
                'y': wy,
                'width':  wpx_w,
                'height': wpx_h,
            })

        # --- Individual map JSON ---
        out_path = MAPS_DIR / fname
        if not out_path.exists():
            data = make_map(name, w_tiles, h_tiles, terrain)
            with open(out_path, 'w') as f:
                json.dump(data, f, separators=(',', ':'))
            created_files.append(fname)
            print(f'  Created {fname}  ({w_tiles}×{h_tiles} tiles, terrain={terrain})')
        else:
            print(f'  Skipped {fname} (already exists)')

    # --- Patch kanto.json ---
    if new_map_objects:
        maps_layer['objects'].extend(new_map_objects)
        kanto['nextobjectid'] = next_id
        with open(kanto_path, 'w', encoding='latin-1') as f:
            json.dump(kanto, f, separators=(',', ':'), ensure_ascii=False)
        print(f'\nAdded {len(new_map_objects)} zone objects to kanto.json maps layer.')

    # --- Patch kanto.world ---
    if new_world_entries:
        world['maps'].extend(new_world_entries)
        with open(world_path, 'w') as f:
            json.dump(world, f, indent=4)
        print(f'Added {len(new_world_entries)} entries to kanto.world.')

    print(f'\nDone. {len(created_files)} new map files created.')


if __name__ == '__main__':
    main()
