#!/usr/bin/env python3
"""
Sync individual interior map JSON files from kanto_inside.json.

kanto_inside.json is edited in Tiled using two source tilesets:
  - gen3_inside.png    (firstgid=1)
  - gen3_outside.png   (firstgid=3948)

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
   StrengthBoulder) from gen3_outside are present in kanto_inside so that
   BaseItem subclasses work correctly in interior maps.
4. Writes gen3_to_kanto_inside.json — a gen3_outside tileId+1 → kanto_inside
   GID mapping that mirrors gen3_to_kanto.json, allowing BaseItem to resolve
   the correct frame when running inside a kanto_inside map.
5. Rebuilds kanto_inside.png from scratch every run using the full src_to_inside
   mapping, sourcing pixels from gen3_inside.png and gen3_outside.png.
6. Writes the updated kanto_inside tileset JSON (tile properties synced from
   source tilesets for any GID newly added).
7. For any map not already registered in the JS source files, creates a
   Phaser scene file and updates src/maps/index.js and src/scenes/index.js.
"""

import json
import pathlib
import re

MAPS_DIR    = pathlib.Path(__file__).parent
TILESET_DIR = MAPS_DIR.parent.parent / 'tileset'
SRC_DIR     = MAPS_DIR.parent.parent  # src/

INSIDE_TILESET = {'firstgid': 1, 'source': '../../tileset/maps/kanto_inside.json'}

# Firstgids are read dynamically from kanto_inside.json in main() and stored here.
# Hardcoding is avoided because Tiled renumbers tilesets when one is removed.
GEN3_INSIDE_FIRSTGID   = None  # set in main()
GEN3_OUTSIDE_FIRSTGID  = None  # set in main()

# gen3_outside tile IDs (0-based) that must always be present in kanto_inside
# so that BaseItem subclasses (Pokeball, CutTree, Bush, StrengthBoulder) render
# correctly in interior maps.  Mirrors the tileId constants in each subclass.
ITEM_TILE_IDS = [
    17,   # CutTree
    18,   # Bush
    35,   # StrengthBoulder
    53,   # Pokeball
]

# Explicit overrides for map names whose filename doesn't follow the default
# snake_case convention.
NAME_TO_FILE = {}

# Maps a kanto_inside.json map name to the JS scene key that should be used
# when registering it.  Use this when the map already exists under a different
# name registered by update_kanto.py (e.g. "ProfLab" ↔ "ProfessorLab").
NAME_TO_SCENE_KEY = {
    'ProfLab': 'ProfessorLab',
}


def name_to_filename(name):
    """
    Derive a JSON filename from a CamelCase map name.
    Checks NAME_TO_FILE first; falls back to inserting underscores before
    each uppercase letter that follows a lowercase letter or digit.
    Examples:
        HeroHouseF1 -> hero_house_floor1.json (via override)
        HeroHouseF2 -> hero_house_floor2.json (via override)
    """
    if name in NAME_TO_FILE:
        return NAME_TO_FILE[name]
    # Replace F<digit> suffix with Floor<digit> for readability
    name_exp = re.sub(r'F(\d+)$', lambda m: f'Floor{m.group(1)}', name)
    snake = re.sub(r'(?<=[a-z0-9])(?=[A-Z])', '_', name_exp).lower()
    return snake + '.json'


