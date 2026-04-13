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
import pathlib
import re

MAPS_DIR    = pathlib.Path(__file__).parent
TILESET_DIR = MAPS_DIR.parent.parent / 'tileset'
SRC_DIR     = MAPS_DIR.parent.parent   # src/

OFFSET_X = 2592
OFFSET_Y = 7616

def make_outdoor_tilesets(common_count):
    return [
        {'firstgid': 1,                'source': '../../tileset/maps/kanto_common.json'},
        {'firstgid': common_count + 1, 'source': '../../tileset/maps/kanto_outside.json'},
    ]

# gen3_outside 0-based tile IDs used programmatically by BaseItem subclasses
# (not placed in tilelayers) — must always be present in gid_map.json so that
# update_kanto_insides.py can assign matching frame positions.
ITEM_TILE_IDS = [17, 18, 35, 53]  # CutTree, Bush, StrengthBoulder, Pokeball

# Explicit overrides for map names whose filename doesn't follow the default
# snake_case convention (e.g. PalletTown → pallet.json instead of pallet_town.json).
NAME_TO_FILE = {
    'PalletTown':   'pallet.json',
}


def name_to_filename(name):
    """
    Derive a JSON filename from a CamelCase map name.
    Checks NAME_TO_FILE first; falls back to inserting underscores before
    each uppercase letter that follows a lowercase letter or digit.
    Examples:
        PalletTown   -> pallet.json        (via override)
        ViridianCity -> viridian_city.json
        Route1       -> route1.json
        CeruleanCity -> cerulean_city.json
    """
    if name in NAME_TO_FILE:
        return NAME_TO_FILE[name]
    snake = re.sub(r'(?<=[a-z0-9])(?=[A-Z])', '_', name).lower()
    return snake + '.json'


LAYER_TEMPLATE = [
    ('floor',        None,     False),
    ('subground',    None,     False),
    ('ground',       'ground', False),
    ('middle',       None,     False),
    ('top',          'top',    False),
    ('interactions', None,     True),
]

# ge_charLayer value for each known tilelayer name (None = no property).
LAYER_CHAR = {name: char for name, char, is_obj in LAYER_TEMPLATE if not is_obj}

LAYER_ORDER = [name for name, _, _ in LAYER_TEMPLATE]


def sort_layers(layers):
    """Re-order a layer list to match LAYER_TEMPLATE. Unknown layers go last."""
    def key(l):
        try:
            return LAYER_ORDER.index(l['name'])
        except ValueError:
            return len(LAYER_ORDER)
    layers.sort(key=key)


# ── Helpers ────────────────────────────────────────────────────────────────

def extract_region(data, src_w, src_h, ox, oy, dst_w, dst_h):
    out = []
    for row in range(dst_h):
        for col in range(dst_w):
            sx, sy = ox + col, oy + row
            if 0 <= sx < src_w and 0 <= sy < src_h:
                out.append(data[sy * src_w + sx])
            else:
                out.append(0)
    return out


def make_layer(name, w, h, ge_char_layer=None):
    layer = {
        'height': h, 'id': None, 'name': name,
        'opacity': 1, 'type': 'tilelayer',
        'visible': True, 'width': w, 'x': 0, 'y': 0,
        'data': [0] * (w * h),
    }
    if ge_char_layer:
        layer['properties'] = [
            {'name': 'ge_charLayer', 'type': 'string', 'value': ge_char_layer}
        ]
    return layer


