#!/usr/bin/env python3
"""
Sync individual route/town JSON files and spriteworld.world from spriteworld.json.

spriteworld.json is edited in Tiled and may reference any source tilesets
(auto-discovered from the master's tilesets array).  This script
converts master src GIDs → spriteworld GIDs when writing the individual map
files (which use a compact two-tileset layout: spriteworld_common +
spriteworld_outside).

What this script does
─────────────────────
1. Catalogues every source tileset in spriteworld.json.
2. Reads spriteworld.json's "maps" objectgroup to derive each named area's
   pixel bounds.
3. Converts those bounds to world coordinates and writes spriteworld.world.
4. For each map file:
   - Creates it if it doesn't exist (standard spriteworld layer skeleton).
   - Resizes its tilelayers if the tile dimensions have changed.
   - Decodes each master src GID to (source_name, tile_id) and remaps it
     to a compact spriteworld GID.
   - Merges interaction objects (matched by name).
5. Splits the combined GID space into spriteworld_common (used in indoor maps
   too) + spriteworld_outside (everything else).
6. Writes the updated spriteworld_common / spriteworld_outside tileset JSONs and
   composes their PNGs from the appropriate source PNG per tile.
7. Registers any new map in src/maps/index.js + src/scenes/index.js and
   creates a Phaser scene stub.

Coordinate relationship
───────────────────────
    spriteworld_pixel = world_pixel + (OFFSET_X, OFFSET_Y)
    world_pixel = spriteworld_pixel - (OFFSET_X, OFFSET_Y)

Offset derived from pallet.json HeroHouseF1Warp:
    spriteworld warp @ (3552, 9184), pallet local @ (192, 224), world pos (768, 1344)
    => offset = (3552 - 192 - 768, 9184 - 224 - 1344) = (2592, 7616)
"""

import json
import pathlib
import sys

import rebuild_lib as lib

OFFSET_X = 2592
OFFSET_Y = 7616

NAME_TO_FILE = {
    'PalletTown': 'pallet.json',
}

# Prefixed onto every Tiled zone-name to produce the scene_key. Lets multiple
# worlds re-use the same map name (e.g. "Route1") without colliding in
# src/maps/index.js or src/scenes/index.js.
WORLD_PREFIX = 'Spriteworld'

