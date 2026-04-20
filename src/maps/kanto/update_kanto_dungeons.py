#!/usr/bin/env python3
"""
Sync individual dungeon map JSON files from kanto_dungeons.json.

kanto_dungeons.json is edited in Tiled and may reference any of:
  - gen3_outside.json (one OR more refs — Tiled occasionally registers the
    same source twice via different relative paths)
  - cave_dungeon.json  (the dungeon-specific tileset; required)

This script converts the combined source GIDs from those tilesets into a
three-tileset layout that the engine consumes:
  - kanto_common  (inherited — written by update_kanto.py)
  - kanto_outside (inherited — written by update_kanto.py)
  - kanto_dungeons (owned — written here)

Outdoor tiles in dungeons are looked up in `gid_map.json` (the outdoor
script's authority) — dungeons doesn't extend the outdoor tilesets. If a
gen3_outside tile in a dungeon isn't already mapped by the outdoor build
the lookup warns and the tile is skipped; re-run update_kanto.py first.

cave_dungeon tiles are assigned compact map GIDs in a fresh kanto_dungeons
output tileset and committed to dungeon_gid_map.json so reruns are stable.
"""

import json

import rebuild_lib as lib

NAME_TO_FILE = {}
NAME_TO_SCENE_KEY = {}

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


def make_dungeons_tilesets(common_count, outside_count):
    """Three-tileset layout consumed by every dungeon map."""
    dungeons_firstgid = common_count + outside_count + 1
    return [
        {'firstgid': 1,                'source': '../../tileset/maps/kanto_common.json'},
        {'firstgid': common_count + 1, 'source': '../../tileset/maps/kanto_outside.json'},
        {'firstgid': dungeons_firstgid, 'source': '../../tileset/maps/kanto_dungeons.json'},
    ]


# ── Master tileset cataloguing ──────────────────────────────────────────────

def catalogue_master_tilesets(master):
    """
    Return a list of (firstgid, source_name, tile_count) sorted by firstgid
    ascending. `source_name` is one of 'gen3_outside' or 'cave_dungeon'
    (other sources are unsupported here and the caller should error).
    `tile_count` is read from the source tileset JSON.
    """
    entries = []
    for ts in master.get('tilesets', []):
        src = ts.get('source', '')
        # Identify by substring; both relative and absolute Tiled paths work.
        if 'cave_dungeon' in src:
            name = 'cave_dungeon'
        elif 'gen3_outside' in src:
            name = 'gen3_outside'
        else:
            print(f'  WARNING: unsupported tileset source "{src}" — ignoring')
            continue
        # Resolve to the project's canonical tileset path.
        ts_path = lib.TILESET_DIR / f'{name}.json'
        with open(ts_path) as f:
            ts_json = json.load(f)
        entries.append((ts['firstgid'], name, ts_json.get('tilecount', 0)))
    entries.sort()
    return entries


def src_gid_to_source(src_gid, catalogue):
    """Resolve a master GID to (source_name, 0-based tile_id) using standard
    Tiled firstgid-range partitioning. Returns (None, None) on miss."""
    for firstgid, name, count in reversed(catalogue):
        if src_gid >= firstgid and src_gid < firstgid + count:
            return name, src_gid - firstgid
    return None, None


# ── GID assignment ─────────────────────────────────────────────────────────