# Layer template for interior maps.
# (layer_name, ge_charLayer_value, is_objectgroup)
LAYER_TEMPLATE = [
    ('floor',        None,     False),
    ('subground',    None,     False),
    ('ground',       'ground', False),
    ('collision',    None,     False),
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


def sync_layer_properties(layers):
    """Ensure each tilelayer has the correct ge_charLayer property per LAYER_CHAR."""
    for layer in layers:
        if layer['type'] != 'tilelayer':
            continue
        char_layer = LAYER_CHAR.get(layer['name'])
        # Strip any existing ge_charLayer, then re-apply if needed.
        props = [p for p in layer.get('properties', []) if p['name'] != 'ge_charLayer']
        if char_layer:
            props.append({'name': 'ge_charLayer', 'type': 'string', 'value': char_layer})
        layer['properties'] = props


# ── Helpers ────────────────────────────────────────────────────────────────

def extract_region(data, src_w, src_h, ox, oy, dst_w, dst_h):
    """Extract a rectangular region from a flat tile array."""
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
    """Build a blank tilelayer dict."""
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


def make_skeleton(name, w, h):
    """Build a minimal map JSON skeleton for a new inside map."""
    layers = []
    for lid, (lname, char_layer, is_obj) in enumerate(LAYER_TEMPLATE, start=1):
        if is_obj:
            layers.append({
                'draworder': 'topdown', 'id': lid,
                'name': lname, 'opacity': 1,
                'type': 'objectgroup', 'visible': True,
                'x': 0, 'y': 0,
                'objects': [{
                    'height': 32, 'id': 1, 'name': 'player',
                    'rotation': 0, 'type': 'playerSpawn',
                    'visible': True, 'width': 32,
                    'x': (w // 2) * 32, 'y': (h // 2) * 32,
                }],
            })
        else:
            layer = make_layer(lname, w, h, char_layer)
            layer['id'] = lid
            layers.append(layer)
    return {
        'height': h, 'width': w,
        'tilewidth': 32, 'tileheight': 32,
        'orientation': 'orthogonal', 'renderorder': 'right-down',
        'tiledversion': '1.11.2', 'type': 'map', 'version': '1.10',
        'infinite': False, 'compressionlevel': -1,
        'tilesets': [INSIDE_TILESET],
        'layers': layers,
        'nextlayerid': len(LAYER_TEMPLATE) + 1,
        'nextobjectid': 2,
    }


# ── GID conversion ─────────────────────────────────────────────────────────

def load_gid_map():
    """Load src<->inside GID mapping from inside_gid_map.json."""
    gid_map_path = MAPS_DIR / 'inside_gid_map.json'
    if not gid_map_path.exists():
        raw = {'src_to_inside': {}, 'inside_to_src': {}}
    else:
        with open(gid_map_path) as f:
            raw = json.load(f)
    src_to_inside = {int(k): v for k, v in raw['src_to_inside'].items()}
    inside_to_src = {int(k): v for k, v in raw['inside_to_src'].items()}
    return src_to_inside, inside_to_src, gid_map_path, raw


def build_props_index(tileset_json):
    """Return {tile_id (0-based): props_list} from a tileset JSON."""
    index = {}
    for tile in tileset_json.get('tiles', []):
        if 'properties' in tile:
            index[tile['id']] = tile['properties']
    return index


def src_gid_to_tile_id(src_gid):
    """
    Convert a combined kanto_inside.json GID to a 0-based tile ID and
    identify which source tileset it belongs to.
    Returns ('gen3_inside', tile_id) or ('gen3_outside', tile_id).
    """
    if src_gid < GEN3_OUTSIDE_FIRSTGID:
        return 'gen3_inside', src_gid - GEN3_INSIDE_FIRSTGID
    return 'gen3_outside', src_gid - GEN3_OUTSIDE_FIRSTGID


def ensure_inside_tile(inside_ts_json, inside_gid, src_gid, props_indices):
    """
    Ensure inside tileset JSON has a tile entry for inside_gid with up-to-date
    properties synced from the source tileset.
    Returns True if inside_ts_json was modified.
    """
    tile_id  = inside_gid - 1
    tiles    = inside_ts_json.setdefault('tiles', [])

    src_name, src_tid = src_gid_to_tile_id(src_gid)
    props = props_indices.get(src_name, {}).get(src_tid, [])

    existing = next((t for t in tiles if t['id'] == tile_id), None)
    if existing is None:
        tiles.append({'id': tile_id, 'properties': props})
        return True

    # Sync properties even if the entry already exists
    if existing.get('properties') != props:
        existing['properties'] = props
        return True

    return False


def remap_data(data, src_to_inside, inside_to_src,
               inside_ts_json, props_indices, gid_map_raw, new_mappings):
    """
    Convert a flat tile-data array from combined src GIDs to inside GIDs.

    Tiles with no existing mapping are assigned the next available inside GID
    and recorded in new_mappings.
    Returns (converted_data, ts_modified).
    """
    max_inside  = max(inside_to_src.keys(), default=0)
    out         = []
    ts_modified = False

    for src_gid in data:
        if src_gid == 0:
            out.append(0)
            continue
        igid = src_to_inside.get(src_gid)
        if igid is None:
            if src_gid in new_mappings:
                igid = new_mappings[src_gid]
            else:
                max_inside += 1
                igid = max_inside
                new_mappings[src_gid]            = igid
                src_to_inside[src_gid]           = igid
                inside_to_src[igid]              = src_gid
                gid_map_raw['src_to_inside'][str(src_gid)] = igid
                gid_map_raw['inside_to_src'][str(igid)]    = src_gid
        if ensure_inside_tile(inside_ts_json, igid, src_gid, props_indices):
            ts_modified = True
        out.append(igid)

    return out, ts_modified


# ── PNG update ─────────────────────────────────────────────────────────────

def update_inside_png(src_to_inside, inside_ts_json, inside_ts_path):
    """
    Rebuild kanto_inside.png from scratch using every entry in src_to_inside.
    Tiles are sourced from gen3_inside.png or pallet_town_inside.png depending
    on the src GID.  Sizes the canvas to fit the highest inside GID exactly.
    Updates inside_ts_json imageheight and tilecount in-place.
    Returns True if the PNG was written.
    """
    try:
        from PIL import Image
    except ImportError:
        print('  WARNING: Pillow not installed — cannot update kanto_inside.png')
        return False

    if not src_to_inside:
        return False

    tw   = inside_ts_json['tilewidth']
    th   = inside_ts_json['tileheight']
    cols = inside_ts_json['columns']

    inside_png = inside_ts_path.parent / inside_ts_json['image']

    gen3_inside_img   = Image.open(TILESET_DIR / 'gen3_inside.png').convert('RGBA')
    gen3_outside_img  = Image.open(TILESET_DIR / 'gen3_outside.png').convert('RGBA')
    gen3_inside_cols  = 8    # gen3_inside has 8 columns
    gen3_outside_cols = 16   # gen3_outside has 16 columns

    max_inside_tid = max(src_to_inside.values()) - 1  # 0-based
    rows           = (max_inside_tid // cols) + 1
    inside_img     = Image.new('RGBA', (cols * tw, rows * th), (0, 0, 0, 0))

    for src_gid, inside_gid in src_to_inside.items():
        src_name, src_tid = src_gid_to_tile_id(src_gid)
        if src_name == 'gen3_inside':
            src_img  = gen3_inside_img
            src_cols = gen3_inside_cols
        else:
            src_img  = gen3_outside_img
            src_cols = gen3_outside_cols

        inside_tid = inside_gid - 1
        src_x  = (src_tid    % src_cols)  * tw
        src_y  = (src_tid    // src_cols) * th
        dst_x  = (inside_tid % cols)      * tw
        dst_y  = (inside_tid // cols)     * th

        tile = src_img.crop((src_x, src_y, src_x + tw, src_y + th))
        inside_img.paste(tile, (dst_x, dst_y))

    inside_img.save(inside_png)

    inside_ts_json['imagewidth']  = cols * tw
    inside_ts_json['imageheight'] = rows * th
    inside_ts_json['tilecount']   = cols * rows

    print(f'  rebuilt kanto_inside.png ({len(src_to_inside)} tiles, {cols}×{rows} grid)')
    return True


# ── JS registration ────────────────────────────────────────────────────────

def js_insert_after_last(content, pattern, new_line):
    """
    Insert new_line after the last line in content that matches pattern.
    Returns (new_content, True) on success, (content, False) if no match found.
    """
    lines    = content.splitlines(keepends=True)
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
    Register an inside map in src/maps/index.js.
    Inserts the import, named export, and MAP_REGISTRY entry if missing.
    Skips silently if the file is already imported under any variable name.
    Returns True if the file was modified.
    """
    path    = SRC_DIR / 'maps' / 'index.js'
    content = path.read_text(encoding='utf-8')
    map_var = scene_key + 'Map'
    changed = False

    # If the file is already imported (possibly under a different variable name
    # e.g. ProfessorLabMap for prof_lab.json), skip the import entirely.
    file_already_imported = f"'./kanto/{fname}'" in content

    if not file_already_imported and f"import {map_var} from" not in content:
        content, ok = js_insert_after_last(
            content,
            r"import \w+Map from '\./kanto/[^']+\.json';",
            f"import {map_var} from './kanto/{fname}';"
        )
        if ok:
            changed = True
            print(f'  maps/index.js: added import {map_var}')
        else:
            print(f'  maps/index.js: WARNING — could not find anchor for import {map_var}')

    # Resolve the variable name that the file is actually imported as.
    if file_already_imported:
        m = re.search(r"import (\w+) from '\./kanto/" + re.escape(fname) + r"'", content)
        map_var = m.group(1) if m else map_var

    if f'{map_var},' not in content:
        content, ok = js_insert_after_last(
            content,
            r'^\s{4}[A-Z]\w+Map,?\s*$',
            f'    {map_var},'
        )
        if ok:
            changed = True
            print(f'  maps/index.js: added named export {map_var}')
        else:
            print(f'  maps/index.js: WARNING — could not find anchor for named export {map_var}')

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
    path    = SRC_DIR / 'scenes' / 'index.js'
    content = path.read_text(encoding='utf-8')
    changed = False

    if f"import {scene_key} from" not in content:
        content, ok = js_insert_after_last(
            content,
            r"import \w+ from '@Scenes/maps/kanto/[^']+\.js';",
            f"import {scene_key} from '@Scenes/maps/kanto/{scene_key}.js';"
        )
        if ok:
            changed = True
            print(f'  scenes/index.js: added import {scene_key}')
        else:
            print(f'  scenes/index.js: WARNING — could not find anchor for import {scene_key}')

    if f'  {scene_key},' not in content:
        content, ok = js_insert_after_last(
            content,
            r'^\s{2}[A-Z][A-Za-z0-9]+,\s*$',
            f'  {scene_key},'
        )
        if ok:
            changed = True
            print(f'  scenes/index.js: added export {scene_key}')
        else:
            print(f'  scenes/index.js: WARNING — could not find anchor for export {scene_key}')

    if changed:
        path.write_text(content, encoding='utf-8')
    return changed


# ── Main ────────────────────────────────────────────────────────────────────

def main():
    global GEN3_INSIDE_FIRSTGID, GEN3_OUTSIDE_FIRSTGID

    # ── Load source files ─────────────────────────────────────────────────
    with open(MAPS_DIR / 'kanto_inside.json') as f:
        master = json.load(f)

    # Read actual firstgids from the master file — Tiled renumbers these
    # whenever a tileset is added or removed, so hardcoding is fragile.
    ts_map = {}
    for ts in master.get('tilesets', []):
        src = ts.get('source', '')
        if 'gen3_inside' in src and 'gen3_outside' not in src:
            ts_map['gen3_inside'] = ts['firstgid']
        elif 'gen3_outside' in src:
            ts_map['gen3_outside'] = ts['firstgid']

    if 'gen3_inside' not in ts_map or 'gen3_outside' not in ts_map:
        print('ERROR: kanto_inside.json must contain gen3_inside and gen3_outside tilesets')
        return

    GEN3_INSIDE_FIRSTGID  = ts_map['gen3_inside']
    GEN3_OUTSIDE_FIRSTGID = ts_map['gen3_outside']
    print(f'Tilesets: gen3_inside firstgid={GEN3_INSIDE_FIRSTGID}, gen3_outside firstgid={GEN3_OUTSIDE_FIRSTGID}')

    master_w = master['width']
    master_h = master['height']
    tw = master['tilewidth']
    th = master['tileheight']

    master_tilelayers = {
        l['name']: l for l in master['layers'] if l['type'] == 'tilelayer'
    }
    master_inter = next(
        (l for l in master['layers']
         if l['type'] == 'objectgroup' and l['name'] == 'interactions'), None
    )
    master_objs = master_inter['objects'] if master_inter else []

    maps_layer = next(
        (l for l in master['layers']
         if l['name'] == 'maps' and l['type'] == 'objectgroup'), None
    )
    if not maps_layer:
        print('ERROR: no "maps" objectgroup found in kanto_inside.json')
        return

    src_to_inside, inside_to_src, gid_map_path, gid_map_raw = load_gid_map()

    inside_ts_path = TILESET_DIR / 'maps' / 'kanto_inside.json'
    if inside_ts_path.exists():
        with open(inside_ts_path) as f:
            inside_ts_json = json.load(f)
    else:
        inside_ts_json = {
            'columns':    8,
            'image':      'kanto_inside.png',
            'imageheight': 0,
            'imagewidth':  256,
            'margin':     0,
            'name':       'kanto_inside',
            'spacing':    0,
            'tilecount':  0,
            'tiledversion': '1.12.1',
            'tileheight': 32,
            'tilewidth':  32,
            'tiles':      [],
            'type':       'tileset',
            'version':    '1.11',
        }

    with open(TILESET_DIR / 'gen3_inside.json') as f:
        gen3_ts_json = json.load(f)
    with open(TILESET_DIR / 'gen3_outside.json') as f:
        gen3_outside_ts_json = json.load(f)

    props_indices = {
        'gen3_inside':   build_props_index(gen3_ts_json),
        'gen3_outside':  build_props_index(gen3_outside_ts_json),
    }

    new_mappings      = {}   # src_gid -> newly assigned inside_gid
    inside_ts_modified = False

    # ── Update each map file ──────────────────────────────────────────────
    fname_to_key = {}
    for obj in maps_layer['objects']:
        if not obj.get('name'):
            continue
        fname     = name_to_filename(obj['name'])
        scene_key_for_map = NAME_TO_SCENE_KEY.get(obj['name'], obj['name'])
        fname_to_key[fname] = scene_key_for_map

        map_path = MAPS_DIR / fname
        ox    = obj['x'] // tw
        oy    = obj['y'] // th
        dst_w = obj['width']  // tw
        dst_h = obj['height'] // th

        print(f'\n{fname}: master tile origin ({ox},{oy}), size {dst_w}x{dst_h}')

        is_new_map = not map_path.exists()
        if is_new_map:
            route = make_skeleton(obj['name'], dst_w, dst_h)
            print('  created skeleton')
        else:
            with open(map_path) as f:
                route = json.load(f)

        # Detect the source tileset to decide how to handle tile data.
        # pallet_town_inside  → migrate GIDs to kanto_inside in-place (one-time migration)
        # kanto_inside        → tiles already in kanto_inside space; skip tile sync
        # (new map / skeleton) → always pull from master (is_new_map == True)
        existing_ts_src = (route.get('tilesets') or [{}])[0].get('source', '')
        uses_kanto_inside = 'kanto_inside' in existing_ts_src

        # Always point at kanto_inside tileset
        route['tilesets'] = [INSIDE_TILESET]

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

        # Sync tile layers from master kanto_inside.json.
        # For new maps, only layers with non-zero tile data are added.
        # For existing maps, all master layers are synced (existing updated, new added).
        print('  syncing tile layers from master kanto_inside.json')
        existing_layers = {l['name']: l for l in route['layers'] if l['type'] == 'tilelayer'}
        inter_idx = next(
            (i for i, l in enumerate(route['layers']) if l['type'] == 'objectgroup'),
            len(route['layers'])
        )
        max_lid = max((l.get('id') or 0 for l in route['layers']), default=0)
        for kname, klayer in master_tilelayers.items():
            raw = extract_region(
                klayer['data'], master_w, master_h,
                ox, oy, dst_w, dst_h
            )
            converted, modified = remap_data(
                raw, src_to_inside, inside_to_src,
                inside_ts_json, props_indices, gid_map_raw, new_mappings
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
                new_layer = make_layer(kname, dst_w, dst_h, LAYER_CHAR.get(kname))
                new_layer['id']   = max_lid
                new_layer['data'] = converted
                route['layers'].insert(inter_idx, new_layer)
                inter_idx += 1
                print(f'  added layer "{kname}" from master ({non_zero} non-zero tiles)')

        # Interaction objects — merge from master's interactions objectgroup
        inter = next(
            (l for l in route['layers'] if l['type'] == 'objectgroup'), None
        )
        if inter is None:
            max_lid = max((l.get('id') or 0 for l in route['layers']), default=0) + 1
            inter = {
                'draworder': 'topdown', 'id': max_lid,
                'name': 'interactions', 'opacity': 1,
                'type': 'objectgroup', 'visible': True,
                'x': 0, 'y': 0, 'objects': [],
            }
            route['layers'].append(inter)

        master_px_x = ox * tw
        master_px_y = oy * th
        px_w = dst_w * tw
        px_h = dst_h * th

        inter['objects'] = []
        max_oid = 0

        for obj_src in master_objs:
            cx = obj_src['x'] + obj_src.get('width', 0) / 2
            cy = obj_src['y'] + obj_src.get('height', 0) / 2
            if not (master_px_x <= cx < master_px_x + px_w and
                    master_px_y <= cy < master_px_y + px_h):
                continue
            local_x = obj_src['x'] - master_px_x
            local_y = obj_src['y'] - master_px_y
            max_oid += 1
            inter['objects'].append({**obj_src, 'x': local_x, 'y': local_y, 'id': max_oid})
            print(f'  added obj "{obj_src["name"]}"')

        route['nextobjectid'] = max_oid + 1

        sort_layers(route['layers'])
        sync_layer_properties(route['layers'])

        with open(map_path, 'w') as f:
            json.dump(route, f, indent=2)
        print(f'  saved {fname}')

        # ── Register in JS source files ───────────────────────────────────
        scene_key = fname_to_key[fname]
        ensure_scene_file(scene_key)
        ensure_maps_index(scene_key, fname)
        ensure_scenes_index(scene_key)

    # ── Ensure item/obstacle tiles from gen3_outside are in kanto_inside ────
    # BaseItem subclasses (Pokeball, CutTree, etc.) use specific gen3_outside
    # tile IDs.  Guarantee they have a kanto_inside GID even when they are not
    # placed in any tilelayer of kanto_inside.json.
    print('\nEnsuring item tiles are in kanto_inside...')
    for tile_id in ITEM_TILE_IDS:
        src_gid = GEN3_OUTSIDE_FIRSTGID + tile_id
        if src_gid not in src_to_inside:
            max_inside = max(inside_to_src.keys(), default=0) + 1
            src_to_inside[src_gid]                        = max_inside
            inside_to_src[max_inside]                     = src_gid
            gid_map_raw['src_to_inside'][str(src_gid)]    = max_inside
            gid_map_raw['inside_to_src'][str(max_inside)] = src_gid
            new_mappings[src_gid]                         = max_inside
            print(f'  reserved inside GID {max_inside} for item tile {tile_id} (gen3_outside)')
        if ensure_inside_tile(inside_ts_json, src_to_inside[src_gid], src_gid, props_indices):
            inside_ts_modified = True

    # ── Write gen3_to_kanto_inside.json ──────────────────────────────────
    # Maps gen3_outside tileId+1 (= BaseItem gen3Gid) → kanto_inside GID.
    # Mirrors the format of gen3_to_kanto.json so BaseItem can use an identical
    # lookup pattern when rendering on a kanto_inside map.
    gen3_to_inside = {}
    for tile_id in ITEM_TILE_IDS:
        src_gid = GEN3_OUTSIDE_FIRSTGID + tile_id
        igid = src_to_inside.get(src_gid)
        if igid is not None:
            gen3_to_inside[str(tile_id + 1)] = igid
    gen3_inside_map_path = MAPS_DIR / 'gen3_to_kanto_inside.json'
    with open(gen3_inside_map_path, 'w') as f:
        json.dump(gen3_to_inside, f, indent=2)
    print(f'Updated gen3_to_kanto_inside.json ({len(gen3_to_inside)} entries)')

    # ── Persist GID map ───────────────────────────────────────────────────
    if new_mappings:
        print(f'\nNew src->inside tile mappings added: {len(new_mappings)}')
        with open(gid_map_path, 'w') as f:
            json.dump(gid_map_raw, f, indent=2)
        print('Updated inside_gid_map.json')

    # ── Rebuild kanto_inside.png ──────────────────────────────────────────
    if update_inside_png(src_to_inside, inside_ts_json, inside_ts_path):
        inside_ts_modified = True

    # ── Write kanto_inside.json tileset ───────────────────────────────────
    if inside_ts_modified or not inside_ts_path.exists():
        # Sort tiles by id for clean diffs
        if 'tiles' in inside_ts_json:
            inside_ts_json['tiles'].sort(key=lambda t: t['id'])
        with open(inside_ts_path, 'w') as f:
            json.dump(inside_ts_json, f, indent=1)
        print(f'Updated {inside_ts_path.name}')


if __name__ == '__main__':
    main()
