#!/usr/bin/env python3
"""
Sync individual route/town JSON files and kanto.world from kanto.json.

kanto.json is edited in Tiled using gen3_outside.png as its tileset.
This script converts gen3_outside GIDs → kanto GIDs when writing the
individual map files (which use kanto tileset for the game engine).

What this script does
─────────────────────
1. Reads kanto.json's "maps" objectgroup to derive each named area's
   pixel bounds.
2. Converts those bounds to world coordinates and writes kanto.world.
3. For each map file:
   - Creates it if it doesn't exist (standard kanto layer skeleton).
   - Resizes its tilelayers if the tile dimensions have changed.
   - Extracts tile data from kanto.json, remapping gen3_outside GIDs
     to kanto GIDs using gid_map.json.
   - For any gen3_outside GID with no kanto equivalent (new tiles added
     in Tiled), appends new entries to the kanto tileset JSON and updates
     gid_map.json so subsequent runs keep the assignment stable.
   - Merges interaction objects (matched by name).
4. Writes the updated kanto tileset JSON (tile properties synced from
   gen3_outside for any GID newly added in step 3).
5. For any map not already registered in the JS source files, creates a
   Phaser scene file and updates src/maps/index.js and
   src/scenes/index.js automatically.

Coordinate relationship
───────────────────────
    kanto_pixel = world_pixel + (OFFSET_X, OFFSET_Y)
    world_pixel = kanto_pixel - (OFFSET_X, OFFSET_Y)

Offset derived from pallet.json HeroHouseF1Warp:
    kanto warp @ (3552, 9184), pallet local @ (192, 224), world pos (768, 1344)
    => offset = (3552 - 192 - 768, 9184 - 224 - 1344) = (2592, 7616)
"""

import json

import rebuild_lib as lib

OFFSET_X = 2592
OFFSET_Y = 7616

NAME_TO_FILE = {
    'PalletTown': 'pallet.json',
}

# Prefixed onto every Tiled zone-name to produce the scene_key. Lets multiple
# worlds re-use the same map name (e.g. "Route1") without colliding in
# src/maps/index.js or src/scenes/index.js.
WORLD_PREFIX = 'Kanto'

# (layer_name, ge_charLayer_value, is_objectgroup) — render-stack order.
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

# gen3_outside 0-based tile IDs used programmatically by BaseItem subclasses
# (not placed in tilelayers) — must always be present in gid_map.json so that
# update_kanto_insides.py can assign matching frame positions.
ITEM_TILE_IDS = [17, 18, 35, 53]  # CutTree, Bush, StrengthBoulder, Pokeball


def make_outdoor_tilesets(common_count):
    return [
        {'firstgid': 1,                'source': '../../tileset/maps/kanto_common.json'},
        {'firstgid': common_count + 1, 'source': '../../tileset/maps/kanto_outside.json'},
    ]


# ── GID conversion ─────────────────────────────────────────────────────────

