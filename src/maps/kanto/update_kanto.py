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

KANTO_TILESET = {'firstgid': 1, 'source': '../../tileset/maps/kanto.json'}

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
        'tilesets': [KANTO_TILESET],
        'layers': layers,
    }


# ── GID conversion ─────────────────────────────────────────────────────────

def load_gid_maps():
    """Load gen3<->kanto GID mapping from gid_map.json."""
    gid_map_path = MAPS_DIR / 'gid_map.json'
    with open(gid_map_path) as f:
        raw = json.load(f)
    gen3_to_kanto = {int(k): v for k, v in raw['gen3_to_kanto'].items()}
    kanto_to_gen3 = {int(k): v for k, v in raw['kanto_to_gen3'].items()}
    return gen3_to_kanto, kanto_to_gen3, gid_map_path


def build_gen3_props_index(gen3_tileset_json):
    """Return {tile_id: props_list} from gen3_outside tileset JSON."""
    index = {}
    for tile in gen3_tileset_json.get('tiles', []):
        if 'properties' in tile:
            index[tile['id']] = tile['properties']
    return index


def ensure_kanto_tile(kanto_ts_json, kanto_gid, gen3_gid, gen3_props_index):
    """
    Ensure kanto tileset JSON has a tile entry for kanto_gid.
    Copies properties from the corresponding gen3_outside tile if missing.
    Returns True if the kanto tileset was modified.
    """
    tile_id = kanto_gid - 1  # Tiled tile IDs are 0-based
    tiles   = kanto_ts_json.setdefault('tiles', [])

    existing = next((t for t in tiles if t['id'] == tile_id), None)
    if existing:
        return False  # already has an entry

    gen3_tile_id = gen3_gid - 1
    props = gen3_props_index.get(gen3_tile_id, [])
    tiles.append({'id': tile_id, 'properties': props})
    return True


def remap_data(data, gen3_to_kanto, kanto_ts_json,
               gen3_props_index, kanto_to_gen3,
               gid_map, new_mappings):
    """
    Convert a flat tile-data array from gen3_outside GIDs to kanto GIDs.

    Tiles with no existing mapping are assigned the next available kanto GID
    (extending the kanto tileset) and recorded in new_mappings.
    Returns (converted_data, ts_modified) where ts_modified is True if any
    new property entries were added to kanto_ts_json.
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
        # Ensure kanto tileset has a property entry for this tile.
        if ensure_kanto_tile(kanto_ts_json, kgid, gid, gen3_props_index):
            ts_modified = True
        out.append(kgid)
    return out, ts_modified


# ── Animation support ──────────────────────────────────────────────────────

def ensure_anim_tiles_in_kanto(gen3_ts_json, gen3_to_kanto, kanto_to_gen3,
                                gid_map, new_mappings, kanto_ts_json,
                                gen3_props_index):
    """
    Guarantee that every animation frame tile from gen3_outside has a kanto GID.
    Frame tiles are never placed directly on maps, so remap_data won't encounter
    them.  This function fills that gap before update_kanto_png runs.
    Returns True if kanto_ts_json was modified.
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
                new_mappings[gen3_gid]             = kgid
                gen3_to_kanto[gen3_gid]            = kgid
                kanto_to_gen3[kgid]               = gen3_gid
                gid_map['gen3_to_kanto'][str(gen3_gid)] = kgid
                gid_map['kanto_to_gen3'][str(kgid)]     = gen3_gid
            if ensure_kanto_tile(kanto_ts_json, kgid, gen3_gid, gen3_props_index):
                ts_modified = True
    return ts_modified


def sync_kanto_animations(gen3_ts_json, gen3_to_kanto, kanto_ts_json):
    """
    Write animation properties into kanto_ts_json for every animated gen3 tile.
    Frame tileids are remapped from gen3 tile IDs to kanto tile IDs (0-based).
    Returns True if kanto_ts_json was modified.
    """
    tiles      = kanto_ts_json.setdefault('tiles', [])
    tile_by_id = {t['id']: t for t in tiles}
    modified   = False

    for gen3_tile in gen3_ts_json.get('tiles', []):
        if 'animation' not in gen3_tile:
            continue
        kanto_gid = gen3_to_kanto.get(gen3_tile['id'] + 1)
        if kanto_gid is None:
            continue
        kanto_tid = kanto_gid - 1

        new_anim = []
        for frame in gen3_tile['animation']:
            frame_kanto_gid = gen3_to_kanto.get(frame['tileid'] + 1)
            if frame_kanto_gid is None:
                continue
            new_anim.append({'duration': frame['duration'], 'tileid': frame_kanto_gid - 1})

        if not new_anim:
            continue

        # The animatedTiles plugin uses findIndex to locate the animated tile's
        # own frame. If the tile's own ID is absent from the frames, findIndex
        # returns -1, causing a runtime crash.  Skip any animation that doesn't
        # include the tile itself as one of the frames.
        if not any(f['tileid'] == kanto_tid for f in new_anim):
            continue

        entry = tile_by_id.get(kanto_tid)
        if entry is None:
            entry = {'id': kanto_tid}
            tiles.append(entry)
            tile_by_id[kanto_tid] = entry

        if entry.get('animation') != new_anim:
            entry['animation'] = new_anim
            modified = True
            print(f'  synced animation for kanto tile {kanto_tid} ({len(new_anim)} frames)')

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