# (layer_name, ge_charLayer_value, is_objectgroup) — render-stack order.
LAYER_TEMPLATE = [
    ('floor',        None,     False),
    ('water',        None,     False),
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
# update_spriteworld_insides.py can assign matching frame positions.
ITEM_TILE_IDS = [17, 18, 35, 53]  # CutTree, Bush, StrengthBoulder, Pokeball


def make_outdoor_tilesets(common_count):
    return [
        {'firstgid': 1,                'source': '../../../worlds/_base/tileset/maps/spriteworld_common.json'},
        {'firstgid': common_count + 1, 'source': '../../../worlds/_base/tileset/maps/spriteworld_outside.json'},
    ]


# ── Source-tileset catalogue ────────────────────────────────────────────────

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
                          spriteworld_inside_tilelayers=None,
                          gen3_outside_firstgid_inside=None,
                          dungeons_outside_gids=None):
    """
    Build a gap-free (source, tile_id) → spriteworld_gid mapping.

    Tiles are split into two groups:
    - common (GIDs 1..C): gen3_outside tiles used in both outdoor AND indoor
      maps, plus all gen3_outside ITEM_TILE_IDS and gen3_outside animation
      frame tiles.
    - outdoor_only (GIDs C+1..C+O): every other referenced tile — gen3_outside
      tiles only used outdoor (or by dungeons), plus every tile from other
      source tilesets (those sources are outdoor-only by nature).

    Returns (src_to_spriteworld, spriteworld_to_src, gid_map_path, gid_map_raw,
              common_count) where the in-memory dicts are keyed by
      (source_name, tile_id).
    """
    # Decode every non-zero master GID in outdoor tilelayers to (source, tid).
    outdoor_keys = set()
    for layer in master_tilelayers.values():
        for src_gid in layer.get('data', []):
            if src_gid == 0:
                continue
            name, tid, _ = src_gid_to_source(src_gid, catalogue)
            if name is None:
                continue
            outdoor_keys.add((name, tid))

    # Animation frames from any source — always need a spriteworld GID even
    # when not placed on a tilelayer directly.
    anim_keys = set()
    for fg, name, count, ts_json in catalogue:
        for t in ts_json.get('tiles', []):
            if 'animation' not in t:
                continue
            anim_keys.add((name, t['id']))
            for frame in t['animation']:
                anim_keys.add((name, frame['tileid']))
    outdoor_keys |= anim_keys

    # Dungeons-referenced gen3_outside tiles must exist in gid_map.json or
    # update_spriteworld_dungeons.py can't resolve them.
    if dungeons_outside_gids:
        for raw_gid in dungeons_outside_gids:
            outdoor_keys.add(('gen3_outside', raw_gid - 1))

    # Item tiles + indoor-shared gen3_outside tiles → common pool.
    item_keys = {('gen3_outside', tid) for tid in ITEM_TILE_IDS}

    indoor_outside_keys = set()
    if spriteworld_inside_tilelayers and gen3_outside_firstgid_inside:
        for layer in spriteworld_inside_tilelayers.values():
            for src_gid in layer.get('data', []):
                if src_gid >= gen3_outside_firstgid_inside:
                    tid = src_gid - gen3_outside_firstgid_inside
                    indoor_outside_keys.add(('gen3_outside', tid))

    common_keys  = sorted(indoor_outside_keys | item_keys)
    outdoor_only = sorted(outdoor_keys - set(common_keys))

    common_count    = len(common_keys)
    outside_count   = len(outdoor_only)
    src_to_spriteworld = {}
    for i, key in enumerate(common_keys):
        src_to_spriteworld[key] = i + 1
    for i, key in enumerate(outdoor_only):
        src_to_spriteworld[key] = common_count + i + 1
    spriteworld_to_src = {v: k for k, v in src_to_spriteworld.items()}

    # Persist with the schema that update_spriteworld_insides.py /
    # update_spriteworld_dungeons.py read:
    #   gen3_to_spriteworld / spriteworld_to_gen3 hold ONLY gen3_outside entries
    #     (raw_gid = tile_id + 1). Other source mappings live in
    #     `extras_to_spriteworld` keyed by "source:tile_id" strings.
    #   `outside_count` = total spriteworld_outside tile count (across all
    #     sources) — dungeons reads this to know its own firstgid.
    gen3_to_spriteworld = {
        str(tid + 1): sgid
        for (src, tid), sgid in src_to_spriteworld.items() if src == 'gen3_outside'
    }
    spriteworld_to_gen3 = {
        str(sgid): tid + 1
        for (src, tid), sgid in src_to_spriteworld.items() if src == 'gen3_outside'
    }
    extras_to_spriteworld = {
        f'{src}:{tid}': sgid
        for (src, tid), sgid in src_to_spriteworld.items() if src != 'gen3_outside'
    }
    gid_map_raw = {
        'gen3_to_spriteworld':   gen3_to_spriteworld,
        'spriteworld_to_gen3':   spriteworld_to_gen3,
        'extras_to_spriteworld': extras_to_spriteworld,
        'common_count':          common_count,
        'outside_count':         outside_count,
    }
    gid_map_path = lib.MAPS_DIR / 'gid_map.json'
    return src_to_spriteworld, spriteworld_to_src, gid_map_path, gid_map_raw, common_count


def _record_new_mapping(name, tid, sgid, gid_map):
    """Update gid_map dict in-place for a freshly assigned (source, tid)."""
    if name == 'gen3_outside':
        gid_map['gen3_to_spriteworld'][str(tid + 1)] = sgid
        gid_map['spriteworld_to_gen3'][str(sgid)]    = tid + 1
    else:
        gid_map['extras_to_spriteworld'][f'{name}:{tid}'] = sgid


def ensure_spriteworld_tile(ts_json, spriteworld_gid, source, tid, src_props_indices,
                            tile_id_offset=0):
    """Ensure a tileset JSON has a tile entry for `spriteworld_gid` with up-to-date
    properties from the named source tileset. Returns True if modified."""
    tile_id = spriteworld_gid - 1 - tile_id_offset
    tiles   = ts_json.setdefault('tiles', [])
    props   = src_props_indices.get(source, {}).get(tid, [])

    existing = next((t for t in tiles if t['id'] == tile_id), None)
    if existing is None:
        tiles.append({'id': tile_id, 'properties': props})
        return True
    if existing.get('properties') == props:
        return False
    existing['properties'] = props
    return True


