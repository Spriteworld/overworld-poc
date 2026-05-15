#!/usr/bin/env python3
"""
Sync individual interior map JSON files from spriteworld_inside.json.

spriteworld_inside.json is edited in Tiled and may reference any number of
source tilesets (auto-discovered from the master's tilesets array).

This script converts the combined source GIDs from those tilesets into a
two-tileset layout that the engine consumes:
  - spriteworld_common  (inherited — written by update_spriteworld.py)
  - spriteworld_inside  (owned — written here)

Tiles from sources that also appear in the outdoor gid_map.json are resolved
through it (common range only). ALL OTHER source tiles are assigned compact
inside-owned GIDs starting at common_count + 1.

What this script does
─────────────────────
1. Catalogues every source tileset in spriteworld_inside.json.
2. Reads spriteworld_inside.json's "maps" objectgroup to derive each named area's
   tile bounds.
3. For each map file:
   - Creates it if it doesn't exist (standard inside-map layer skeleton).
   - Resizes its tilelayers if the tile dimensions have changed.
   - Extracts tile data from spriteworld_inside.json, remapping combined source GIDs
     to spriteworld_inside GIDs via inside_gid_map.json.
   - For any source GID with no spriteworld_inside equivalent (new tiles added in
     Tiled), appends new entries to the spriteworld_inside tileset JSON and updates
     inside_gid_map.json so subsequent runs keep the assignment stable.
   - Merges interaction objects (matched by name) from spriteworld_inside.json's
     "interactions" objectgroup.
4. Ensures all overworld item/obstacle tiles (Pokeball, CutTree, Bush,
   StrengthBoulder) from gen3_outside are present in spriteworld_common so that
   BaseItem subclasses work correctly in interior maps.
5. Rebuilds spriteworld_inside.png from scratch every run, sourcing pixels from
   the appropriate source PNG per tile.
6. Writes the updated spriteworld_inside tileset JSON (tile properties synced from
   source tilesets for any GID newly added).
7. For any map not already registered in the JS source files, creates a
   Phaser scene file and updates src/maps/index.js and src/scenes/index.js.
"""

import json
import pathlib
import sys

import rebuild_lib as lib

NAME_TO_FILE = {}

# Maps a spriteworld_inside.json map name to the JS scene key that should be used
# when registering it.  Use this when the map already exists under a
# different name registered by update_spriteworld.py (e.g. "ProfLab" ↔ "ProfessorLab").
NAME_TO_SCENE_KEY = {
    'ProfLab': 'ProfessorLab',
}

# Prefixed onto every scene_key (after NAME_TO_SCENE_KEY override). Keeps map
# names like "ProfessorLab" unique across worlds in src/maps/index.js etc.
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

# gen3_outside tile IDs (0-based) that must always live in spriteworld_common so
# that BaseItem subclasses (Pokeball, CutTree, Bush, StrengthBoulder) render
# correctly in interior maps. Mirrors the tileId constants in each subclass.
ITEM_TILE_IDS = [17, 18, 35, 53]


def make_inside_tilesets(common_count):
    return [
        {'firstgid': 1,                'source': '../../../worlds/_base/tileset/maps/spriteworld_common.json'},
        {'firstgid': common_count + 1, 'source': '../../../worlds/_base/tileset/maps/spriteworld_inside.json'},
    ]


# ── Master tileset cataloguing ──────────────────────────────────────────────

def catalogue_master_tilesets(master):
    """Auto-discover all tilesets in the master JSON by resolving each
    source path to its canonical file in TILESET_DIR.
    Returns [(firstgid, source_name, tile_count, source_json), ...] sorted
    by firstgid ascending. Aborts if a tileset JSON cannot be found."""
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
        entries.append((ts['firstgid'], name, ts_json.get('tilecount', 0), ts_json))
    entries.sort(key=lambda e: e[0])
    return entries


def src_gid_to_source(src_gid, catalogue):
    """Resolve a master GID to (source_name, 0-based tile_id, source_json).
    Returns (None, None, None) on miss."""
    for fg, name, count, ts_json in reversed(catalogue):
        if fg <= src_gid < fg + count:
            return name, src_gid - fg, ts_json
    return None, None, None


# ── GID conversion ─────────────────────────────────────────────────────────