def build_compact_gid_map(kanto_tilelayers, gen3_ts_json,
                          kanto_inside_tilelayers=None,
                          gen3_outside_firstgid_inside=None,
                          dungeons_outside_gids=None):
    """
    Build a gap-free gen3_gid → kanto_gid mapping.

    Tiles are split into two groups:
    - common (GIDs 1..C): gen3_outside tiles used in both outdoor AND indoor maps,
      plus all ITEM_TILE_IDS and animation frame tiles.
    - outdoor_only (GIDs C+1..C+O): gen3_outside tiles used only in outdoor maps,
      plus any gen3_outside tile referenced by `kanto_dungeons.json` (dungeons
      reads from the outdoor tilesets so every dungeon-referenced outdoor tile
      must have an entry here).

    Returns (gen3_to_kanto, kanto_to_gen3, gid_map_path, gid_map_raw, common_count).
    """
    outdoor_gids = {
        gid
        for layer in kanto_tilelayers.values()
        for gid in layer.get('data', [])
        if gid != 0
    }

    anim_gids = set()
    for t in gen3_ts_json.get('tiles', []):
        if 'animation' not in t:
            continue
        anim_gids.add(t['id'] + 1)
        for frame in t['animation']:
            anim_gids.add(frame['tileid'] + 1)
    outdoor_gids |= anim_gids

    # Dungeon-referenced outdoor tiles must exist in gid_map.json or the
    # dungeons rebuild can't resolve them. They don't need to be common —
    # dungeons output maps reference both kanto_common and kanto_outside —
    # so just fold them into the outdoor pool.
    if dungeons_outside_gids:
        outdoor_gids |= dungeons_outside_gids

    item_gids = {tid + 1 for tid in ITEM_TILE_IDS}

    indoor_outside_gids = set()
    if kanto_inside_tilelayers and gen3_outside_firstgid_inside:
        for layer in kanto_inside_tilelayers.values():
            for src_gid in layer.get('data', []):
                if src_gid >= gen3_outside_firstgid_inside:
                    gen3_raw_gid = src_gid - gen3_outside_firstgid_inside + 1
                    indoor_outside_gids.add(gen3_raw_gid)

    common_raw   = sorted(indoor_outside_gids | item_gids)
    outdoor_only = sorted(outdoor_gids - set(common_raw))

    common_count  = len(common_raw)
    gen3_to_kanto = {}
    for i, g in enumerate(common_raw):
        gen3_to_kanto[g] = i + 1
    for i, g in enumerate(outdoor_only):
        gen3_to_kanto[g] = common_count + i + 1

    kanto_to_gen3 = {v: k for k, v in gen3_to_kanto.items()}
    gid_map_raw   = {
        'gen3_to_kanto': {str(k): v for k, v in gen3_to_kanto.items()},
        'kanto_to_gen3': {str(k): v for k, v in kanto_to_gen3.items()},
        'common_count':  common_count,
    }
    gid_map_path = lib.MAPS_DIR / 'gid_map.json'
    return gen3_to_kanto, kanto_to_gen3, gid_map_path, gid_map_raw, common_count


def ensure_kanto_tile(ts_json, kanto_gid, gen3_gid, gen3_props_index,
                      tile_id_offset=0):
    """
    Ensure a tileset JSON has a tile entry for the given GID. Properties are
    re-synced from the gen3_outside source on every run so that flipping a
    flag (e.g. ge_collide) on a source tile actually propagates downstream.
    Returns True if the tileset was modified.
    """
    tile_id = kanto_gid - 1 - tile_id_offset
    tiles   = ts_json.setdefault('tiles', [])

    gen3_tile_id = gen3_gid - 1
    props        = gen3_props_index.get(gen3_tile_id, [])

    existing = next((t for t in tiles if t['id'] == tile_id), None)
    if existing:
        if existing.get('properties') == props:
            return False
        existing['properties'] = props
        return True

    tiles.append({'id': tile_id, 'properties': props})
    return True


def remap_data(data, gen3_to_kanto, kanto_common_ts_json, kanto_outside_ts_json,
               gen3_props_index, kanto_to_gen3,
               gid_map, new_mappings, common_count):
    """
    Convert a flat tile-data array from gen3_outside GIDs to kanto GIDs.

    Tiles with no existing mapping are assigned the next available kanto GID
    (extending the appropriate tileset) and recorded in `new_mappings`.
    GIDs 1..common_count → kanto_common; higher → kanto_outside.
    Returns (converted_data, ts_modified).
    """
    max_kanto   = max(kanto_to_gen3.keys(), default=0)
    out         = []
    ts_modified = False
    for gid in data:
        if gid == 0:
            out.append(0)
            continue
        kgid = gen3_to_kanto.get(gid)
        if kgid is None:
            if gid in new_mappings:
                kgid = new_mappings[gid]
            else:
                max_kanto += 1
                kgid = max_kanto
                new_mappings[gid]                  = kgid
                gen3_to_kanto[gid]                 = kgid
                kanto_to_gen3[kgid]                = gid
                gid_map['gen3_to_kanto'][str(gid)]  = kgid
                gid_map['kanto_to_gen3'][str(kgid)] = gid
        if kgid <= common_count:
            if ensure_kanto_tile(kanto_common_ts_json, kgid, gid, gen3_props_index, 0):
                ts_modified = True
        else:
            if ensure_kanto_tile(kanto_outside_ts_json, kgid, gid, gen3_props_index, common_count):
                ts_modified = True
        out.append(kgid)
    return out, ts_modified


