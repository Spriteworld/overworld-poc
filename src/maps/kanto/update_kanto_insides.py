#!/usr/bin/env python3
"""
Sync individual interior map JSON files from kanto_inside.json.

kanto_inside.json is edited in Tiled using one or two source tilesets:
  - gen3_inside.png  (firstgid=1, required)
  - gen3_outside.png (optional — present only when interior tiles re-use
                       outdoor sprites; firstgids discovered dynamically)

This script converts those combined source GIDs → kanto_inside GIDs when
writing individual map files (which use a single kanto_inside tileset).

What this script does
─────────────────────
1. Reads kanto_inside.json's "maps" objectgroup to derive each named area's
   tile bounds.
2. For each map file:
   - Creates it if it doesn't exist (standard inside-map layer skeleton).
   - Resizes its tilelayers if the tile dimensions have changed.
   - Extracts tile data from kanto_inside.json, remapping combined source GIDs
     to kanto_inside GIDs via inside_gid_map.json.
   - For any source GID with no kanto_inside equivalent (new tiles added in
     Tiled), appends new entries to the kanto_inside tileset JSON and updates
     inside_gid_map.json so subsequent runs keep the assignment stable.
   - Merges interaction objects (matched by name) from kanto_inside.json's
     "interactions" objectgroup.
3. Ensures all overworld item/obstacle tiles (Pokeball, CutTree, Bush,
   StrengthBoulder) from gen3_outside are present in kanto_common so that
   BaseItem subclasses work correctly in interior maps.
4. Rebuilds kanto_inside.png from scratch every run, sourcing pixels from
   gen3_inside.png.
5. Writes the updated kanto_inside tileset JSON (tile properties synced from
   source tilesets for any GID newly added).
6. For any map not already registered in the JS source files, creates a
   Phaser scene file and updates src/maps/index.js and src/scenes/index.js.
"""

import json

import rebuild_lib as lib

NAME_TO_FILE = {}

# Maps a kanto_inside.json map name to the JS scene key that should be used
# when registering it.  Use this when the map already exists under a
# different name registered by update_kanto.py (e.g. "ProfLab" ↔ "ProfessorLab").
NAME_TO_SCENE_KEY = {
    'ProfLab': 'ProfessorLab',
}

LAYER_TEMPLATE = [
    ('floor',        None,     False),
    ('subground',    None,     False),
    ('ground',       'ground', False),
    ('middle',       None,     False),
    ('top',          'top',    False),
    ('interactions', None,     True),
]
LAYER_CHAR  = {name: char for name, char, is_obj in LAYER_TEMPLATE if not is_obj}
LAYER_ORDER = [name for name, _, _ in LAYER_TEMPLATE]

# gen3_outside tile IDs (0-based) that must always live in kanto_common so
# that BaseItem subclasses (Pokeball, CutTree, Bush, StrengthBoulder) render
# correctly in interior maps. Mirrors the tileId constants in each subclass.
ITEM_TILE_IDS = [17, 18, 35, 53]


def make_inside_tilesets(common_count):
    return [
        {'firstgid': 1,                'source': '../../tileset/maps/kanto_common.json'},
        {'firstgid': common_count + 1, 'source': '../../tileset/maps/kanto_inside.json'},
    ]


# ── GID conversion ─────────────────────────────────────────────────────────

def build_compact_gid_map(master_tilelayers, gen3_inside_firstgid,
                           gen3_outside_firstgid, gen3_raw_to_kanto, common_count):
    """
    Build src_gid → map_gid mapping for indoor maps using the two-tileset
    layout:
    - gen3_outside tiles → kanto_common GID (1..common_count) via gid_map.json
    - gen3_inside  tiles → compact starting at common_count + 1

    `gen3_outside_firstgid` may be None if the master no longer references
    gen3_outside; in that case all tiles come from gen3_inside.

    Returns (src_to_map_gid, map_gid_to_src, gid_map_raw, gid_map_path).
    """
    INSIDE_FIRSTGID = common_count + 1

    all_src_gids = sorted({
        gid
        for layer in master_tilelayers.values()
        for gid in layer.get('data', [])
        if gid != 0
    })

    if gen3_outside_firstgid is not None:
        extra_outside = [gen3_outside_firstgid + tid for tid in ITEM_TILE_IDS]
        all_src_gids  = sorted(set(all_src_gids) | set(extra_outside))
        inside_src_gids  = [g for g in all_src_gids if g < gen3_outside_firstgid]
        outside_src_gids = [g for g in all_src_gids if g >= gen3_outside_firstgid]
    else:
        inside_src_gids  = list(all_src_gids)
        outside_src_gids = []

    src_to_map_gid = {}
    for src_gid in outside_src_gids:
        tile_id      = src_gid - gen3_outside_firstgid
        gen3_raw_gid = tile_id + 1
        kgid = gen3_raw_to_kanto.get(gen3_raw_gid)
        if kgid is not None:
            src_to_map_gid[src_gid] = kgid

    for i, src_gid in enumerate(inside_src_gids):
        src_to_map_gid[src_gid] = INSIDE_FIRSTGID + i

    map_gid_to_src = {v: k for k, v in src_to_map_gid.items()}
    gid_map_raw    = {
        'src_to_map_gid': {str(k): v for k, v in src_to_map_gid.items()},
        'map_gid_to_src': {str(k): v for k, v in map_gid_to_src.items()},
    }
    gid_map_path = lib.MAPS_DIR / 'inside_gid_map.json'
    return src_to_map_gid, map_gid_to_src, gid_map_raw, gid_map_path