def build_compact_gid_map(master_tilelayers, catalogue,
                           outdoor_gid_lookup, outdoor_source_names, common_count):
    """
    Build src_gid → map_gid mapping for indoor maps using the two-tileset
    layout:
    - Tiles from outdoor sources → spriteworld_common GID (1..common_count)
      via outdoor_gid_lookup, but ONLY if the resolved GID <= common_count
    - All other tiles → compact inside range starting at common_count + 1

    Existing assignments in inside_gid_map.json are preserved so that adding
    a new source tileset doesn't reshuffle every GID.

    Returns (src_to_map_gid, map_gid_to_src, gid_map_raw, gid_map_path).
    """
    INSIDE_FIRSTGID = common_count + 1
    gid_map_path = lib.MAPS_DIR / 'inside_gid_map.json'

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

    # Ensure ITEM_TILE_IDS from gen3_outside are included if gen3_outside is
    # among the outdoor sources.
    if 'gen3_outside' in outdoor_source_names:
        extra_item_gids = set()
        for fg, name, count, _ in catalogue:
            if name == 'gen3_outside':
                for tid in ITEM_TILE_IDS:
                    extra_item_gids.add(fg + tid)
                break
        all_src_gids = sorted(set(all_src_gids) | extra_item_gids)

    src_to_map_gid = {}
    needs_assignment = []

    for src_gid in all_src_gids:
        name, tid, _ = src_gid_to_source(src_gid, catalogue)
        if name is None:
            continue
        if name in outdoor_source_names:
            kgid = outdoor_gid_lookup.get((name, tid))
            if kgid is not None and kgid <= common_count:
                src_to_map_gid[src_gid] = kgid
            elif src_gid in prev_src_to_map:
                src_to_map_gid[src_gid] = prev_src_to_map[src_gid]
            else:
                needs_assignment.append(src_gid)
        elif src_gid in prev_src_to_map:
            src_to_map_gid[src_gid] = prev_src_to_map[src_gid]
        else:
            needs_assignment.append(src_gid)

    existing_inside = [g for g in src_to_map_gid.values() if g >= INSIDE_FIRSTGID]
    next_gid = max(existing_inside, default=INSIDE_FIRSTGID - 1) + 1

    for src_gid in needs_assignment:
        src_to_map_gid[src_gid] = next_gid
        next_gid += 1

    map_gid_to_src = {v: k for k, v in src_to_map_gid.items()}
    gid_map_raw    = {
        'src_to_map_gid': {str(k): v for k, v in src_to_map_gid.items()},
        'map_gid_to_src': {str(k): v for k, v in map_gid_to_src.items()},
    }
    return src_to_map_gid, map_gid_to_src, gid_map_raw, gid_map_path


def ensure_inside_tile(inside_ts_json, map_gid, source, tid,
                        src_props_indices, common_count):
    """
    Ensure inside tileset JSON has a tile entry for `map_gid` with
    up-to-date properties synced from the source tileset. Only call for
    inside-owned tiles (map_gid >= common_count + 1) — common-range tiles
    are owned by spriteworld_common.json (written by update_spriteworld.py).
    """
    INSIDE_FIRSTGID = common_count + 1
    tile_id  = map_gid - INSIDE_FIRSTGID
    tiles    = inside_ts_json.setdefault('tiles', [])

    props = src_props_indices.get(source, {}).get(tid, [])

    existing = next((t for t in tiles if t['id'] == tile_id), None)
    if existing is None:
        tiles.append({'id': tile_id, 'properties': props})
        return True
    if existing.get('properties') != props:
        existing['properties'] = props
        return True
    return False


def remap_data(data, catalogue, src_to_map_gid, map_gid_to_src,
                inside_ts_json, src_props_indices, gid_map_raw,
                new_mappings, common_count):
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
            name, tid, _ = src_gid_to_source(src_gid, catalogue)
            if name is not None:
                if ensure_inside_tile(inside_ts_json, igid, name, tid,
                                      src_props_indices, common_count):
                    ts_modified = True
        out.append(igid)

    return out, ts_modified


# ── PNG composition ────────────────────────────────────────────────────────