def build_compact_gid_map(master_tilelayers, catalogue,
                            gen3_raw_to_kanto, common_count, outside_count):
    """
    Build src_gid → map_gid mapping for dungeon maps.
    - gen3_outside tiles → kanto_common / kanto_outside via gid_map.json
    - cave_dungeon tiles → compact starting at common_count + outside_count + 1
    Tiles whose lookup fails are silently dropped (with a warning) — re-run
    update_kanto.py to surface a missing outdoor tile.
    """
    DUNGEONS_FIRSTGID = common_count + outside_count + 1

    all_src_gids = sorted({
        gid
        for layer in master_tilelayers.values()
        for gid in layer.get('data', [])
        if gid != 0
    })

    src_to_map_gid = {}
    cave_tids_used = []  # 0-based cave_dungeon tile ids, ordered by first appearance

    seen_cave = set()
    for src_gid in all_src_gids:
        name, tid = src_gid_to_source(src_gid, catalogue)
        if name == 'gen3_outside':
            gen3_raw_gid = tid + 1
            kgid = gen3_raw_to_kanto.get(gen3_raw_gid)
            if kgid is None:
                print(f'  WARNING: gen3_outside tile {tid} (src_gid={src_gid}) '
                      f'not in gid_map.json — skipping. Re-run update_kanto.py first.')
                continue
            src_to_map_gid[src_gid] = kgid
        elif name == 'cave_dungeon':
            if tid not in seen_cave:
                seen_cave.add(tid)
                cave_tids_used.append(tid)
            # map_gid filled in after we've assembled the sorted list below.
        else:
            print(f'  WARNING: unmappable src_gid {src_gid} (no tileset match) — skipping')

    # Assign cave_dungeon tile ids in numerical order so the kanto_dungeons
    # PNG mirrors cave_dungeon.png's layout for easier visual diffing.
    cave_tids_used.sort()
    for i, cave_tid in enumerate(cave_tids_used):
        map_gid = DUNGEONS_FIRSTGID + i
        # Find every src_gid that resolves to this cave tile and map them all.
        for src_gid in all_src_gids:
            name, tid = src_gid_to_source(src_gid, catalogue)
            if name == 'cave_dungeon' and tid == cave_tid:
                src_to_map_gid[src_gid] = map_gid

    map_gid_to_src = {v: k for k, v in src_to_map_gid.items()}
    gid_map_raw    = {
        'src_to_map_gid': {str(k): v for k, v in src_to_map_gid.items()},
        'map_gid_to_src': {str(k): v for k, v in map_gid_to_src.items()},
        'common_count':   common_count,
        'outside_count':  outside_count,
        'dungeons_firstgid': DUNGEONS_FIRSTGID,
    }
    return src_to_map_gid, map_gid_to_src, gid_map_raw


def ensure_dungeons_tile(dungeons_ts_json, map_gid, src_gid, catalogue,
                          cave_props_index, common_count, outside_count):
    """Sync a tile entry into kanto_dungeons.json with properties from the
    cave_dungeon source. Only call for cave_dungeon-sourced map_gids
    (>= common_count + outside_count + 1)."""
    DUNGEONS_FIRSTGID = common_count + outside_count + 1
    tile_id  = map_gid - DUNGEONS_FIRSTGID
    tiles    = dungeons_ts_json.setdefault('tiles', [])

    name, src_tid = src_gid_to_source(src_gid, catalogue)
    props = cave_props_index.get(src_tid, []) if name == 'cave_dungeon' else []

    existing = next((t for t in tiles if t['id'] == tile_id), None)
    if existing is None:
        tiles.append({'id': tile_id, 'properties': props})
        return True
    if existing.get('properties') != props:
        existing['properties'] = props
        return True
    return False


def remap_data(data, src_to_map_gid, dungeons_ts_json, catalogue,
                cave_props_index, common_count, outside_count):
    """Convert master tile-data into the three-tileset map_gid space."""
    DUNGEONS_FIRSTGID = common_count + outside_count + 1
    out = []
    ts_modified = False
    for src_gid in data:
        if src_gid == 0:
            out.append(0)
            continue
        mgid = src_to_map_gid.get(src_gid)
        if mgid is None:
            # Unmapped tile — already warned during build_compact_gid_map.
            out.append(0)
            continue
        if mgid >= DUNGEONS_FIRSTGID:
            if ensure_dungeons_tile(dungeons_ts_json, mgid, src_gid, catalogue,
                                     cave_props_index, common_count, outside_count):
                ts_modified = True
        out.append(mgid)
    return out, ts_modified


# ── PNG composition ────────────────────────────────────────────────────────

def update_dungeons_png(src_to_map_gid, common_count, outside_count,
                          dungeons_ts_json, dungeons_ts_path, catalogue):
    """Rebuild kanto_dungeons.png from cave_dungeon tiles only."""
    DUNGEONS_FIRSTGID = common_count + outside_count + 1

    # Collect (cave_dungeon_tile_id, dst_tile_id) in dst order — and dedupe
    # since multiple src_gids can resolve to the same cave_dungeon tile.
    seen_dst = set()
    entries  = []
    for src_gid, map_gid in src_to_map_gid.items():
        if map_gid < DUNGEONS_FIRSTGID:
            continue
        name, tid = src_gid_to_source(src_gid, catalogue)
        if name != 'cave_dungeon':
            continue
        dst = map_gid - DUNGEONS_FIRSTGID
        if dst in seen_dst:
            continue
        seen_dst.add(dst)
        entries.append((tid, dst))
    if not entries:
        return False
    entries.sort(key=lambda e: e[1])

    cave_ts_path = lib.TILESET_DIR / 'cave_dungeon.json'
    with open(cave_ts_path) as f:
        cave_ts_json = json.load(f)
    return lib.write_tileset_png(
        entries,
        lib.TILESET_DIR / 'cave_dungeon.png',
        dungeons_ts_json,
        dungeons_ts_path.parent / dungeons_ts_json['image'],
        source_columns=cave_ts_json.get('columns', 8),
    )