def src_gid_to_tile_id(src_gid, gen3_inside_firstgid, gen3_outside_firstgid):
    """Resolve a master GID back to (source_name, 0-based tile_id)."""
    if gen3_outside_firstgid is not None and src_gid >= gen3_outside_firstgid:
        return 'gen3_outside', src_gid - gen3_outside_firstgid
    return 'gen3_inside', src_gid - gen3_inside_firstgid


def ensure_inside_tile(inside_ts_json, map_gid, src_gid, props_indices,
                        common_count, gen3_inside_firstgid, gen3_outside_firstgid):
    """
    Ensure inside tileset JSON has a tile entry for `map_gid` with
    up-to-date properties synced from the source tileset. Only call for
    gen3_inside tiles (map_gid >= common_count + 1) — common-range tiles
    are owned by kanto_common.json (written by update_kanto.py).
    """
    INSIDE_FIRSTGID = common_count + 1
    tile_id  = map_gid - INSIDE_FIRSTGID
    tiles    = inside_ts_json.setdefault('tiles', [])

    src_name, src_tid = src_gid_to_tile_id(src_gid, gen3_inside_firstgid, gen3_outside_firstgid)
    props = props_indices.get(src_name, {}).get(src_tid, [])

    existing = next((t for t in tiles if t['id'] == tile_id), None)
    if existing is None:
        tiles.append({'id': tile_id, 'properties': props})
        return True
    if existing.get('properties') != props:
        existing['properties'] = props
        return True
    return False


def remap_data(data, src_to_map_gid, map_gid_to_src,
                inside_ts_json, props_indices, gid_map_raw,
                new_mappings, common_count,
                gen3_inside_firstgid, gen3_outside_firstgid):
    """
    Convert a flat tile-data array from combined src GIDs to map GIDs.
    Tiles with no existing mapping are assigned the next available map GID
    and recorded in `new_mappings`. Returns (converted_data, ts_modified).
    """
    INSIDE_FIRSTGID = common_count + 1
    max_map  = max(map_gid_to_src.keys(), default=INSIDE_FIRSTGID - 1)
    out      = []
    ts_modified = False

    for src_gid in data:
        if src_gid == 0:
            out.append(0)
            continue
        igid = src_to_map_gid.get(src_gid)
        if igid is None:
            if src_gid in new_mappings:
                igid = new_mappings[src_gid]
            else:
                max_map += 1
                igid = max_map
                new_mappings[src_gid]                       = igid
                src_to_map_gid[src_gid]                     = igid
                map_gid_to_src[igid]                        = src_gid
                gid_map_raw['src_to_map_gid'][str(src_gid)] = igid
                gid_map_raw['map_gid_to_src'][str(igid)]    = src_gid
        if igid >= INSIDE_FIRSTGID:
            if ensure_inside_tile(inside_ts_json, igid, src_gid, props_indices,
                                  common_count, gen3_inside_firstgid,
                                  gen3_outside_firstgid):
                ts_modified = True
        out.append(igid)

    return out, ts_modified


def update_inside_png(src_to_map_gid, common_count, inside_ts_json,
                     inside_ts_path, gen3_inside_firstgid, gen3_outside_firstgid):
    """Rebuild kanto_inside.png from gen3_inside tiles only."""
    INSIDE_FIRSTGID = common_count + 1

    # Only gen3_inside tiles.  When gen3_outside isn't present in the master,
    # the upper-bound check still excludes any GID that would have come from it.
    def is_inside_src(src_gid):
        return (gen3_outside_firstgid is None or src_gid < gen3_outside_firstgid) \
            and src_gid >= gen3_inside_firstgid

    inside_entries = [
        (src_gid - gen3_inside_firstgid, map_gid - INSIDE_FIRSTGID)
        for src_gid, map_gid in src_to_map_gid.items()
        if map_gid >= INSIDE_FIRSTGID and is_inside_src(src_gid)
    ]
    if not inside_entries:
        return False

    return lib.write_tileset_png(
        inside_entries,
        lib.TILESET_DIR / 'gen3_inside.png',
        inside_ts_json,
        inside_ts_path.parent / inside_ts_json['image'],
        source_columns=8,
    )


