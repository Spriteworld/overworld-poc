#!/usr/bin/env python3
"""
Rebuild kanto.json after truncation.

kanto.json is only used by the game code to read the "maps" objectgroup
(location zone rectangles).  The tile-layer data is for Tiled editing only —
the game renders the world from the individual map JSON files via kanto.world.

This script rebuilds kanto.json with:
  • Empty tile layers (all-zero data, 536×445 tiles)
  • Interaction objects sourced from every individual map file, converted to
    kanto.json absolute pixel coordinates using each zone's origin
  • Maps objectgroup sourced from kanto.world (world coords → kanto pixel coords)

Run after any data loss, or after adding new zones, to keep kanto.json in sync.
"""

import json, pathlib, re

MAPS_DIR  = pathlib.Path(__file__).parent
SRC_DIR   = MAPS_DIR.parent.parent.parent / 'src'  # character/src
KANTO_OUT = SRC_DIR / 'maps' / 'kanto' / 'kanto.json'

OFFSET_X  = 2592   # kanto_pixel_x = world_x + OFFSET_X
OFFSET_Y  = 7616   # kanto_pixel_y = world_y + OFFSET_Y
TILE_PX   = 32
MAP_W     = 536    # kanto.json tile width
MAP_H     = 445    # kanto.json tile height

# ---------------------------------------------------------------------------
# Load kanto.world (always intact – separate file)
# ---------------------------------------------------------------------------
with open(MAPS_DIR / 'kanto.world') as f:
    world = json.load(f)

# Build: zone_filename → (world_x, world_y, world_w, world_h)
zone_by_file = {}
for entry in world['maps']:
    zone_by_file[entry['fileName']] = (
        entry['x'], entry['y'], entry['width'], entry['height']
    )

# Derive zone_name → zone_origin_in_kanto_pixels for all outdoor zones.
# The individual map files are named by snake_case zone name.
def fname_to_name(fname):
    """inverse snake_case: e.g. 'pallet.json' → 'PalletTown' (override),
    'viridian_city.json' → 'ViridianCity' """
    OVERRIDE = {
        'pallet.json': 'PalletTown',
    }
    if fname in OVERRIDE:
        return OVERRIDE[fname]
    stem = pathlib.Path(fname).stem            # e.g. 'viridian_city'
    return re.sub(r'_([a-z])', lambda m: m.group(1).upper(),
                  stem[0].upper() + stem[1:])  # CamelCase


zone_origins = {}  # name → (kanto_x, kanto_y)
for fname, (wx, wy, ww, wh) in zone_by_file.items():
    name = fname_to_name(fname)
    zone_origins[name] = (wx + OFFSET_X, wy + OFFSET_Y)

# ---------------------------------------------------------------------------
# Collect interaction objects from each individual map file
# ---------------------------------------------------------------------------
# We assign monotonically increasing IDs across all objects.
all_interaction_objects = []
next_oid = 1

# Process outdoor maps first (in a deterministic order), then indoor
OUTDOOR_ORDER = [
    'pallet.json',
    'route1.json',
    'viridian_city.json',
    'route22.json',
    'route2.json',
    'pewter_city.json',
    'route21.json',
    'route3.json',
    'route4.json',
    'cerulean_city.json',
    'route24.json',
    'route25.json',
    'viridian_forest.json',
    # new outdoor zones (empty interactions)
    'route5.json',
    'saffron_city.json',
    'route6.json',
    'vermillion_city.json',
    'route7.json',
    'route8.json',
    'route9.json',
    'route11.json',
    'route12.json',
    'route13.json',
    'route14.json',
    'route15.json',
    'route16.json',
    'route17.json',
    'route18.json',
    'celadon_city.json',
    'fuchsia_city.json',
    'route19.json',
    'route20.json',
    'cinnabar_island.json',
    'lavender_town.json',
    'route23.json',
]

def load_interactions(fname):
    p = MAPS_DIR / fname
    if not p.exists():
        return []
    with open(p) as f:
        d = json.load(f)
    intr = next((l for l in d.get('layers', []) if l.get('name') == 'interactions'), None)
    return intr.get('objects', []) if intr else []


def convert_obj(local_obj, origin_x, origin_y, new_id):
    """Return a kanto.json-style interaction object at absolute coordinates."""
    obj = dict(local_obj)
    obj['id'] = new_id
    obj['x'] = local_obj.get('x', 0) + origin_x
    obj['y'] = local_obj.get('y', 0) + origin_y
    # Fix U+FFFD replacement characters in any string properties
    if 'properties' in obj:
        fixed = []
        for prop in obj['properties']:
            p = dict(prop)
            if isinstance(p.get('value'), str):
                p['value'] = p['value'].replace('\ufffd', '\u00e9')
            fixed.append(p)
        obj['properties'] = fixed
    return obj


