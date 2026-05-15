#!/usr/bin/env python3
"""
Sync individual dungeon map JSON files from spriteworld_dungeons.json.

spriteworld_dungeons.json is edited in Tiled and may reference any source
tilesets (auto-discovered from the master's tilesets array).

This script converts the combined source GIDs into a three-tileset
layout that the engine consumes:
  - spriteworld_common  (inherited — written by update_spriteworld.py)
  - spriteworld_outside (inherited — written by update_spriteworld.py)
  - spriteworld_dungeons (owned — written here)

Tiles from sources that appear in the outdoor gid_map.json are looked up
there (the outdoor script's authority).  All other source tiles are
assigned compact map GIDs in a fresh spriteworld_dungeons output tileset.
"""

import json
import pathlib
import sys

import rebuild_lib as lib

NAME_TO_FILE = {}
NAME_TO_SCENE_KEY = {}

# Prefixed onto every scene_key (after NAME_TO_SCENE_KEY override). Keeps map
# names unique across worlds in src/maps/index.js + src/scenes/index.js.
WORLD_PREFIX = 'Spriteworld'

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
        {'firstgid': 1,                'source': '../../../worlds/_base/tileset/maps/spriteworld_common.json'},
        {'firstgid': common_count + 1, 'source': '../../../worlds/_base/tileset/maps/spriteworld_outside.json'},
        {'firstgid': dungeons_firstgid, 'source': '../../../worlds/_base/tileset/maps/spriteworld_dungeons.json'},
    ]


# ── Master tileset cataloguing ──────────────────────────────────────────────

def catalogue_master_tilesets(master):
    """Auto-discover all tilesets in the master JSON by resolving each
    source path to its canonical file in TILESET_DIR.
    Returns [(firstgid, source_name, tile_count), ...] sorted by firstgid
    ascending. Aborts if a tileset JSON cannot be found."""
    entries = []
    for ts in master.get('tilesets', []):
        src = ts.get('source', '')
        name = pathlib.PurePosixPath(src).stem
        ts_path = lib.TILESET_DIR / f'{name}.json'
        if not ts_path.exists():
            print(f'  ERROR: cannot resolve tileset source "{src}" '
                  f'— expected {ts_path}')
            sys.exit(1)
        with open(ts_path) as f:
            ts_json = json.load(f)
        entries.append((ts['firstgid'], name, ts_json.get('tilecount', 0)))
    entries.sort()
    return entries


def src_gid_to_source(src_gid, catalogue):
    """Resolve a master GID to (source_name, 0-based tile_id) using standard
    Tiled firstgid-range partitioning. Returns (None, None) on miss."""
    for firstgid, name, count in reversed(catalogue):
        if firstgid <= src_gid < firstgid + count:
            return name, src_gid - firstgid
    return None, None


# ── GID assignment ─────────────────────────────────────────────────────────

def build_compact_gid_map(master_tilelayers, catalogue,
                            outdoor_gid_lookup, outdoor_source_names,
                            common_count, outside_count):
    """
    Build src_gid → map_gid mapping for dungeon maps.
    - Tiles from sources known to the outdoor gid_map → inherited via lookup
    - All other tiles → compact dungeon range starting at
      common_count + outside_count + 1

    Existing assignments in dungeon_gid_map.json are preserved so that adding
    a new source tileset doesn't reshuffle every GID.
    """
    DUNGEONS_FIRSTGID = common_count + outside_count + 1
    gid_map_path = lib.MAPS_DIR / 'dungeon_gid_map.json'

    prev_src_to_map = {}
    if gid_map_path.exists():
        with open(gid_map_path) as f:
            prev = json.load(f)
        prev_src_to_map = {int(k): int(v)
                           for k, v in prev.get('src_to_map_gid', {}).items()}

    all_src_gids = sorted({
        gid
        for layer in master_tilelayers.values()
        for gid in layer.get('data', [])
        if gid != 0
    })

    src_to_map_gid = {}
    needs_assignment = []

    for src_gid in all_src_gids:
        name, tid = src_gid_to_source(src_gid, catalogue)
        if name is None:
            continue
        if name in outdoor_source_names:
            kgid = outdoor_gid_lookup.get((name, tid))
            if kgid is None:
                print(f'  WARNING: {name} tile {tid} (src_gid={src_gid}) '
                      f'not in gid_map.json — skipping. Re-run the outdoor update first.')
                continue
            src_to_map_gid[src_gid] = kgid
        elif src_gid in prev_src_to_map and prev_src_to_map[src_gid] >= DUNGEONS_FIRSTGID:
            src_to_map_gid[src_gid] = prev_src_to_map[src_gid]
        else:
            needs_assignment.append(src_gid)

    existing_dungeon = [g for g in src_to_map_gid.values() if g >= DUNGEONS_FIRSTGID]
    next_gid = max(existing_dungeon, default=DUNGEONS_FIRSTGID - 1) + 1

    for src_gid in needs_assignment:
        src_to_map_gid[src_gid] = next_gid
        next_gid += 1

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
                          src_props_indices, common_count, outside_count):
    """Sync a tile entry into spriteworld_dungeons.json with properties from the
    appropriate source. Only call for dungeon-owned map_gids
    (>= common_count + outside_count + 1)."""
    DUNGEONS_FIRSTGID = common_count + outside_count + 1
    tile_id  = map_gid - DUNGEONS_FIRSTGID
    tiles    = dungeons_ts_json.setdefault('tiles', [])

    name, src_tid = src_gid_to_source(src_gid, catalogue)
    props = src_props_indices.get(name, {}).get(src_tid, [])

    existing = next((t for t in tiles if t['id'] == tile_id), None)
    if existing is None:
        tiles.append({'id': tile_id, 'properties': props})
        return True
    if existing.get('properties') != props:
        existing['properties'] = props
        return True
    return False