# ── Animation support ──────────────────────────────────────────────────────

def ensure_anim_tiles_in_kanto(gen3_ts_json, gen3_to_kanto, kanto_to_gen3,
                                gid_map, new_mappings, kanto_common_ts_json,
                                kanto_outside_ts_json, gen3_props_index, common_count):
    """
    Guarantee that every animation frame tile from gen3_outside has a kanto
    GID. Frame tiles aren't placed directly on maps so remap_data won't see
    them — fill that gap before update_split_pngs runs.
    """
    max_kanto   = max(kanto_to_gen3.keys(), default=0)
    ts_modified = False
    for t in gen3_ts_json.get('tiles', []):
        if 'animation' not in t:
            continue
        frame_tids = {f['tileid'] for f in t['animation']}
        frame_tids.add(t['id'])
        for tid in sorted(frame_tids):
            gen3_gid = tid + 1
            if gen3_gid in gen3_to_kanto:
                continue
            if gen3_gid in new_mappings:
                kgid = new_mappings[gen3_gid]
            else:
                max_kanto += 1
                kgid = max_kanto
                new_mappings[gen3_gid]                = kgid
                gen3_to_kanto[gen3_gid]               = kgid
                kanto_to_gen3[kgid]                   = gen3_gid
                gid_map['gen3_to_kanto'][str(gen3_gid)] = kgid
                gid_map['kanto_to_gen3'][str(kgid)]      = gen3_gid
            if kgid <= common_count:
                if ensure_kanto_tile(kanto_common_ts_json, kgid, gen3_gid, gen3_props_index, 0):
                    ts_modified = True
            else:
                if ensure_kanto_tile(kanto_outside_ts_json, kgid, gen3_gid, gen3_props_index, common_count):
                    ts_modified = True
    return ts_modified


def sync_kanto_animations(gen3_ts_json, gen3_to_kanto, common_count,
                           kanto_common_ts_json, kanto_outside_ts_json):
    """
    Write animation properties into kanto_common_ts_json or kanto_outside_ts_json
    for every animated gen3 tile. Frame tileids are made 0-based within the
    target tileset.
    """
    common_tiles  = kanto_common_ts_json.setdefault('tiles', [])
    outside_tiles = kanto_outside_ts_json.setdefault('tiles', [])
    common_by_id  = {t['id']: t for t in common_tiles}
    outside_by_id = {t['id']: t for t in outside_tiles}
    modified = False

    for gen3_tile in gen3_ts_json.get('tiles', []):
        if 'animation' not in gen3_tile:
            continue
        kanto_gid = gen3_to_kanto.get(gen3_tile['id'] + 1)
        if kanto_gid is None:
            continue

        is_common = kanto_gid <= common_count
        offset    = 0 if is_common else common_count
        kanto_tid = kanto_gid - 1 - offset

        new_anim = []
        for frame in gen3_tile['animation']:
            frame_kanto_gid = gen3_to_kanto.get(frame['tileid'] + 1)
            if frame_kanto_gid is None:
                continue
            frame_is_common = frame_kanto_gid <= common_count
            frame_offset    = 0 if frame_is_common else common_count
            new_anim.append({
                'duration': frame['duration'],
                'tileid':   frame_kanto_gid - 1 - frame_offset,
            })

        if not new_anim:
            continue
        # animatedTiles plugin uses findIndex to locate the animated tile's
        # own frame — skip animations that don't include themselves.
        if not any(f['tileid'] == kanto_tid for f in new_anim):
            continue

        tile_by_id = common_by_id if is_common else outside_by_id
        tiles_list = common_tiles if is_common else outside_tiles
        entry = tile_by_id.get(kanto_tid)
        if entry is None:
            entry = {'id': kanto_tid}
            tiles_list.append(entry)
            tile_by_id[kanto_tid] = entry

        if entry.get('animation') != new_anim:
            entry['animation'] = new_anim
            modified = True
            ts_name = 'kanto_common' if is_common else 'kanto_outside'
            print(f'  synced animation for {ts_name} tile {kanto_tid} ({len(new_anim)} frames)')

    return modified