def update_inside_png(src_to_map_gid, common_count, inside_ts_json,
                      inside_ts_path, catalogue, outdoor_source_names):
    """Rebuild spriteworld_inside.png from inside-owned source tiles."""
    try:
        from PIL import Image
    except ImportError:
        print('  WARNING: Pillow not installed — cannot rebuild PNG')
        return False

    INSIDE_FIRSTGID = common_count + 1

    # Collect (source_name, src_tile_id, dst_tile_id) — dedupe by dst.
    seen_dst = set()
    entries  = []
    for src_gid, map_gid in src_to_map_gid.items():
        if map_gid < INSIDE_FIRSTGID:
            continue
        name, tid, _ = src_gid_to_source(src_gid, catalogue)
        if name is None:
            continue
        dst = map_gid - INSIDE_FIRSTGID
        if dst in seen_dst:
            continue
        seen_dst.add(dst)
        entries.append((name, tid, dst))
    if not entries:
        return False

    # Load source PNGs for inside-owned tilesets.
    src_imgs = {}
    src_cols = {}
    for fg, name, count, ts_json in catalogue:
        # Include all sources — some outdoor-source tiles might fall into
        # inside-owned range (outdoor tiles not in common range).
        ts_path = lib.TILESET_DIR / f'{name}.json'
        with open(ts_path) as f:
            ts_data = json.load(f)
        src_imgs[name] = Image.open(lib.TILESET_DIR / ts_data['image']).convert('RGBA')
        src_cols[name] = ts_data['columns']

    tw   = inside_ts_json['tilewidth']
    th   = inside_ts_json['tileheight']
    cols = inside_ts_json['columns']
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
    img.save(inside_ts_path.parent / inside_ts_json['image'])
    inside_ts_json['imagewidth']  = cols * tw
    inside_ts_json['imageheight'] = rows * th
    inside_ts_json['tilecount']   = cols * rows
    print(f'  rebuilt {inside_ts_json["image"]} ({len(entries)} tiles, {cols}x{rows} grid)')
    return True


# ── Main ────────────────────────────────────────────────────────────────────