# ── Main ────────────────────────────────────────────────────────────────────

def main():
    master, master_tilelayers, master_objs, maps_layer = lib.load_master(
        lib.MAPS_DIR / 'kanto_inside.json'
    )
    if not maps_layer:
        print('ERROR: no "maps" objectgroup found in kanto_inside.json')
        return

    # Discover firstgids dynamically.  gen3_outside is optional — interior
    # masters may have removed it once no inside tile relies on outdoor art.
    ts_map = {}
    for ts in master.get('tilesets', []):
        src = ts.get('source', '')
        if 'gen3_inside' in src:
            ts_map['gen3_inside'] = ts['firstgid']
        elif 'gen3_outside' in src:
            ts_map['gen3_outside'] = ts['firstgid']
    if 'gen3_inside' not in ts_map:
        print('ERROR: kanto_inside.json must contain a gen3_inside tileset')
        return
    gen3_inside_firstgid  = ts_map['gen3_inside']
    gen3_outside_firstgid = ts_map.get('gen3_outside')
    print(f'Tilesets: gen3_inside firstgid={gen3_inside_firstgid}, '
          f'gen3_outside firstgid={gen3_outside_firstgid}')

    master_w = master['width']
    master_h = master['height']
    tw, th   = master['tilewidth'], master['tileheight']

    # Read common_count and gen3_to_kanto from gid_map.json (written by update_kanto.py).
    with open(lib.MAPS_DIR / 'gid_map.json') as f:
        gid_map_data = json.load(f)
    gen3_raw_to_kanto = {int(k): v for k, v in gid_map_data['gen3_to_kanto'].items()}
    common_count      = gid_map_data['common_count']
    INSIDE_FIRSTGID   = common_count + 1

    src_to_map_gid, map_gid_to_src, gid_map_raw, gid_map_path = build_compact_gid_map(
        master_tilelayers, gen3_inside_firstgid, gen3_outside_firstgid,
        gen3_raw_to_kanto, common_count,
    )
    inside_count = sum(1 for g in src_to_map_gid.values() if g >= INSIDE_FIRSTGID)
    print(f'Compact GID map: {len(src_to_map_gid)} tiles '
          f'({inside_count} gen3_inside, {len(src_to_map_gid)-inside_count} gen3_outside/common)')

    inside_ts_path = lib.TILESET_DIR / 'maps' / 'kanto_inside.json'
    inside_ts_json = lib.load_or_init_tileset(
        inside_ts_path, 'kanto_inside', 'kanto_inside.png', columns=8, image_width=256,
    )

    with open(lib.TILESET_DIR / 'gen3_inside.json') as f:
        gen3_inside_ts_json = json.load(f)

    # For gen3_outside tiles in indoor maps, use kanto_common.json properties
    # (authoritative — written by update_kanto.py).  Only common tiles are there.
    kanto_common_ts_path = lib.TILESET_DIR / 'maps' / 'kanto_common.json'
    with open(kanto_common_ts_path) as f:
        kanto_common_ts_json_data = json.load(f)
    kanto_tile_props = {t['id']: t.get('properties', [])
                        for t in kanto_common_ts_json_data.get('tiles', [])}
    gen3_outside_via_kanto = {
        gen3_raw_gid - 1: kanto_tile_props.get(kanto_gid - 1, [])
        for gen3_raw_gid, kanto_gid in gen3_raw_to_kanto.items()
        if kanto_gid <= common_count
    }

    props_indices = {
        'gen3_inside':  lib.build_props_index(gen3_inside_ts_json),
        'gen3_outside': gen3_outside_via_kanto,
    }

    # The compact GID rebuild reassigns every inside GID — clear stale tile
    # entries from a previous run so ensure_inside_tile starts clean.
    inside_ts_json['tiles'] = []
    inside_ts_modified = True

    # ── Per-zone sync ─────────────────────────────────────────────────────
    for zone in lib.iter_zones(maps_layer, name_to_file_overrides=NAME_TO_FILE,
                                expand_floor_suffix=True):
        fname     = zone['fname']
        scene_key = NAME_TO_SCENE_KEY.get(zone['name'], zone['name'])

        map_path = lib.MAPS_DIR / fname
        ox = zone['x'] // tw
        oy = zone['y'] // th
        dst_w = zone['width']  // tw
        dst_h = zone['height'] // th

        print(f'\n{fname}: master tile origin ({ox},{oy}), size {dst_w}x{dst_h}')

        if not map_path.exists():
            route = lib.make_skeleton(dst_w, dst_h, LAYER_TEMPLATE,
                                       make_inside_tilesets(0), scene_inside=True)
            print('  created skeleton')
        else:
            with open(map_path) as f:
                route = json.load(f)

        route['tilesets'] = make_inside_tilesets(common_count)
        lib.resize_route(route, dst_w, dst_h)

        print('  syncing tile layers from master kanto_inside.json')
        existing_layers = {l['name']: l for l in route['layers'] if l['type'] == 'tilelayer'}
        inter_idx = lib.tilelayer_insert_index(route['layers'])
        max_lid   = max((l.get('id') or 0 for l in route['layers']), default=0)
        for kname, klayer in master_tilelayers.items():
            raw = lib.extract_region(
                klayer['data'], master_w, master_h,
                ox, oy, dst_w, dst_h,
            )
            converted, modified = remap_data(
                raw, src_to_map_gid, map_gid_to_src,
                inside_ts_json, props_indices, gid_map_raw, {},
                common_count, gen3_inside_firstgid, gen3_outside_firstgid,
            )
            if modified:
                inside_ts_modified = True
            non_zero = sum(1 for t in converted if t != 0)
            if kname in existing_layers:
                existing_layers[kname]['data']   = converted
                existing_layers[kname]['width']  = dst_w
                existing_layers[kname]['height'] = dst_h
                print(f'  updated layer "{kname}" from master ({non_zero} non-zero tiles)')
            elif non_zero > 0:
                max_lid += 1
                new_layer = lib.make_layer(kname, dst_w, dst_h, LAYER_CHAR.get(kname))
                new_layer['id']   = max_lid
                new_layer['data'] = converted
                route['layers'].insert(inter_idx, new_layer)
                inter_idx += 1
                print(f'  added layer "{kname}" from master ({non_zero} non-zero tiles)')

        # Interaction objects
        inter = lib.get_or_create_interaction_layer(route['layers'])
        master_px_x = ox * tw
        master_px_y = oy * th
        px_w = dst_w * tw
        px_h = dst_h * th
        objects, next_oid = lib.merge_interactions(
            master_objs, master_px_x, master_px_y, px_w, px_h,
        )
        inter['objects']      = objects
        route['nextobjectid'] = next_oid
        for o in objects:
            print(f'  added obj "{o["name"]}"')

        props = zone['properties']
        if props:
            route['properties'] = props
        elif 'properties' in route:
            del route['properties']

        lib.sort_layers(route['layers'], LAYER_ORDER)
        lib.sync_layer_properties(route['layers'], LAYER_CHAR)

        with open(map_path, 'w') as f:
            json.dump(route, f, indent=2)
        print(f'  saved {fname}')

        lib.ensure_scene_file(scene_key, inside=True)
        lib.ensure_maps_index(scene_key, fname)
        lib.ensure_scenes_index(scene_key)

    # ── Item-tile report (informational) ──────────────────────────────────
    print('\nItem tile map_gids (kanto_common):')
    for tile_id in ITEM_TILE_IDS:
        if gen3_outside_firstgid is None:
            print(f'  item tile {tile_id} — no gen3_outside in master, skipped')
            continue
        src_gid = gen3_outside_firstgid + tile_id
        mgid    = src_to_map_gid.get(src_gid)
        if mgid is None:
            print(f'  WARNING: item tile {tile_id} missing from GID map')
        else:
            print(f'  item tile {tile_id} (gen3_outside) -> map GID {mgid} (kanto_common)')

    # ── Persist GID map ───────────────────────────────────────────────────
    with open(gid_map_path, 'w') as f:
        json.dump(gid_map_raw, f, indent=2)
    print(f'\nUpdated inside_gid_map.json ({len(src_to_map_gid)} total entries)')

    if update_inside_png(src_to_map_gid, common_count, inside_ts_json,
                          inside_ts_path, gen3_inside_firstgid,
                          gen3_outside_firstgid):
        inside_ts_modified = True

    if inside_ts_modified or not inside_ts_path.exists():
        lib.write_tileset_json(inside_ts_path, inside_ts_json)


if __name__ == '__main__':
    main()