def remap_data(data, src_to_map_gid, dungeons_ts_json, catalogue,
                src_props_indices, common_count, outside_count):
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
            out.append(0)
            continue
        if mgid >= DUNGEONS_FIRSTGID:
            if ensure_dungeons_tile(dungeons_ts_json, mgid, src_gid, catalogue,
                                     src_props_indices, common_count, outside_count):
                ts_modified = True
        out.append(mgid)
    return out, ts_modified


# ── PNG composition ────────────────────────────────────────────────────────

def update_dungeons_png(src_to_map_gid, common_count, outside_count,
                          dungeons_ts_json, dungeons_ts_path, catalogue,
                          outdoor_source_names):
    """Rebuild spriteworld_dungeons.png from dungeon-owned source tiles."""
    try:
        from PIL import Image
    except ImportError:
        print('  WARNING: Pillow not installed — cannot rebuild PNG')
        return False

    DUNGEONS_FIRSTGID = common_count + outside_count + 1

    # Collect (source_name, src_tile_id, dst_tile_id) — dedupe by dst.
    seen_dst = set()
    entries  = []
    for src_gid, map_gid in src_to_map_gid.items():
        if map_gid < DUNGEONS_FIRSTGID:
            continue
        name, tid = src_gid_to_source(src_gid, catalogue)
        if name is None or name in outdoor_source_names:
            continue
        dst = map_gid - DUNGEONS_FIRSTGID
        if dst in seen_dst:
            continue
        seen_dst.add(dst)
        entries.append((name, tid, dst))
    if not entries:
        return False

    # Load source PNGs for dungeon-owned tilesets.
    src_imgs = {}
    src_cols = {}
    for fg, name, count in catalogue:
        if name in outdoor_source_names:
            continue
        ts_path = lib.TILESET_DIR / f'{name}.json'
        with open(ts_path) as f:
            ts_json = json.load(f)
        src_imgs[name] = Image.open(lib.TILESET_DIR / ts_json['image']).convert('RGBA')
        src_cols[name] = ts_json['columns']

    tw   = dungeons_ts_json['tilewidth']
    th   = dungeons_ts_json['tileheight']
    cols = dungeons_ts_json['columns']
    max_dst = max(dst for _, _, dst in entries)
    rows    = (max_dst // cols) + 1
    img     = Image.new('RGBA', (cols * tw, rows * th), (0, 0, 0, 0))
    for name, src_tid, dst_tid in entries:
        scol = src_cols[name]
        sx = (src_tid % scol) * tw
        sy = (src_tid // scol) * th
        dx = (dst_tid % cols) * tw
        dy = (dst_tid // cols) * th
        img.paste(src_imgs[name].crop((sx, sy, sx + tw, sy + th)), (dx, dy))
    img.save(dungeons_ts_path.parent / dungeons_ts_json['image'])
    dungeons_ts_json['imagewidth']  = cols * tw
    dungeons_ts_json['imageheight'] = rows * th
    dungeons_ts_json['tilecount']   = cols * rows
    print(f'  rebuilt {dungeons_ts_json["image"]} ({len(entries)} tiles, {cols}x{rows} grid)')
    return True


# ── Main ────────────────────────────────────────────────────────────────────

def main():
    master, master_tilelayers, master_objs, maps_layer = lib.load_master(
        lib.MAPS_DIR / 'spriteworld_dungeons.json'
    )
    if not maps_layer:
        print('ERROR: no "maps" objectgroup found in spriteworld_dungeons.json')
        return

    master_w = master['width']
    master_h = master['height']
    tw, th   = master['tilewidth'], master['tileheight']

    catalogue = catalogue_master_tilesets(master)
    if not catalogue:
        print('ERROR: spriteworld_dungeons.json has no recognised tilesets')
        return
    print('Master tilesets:')
    for firstgid, name, count in catalogue:
        print(f'  {name}: firstgid={firstgid}, tilecount={count}')

    # Inherit outdoor's GID space — both common + outside.
    with open(lib.MAPS_DIR / 'gid_map.json') as f:
        gid_map_data = json.load(f)
    common_count = gid_map_data['common_count']

    # Build a unified outdoor lookup: (source_name, tile_id) → spriteworld GID.
    outdoor_gid_lookup = {}
    outdoor_source_names = set()
    for raw_str, sgid in gid_map_data.get('gen3_to_spriteworld', {}).items():
        tid = int(raw_str) - 1
        outdoor_gid_lookup[('gen3_outside', tid)] = sgid
        outdoor_source_names.add('gen3_outside')
    for key_str, sgid in gid_map_data.get('extras_to_spriteworld', {}).items():
        src, tid_str = key_str.rsplit(':', 1)
        outdoor_gid_lookup[(src, int(tid_str))] = sgid
        outdoor_source_names.add(src)

    # outside_count = total spriteworld_outside tile count. Use the tileset's
    # tilecount (image-grid size) so the dungeons firstgid sits past
    # Phaser's full spriteworld_outside GID range.
    outside_count = gid_map_data.get('outside_count', 0)
    if not outside_count:
        with open(lib.TILESET_DIR / 'maps' / 'spriteworld_outside.json') as f:
            outside_count = json.load(f)['tilecount']

    src_to_map_gid, map_gid_to_src, gid_map_raw = build_compact_gid_map(
        master_tilelayers, catalogue,
        outdoor_gid_lookup, outdoor_source_names, common_count, outside_count,
    )
    DUNGEONS_FIRSTGID = common_count + outside_count + 1
    dungeons_count = sum(1 for g in src_to_map_gid.values() if g >= DUNGEONS_FIRSTGID)
    print(f'Compact GID map: {len(src_to_map_gid)} src tiles '
          f'({dungeons_count} dungeon, '
          f'{len(src_to_map_gid)-dungeons_count} inherited from spriteworld_common/outside)')

    dungeons_ts_path = lib.TILESET_DIR / 'maps' / 'spriteworld_dungeons.json'
    dungeons_ts_json = lib.load_or_init_tileset(
        dungeons_ts_path, 'spriteworld_dungeons', 'spriteworld_dungeons.png',
        columns=8, image_width=256,
    )

    # Build properties index for every dungeon-owned source tileset.
    src_props_indices = {}
    for fg, name, count in catalogue:
        if name not in outdoor_source_names:
            ts_path = lib.TILESET_DIR / f'{name}.json'
            with open(ts_path) as f:
                ts_json = json.load(f)
            src_props_indices[name] = lib.build_props_index(ts_json)

    # Recompact every run — clear stale tile entries.
    dungeons_ts_json['tiles'] = []
    dungeons_ts_modified = True

    gid_map_path = lib.MAPS_DIR / 'dungeon_gid_map.json'

    # ── Per-zone sync ─────────────────────────────────────────────────────
    for zone in lib.iter_zones(maps_layer, name_to_file_overrides=NAME_TO_FILE,
                                expand_floor_suffix=True):
        fname     = zone['fname']
        scene_key = WORLD_PREFIX + NAME_TO_SCENE_KEY.get(zone['name'], zone['name'])
        polygon   = zone['polygon']

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

        print('  syncing tile layers from master spriteworld_dungeons.json')
        existing_layers = {l['name']: l for l in route['layers'] if l['type'] == 'tilelayer'}
        inter_idx = lib.tilelayer_insert_index(route['layers'])
        max_lid   = max((l.get('id') or 0 for l in route['layers']), default=0)
        for kname, klayer in master_tilelayers.items():
            raw = lib.extract_region(
                klayer['data'], master_w, master_h,
                ox, oy, dst_w, dst_h,
                polygon=polygon, tw=tw, th=th,
            )
            converted, modified = remap_data(
                raw, src_to_map_gid, dungeons_ts_json, catalogue,
                src_props_indices, common_count, outside_count,
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
            polygon=polygon,
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

        lib.ensure_scene_file(scene_key, inside=True, world_prefix=WORLD_PREFIX)
        lib.ensure_maps_index(scene_key, fname, inside=True, world_prefix=WORLD_PREFIX)
        lib.ensure_scenes_index(scene_key, world_prefix=WORLD_PREFIX)

    with open(gid_map_path, 'w') as f:
        json.dump(gid_map_raw, f, indent=2)
    print(f'\nUpdated dungeon_gid_map.json ({len(src_to_map_gid)} total entries)')

    if update_dungeons_png(src_to_map_gid, common_count, outside_count,
                            dungeons_ts_json, dungeons_ts_path, catalogue,
                            outdoor_source_names):
        dungeons_ts_modified = True

    if dungeons_ts_modified or not dungeons_ts_path.exists():
        lib.write_tileset_json(dungeons_ts_path, dungeons_ts_json)

    lib.sweep_legacy_world_namespace(WORLD_PREFIX)


if __name__ == '__main__':
    main()