def remap_data(data, catalogue, src_to_spriteworld, spriteworld_to_src,
               spriteworld_common_ts_json, spriteworld_outside_ts_json,
               src_props_indices, gid_map, common_count, new_mappings):
    """
    Convert a flat master-GID array to spriteworld GIDs.

    Tiles whose (source, tid) isn't in `src_to_spriteworld` are assigned the
    next available spriteworld GID (extending the appropriate output tileset)
    and recorded in `new_mappings`. GIDs 1..common_count → spriteworld_common;
    higher → spriteworld_outside. Returns (converted_data, ts_modified).
    """
    max_spriteworld = max(spriteworld_to_src.keys(), default=0)
    out         = []
    ts_modified = False
    for src_gid in data:
        if src_gid == 0:
            out.append(0)
            continue
        name, tid, _ = src_gid_to_source(src_gid, catalogue)
        if name is None:
            out.append(0)
            continue
        key  = (name, tid)
        sgid = src_to_spriteworld.get(key)
        if sgid is None:
            if key in new_mappings:
                sgid = new_mappings[key]
            else:
                max_spriteworld += 1
                sgid = max_spriteworld
                new_mappings[key]          = sgid
                src_to_spriteworld[key]    = sgid
                spriteworld_to_src[sgid]   = key
                _record_new_mapping(name, tid, sgid, gid_map)
        if sgid <= common_count:
            if ensure_spriteworld_tile(spriteworld_common_ts_json, sgid, name, tid,
                                       src_props_indices, 0):
                ts_modified = True
        else:
            if ensure_spriteworld_tile(spriteworld_outside_ts_json, sgid, name, tid,
                                       src_props_indices, common_count):
                ts_modified = True
        out.append(sgid)
    return out, ts_modified


# ── Animation support ──────────────────────────────────────────────────────

def ensure_anim_tiles_in_spriteworld(catalogue, src_to_spriteworld, spriteworld_to_src,
                                     gid_map, new_mappings,
                                     spriteworld_common_ts_json, spriteworld_outside_ts_json,
                                     src_props_indices, common_count):
    """Guarantee every animation frame tile from any source has a spriteworld
    GID. Frame tiles aren't placed directly on maps so remap_data won't see
    them — fill that gap before update_split_pngs runs."""
    max_spriteworld = max(spriteworld_to_src.keys(), default=0)
    ts_modified = False
    for fg, name, count, ts_json in catalogue:
        for t in ts_json.get('tiles', []):
            if 'animation' not in t:
                continue
            frame_tids = {f['tileid'] for f in t['animation']}
            frame_tids.add(t['id'])
            for tid in sorted(frame_tids):
                key = (name, tid)
                if key in src_to_spriteworld:
                    continue
                if key in new_mappings:
                    sgid = new_mappings[key]
                else:
                    max_spriteworld += 1
                    sgid = max_spriteworld
                    new_mappings[key]          = sgid
                    src_to_spriteworld[key]    = sgid
                    spriteworld_to_src[sgid]   = key
                    _record_new_mapping(name, tid, sgid, gid_map)
                if sgid <= common_count:
                    if ensure_spriteworld_tile(spriteworld_common_ts_json, sgid, name, tid,
                                               src_props_indices, 0):
                        ts_modified = True
                else:
                    if ensure_spriteworld_tile(spriteworld_outside_ts_json, sgid, name, tid,
                                               src_props_indices, common_count):
                        ts_modified = True
    return ts_modified