for fname in OUTDOOR_ORDER:
    fname = fname.lower().replace(' ', '_')
    name = fname_to_name(fname)
    origin = zone_origins.get(name, (0, 0))  # (0,0) for maps not in world yet
    objs = load_interactions(fname)
    for obj in objs:
        all_interaction_objects.append(convert_obj(obj, origin[0], origin[1], next_oid))
        next_oid += 1

# Add any remaining map files not in OUTDOOR_ORDER (viridian_forest, etc.)
processed = set(OUTDOOR_ORDER)
for fname in sorted(zone_by_file.keys()):
    if fname not in processed:
        name = fname_to_name(fname)
        origin = zone_origins.get(name, (0, 0))
        for obj in load_interactions(fname):
            all_interaction_objects.append(convert_obj(obj, origin[0], origin[1], next_oid))
            next_oid += 1
        processed.add(fname)

# ---------------------------------------------------------------------------
# Build maps objectgroup from kanto.world
# ---------------------------------------------------------------------------
maps_objects = []
for i, entry in enumerate(world['maps'], start=1):
    fname = entry['fileName']
    name = fname_to_name(fname)
    kx = entry['x'] + OFFSET_X
    ky = entry['y'] + OFFSET_Y
    maps_objects.append({
        'height':   entry['height'],
        'id':       next_oid + i - 1,
        'name':     name,
        'opacity':  1,
        'rotation': 0,
        'type':     'location',
        'visible':  True,
        'width':    entry['width'],
        'x':        kx,
        'y':        ky,
    })

next_oid += len(maps_objects)

# ---------------------------------------------------------------------------
# Build the full kanto.json structure
# ---------------------------------------------------------------------------
W = MAP_W
H = MAP_H
EMPTY = [0] * (W * H)

layers = [
    {
        'data':    EMPTY[:],
        'height':  H,
        'id':      1,
        'name':    'floor',
        'opacity': 1,
        'type':    'tilelayer',
        'visible': True,
        'width':   W,
        'x': 0, 'y': 0,
    },
    {
        'data':    EMPTY[:],
        'height':  H,
        'id':      18,
        'name':    'subground',
        'opacity': 1,
        'type':    'tilelayer',
        'visible': True,
        'width':   W,
        'x': 0, 'y': 0,
    },
    {
        'data':    EMPTY[:],
        'height':  H,
        'id':      9,
        'name':    'ground',
        'opacity': 1,
        'properties': [
            {'name': 'ge_charLayer', 'type': 'string', 'value': 'ground'}
        ],
        'type':    'tilelayer',
        'visible': True,
        'width':   W,
        'x': 0, 'y': 0,
    },
    {
        'data':    EMPTY[:],
        'height':  H,
        'id':      17,
        'name':    'middle',
        'opacity': 1,
        'type':    'tilelayer',
        'visible': True,
        'width':   W,
        'x': 0, 'y': 0,
    },
    {
        'data':    EMPTY[:],
        'height':  H,
        'id':      11,
        'name':    'top',
        'opacity': 1,
        'properties': [
            {'name': 'ge_charLayer', 'type': 'string', 'value': 'top'}
        ],
        'type':    'tilelayer',
        'visible': True,
        'width':   W,
        'x': 0, 'y': 0,
    },
    {
        'draworder': 'topdown',
        'id':        12,
        'name':      'interactions',
        'objects':   all_interaction_objects,
        'opacity':   1,
        'type':      'objectgroup',
        'visible':   True,
        'x': 0, 'y': 0,
    },
    {
        'draworder': 'topdown',
        'id':        13,
        'name':      'maps',
        'objects':   maps_objects,
        'opacity':   1,
        'type':      'objectgroup',
        'visible':   True,
        'x': 0, 'y': 0,
    },
]

kanto = {
    'compressionlevel': -1,
    'height':           H,
    'infinite':         False,
    'nextlayerid':      19,
    'nextobjectid':     next_oid,
    'orientation':      'orthogonal',
    'renderorder':      'right-down',
    'tiledversion':     '1.12.1',
    'tileheight':       TILE_PX,
    'tilesets': [
        {
            'firstgid': 1,
            'source':   '../../tileset/gen3_outside.json',
        }
    ],
    'tilewidth':  TILE_PX,
    'type':       'map',
    'version':    '1.11',
    'width':      W,
    'layers':     layers,
}

# ---------------------------------------------------------------------------
# Write output (UTF-8 — no bytes > 0x7F after replacing \ufffd above)
# ---------------------------------------------------------------------------
with open(KANTO_OUT, 'w', encoding='utf-8') as f:
    json.dump(kanto, f, separators=(',', ':'), ensure_ascii=False)

print(f'Wrote {KANTO_OUT}')
print(f'  Tile layers: {W}×{H} tiles (empty — game uses individual map files)')
print(f'  Interaction objects: {len(all_interaction_objects)}')
print(f'  Zone map objects: {len(maps_objects)}')
print(f'  nextobjectid: {next_oid}')