def build_anim_png(gen3_ts_json, gen3_to_kanto):
    """
    Write animation.png — a single-row sprite sheet of every animation frame
    tile, ordered by kanto tile ID, followed by frames from any standalone
    animation tilesets (e.g. animated_grass.png). Visual reference only;
    the tiles themselves live in their canonical sheets for the engine.
    """
    try:
        from PIL import Image
    except ImportError:
        return False

    seen       = set()
    anim_tiles = []  # (kanto_gid, gen3_gid) sorted by kanto_gid
    for t in gen3_ts_json.get('tiles', []):
        if 'animation' not in t:
            continue
        all_tids = {t['id']} | {f['tileid'] for f in t['animation']}
        for tid in all_tids:
            gen3_gid  = tid + 1
            kanto_gid = gen3_to_kanto.get(gen3_gid)
            if kanto_gid and kanto_gid not in seen:
                anim_tiles.append((kanto_gid, gen3_gid))
                seen.add(kanto_gid)

    tw, th = 32, 32
    strips = []

    if anim_tiles:
        anim_tiles.sort()
        gen3_cols = gen3_ts_json['columns']
        gen3_img  = Image.open(lib.TILESET_DIR / gen3_ts_json['image']).convert('RGBA')
        strip = Image.new('RGBA', (len(anim_tiles) * tw, th), (0, 0, 0, 0))
        for i, (_, gen3_gid) in enumerate(anim_tiles):
            gen3_tid = gen3_gid - 1
            src_x = (gen3_tid % gen3_cols) * tw
            src_y = (gen3_tid // gen3_cols) * th
            strip.paste(gen3_img.crop((src_x, src_y, src_x + tw, src_y + th)), (i * tw, 0))
        strips.append(strip)

    EXTRA_TILESETS = ['animated_grass']
    for ts_name in EXTRA_TILESETS:
        ts_json_path = lib.TILESET_DIR / f'{ts_name}.json'
        ts_png_path  = lib.TILESET_DIR / f'{ts_name}.png'
        if not ts_json_path.exists() or not ts_png_path.exists():
            continue
        ts_json = json.loads(ts_json_path.read_text(encoding='utf-8'))
        ts_img  = Image.open(ts_png_path).convert('RGBA')
        ts_cols = ts_json['columns']
        frame_tids = set()
        for t in ts_json.get('tiles', []):
            if 'animation' in t:
                frame_tids.add(t['id'])
                frame_tids.update(f['tileid'] for f in t['animation'])
        if not frame_tids:
            frame_tids = set(range(ts_json['tilecount']))
        frame_tids = sorted(frame_tids)
        strip = Image.new('RGBA', (len(frame_tids) * tw, th), (0, 0, 0, 0))
        for i, tid in enumerate(frame_tids):
            src_x = (tid % ts_cols) * tw
            src_y = (tid // ts_cols) * th
            strip.paste(ts_img.crop((src_x, src_y, src_x + tw, src_y + th)), (i * tw, 0))
        strips.append(strip)
        print(f'  included {len(frame_tids)} frame(s) from {ts_name}.png in animation.png')

    if not strips:
        return False

    total_w = sum(s.width for s in strips)
    out_img = Image.new('RGBA', (total_w, th), (0, 0, 0, 0))
    x_off = 0
    for s in strips:
        out_img.paste(s, (x_off, 0))
        x_off += s.width

    out_path = lib.TILESET_DIR / 'maps' / 'animation.png'
    out_img.save(out_path)
    total_frames = total_w // tw
    print(f'  rebuilt animation.png ({total_frames} animation frame tile(s))')
    return True


# ── Output PNG split (kanto_common + kanto_outside) ────────────────────────

def update_split_pngs(gen3_to_kanto, common_count,
                      kanto_common_ts_json, kanto_outside_ts_json,
                      kanto_common_ts_path, kanto_outside_ts_path,
                      gen3_ts_json):
    """
    Rebuild kanto_common.png and kanto_outside.png from scratch.
    GIDs 1..common_count → kanto_common.png; higher → kanto_outside.png.
    """
    if not gen3_to_kanto:
        return False, False

    gen3_cols  = gen3_ts_json['columns']
    gen3_png   = lib.TILESET_DIR / gen3_ts_json['image']

    # Split: each entry is (gen3_tile_id, dst_tile_id). 0-based within target.
    common_entries = sorted(
        [(g - 1, kgid - 1) for g, kgid in gen3_to_kanto.items() if kgid <= common_count],
        key=lambda x: x[1]
    )
    outside_entries = sorted(
        [(g - 1, kgid - common_count - 1) for g, kgid in gen3_to_kanto.items() if kgid > common_count],
        key=lambda x: x[1]
    )

    c = lib.write_tileset_png(
        common_entries, gen3_png, kanto_common_ts_json,
        kanto_common_ts_path.parent / kanto_common_ts_json['image'],
        gen3_cols,
    )
    o = lib.write_tileset_png(
        outside_entries, gen3_png, kanto_outside_ts_json,
        kanto_outside_ts_path.parent / kanto_outside_ts_json['image'],
        gen3_cols,
    )
    return c, o


# ── Main ────────────────────────────────────────────────────────────────────

def main():
    master, kanto_tilelayers, kanto_objs, maps_layer = lib.load_master(
        lib.MAPS_DIR / 'kanto.json'
    )
    if not maps_layer:
        print('ERROR: no "maps" objectgroup found in kanto.json')
        return

    kanto_w = master['width']
    kanto_h = master['height']
    tw, th  = master['tilewidth'], master['tileheight']

    gen3_ts_path = lib.TILESET_DIR / 'gen3_outside.json'
    with open(gen3_ts_path) as f:
        gen3_ts_json = json.load(f)
    gen3_props_index = lib.build_props_index(gen3_ts_json)

    kanto_common_ts_path  = lib.TILESET_DIR / 'maps' / 'kanto_common.json'
    kanto_outside_ts_path = lib.TILESET_DIR / 'maps' / 'kanto_outside.json'
    kanto_common_ts_json  = lib.load_or_init_tileset(
        kanto_common_ts_path,  'kanto_common',  'kanto_common.png',  columns=16, image_width=512)
    kanto_outside_ts_json = lib.load_or_init_tileset(
        kanto_outside_ts_path, 'kanto_outside', 'kanto_outside.png', columns=16, image_width=512)

    # Clear stale tile entries — recomputed from gen3_outside every run.
    kanto_common_ts_json['tiles'] = []
    kanto_outside_ts_json['tiles'] = []

    # Read kanto_inside.json to find which gen3_outside tiles are also used indoors.
    kanto_inside_path        = lib.MAPS_DIR / 'kanto_inside.json'
    kanto_inside_tilelayers  = {}
    gen3_outside_firstgid_inside = None
    if kanto_inside_path.exists():
        with open(kanto_inside_path) as f:
            ki = json.load(f)
        kanto_inside_tilelayers = {
            l['name']: l for l in ki.get('layers', []) if l['type'] == 'tilelayer'
        }
        for ts in ki.get('tilesets', []):
            if 'gen3_outside' in ts.get('source', ''):
                gen3_outside_firstgid_inside = ts['firstgid']
                break

    # Read kanto_dungeons.json to surface every gen3_outside tile referenced
    # by dungeons. Dungeons may register the same gen3_outside source under
    # multiple firstgids (Tiled occasionally re-imports via a different path),
    # so visit each tileset entry. Only `cave_dungeon` is a non-outdoor source.
    dungeons_outside_gids = set()
    kanto_dungeons_path = lib.MAPS_DIR / 'kanto_dungeons.json'
    if kanto_dungeons_path.exists():
        with open(kanto_dungeons_path) as f:
            kd = json.load(f)
        outside_ranges = []
        cave_firstgid  = None
        cave_count     = 0
        for ts in kd.get('tilesets', []):
            src = ts.get('source', '')
            if 'cave_dungeon' in src:
                cave_firstgid = ts['firstgid']
                with open(lib.TILESET_DIR / 'cave_dungeon.json') as ctf:
                    cave_count = json.load(ctf).get('tilecount', 0)
            elif 'gen3_outside' in src:
                outside_ranges.append(ts['firstgid'])
        for layer in kd.get('layers', []):
            if layer.get('type') != 'tilelayer':
                continue
            for src_gid in layer.get('data', []):
                if src_gid == 0:
                    continue
                if cave_firstgid is not None and \
                   cave_firstgid <= src_gid < cave_firstgid + cave_count:
                    continue
                # Resolve via the largest gen3_outside firstgid <= src_gid.
                base = max((fg for fg in outside_ranges if fg <= src_gid), default=None)
                if base is None:
                    continue
                gen3_raw_gid = src_gid - base + 1
                dungeons_outside_gids.add(gen3_raw_gid)

    gen3_to_kanto, kanto_to_gen3, gid_map_path, gid_map, common_count = build_compact_gid_map(
        kanto_tilelayers, gen3_ts_json,
        kanto_inside_tilelayers, gen3_outside_firstgid_inside,
        dungeons_outside_gids=dungeons_outside_gids,
    )
    print(f'Compact GID map: {len(gen3_to_kanto)} tiles '
          f'({common_count} common, {len(gen3_to_kanto)-common_count} outdoor-only)')

    kanto_common_ts_modified  = False
    kanto_outside_ts_modified = False

    # ── Bounds + kanto.world ───────────────────────────────────────────────
    bounds = {}
    fname_to_key = {}
    for zone in lib.iter_zones(maps_layer, name_to_file_overrides=NAME_TO_FILE):
        polygon = zone['polygon']
        if polygon:
            polygon = [(px - OFFSET_X, py - OFFSET_Y) for px, py in polygon]
        bounds[zone['fname']] = {
            'x':      zone['x'] - OFFSET_X,
            'y':      zone['y'] - OFFSET_Y,
            'width':  zone['width'],
            'height': zone['height'],
            'polygon':    polygon,
            'properties': zone['properties'],
        }
        fname_to_key[zone['fname']] = WORLD_PREFIX + zone['name']

    world_path = lib.MAPS_DIR / 'kanto.world'
    if world_path.exists():
        with open(world_path) as f:
            world = json.load(f)
    else:
        world = {'onlyShowAdjacentMaps': False, 'type': 'world', 'maps': []}

    updated = []
    for fname, b in bounds.items():
        updated.append({
            'fileName': fname,
            'x': b['x'], 'y': b['y'], 'width': b['width'], 'height': b['height'],
        })
    for e in world['maps']:
        if e['fileName'] not in bounds:
            updated.append(e)
    world['maps'] = updated
    with open(world_path, 'w') as f:
        json.dump(world, f, indent=4)
    print('Updated kanto.world')

    # ── Per-zone sync ──────────────────────────────────────────────────────
    for fname, b in bounds.items():
        route_path = lib.MAPS_DIR / fname
        dst_w = b['width']  // tw
        dst_h = b['height'] // th
        ox    = (b['x'] + OFFSET_X) // tw
        oy    = (b['y'] + OFFSET_Y) // th
        # Polygon in master pixel coords (add OFFSET back) for extract_region
        polygon_local = b.get('polygon')
        polygon_master = ([(px + OFFSET_X, py + OFFSET_Y) for px, py in polygon_local]
                          if polygon_local else None)

        print(f'\n{fname}: kanto tile origin ({ox},{oy}), size {dst_w}x{dst_h}')

        if not route_path.exists():
            route = lib.make_skeleton(dst_w, dst_h, LAYER_TEMPLATE,
                                       make_outdoor_tilesets(0))
            print('  created skeleton')
        else:
            with open(route_path) as f:
                route = json.load(f)

        route['tilesets'] = make_outdoor_tilesets(common_count)
        lib.resize_route(route, dst_w, dst_h)

        # Tile layers — sync existing ones, drop empty/obsolete ones.
        remove_layers = set()
        for layer in route['layers']:
            if layer['type'] != 'tilelayer':
                continue
            name = layer['name']
            if name not in kanto_tilelayers:
                remove_layers.add(name)
                print(f'  removed layer "{name}" (not in kanto.json)')
                continue
            raw = lib.extract_region(
                kanto_tilelayers[name]['data'], kanto_w, kanto_h,
                ox, oy, dst_w, dst_h,
                polygon=polygon_master, tw=tw, th=th,
            )
            converted, modified = remap_data(
                raw, gen3_to_kanto, kanto_common_ts_json, kanto_outside_ts_json,
                gen3_props_index, kanto_to_gen3, gid_map, {}, common_count,
            )
            if modified:
                kanto_common_ts_modified  = True
                kanto_outside_ts_modified = True
            non_zero = sum(1 for t in converted if t != 0)
            if non_zero == 0:
                remove_layers.add(name)
                print(f'  removed layer "{name}" (empty in this region)')
                continue
            layer['data']   = converted
            layer['width']  = dst_w
            layer['height'] = dst_h
            print(f'  updated layer "{name}" ({non_zero} non-zero tiles)')

        if remove_layers:
            route['layers'] = [
                l for l in route['layers']
                if not (l['type'] == 'tilelayer' and l['name'] in remove_layers)
            ]

        # Tile layers — add any layers present in master but missing here.
        existing_names = {l['name'] for l in route['layers'] if l['type'] == 'tilelayer'}
        inter_idx = lib.tilelayer_insert_index(route['layers'])
        max_lid   = max((l.get('id') or 0 for l in route['layers']), default=0)
        for kname, klayer in kanto_tilelayers.items():
            if kname in existing_names:
                continue
            raw = lib.extract_region(
                klayer['data'], kanto_w, kanto_h,
                ox, oy, dst_w, dst_h,
                polygon=polygon_master, tw=tw, th=th,
            )
            if not any(raw):
                continue
            converted, modified = remap_data(
                raw, gen3_to_kanto, kanto_common_ts_json, kanto_outside_ts_json,
                gen3_props_index, kanto_to_gen3, gid_map, {}, common_count,
            )
            if modified:
                kanto_common_ts_modified  = True
                kanto_outside_ts_modified = True
            non_zero = sum(1 for t in converted if t != 0)
            if non_zero == 0:
                continue
            max_lid += 1
            new_layer = lib.make_layer(kname, dst_w, dst_h, LAYER_CHAR.get(kname))
            new_layer['id']   = max_lid
            new_layer['data'] = converted
            route['layers'].insert(inter_idx, new_layer)
            inter_idx += 1
            existing_names.add(kname)
            print(f'  added new layer "{kname}" ({non_zero} non-zero tiles)')

        # Interaction objects
        inter = lib.get_or_create_interaction_layer(route['layers'])
        kanto_px_x = ox * tw
        kanto_px_y = oy * th
        px_w = dst_w * tw
        px_h = dst_h * th
        objects, next_oid = lib.merge_interactions(
            kanto_objs, kanto_px_x, kanto_px_y, px_w, px_h,
            polygon=polygon_master,
        )
        inter['objects']      = objects
        route['nextobjectid'] = next_oid
        for o in objects:
            print(f'  added obj "{o["name"]}"')

        props = b['properties']
        if props:
            route['properties'] = props
        elif 'properties' in route:
            del route['properties']

        lib.sort_layers(route['layers'], LAYER_ORDER)

        with open(route_path, 'w') as f:
            json.dump(route, f, indent=2)
        print(f'  saved {fname}')

        scene_key = fname_to_key[fname]
        lib.ensure_scene_file(scene_key, world_prefix=WORLD_PREFIX)
        lib.ensure_maps_index(scene_key, fname, world_prefix=WORLD_PREFIX)
        lib.ensure_scenes_index(scene_key, world_prefix=WORLD_PREFIX)

    # ── Animation backfill + sync ──────────────────────────────────────────
    if ensure_anim_tiles_in_kanto(gen3_ts_json, gen3_to_kanto, kanto_to_gen3,
                                   gid_map, {}, kanto_common_ts_json,
                                   kanto_outside_ts_json, gen3_props_index,
                                   common_count):
        kanto_common_ts_modified  = True
        kanto_outside_ts_modified = True

    if sync_kanto_animations(gen3_ts_json, gen3_to_kanto, common_count,
                              kanto_common_ts_json, kanto_outside_ts_json):
        kanto_common_ts_modified  = True
        kanto_outside_ts_modified = True

    # Re-sync tile properties on every existing kanto tile entry. Tiles only
    # appear in remap_data when touched by the master kanto.json data;
    # per-zone sources don't round-trip through this script, so a flag
    # flipped on a gen3_outside source tile would otherwise never propagate
    # to its kanto_common / kanto_outside derivative.
    for kgid_str, gen3_gid in gid_map['kanto_to_gen3'].items():
        kgid = int(kgid_str)
        if kgid <= common_count:
            if ensure_kanto_tile(kanto_common_ts_json, kgid, int(gen3_gid), gen3_props_index, 0):
                kanto_common_ts_modified = True
        else:
            if ensure_kanto_tile(kanto_outside_ts_json, kgid, int(gen3_gid), gen3_props_index, common_count):
                kanto_outside_ts_modified = True

    with open(gid_map_path, 'w') as f:
        json.dump(gid_map, f, indent=2)
    print(f'\nUpdated gid_map.json ({len(gen3_to_kanto)} total, {common_count} common)')

    # Flat common-only map for BaseItem.js
    common_flat = {k: v for k, v in gid_map['gen3_to_kanto'].items() if int(v) <= common_count}
    flat_path = lib.MAPS_DIR / 'gen3_to_kanto_common.json'
    with open(flat_path, 'w') as f:
        json.dump(common_flat, f, indent=2)
    print(f'Updated gen3_to_kanto_common.json ({len(common_flat)} entries)')

    common_png_modified, outside_png_modified = update_split_pngs(
        gen3_to_kanto, common_count, kanto_common_ts_json, kanto_outside_ts_json,
        kanto_common_ts_path, kanto_outside_ts_path, gen3_ts_json,
    )
    if common_png_modified:  kanto_common_ts_modified  = True
    if outside_png_modified: kanto_outside_ts_modified = True

    build_anim_png(gen3_ts_json, gen3_to_kanto)

    if kanto_common_ts_modified:
        lib.write_tileset_json(kanto_common_ts_path, kanto_common_ts_json)
    if kanto_outside_ts_modified:
        lib.write_tileset_json(kanto_outside_ts_path, kanto_outside_ts_json)

    # End-of-run sweep: catch any leftover un-prefixed entries (maps no longer
    # in the master, but still listed in src/maps/index.js etc).
    lib.sweep_legacy_world_namespace(WORLD_PREFIX)


if __name__ == '__main__':
    main()