def sync_spriteworld_animations(catalogue, src_to_spriteworld, common_count,
                                spriteworld_common_ts_json, spriteworld_outside_ts_json):
    """
    Write animation properties into spriteworld_common/outside for every animated
    source tile (across all source tilesets). Frame tileids are made 0-based
    within the target output tileset.
    """
    common_tiles  = spriteworld_common_ts_json.setdefault('tiles', [])
    outside_tiles = spriteworld_outside_ts_json.setdefault('tiles', [])
    common_by_id  = {t['id']: t for t in common_tiles}
    outside_by_id = {t['id']: t for t in outside_tiles}
    modified = False

    animated_common_tids  = set()
    animated_outside_tids = set()

    for fg, name, count, ts_json in catalogue:
        for src_tile in ts_json.get('tiles', []):
            if 'animation' not in src_tile:
                continue
            sgid = src_to_spriteworld.get((name, src_tile['id']))
            if sgid is None:
                continue

            is_common      = sgid <= common_count
            offset         = 0 if is_common else common_count
            spriteworld_tid = sgid - 1 - offset

            new_anim = []
            for frame in src_tile['animation']:
                frame_sgid = src_to_spriteworld.get((name, frame['tileid']))
                if frame_sgid is None:
                    continue
                frame_is_common = frame_sgid <= common_count
                frame_offset    = 0 if frame_is_common else common_count
                new_anim.append({
                    'duration': frame['duration'],
                    'tileid':   frame_sgid - 1 - frame_offset,
                })

            if not new_anim:
                continue
            # animatedTiles plugin uses findIndex to locate the animated
            # tile's own frame — skip animations that don't include themselves.
            if not any(f['tileid'] == spriteworld_tid for f in new_anim):
                continue

            if is_common:
                animated_common_tids.add(spriteworld_tid)
            else:
                animated_outside_tids.add(spriteworld_tid)

            tile_by_id = common_by_id if is_common else outside_by_id
            tiles_list = common_tiles  if is_common else outside_tiles
            entry = tile_by_id.get(spriteworld_tid)
            if entry is None:
                entry = {'id': spriteworld_tid}
                tiles_list.append(entry)
                tile_by_id[spriteworld_tid] = entry

            if entry.get('animation') != new_anim:
                entry['animation'] = new_anim
                modified = True
                ts_name = 'spriteworld_common' if is_common else 'spriteworld_outside'
                print(f'  synced animation for {ts_name} tile {spriteworld_tid} '
                      f'({len(new_anim)} frames, source={name})')

    for entry in common_tiles:
        if 'animation' in entry and entry['id'] not in animated_common_tids:
            del entry['animation']
            modified = True
            print(f'  removed stale animation from spriteworld_common tile {entry["id"]}')
    for entry in outside_tiles:
        if 'animation' in entry and entry['id'] not in animated_outside_tids:
            del entry['animation']
            modified = True
            print(f'  removed stale animation from spriteworld_outside tile {entry["id"]}')

    return modified