def make_skeleton(w, h):
    layers = []
    for lid, (name, char_layer, is_obj) in enumerate(LAYER_TEMPLATE, start=1):
        if is_obj:
            layers.append({
                'draworder': 'topdown', 'id': lid,
                'name': name, 'opacity': 1,
                'type': 'objectgroup', 'visible': True,
                'x': 0, 'y': 0,
                'objects': [{
                    'height': 32, 'id': 1, 'name': 'player',
                    'rotation': 0, 'type': 'playerSpawn',
                    'visible': True, 'width': 32,
                    'x': (w // 2) * 32, 'y': (h - 2) * 32,
                }],
            })
        else:
            layer = make_layer(name, w, h, char_layer)
            layer['id'] = lid
            layers.append(layer)
    return {
        'height': h, 'width': w,
        'tilewidth': 32, 'tileheight': 32,
        'orientation': 'orthogonal', 'renderorder': 'right-down',
        'tiledversion': '1.11.2', 'type': 'map', 'version': '1.10',
        'tilesets': make_outdoor_tilesets(0),  # placeholder; overwritten per-map
        'layers': layers,
    }


# ── GID conversion ─────────────────────────────────────────────────────────

def build_compact_gid_map(kanto_tilelayers, gen3_ts_json, kanto_inside_tilelayers=None, gen3_outside_firstgid_inside=None):
    """
    Build a gap-free gen3_gid → kanto_gid mapping.

    Tiles are split into two groups:
    - common (GIDs 1..C): gen3_outside tiles used in both outdoor AND indoor maps,
      plus all ITEM_TILE_IDS and animation frame tiles.
    - outdoor_only (GIDs C+1..C+O): gen3_outside tiles used only in outdoor maps.

    Returns (gen3_to_kanto, kanto_to_gen3, gid_map_path, gid_map_raw, common_count).
    """
    # Outdoor tilelayer GIDs
    outdoor_gids = {
        gid
        for layer in kanto_tilelayers.values()
        for gid in layer.get('data', [])
        if gid != 0
    }

    # Animation frame GIDs (always in outdoor)
    anim_gids = set()
    for t in gen3_ts_json.get('tiles', []):
        if 'animation' not in t:
            continue
        anim_gids.add(t['id'] + 1)
        for frame in t['animation']:
            anim_gids.add(frame['tileid'] + 1)

    outdoor_gids |= anim_gids

    # Force ITEM_TILE_IDS into common
    item_gids = {tid + 1 for tid in ITEM_TILE_IDS}

    # Indoor gen3_outside GIDs (convert from combined src GIDs to gen3_raw_gids)
    indoor_outside_gids = set()
    if kanto_inside_tilelayers and gen3_outside_firstgid_inside:
        for layer in kanto_inside_tilelayers.values():
            for src_gid in layer.get('data', []):
                if src_gid >= gen3_outside_firstgid_inside:
                    gen3_raw_gid = src_gid - gen3_outside_firstgid_inside + 1
                    indoor_outside_gids.add(gen3_raw_gid)

    # All gen3_outside tiles used in indoor maps MUST be in kanto_common
    # (indoor maps can't reference kanto_outside). Outdoor-only tiles go in
    # kanto_outside.  The intersection is redundant — any indoor tile is common.
    common_raw   = sorted(indoor_outside_gids | item_gids)
    outdoor_only = sorted(outdoor_gids - set(common_raw))

    # Assign compact GIDs: common first (1..C), outdoor_only after (C+1..C+O)
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
    gid_map_path = MAPS_DIR / 'gid_map.json'
    return gen3_to_kanto, kanto_to_gen3, gid_map_path, gid_map_raw, common_count


def build_gen3_props_index(gen3_tileset_json):
    """Return {tile_id: props_list} from gen3_outside tileset JSON."""
    index = {}
    for tile in gen3_tileset_json.get('tiles', []):
        if 'properties' in tile:
            index[tile['id']] = tile['properties']
    return index


def ensure_kanto_tile(ts_json, kanto_gid, gen3_gid, gen3_props_index, tile_id_offset=0):
    """
    Ensure a tileset JSON has a tile entry for the given GID.
    tile_id_offset is subtracted from kanto_gid-1 to get the 0-based id within
    the target tileset (0 for kanto_common, common_count for kanto_outside).
    Copies properties from the corresponding gen3_outside tile if missing.
    Returns True if the tileset was modified.
    """
    tile_id = kanto_gid - 1 - tile_id_offset  # 0-based within tileset
    tiles   = ts_json.setdefault('tiles', [])

    existing = next((t for t in tiles if t['id'] == tile_id), None)
    if existing:
        return False  # already has an entry

    gen3_tile_id = gen3_gid - 1
    props = gen3_props_index.get(gen3_tile_id, [])
    tiles.append({'id': tile_id, 'properties': props})
    return True


def remap_data(data, gen3_to_kanto, kanto_common_ts_json, kanto_outside_ts_json,
               gen3_props_index, kanto_to_gen3,
               gid_map, new_mappings, common_count):
    """
    Convert a flat tile-data array from gen3_outside GIDs to kanto GIDs.

    Tiles with no existing mapping are assigned the next available kanto GID
    (extending the appropriate tileset) and recorded in new_mappings.
    GIDs 1..common_count go into kanto_common_ts_json; higher go into kanto_outside_ts_json.
    Returns (converted_data, ts_modified) where ts_modified is True if any
    new property entries were added.
    """
    max_kanto  = max(kanto_to_gen3.keys(), default=0)
    out        = []
    ts_modified = False
    for gid in data:
        if gid == 0:
            out.append(0)
            continue
        kgid = gen3_to_kanto.get(gid)
        if kgid is None:
            # New gen3 tile not previously mapped — assign next kanto slot.
            if gid in new_mappings:
                kgid = new_mappings[gid]
            else:
                max_kanto += 1
                kgid = max_kanto
                new_mappings[gid] = kgid
                gen3_to_kanto[gid] = kgid
                kanto_to_gen3[kgid] = gid
                gid_map['gen3_to_kanto'][str(gid)]   = kgid
                gid_map['kanto_to_gen3'][str(kgid)]  = gid
        # Route to the correct tileset JSON based on GID range.
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
    Guarantee that every animation frame tile from gen3_outside has a kanto GID.
    Frame tiles are never placed directly on maps, so remap_data won't encounter
    them.  This function fills that gap before update_split_pngs runs.
    Returns True if any tileset JSON was modified.
    """
    max_kanto  = max(kanto_to_gen3.keys(), default=0)
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
                new_mappings[gen3_gid]              = kgid
                gen3_to_kanto[gen3_gid]             = kgid
                kanto_to_gen3[kgid]                = gen3_gid
                gid_map['gen3_to_kanto'][str(gen3_gid)] = kgid
                gid_map['kanto_to_gen3'][str(kgid)]     = gen3_gid
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
    for every animated gen3 tile.  Frame tileids are made 0-based within the
    target tileset (common: gid-1, outside: gid-common_count-1).
    Returns True if any tileset was modified.
    """
    common_tiles      = kanto_common_ts_json.setdefault('tiles', [])
    outside_tiles     = kanto_outside_ts_json.setdefault('tiles', [])
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
        kanto_tid = kanto_gid - 1 - offset  # 0-based within target tileset

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

        # The animatedTiles plugin uses findIndex to locate the animated tile's
        # own frame.  Skip any animation that doesn't include the tile itself.
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
    animation tilesets (e.g. animated_grass.png).
    This is a visual export for reference; the tiles themselves live in
    kanto.png (or their own sheet) for the game engine.
    Returns True if the file was written.
    """
    try:
        from PIL import Image
    except ImportError:
        return False

    # ── Section 1: gen3_outside animated tiles (mapped into kanto GIDs) ───────
    seen      = set()
    anim_tiles = []   # (kanto_gid, gen3_gid) sorted by kanto_gid
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
    strips = []  # list of PIL Images to stitch horizontally

    if anim_tiles:
        anim_tiles.sort()
        gen3_cols = gen3_ts_json['columns']
        gen3_img  = Image.open(TILESET_DIR / gen3_ts_json['image']).convert('RGBA')
        strip = Image.new('RGBA', (len(anim_tiles) * tw, th), (0, 0, 0, 0))
        for i, (_, gen3_gid) in enumerate(anim_tiles):
            gen3_tid = gen3_gid - 1
            src_x = (gen3_tid % gen3_cols) * tw
            src_y = (gen3_tid // gen3_cols) * th
            strip.paste(gen3_img.crop((src_x, src_y, src_x + tw, src_y + th)), (i * tw, 0))
        strips.append(strip)

    # ── Section 2: standalone animation tilesets (e.g. animated_grass) ────────
    EXTRA_TILESETS = ['animated_grass']
    for ts_name in EXTRA_TILESETS:
        ts_json_path = TILESET_DIR / f'{ts_name}.json'
        ts_png_path  = TILESET_DIR / f'{ts_name}.png'
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
        # If no animation data, include every tile in the sheet.
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

    out_path = TILESET_DIR / 'maps' / 'animation.png'
    out_img.save(out_path)
    total_frames = total_w // tw
    print(f'  rebuilt animation.png ({total_frames} animation frame tile(s))')
    return True


# ── PNG update ─────────────────────────────────────────────────────────────

def update_split_pngs(gen3_to_kanto, common_count, kanto_common_ts_json, kanto_outside_ts_json,
                      kanto_common_ts_path, kanto_outside_ts_path, gen3_ts_json):
    """
    Rebuild kanto_common.png and kanto_outside.png from scratch.
    GIDs 1..common_count → kanto_common.png
    GIDs common_count+1.. → kanto_outside.png
    Returns (common_modified, outside_modified).
    """
    try:
        from PIL import Image
    except ImportError:
        print('  WARNING: Pillow not installed — cannot update tileset PNGs')
        return False, False

    if not gen3_to_kanto:
        return False, False

    gen3_cols = gen3_ts_json['columns']
    gen3_png  = TILESET_DIR / gen3_ts_json['image']
    gen3_img  = Image.open(gen3_png).convert('RGBA')

    def write_tileset_png(entries, ts_json, ts_path):
        """entries: list of (gen3_gid, dst_tid_0based) sorted by dst_tid"""
        if not entries:
            return False
        tw   = ts_json['tilewidth']
        th   = ts_json['tileheight']
        cols = ts_json['columns']
        png_path = ts_path.parent / ts_json['image']
        max_tid = max(dst for _, dst in entries)
        rows    = (max_tid // cols) + 1
        img     = Image.new('RGBA', (cols * tw, rows * th), (0, 0, 0, 0))
        for gen3_gid, dst_tid in entries:
            gen3_tid = gen3_gid - 1
            src_x = (gen3_tid % gen3_cols) * tw
            src_y = (gen3_tid // gen3_cols) * th
            dst_x = (dst_tid  % cols)       * tw
            dst_y = (dst_tid  // cols)      * th
            tile  = gen3_img.crop((src_x, src_y, src_x + tw, src_y + th))
            img.paste(tile, (dst_x, dst_y))
        img.save(png_path)
        ts_json['imagewidth']  = cols * tw
        ts_json['imageheight'] = rows * th
        ts_json['tilecount']   = cols * rows
        print(f'  rebuilt {png_path.name} ({len(entries)} tiles, {cols}x{rows} grid)')
        return True

    # Split gen3_to_kanto into common and outside entries
    common_entries  = sorted(
        [(g, kgid - 1) for g, kgid in gen3_to_kanto.items() if kgid <= common_count],
        key=lambda x: x[1]
    )
    outside_entries = sorted(
        [(g, kgid - common_count - 1) for g, kgid in gen3_to_kanto.items() if kgid > common_count],
        key=lambda x: x[1]
    )

    c = write_tileset_png(common_entries,  kanto_common_ts_json,  kanto_common_ts_path)
    o = write_tileset_png(outside_entries, kanto_outside_ts_json, kanto_outside_ts_path)
    return c, o


# ── JS registration ────────────────────────────────────────────────────────

def js_insert_after_last(content, pattern, new_line):
    """
    Insert new_line after the last line in content that matches pattern.
    Returns (new_content, True) on success, (content, False) if no match found.
    """
    lines = content.splitlines(keepends=True)
    last_idx = -1
    for i, line in enumerate(lines):
        if re.search(pattern, line):
            last_idx = i
    if last_idx == -1:
        return content, False
    lines.insert(last_idx + 1, new_line + '\n')
    return ''.join(lines), True


def ensure_scene_file(scene_key):
    """
    Create src/scenes/maps/kanto/{scene_key}.js if it doesn't exist.
    Returns True if the file was created.
    """
    path = SRC_DIR / 'scenes' / 'maps' / 'kanto' / f'{scene_key}.js'
    if path.exists():
        return False
    map_var = scene_key + 'Map'
    content = (
        f"import {{ GameMap }} from '@Objects';\n"
        f"import {{ {map_var} }} from '@Maps';\n"
        f"\n"
        f"export default class extends GameMap {{\n"
        f"  constructor() {{\n"
        f"    super({{\n"
        f"      mapName: '{scene_key}',\n"
        f"      map: {map_var},\n"
        f"      active: false,\n"
        f"      visible: false,\n"
        f"    }});\n"
        f"  }}\n"
        f"\n"
        f"  preload() {{\n"
        f"    this.preloadMap();\n"
        f"  }}\n"
        f"\n"
        f"  create() {{\n"
        f"    this.loadMap();\n"
        f"    this.createCharacters();\n"
        f"  }}\n"
        f"\n"
        f"  update(time, delta) {{\n"
        f"    this.updateCharacters(time, delta);\n"
        f"  }}\n"
        f"}}\n"
    )
    path.write_text(content, encoding='utf-8')
    print(f'  created scene {path.name}')
    return True


def ensure_maps_index(scene_key, fname):
    """
    Register a world map in src/maps/index.js.
    Inserts the import, WORLD_MAP_KEYS entry, named export, and MAP_REGISTRY
    entry if any are missing.  Returns True if the file was modified.
    """
    path = SRC_DIR / 'maps' / 'index.js'
    content = path.read_text(encoding='utf-8')
    map_var = scene_key + 'Map'
    changed = False

    # Import
    if f"import {map_var} from" not in content:
        content, ok = js_insert_after_last(
            content,
            r"import \w+Map from '\./kanto/[^']+\.json';",
            f"import {map_var} from './kanto/{fname}';"
        )
        if ok:
            changed = True
            print(f"  maps/index.js: added import {map_var}")
        else:
            print(f"  maps/index.js: WARNING — could not find anchor for import {map_var}")

    # WORLD_MAP_KEYS entry  ('filename.json': 'SceneKey', — both sides are quoted strings)
    if f"'{fname}'" not in content:
        pad = ' ' * max(1, 20 - len(fname))
        content, ok = js_insert_after_last(
            content,
            r"  '[^']+\.json'\s*:\s*'[^']+',?",
            f"  '{fname}':{pad}'{scene_key}',"
        )
        if ok:
            changed = True
            print(f"  maps/index.js: added WORLD_MAP_KEYS '{fname}'")
        else:
            print(f"  maps/index.js: WARNING — could not find anchor for WORLD_MAP_KEYS '{fname}'")

    # Named export  (    SceneKeyMap,  — 4-space indent, single identifier per line)
    if f"    {map_var}," not in content:
        content, ok = js_insert_after_last(
            content,
            r"^\s{4}[A-Z]\w+Map,\s*$",
            f"    {map_var},"
        )
        if ok:
            changed = True
            print(f"  maps/index.js: added named export {map_var}")
        else:
            print(f"  maps/index.js: WARNING — could not find anchor for named export {map_var}")

    # MAP_REGISTRY entry  ('SceneKey': SceneKeyMap, — right side is a variable)
    if f"'{scene_key}':" not in content:
        pad = ' ' * max(1, 12 - len(scene_key))
        content, ok = js_insert_after_last(
            content,
            r"  '[^']+':\s+\w+Map,",
            f"  '{scene_key}':{pad}{map_var},"
        )
        if ok:
            changed = True
            print(f"  maps/index.js: added MAP_REGISTRY '{scene_key}'")
        else:
            print(f"  maps/index.js: WARNING — could not find anchor for MAP_REGISTRY '{scene_key}'")

    if changed:
        path.write_text(content, encoding='utf-8')
    return changed


def ensure_scenes_index(scene_key):
    """
    Register a scene in src/scenes/index.js.
    Inserts the import and default-export entry if missing.
    Returns True if the file was modified.
    """
    path = SRC_DIR / 'scenes' / 'index.js'
    content = path.read_text(encoding='utf-8')
    changed = False

    # Import
    if f"import {scene_key} from" not in content:
        content, ok = js_insert_after_last(
            content,
            r"import \w+ from '@Scenes/maps/kanto/[^']+\.js';",
            f"import {scene_key} from '@Scenes/maps/kanto/{scene_key}.js';"
        )
        if ok:
            changed = True
            print(f"  scenes/index.js: added import {scene_key}")
        else:
            print(f"  scenes/index.js: WARNING — could not find anchor for import {scene_key}")

    # Default export entry  (  SceneKey,  — 2-space indent, single identifier per line)
    if f"  {scene_key}," not in content:
        content, ok = js_insert_after_last(
            content,
            r"^\s{2}[A-Z][A-Za-z0-9]+,\s*$",
            f"  {scene_key},"
        )
        if ok:
            changed = True
            print(f"  scenes/index.js: added export {scene_key}")
        else:
            print(f"  scenes/index.js: WARNING — could not find anchor for export {scene_key}")

    if changed:
        path.write_text(content, encoding='utf-8')
    return changed


# ── Main ────────────────────────────────────────────────────────────────────

def main():
    # ── Load source files ─────────────────────────────────────────────────
    with open(MAPS_DIR / 'kanto.json') as f:
        kanto = json.load(f)

    kanto_w = kanto['width']
    kanto_h = kanto['height']
    tw = kanto['tilewidth']
    th = kanto['tileheight']

    kanto_tilelayers = {
        l['name']: l for l in kanto['layers'] if l['type'] == 'tilelayer'
    }
    kanto_inter = next(
        (l for l in kanto['layers']
         if l['type'] == 'objectgroup' and l['name'] == 'interactions'), None
    )
    kanto_objs = kanto_inter['objects'] if kanto_inter else []

    gen3_ts_path = TILESET_DIR / 'gen3_outside.json'
    with open(gen3_ts_path) as f:
        gen3_ts_json = json.load(f)
    gen3_props_index = build_gen3_props_index(gen3_ts_json)

    kanto_common_ts_path  = TILESET_DIR / 'maps' / 'kanto_common.json'
    kanto_outside_ts_path = TILESET_DIR / 'maps' / 'kanto_outside.json'

    def load_or_init_ts(path, name, image_name):
        if path.exists():
            with open(path) as f:
                return json.load(f)
        return {
            'columns': 16, 'image': image_name,
            'imageheight': 0, 'imagewidth': 512,
            'margin': 0, 'name': name, 'spacing': 0,
            'tilecount': 0, 'tiledversion': '1.12.1',
            'tileheight': 32, 'tilewidth': 32,
            'tiles': [], 'type': 'tileset', 'version': '1.11',
        }

    kanto_common_ts_json  = load_or_init_ts(kanto_common_ts_path,  'kanto_common',  'kanto_common.png')
    kanto_outside_ts_json = load_or_init_ts(kanto_outside_ts_path, 'kanto_outside', 'kanto_outside.png')

    # Load kanto_inside.json to determine which outdoor tiles are also used indoors.
    kanto_inside_path = MAPS_DIR / 'kanto_inside.json'
    kanto_inside_tilelayers = {}
    gen3_outside_firstgid_inside = None
    if kanto_inside_path.exists():
        with open(kanto_inside_path) as f:
            ki = json.load(f)
        kanto_inside_tilelayers = {l['name']: l for l in ki.get('layers', []) if l['type'] == 'tilelayer'}
        for ts in ki.get('tilesets', []):
            if 'gen3_outside' in ts.get('source', ''):
                gen3_outside_firstgid_inside = ts['firstgid']
                break

    gen3_to_kanto, kanto_to_gen3, gid_map_path, gid_map, common_count = build_compact_gid_map(
        kanto_tilelayers, gen3_ts_json, kanto_inside_tilelayers, gen3_outside_firstgid_inside
    )
    print(f'Compact GID map: {len(gen3_to_kanto)} tiles ({common_count} common, {len(gen3_to_kanto)-common_count} outdoor-only)')

    kanto_common_ts_modified  = False
    kanto_outside_ts_modified = False

    # ── Derive map bounds from "maps" objectgroup ─────────────────────────
    maps_layer = next(
        (l for l in kanto['layers']
         if l['name'] == 'maps' and l['type'] == 'objectgroup'), None
    )
    if not maps_layer:
        print('ERROR: no "maps" objectgroup found in kanto.json')
        return

    bounds          = {}   # fname -> world-space bounds dict
    fname_to_key    = {}   # fname -> CamelCase scene key (obj['name'])
    map_properties  = {}   # fname -> properties list from maps-layer object
    for obj in maps_layer['objects']:
        fname = name_to_filename(obj['name'])
        bounds[fname] = {
            'x': obj['x'] - OFFSET_X,
            'y': obj['y'] - OFFSET_Y,
            'width':  obj['width'],
            'height': obj['height'],
        }
        fname_to_key[fname]   = obj['name']
        map_properties[fname] = obj.get('properties', [])

    # ── Update kanto.world ────────────────────────────────────────────────
    world_path = MAPS_DIR / 'kanto.world'
    if world_path.exists():
        with open(world_path) as f:
            world = json.load(f)
    else:
        world = {'onlyShowAdjacentMaps': False, 'type': 'world', 'maps': []}

    updated = []
    for fname, b in bounds.items():
        updated.append({'fileName': fname, **b})
    for e in world['maps']:
        if e['fileName'] not in bounds:
            updated.append(e)
    world['maps'] = updated

    with open(world_path, 'w') as f:
        json.dump(world, f, indent=4)
    print('Updated kanto.world')

    # ── Update each map file ──────────────────────────────────────────────
    for fname, b in bounds.items():
        route_path = MAPS_DIR / fname
        dst_w = b['width']  // tw
        dst_h = b['height'] // th
        ox    = (b['x'] + OFFSET_X) // tw
        oy    = (b['y'] + OFFSET_Y) // th

        print(f'\n{fname}: kanto tile origin ({ox},{oy}), size {dst_w}x{dst_h}')

        if not route_path.exists():
            route = make_skeleton(dst_w, dst_h)
            print('  created skeleton')
        else:
            with open(route_path) as f:
                route = json.load(f)

        # Always use the two-tileset outdoor layout.
        route['tilesets'] = make_outdoor_tilesets(common_count)

        if route['width'] != dst_w or route['height'] != dst_h:
            print(f'  resizing {route["width"]}x{route["height"]} -> {dst_w}x{dst_h}')
            route['width']  = dst_w
            route['height'] = dst_h
            for layer in route['layers']:
                if layer['type'] != 'tilelayer':
                    continue
                layer['width']  = dst_w
                layer['height'] = dst_h
                layer['data']   = [0] * (dst_w * dst_h)

        # Tile layers — sync existing ones, drop empty/obsolete ones
        remove_layers = set()
        for layer in route['layers']:
            if layer['type'] != 'tilelayer':
                continue
            name = layer['name']
            if name not in kanto_tilelayers:
                remove_layers.add(name)
                print(f'  removed layer "{name}" (not in kanto.json)')
                continue
            raw = extract_region(
                kanto_tilelayers[name]['data'], kanto_w, kanto_h,
                ox, oy, dst_w, dst_h
            )
            converted, modified = remap_data(
                raw, gen3_to_kanto, kanto_common_ts_json, kanto_outside_ts_json,
                gen3_props_index, kanto_to_gen3, gid_map, {}, common_count
            )
            if modified:
                kanto_common_ts_modified = True
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

        # Tile layers — add any layers present in kanto.json but missing from this file
        existing_names = {l['name'] for l in route['layers'] if l['type'] == 'tilelayer'}
        inter_idx = next(
            (i for i, l in enumerate(route['layers']) if l['type'] == 'objectgroup'),
            len(route['layers'])
        )
        max_lid = max((l.get('id') or 0 for l in route['layers']), default=0)
        for kname, klayer in kanto_tilelayers.items():
            if kname in existing_names:
                continue
            raw = extract_region(
                klayer['data'], kanto_w, kanto_h,
                ox, oy, dst_w, dst_h
            )
            if not any(raw):
                continue  # entirely empty in this region — skip
            converted, modified = remap_data(
                raw, gen3_to_kanto, kanto_common_ts_json, kanto_outside_ts_json,
                gen3_props_index, kanto_to_gen3, gid_map, {}, common_count
            )
            if modified:
                kanto_common_ts_modified = True
                kanto_outside_ts_modified = True
            non_zero = sum(1 for t in converted if t != 0)
            if non_zero == 0:
                continue
            max_lid += 1
            new_layer = make_layer(kname, dst_w, dst_h, LAYER_CHAR.get(kname))
            new_layer['id']   = max_lid
            new_layer['data'] = converted
            route['layers'].insert(inter_idx, new_layer)
            inter_idx += 1
            existing_names.add(kname)
            print(f'  added new layer "{kname}" ({non_zero} non-zero tiles)')

        # Interaction objects
        inter = next(
            (l for l in route['layers'] if l['type'] == 'objectgroup'), None
        )
        if inter is None:
            inter = {
                'draworder': 'topdown', 'name': 'interactions',
                'type': 'objectgroup', 'objects': [],
                'visible': True, 'opacity': 1, 'x': 0, 'y': 0,
            }
            route['layers'].append(inter)

        kanto_px_x = ox * tw
        kanto_px_y = oy * th
        px_w = dst_w * tw
        px_h = dst_h * th

        inter['objects'] = []
        max_id = 0

        for obj in kanto_objs:
            cx = obj['x'] + obj.get('width', 0) / 2
            cy = obj['y'] + obj.get('height', 0) / 2
            if not (kanto_px_x <= cx < kanto_px_x + px_w and
                    kanto_px_y <= cy < kanto_px_y + px_h):
                continue
            local_x = obj['x'] - kanto_px_x
            local_y = obj['y'] - kanto_px_y
            max_id += 1
            inter['objects'].append({**obj, 'x': local_x, 'y': local_y, 'id': max_id})
            print(f'  added obj "{obj["name"]}"')

        route['nextobjectid'] = max_id + 1

        props = map_properties.get(fname, [])
        if props:
            route['properties'] = props
        elif 'properties' in route:
            del route['properties']

        sort_layers(route['layers'])

        with open(route_path, 'w') as f:
            json.dump(route, f, indent=2)
        print(f'  saved {fname}')

        # ── Register in JS source files ───────────────────────────────────
        scene_key = fname_to_key[fname]
        ensure_scene_file(scene_key)
        ensure_maps_index(scene_key, fname)
        ensure_scenes_index(scene_key)

    # ── Ensure animation frame tiles have kanto GIDs ─────────────────────────
    if ensure_anim_tiles_in_kanto(gen3_ts_json, gen3_to_kanto, kanto_to_gen3,
                                   gid_map, {}, kanto_common_ts_json,
                                   kanto_outside_ts_json, gen3_props_index, common_count):
        kanto_common_ts_modified  = True
        kanto_outside_ts_modified = True

    # ── Sync animation properties into tileset JSONs ──────────────────────────
    if sync_kanto_animations(gen3_ts_json, gen3_to_kanto, common_count,
                              kanto_common_ts_json, kanto_outside_ts_json):
        kanto_common_ts_modified  = True
        kanto_outside_ts_modified = True

    with open(gid_map_path, 'w') as f:
        json.dump(gid_map, f, indent=2)
    print(f'\nUpdated gid_map.json ({len(gen3_to_kanto)} total, {common_count} common)')

    # Write flat common-only map for BaseItem.js.
    common_flat = {k: v for k, v in gid_map['gen3_to_kanto'].items() if int(v) <= common_count}
    flat_path = MAPS_DIR / 'gen3_to_kanto_common.json'
    with open(flat_path, 'w') as f:
        json.dump(common_flat, f, indent=2)
    print(f'Updated gen3_to_kanto_common.json ({len(common_flat)} entries)')

    kanto_common_png_modified, kanto_outside_png_modified = update_split_pngs(
        gen3_to_kanto, common_count, kanto_common_ts_json, kanto_outside_ts_json,
        kanto_common_ts_path, kanto_outside_ts_path, gen3_ts_json
    )
    if kanto_common_png_modified:
        kanto_common_ts_modified = True
    if kanto_outside_png_modified:
        kanto_outside_ts_modified = True

    build_anim_png(gen3_ts_json, gen3_to_kanto)

    if kanto_common_ts_modified:
        kanto_common_ts_json['tiles'].sort(key=lambda t: t['id'])
        with open(kanto_common_ts_path, 'w') as f:
            json.dump(kanto_common_ts_json, f, indent=1)
        print(f'Updated {kanto_common_ts_path.name}')

    if kanto_outside_ts_modified:
        kanto_outside_ts_json['tiles'].sort(key=lambda t: t['id'])
        with open(kanto_outside_ts_path, 'w') as f:
            json.dump(kanto_outside_ts_json, f, indent=1)
        print(f'Updated {kanto_outside_ts_path.name}')


if __name__ == '__main__':
    main()