# ── Main ────────────────────────────────────────────────────────────────────

def main():
    master, master_tilelayers, master_objs, maps_layer = lib.load_master(
        lib.MAPS_DIR / 'kanto_dungeons.json'
    )
    if not maps_layer:
        print('ERROR: no "maps" objectgroup found in kanto_dungeons.json')
        return

    master_w = master['width']
    master_h = master['height']
    tw, th   = master['tilewidth'], master['tileheight']

    catalogue = catalogue_master_tilesets(master)
    if not catalogue:
        print('ERROR: kanto_dungeons.json has no recognised tilesets')
        return
    print('Master tilesets:')
    for firstgid, name, count in catalogue:
        print(f'  {name}: firstgid={firstgid}, tilecount={count}')

    # Inherit outdoor's GID space — both common + outside.
    with open(lib.MAPS_DIR / 'gid_map.json') as f:
        gid_map_data = json.load(f)
    gen3_raw_to_kanto = {int(k): v for k, v in gid_map_data['gen3_to_kanto'].items()}
    common_count      = gid_map_data['common_count']
    outside_count     = len(gen3_raw_to_kanto) - common_count

    src_to_map_gid, map_gid_to_src, gid_map_raw = build_compact_gid_map(
        master_tilelayers, catalogue,
        gen3_raw_to_kanto, common_count, outside_count,
    )
    DUNGEONS_FIRSTGID = common_count + outside_count + 1
    dungeons_count = sum(1 for g in src_to_map_gid.values() if g >= DUNGEONS_FIRSTGID)
    print(f'Compact GID map: {len(src_to_map_gid)} src tiles '
          f'({dungeons_count} cave_dungeon, '
          f'{len(src_to_map_gid)-dungeons_count} inherited from kanto_common/outside)')

    dungeons_ts_path = lib.TILESET_DIR / 'maps' / 'kanto_dungeons.json'
    dungeons_ts_json = lib.load_or_init_tileset(
        dungeons_ts_path, 'kanto_dungeons', 'kanto_dungeons.png',
        columns=8, image_width=256,
    )

    cave_ts_path = lib.TILESET_DIR / 'cave_dungeon.json'
    with open(cave_ts_path) as f:
        cave_ts_json = json.load(f)
    cave_props_index = lib.build_props_index(cave_ts_json)

    # Recompact every run — clear stale tile entries.
    dungeons_ts_json['tiles'] = []
    dungeons_ts_modified = True

    gid_map_path = lib.MAPS_DIR / 'dungeon_gid_map.json'

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
                                       make_dungeons_tilesets(0, 0),
                                       scene_inside=True)
            print('  created skeleton')
        else:
            with open(map_path) as f:
                route = json.load(f)

        route['tilesets'] = make_dungeons_tilesets(common_count, outside_count)
        lib.resize_route(route, dst_w, dst_h)

        print('  syncing tile layers from master kanto_dungeons.json')
        existing_layers = {l['name']: l for l in route['layers'] if l['type'] == 'tilelayer'}
        inter_idx = lib.tilelayer_insert_index(route['layers'])
        max_lid   = max((l.get('id') or 0 for l in route['layers']), default=0)
        for kname, klayer in master_tilelayers.items():
            raw = lib.extract_region(
                klayer['data'], master_w, master_h,
                ox, oy, dst_w, dst_h,
            )
            converted, modified = remap_data(
                raw, src_to_map_gid, dungeons_ts_json, catalogue,
                cave_props_index, common_count, outside_count,
            )
            if modified:
                dungeons_ts_modified = True
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

    with open(gid_map_path, 'w') as f:
        json.dump(gid_map_raw, f, indent=2)
    print(f'\nUpdated dungeon_gid_map.json ({len(src_to_map_gid)} total entries)')

    if update_dungeons_png(src_to_map_gid, common_count, outside_count,
                            dungeons_ts_json, dungeons_ts_path, catalogue):
        dungeons_ts_modified = True

    if dungeons_ts_modified or not dungeons_ts_path.exists():
        lib.write_tileset_json(dungeons_ts_path, dungeons_ts_json)


if __name__ == '__main__':
    main()