def build_anim_png(catalogue, src_to_spriteworld):
    """
    Write animation.png — a single-row sprite sheet of every animation frame
    tile (from any source), ordered by spriteworld GID. Visual reference only;
    the tiles themselves live in their canonical sheets for the engine.
    """
    try:
        from PIL import Image
    except ImportError:
        return False

    seen       = set()
    anim_tiles = []  # (spriteworld_gid, source_name, tile_id) sorted by spriteworld_gid
    for fg, name, count, ts_json in catalogue:
        for t in ts_json.get('tiles', []):
            if 'animation' not in t:
                continue
            all_tids = {t['id']} | {f['tileid'] for f in t['animation']}
            for tid in all_tids:
                sgid = src_to_spriteworld.get((name, tid))
                if sgid and sgid not in seen:
                    anim_tiles.append((sgid, name, tid))
                    seen.add(sgid)

    if not anim_tiles:
        return False

    tw, th = 32, 32
    anim_tiles.sort(key=lambda e: e[0])

    src_imgs = {}
    src_cols = {}
    for fg, name, count, ts_json in catalogue:
        png_path = lib.TILESET_DIR / ts_json['image']
        src_imgs[name] = Image.open(png_path).convert('RGBA')
        src_cols[name] = ts_json['columns']

    out_img = Image.new('RGBA', (len(anim_tiles) * tw, th), (0, 0, 0, 0))
    for i, (_, name, tid) in enumerate(anim_tiles):
        cols = src_cols[name]
        sx = (tid % cols) * tw
        sy = (tid // cols) * th
        out_img.paste(src_imgs[name].crop((sx, sy, sx + tw, sy + th)), (i * tw, 0))

    out_path = lib.TILESET_DIR / 'maps' / 'animation.png'
    out_img.save(out_path)
    print(f'  rebuilt animation.png ({len(anim_tiles)} animation frame tile(s))')
    return True


# ── Output PNG split (spriteworld_common + spriteworld_outside) ────────────

def update_split_pngs(catalogue, src_to_spriteworld, common_count,
                      spriteworld_common_ts_json, spriteworld_outside_ts_json,
                      spriteworld_common_ts_path, spriteworld_outside_ts_path):
    """
    Rebuild spriteworld_common.png and spriteworld_outside.png from scratch. Each
    output tile is sourced from whichever input PNG owns its (source, tid)
    pair. GIDs 1..common_count → spriteworld_common.png; higher → spriteworld_outside.png.
    """
    if not src_to_spriteworld:
        return False, False

    try:
        from PIL import Image
    except ImportError:
        print('  WARNING: Pillow not installed — cannot rebuild PNG')
        return False, False

    src_imgs = {}
    src_cols = {}
    for fg, name, count, ts_json in catalogue:
        png_path = lib.TILESET_DIR / ts_json['image']
        src_imgs[name] = Image.open(png_path).convert('RGBA')
        src_cols[name] = ts_json['columns']

    # (source_name, src_tile_id, dst_tile_id) per output tileset.
    common_entries  = []
    outside_entries = []
    for (name, tid), sgid in src_to_spriteworld.items():
        if sgid <= common_count:
            common_entries.append((name, tid, sgid - 1))
        else:
            outside_entries.append((name, tid, sgid - common_count - 1))

    c = _compose_png(common_entries,  src_imgs, src_cols,
                     spriteworld_common_ts_json,
                     spriteworld_common_ts_path.parent / spriteworld_common_ts_json['image'])
    o = _compose_png(outside_entries, src_imgs, src_cols,
                     spriteworld_outside_ts_json,
                     spriteworld_outside_ts_path.parent / spriteworld_outside_ts_json['image'])
    return c, o


def _compose_png(entries, src_imgs, src_cols, ts_json, dst_path):
    """Compose a tileset PNG from (source_name, src_tile_id, dst_tile_id) entries.
    Reads tiles from the appropriate cached source PNG."""
    try:
        from PIL import Image
    except ImportError:
        return False
    if not entries:
        return False
    tw   = ts_json['tilewidth']
    th   = ts_json['tileheight']
    cols = ts_json['columns']
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
    img.save(dst_path)
    ts_json['imagewidth']  = cols * tw
    ts_json['imageheight'] = rows * th
    ts_json['tilecount']   = cols * rows
    print(f'  rebuilt {dst_path.name} ({len(entries)} tiles, {cols}x{rows} grid)')
    return True


# ── Main ────────────────────────────────────────────────────────────────────

def main():
    master, spriteworld_tilelayers, spriteworld_objs, maps_layer = lib.load_master(
        lib.MAPS_DIR / 'spriteworld.json'
    )
    if not maps_layer:
        print('ERROR: no "maps" objectgroup found in spriteworld.json')
        return

    spriteworld_w = master['width']
    spriteworld_h = master['height']
    tw, th  = master['tilewidth'], master['tileheight']

    catalogue = catalogue_master_tilesets(master)
    if not catalogue:
        print('ERROR: spriteworld.json has no recognised tilesets')
        return
    print('Master tilesets:')
    for fg, name, count, _ in catalogue:
        print(f'  {name}: firstgid={fg}, tilecount={count}')

    src_props_indices = {
        name: lib.build_props_index(ts_json)
        for fg, name, count, ts_json in catalogue
    }

    spriteworld_common_ts_path  = lib.TILESET_DIR / 'maps' / 'spriteworld_common.json'
    spriteworld_outside_ts_path = lib.TILESET_DIR / 'maps' / 'spriteworld_outside.json'
    spriteworld_common_ts_json  = lib.load_or_init_tileset(
        spriteworld_common_ts_path,  'spriteworld_common',  'spriteworld_common.png',  columns=16, image_width=512)
    spriteworld_outside_ts_json = lib.load_or_init_tileset(
        spriteworld_outside_ts_path, 'spriteworld_outside', 'spriteworld_outside.png', columns=16, image_width=512)

    # Read spriteworld_inside.json to find which gen3_outside tiles are also used indoors.
    spriteworld_inside_path        = lib.MAPS_DIR / 'spriteworld_inside.json'
    spriteworld_inside_tilelayers  = {}
    gen3_outside_firstgid_inside = None
    if spriteworld_inside_path.exists():
        with open(spriteworld_inside_path) as f:
            ki = json.load(f)
        spriteworld_inside_tilelayers = {
            l['name']: l for l in ki.get('layers', []) if l['type'] == 'tilelayer'
        }
        for ts in ki.get('tilesets', []):
            if 'gen3_outside' in ts.get('source', ''):
                gen3_outside_firstgid_inside = ts['firstgid']
                break

    # Read spriteworld_dungeons.json to surface every gen3_outside tile referenced
    # by dungeons. Dungeons may register the same gen3_outside source under
    # multiple firstgids (Tiled occasionally re-imports via a different path),
    # so visit each tileset entry.
    dungeons_outside_gids = set()
    spriteworld_dungeons_path = lib.MAPS_DIR / 'spriteworld_dungeons.json'
    if spriteworld_dungeons_path.exists():
        with open(spriteworld_dungeons_path) as f:
            kd = json.load(f)
        # Build a catalogue of the dungeon master's tilesets to properly resolve GIDs.
        dung_catalogue = []
        for ts in kd.get('tilesets', []):
            src = ts.get('source', '')
            dname = pathlib.PurePosixPath(src).stem
            dts_path = lib.TILESET_DIR / f'{dname}.json'
            if dts_path.exists():
                with open(dts_path) as dtf:
                    dts_json = json.load(dtf)
                dung_catalogue.append((ts['firstgid'], dname, dts_json.get('tilecount', 0)))
        dung_catalogue.sort()
        for layer in kd.get('layers', []):
            if layer.get('type') != 'tilelayer':
                continue
            for src_gid in layer.get('data', []):
                if src_gid == 0:
                    continue
                # Resolve via the catalogue.
                dname, dtid = None, None
                for dfg, dn, dc in reversed(dung_catalogue):
                    if dfg <= src_gid < dfg + dc:
                        dname, dtid = dn, src_gid - dfg
                        break
                if dname == 'gen3_outside' and dtid is not None:
                    dungeons_outside_gids.add(dtid + 1)

    src_to_spriteworld, spriteworld_to_src, gid_map_path, gid_map, common_count = build_compact_gid_map(
        spriteworld_tilelayers, catalogue,
        spriteworld_inside_tilelayers, gen3_outside_firstgid_inside,
        dungeons_outside_gids=dungeons_outside_gids,
    )
    print(f'Compact GID map: {len(src_to_spriteworld)} tiles '
          f'({common_count} common, {len(src_to_spriteworld)-common_count} outdoor-only)')

    spriteworld_common_ts_modified  = False
    spriteworld_outside_ts_modified = False

    # ── Bounds + spriteworld.world ─────────────────────────────────────────
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

    world_path = lib.MAPS_DIR / 'spriteworld.world'
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
    print('Updated spriteworld.world')

    # ── Per-zone sync ──────────────────────────────────────────────────────
    new_mappings = {}
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

        print(f'\n{fname}: spriteworld tile origin ({ox},{oy}), size {dst_w}x{dst_h}')

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
            if name not in spriteworld_tilelayers:
                remove_layers.add(name)
                print(f'  removed layer "{name}" (not in spriteworld.json)')
                continue
            raw = lib.extract_region(
                spriteworld_tilelayers[name]['data'], spriteworld_w, spriteworld_h,
                ox, oy, dst_w, dst_h,
                polygon=polygon_master, tw=tw, th=th,
            )
            converted, modified = remap_data(
                raw, catalogue, src_to_spriteworld, spriteworld_to_src,
                spriteworld_common_ts_json, spriteworld_outside_ts_json,
                src_props_indices, gid_map, common_count, new_mappings,
            )
            if modified:
                spriteworld_common_ts_modified  = True
                spriteworld_outside_ts_modified = True
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
        for kname, klayer in spriteworld_tilelayers.items():
            if kname in existing_names:
                continue
            raw = lib.extract_region(
                klayer['data'], spriteworld_w, spriteworld_h,
                ox, oy, dst_w, dst_h,
                polygon=polygon_master, tw=tw, th=th,
            )
            if not any(raw):
                continue
            converted, modified = remap_data(
                raw, catalogue, src_to_spriteworld, spriteworld_to_src,
                spriteworld_common_ts_json, spriteworld_outside_ts_json,
                src_props_indices, gid_map, common_count, new_mappings,
            )
            if modified:
                spriteworld_common_ts_modified  = True
                spriteworld_outside_ts_modified = True
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
        spriteworld_px_x = ox * tw
        spriteworld_px_y = oy * th
        px_w = dst_w * tw
        px_h = dst_h * th
        objects, next_oid = lib.merge_interactions(
            spriteworld_objs, spriteworld_px_x, spriteworld_px_y, px_w, px_h,
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
    if ensure_anim_tiles_in_spriteworld(catalogue, src_to_spriteworld, spriteworld_to_src,
                                        gid_map, new_mappings,
                                        spriteworld_common_ts_json, spriteworld_outside_ts_json,
                                        src_props_indices, common_count):
        spriteworld_common_ts_modified  = True
        spriteworld_outside_ts_modified = True

    if sync_spriteworld_animations(catalogue, src_to_spriteworld, common_count,
                                   spriteworld_common_ts_json, spriteworld_outside_ts_json):
        spriteworld_common_ts_modified  = True
        spriteworld_outside_ts_modified = True

    # Re-sync tile properties on every existing spriteworld tile entry. Tiles
    # only appear in remap_data when touched by the master spriteworld.json data;
    # per-zone sources don't round-trip through this script, so a flag flipped
    # on a source tile would otherwise never propagate to its
    # spriteworld_common / spriteworld_outside derivative.
    for sgid, (name, tid) in spriteworld_to_src.items():
        if sgid <= common_count:
            if ensure_spriteworld_tile(spriteworld_common_ts_json, sgid, name, tid,
                                       src_props_indices, 0):
                spriteworld_common_ts_modified = True
        else:
            if ensure_spriteworld_tile(spriteworld_outside_ts_json, sgid, name, tid,
                                       src_props_indices, common_count):
                spriteworld_outside_ts_modified = True

    # Recompute outside_count from final spriteworld_to_src (includes any tiles
    # added by remap_data after build_compact_gid_map ran).
    gid_map['outside_count'] = sum(1 for sgid in spriteworld_to_src if sgid > common_count)

    with open(gid_map_path, 'w') as f:
        json.dump(gid_map, f, indent=2)
    print(f'\nUpdated gid_map.json '
          f'({len(src_to_spriteworld)} total, {common_count} common, '
          f'{gid_map["outside_count"]} outdoor)')

    # Flat common-only map for BaseItem.js (gen3_outside entries only).
    common_flat = {k: v for k, v in gid_map['gen3_to_spriteworld'].items() if int(v) <= common_count}
    flat_path = lib.MAPS_DIR / 'gen3_to_spriteworld_common.json'
    with open(flat_path, 'w') as f:
        json.dump(common_flat, f, indent=2)
    print(f'Updated gen3_to_spriteworld_common.json ({len(common_flat)} entries)')

    common_png_modified, outside_png_modified = update_split_pngs(
        catalogue, src_to_spriteworld, common_count,
        spriteworld_common_ts_json, spriteworld_outside_ts_json,
        spriteworld_common_ts_path, spriteworld_outside_ts_path,
    )
    if common_png_modified:  spriteworld_common_ts_modified  = True
    if outside_png_modified: spriteworld_outside_ts_modified = True

    build_anim_png(catalogue, src_to_spriteworld)

    if spriteworld_common_ts_modified:
        lib.write_tileset_json(spriteworld_common_ts_path, spriteworld_common_ts_json)
    if spriteworld_outside_ts_modified:
        lib.write_tileset_json(spriteworld_outside_ts_path, spriteworld_outside_ts_json)

    # End-of-run sweep: catch any leftover un-prefixed entries (maps no longer
    # in the master, but still listed in src/maps/index.js etc).
    lib.sweep_legacy_world_namespace(WORLD_PREFIX)


if __name__ == '__main__':
    main()