def update_kanto_png(gen3_to_kanto, kanto_ts_json, kanto_ts_path, gen3_ts_json):
    """
    Rebuild kanto.png from scratch using every entry in gen3_to_kanto.
    Sizes the canvas to exactly fit the highest kanto GID.
    Updates kanto_ts_json imageheight and tilecount in-place.
    Returns True if the PNG was written.
    """
    try:
        from PIL import Image
    except ImportError:
        print('  WARNING: Pillow not installed — cannot update kanto.png')
        print('  Run: pip install Pillow')
        return False

    if not gen3_to_kanto:
        return False

    tw        = kanto_ts_json['tilewidth']
    th        = kanto_ts_json['tileheight']
    cols      = kanto_ts_json['columns']
    gen3_cols = gen3_ts_json['columns']

    kanto_png = kanto_ts_path.parent / kanto_ts_json['image']
    gen3_png  = TILESET_DIR / gen3_ts_json['image']

    gen3_img = Image.open(gen3_png).convert('RGBA')

    # Size the canvas to fit the highest kanto GID exactly.
    max_kanto_tid = max(gen3_to_kanto.values()) - 1  # 0-based
    rows          = (max_kanto_tid // cols) + 1
    kanto_img     = Image.new('RGBA', (cols * tw, rows * th), (0, 0, 0, 0))

    # Blit every mapped tile.
    for gen3_gid, kanto_gid in gen3_to_kanto.items():
        gen3_tid  = gen3_gid  - 1
        kanto_tid = kanto_gid - 1

        src_x = (gen3_tid  % gen3_cols) * tw
        src_y = (gen3_tid  // gen3_cols) * th
        dst_x = (kanto_tid % cols)       * tw
        dst_y = (kanto_tid // cols)      * th

        tile = gen3_img.crop((src_x, src_y, src_x + tw, src_y + th))
        kanto_img.paste(tile, (dst_x, dst_y))

    kanto_img.save(kanto_png)

    # Keep tileset JSON metadata consistent with the canvas dimensions.
    kanto_ts_json['imagewidth']  = cols * tw
    kanto_ts_json['imageheight'] = rows * th
    kanto_ts_json['tilecount']   = cols * rows

    print(f'  rebuilt kanto.png ({len(gen3_to_kanto)} tile(s), {cols}×{rows} grid)')
    return True


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

    gen3_to_kanto, kanto_to_gen3, gid_map_path = load_gid_maps()
    with open(gid_map_path) as f:
        gid_map = json.load(f)

    kanto_ts_path = TILESET_DIR / 'maps' / 'kanto.json'
    with open(kanto_ts_path) as f:
        kanto_ts_json = json.load(f)

    gen3_ts_path = TILESET_DIR / 'gen3_outside.json'
    with open(gen3_ts_path) as f:
        gen3_ts_json = json.load(f)
    gen3_props_index = build_gen3_props_index(gen3_ts_json)

    new_mappings      = {}   # gen3_gid -> newly assigned kanto_gid
    kanto_ts_modified = False

    # ── Derive map bounds from "maps" objectgroup ─────────────────────────
    maps_layer = next(
        (l for l in kanto['layers']
         if l['name'] == 'maps' and l['type'] == 'objectgroup'), None
    )
    if not maps_layer:
        print('ERROR: no "maps" objectgroup found in kanto.json')
        return

    bounds       = {}   # fname -> world-space bounds dict
    fname_to_key = {}   # fname -> CamelCase scene key (obj['name'])
    for obj in maps_layer['objects']:
        fname = name_to_filename(obj['name'])
        bounds[fname] = {
            'x': obj['x'] - OFFSET_X,
            'y': obj['y'] - OFFSET_Y,
            'width':  obj['width'],
            'height': obj['height'],
        }
        fname_to_key[fname] = obj['name']

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
                raw, gen3_to_kanto, kanto_ts_json, gen3_props_index,
                kanto_to_gen3, gid_map, new_mappings
            )
            if modified:
                kanto_ts_modified = True
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
                raw, gen3_to_kanto, kanto_ts_json, gen3_props_index,
                kanto_to_gen3, gid_map, new_mappings
            )
            if modified:
                kanto_ts_modified = True
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

        sort_layers(route['layers'])

        with open(route_path, 'w') as f:
            json.dump(route, f, indent=2)
        print(f'  saved {fname}')

        # ── Register in JS source files ───────────────────────────────────
        scene_key = fname_to_key[fname]
        ensure_scene_file(scene_key)
        ensure_maps_index(scene_key, fname)
        ensure_scenes_index(scene_key)

    # ── Persist updated kanto tileset and GID map ─────────────────────────
    # ── Ensure animation frame tiles have kanto GIDs ─────────────────────────
    if ensure_anim_tiles_in_kanto(gen3_ts_json, gen3_to_kanto, kanto_to_gen3,
                                   gid_map, new_mappings, kanto_ts_json,
                                   gen3_props_index):
        kanto_ts_modified = True

    # ── Sync animation properties into kanto tileset JSON ────────────────────
    if sync_kanto_animations(gen3_ts_json, gen3_to_kanto, kanto_ts_json):
        kanto_ts_modified = True

    if new_mappings:
        print(f'\nNew gen3->kanto tile mappings added: {len(new_mappings)}')
        with open(gid_map_path, 'w') as f:
            json.dump(gid_map, f, indent=2)
        print(f'Updated gid_map.json')

    if update_kanto_png(gen3_to_kanto, kanto_ts_json, kanto_ts_path, gen3_ts_json):
        kanto_ts_modified = True

    build_anim_png(gen3_ts_json, gen3_to_kanto)

    if kanto_ts_modified:
        with open(kanto_ts_path, 'w') as f:
            json.dump(kanto_ts_json, f, indent=1)
        print(f'Updated {kanto_ts_path.name}')


if __name__ == '__main__':
    main()