def main():
    master, master_tilelayers, master_objs, maps_layer = lib.load_master(
        lib.MAPS_DIR / 'spriteworld_inside.json'
    )
    if not maps_layer:
        print('ERROR: no "maps" objectgroup found in spriteworld_inside.json')
        return

    master_w = master['width']
    master_h = master['height']
    tw, th   = master['tilewidth'], master['tileheight']

    catalogue = catalogue_master_tilesets(master)
    if not catalogue:
        print('ERROR: spriteworld_inside.json has no recognised tilesets')
        return
    print('Master tilesets:')
    for fg, name, count, _ in catalogue:
        print(f'  {name}: firstgid={fg}, tilecount={count}')

    # Read common_count and outdoor GID mappings from gid_map.json
    # (written by update_spriteworld.py).
    with open(lib.MAPS_DIR / 'gid_map.json') as f:
        gid_map_data = json.load(f)
    common_count  = gid_map_data['common_count']
    INSIDE_FIRSTGID = common_count + 1

    # Build a unified outdoor lookup: (source_name, tile_id) → spriteworld GID.
    outdoor_gid_lookup = {}
    outdoor_source_names = set()
    for raw_str, kgid in gid_map_data.get('gen3_to_spriteworld', {}).items():
        tid = int(raw_str) - 1
        outdoor_gid_lookup[('gen3_outside', tid)] = kgid
        outdoor_source_names.add('gen3_outside')
    for key_str, kgid in gid_map_data.get('extras_to_spriteworld', {}).items():
        src, tid_str = key_str.rsplit(':', 1)
        outdoor_gid_lookup[(src, int(tid_str))] = kgid
        outdoor_source_names.add(src)

    src_to_map_gid, map_gid_to_src, gid_map_raw, gid_map_path = build_compact_gid_map(
        master_tilelayers, catalogue,
        outdoor_gid_lookup, outdoor_source_names, common_count,
    )
    inside_count = sum(1 for g in src_to_map_gid.values() if g >= INSIDE_FIRSTGID)
    print(f'Compact GID map: {len(src_to_map_gid)} tiles '
          f'({inside_count} inside-owned, '
          f'{len(src_to_map_gid)-inside_count} inherited from spriteworld_common)')

    inside_ts_path = lib.TILESET_DIR / 'maps' / 'spriteworld_inside.json'
    inside_ts_json = lib.load_or_init_tileset(
        inside_ts_path, 'spriteworld_inside', 'spriteworld_inside.png', columns=8, image_width=256,
    )

    # Build properties index for all sources.
    # Non-outdoor sources: use lib.build_props_index() directly.
    # Outdoor sources: read spriteworld_common.json and map outdoor GIDs
    # <= common_count to properties.
    src_props_indices = {}
    for fg, name, count, ts_json in catalogue:
        if name not in outdoor_source_names:
            src_props_indices[name] = lib.build_props_index(ts_json)

    # For outdoor-source tiles in indoor maps, use spriteworld_common.json
    # properties (authoritative — written by update_spriteworld.py).
    spriteworld_common_ts_path = lib.TILESET_DIR / 'maps' / 'spriteworld_common.json'
    with open(spriteworld_common_ts_path) as f:
        spriteworld_common_ts_json_data = json.load(f)
    spriteworld_tile_props = {t['id']: t.get('properties', [])
                              for t in spriteworld_common_ts_json_data.get('tiles', [])}

    for src_name in outdoor_source_names:
        props_for_source = {}
        for (oname, otid), ogid in outdoor_gid_lookup.items():
            if oname == src_name and ogid <= common_count:
                props_for_source[otid] = spriteworld_tile_props.get(ogid - 1, [])
        src_props_indices[src_name] = props_for_source

    # The compact GID rebuild reassigns every inside GID — clear stale tile
    # entries from a previous run so ensure_inside_tile starts clean.
    inside_ts_json['tiles'] = []
    inside_ts_modified = True

    # ── Per-zone sync ─────────────────────────────────────────────────────
    for zone in lib.iter_zones(maps_layer, name_to_file_overrides=NAME_TO_FILE,
                                expand_floor_suffix=True):
        fname     = zone['fname']
        scene_key = WORLD_PREFIX + NAME_TO_SCENE_KEY.get(zone['name'], zone['name'])

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

        print('  syncing tile layers from master spriteworld_inside.json')
        existing_layers = {l['name']: l for l in route['layers'] if l['type'] == 'tilelayer'}
        inter_idx = lib.tilelayer_insert_index(route['layers'])
        max_lid   = max((l.get('id') or 0 for l in route['layers']), default=0)
        for kname, klayer in master_tilelayers.items():
            raw = lib.extract_region(
                klayer['data'], master_w, master_h,
                ox, oy, dst_w, dst_h,
            )
            converted, modified = remap_data(
                raw, catalogue, src_to_map_gid, map_gid_to_src,
                inside_ts_json, src_props_indices, gid_map_raw, {},
                common_count,
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

        lib.ensure_scene_file(scene_key, inside=True, world_prefix=WORLD_PREFIX)
        lib.ensure_maps_index(scene_key, fname, inside=True, world_prefix=WORLD_PREFIX)
        lib.ensure_scenes_index(scene_key, world_prefix=WORLD_PREFIX)

    # ── Item-tile report (informational) ──────────────────────────────────
    print('\nItem tile map_gids (spriteworld_common):')
    for tile_id in ITEM_TILE_IDS:
        if 'gen3_outside' not in outdoor_source_names:
            print(f'  item tile {tile_id} — gen3_outside not in outdoor sources, skipped')
            continue
        kgid = outdoor_gid_lookup.get(('gen3_outside', tile_id))
        if kgid is None:
            print(f'  WARNING: item tile {tile_id} missing from outdoor GID lookup')
        elif kgid <= common_count:
            print(f'  item tile {tile_id} (gen3_outside) -> map GID {kgid} (spriteworld_common)')
        else:
            print(f'  WARNING: item tile {tile_id} (gen3_outside) -> map GID {kgid} '
                  f'(outside common range {common_count})')

    # ── Persist GID map ───────────────────────────────────────────────────
    with open(gid_map_path, 'w') as f:
        json.dump(gid_map_raw, f, indent=2)
    print(f'\nUpdated inside_gid_map.json ({len(src_to_map_gid)} total entries)')

    if update_inside_png(src_to_map_gid, common_count, inside_ts_json,
                          inside_ts_path, catalogue, outdoor_source_names):
        inside_ts_modified = True

    if inside_ts_modified or not inside_ts_path.exists():
        lib.write_tileset_json(inside_ts_path, inside_ts_json)

    lib.sweep_legacy_world_namespace(WORLD_PREFIX)


if __name__ == '__main__':
    main()
