"""
Shared infrastructure for the per-master "rebuild" scripts.

Each `update_kanto*.py` script reads a Tiled master map, derives per-zone
JSONs from the named regions on the master's `maps` objectgroup, and feeds
the engine's tileset PNGs from a set of source tilesets. The plumbing for
that loop — region extraction, layer wiring, JSON skeletons, JS-index
registration, GID-table I/O — is identical across the three masters
(kanto.json / kanto_inside.json / kanto_dungeons.json) and lives here.

What stays per-script:
  * The GID-assignment policy. The three masters share their split rules
    only loosely (outdoor splits gen3_outside between common + outside;
    inside inherits from outdoor and adds gen3_inside; dungeons inherits
    common+outside and adds cave_dungeon). Each script defines its own
    `build_compact_gid_map`, `remap_data`, and PNG composer.
  * Animation handling. Only the outdoor master sources animated tiles.
"""

import json
import pathlib
import re

# ── Path constants ──────────────────────────────────────────────────────────

MAPS_DIR    = pathlib.Path(__file__).parent
SRC_DIR     = MAPS_DIR.parent.parent           # src/
TILESET_DIR = SRC_DIR / 'tileset'


# ── Layer scaffolding ──────────────────────────────────────────────────────

def make_layer(name, w, h, ge_char_layer=None):
    """Build a blank tilelayer dict. `ge_char_layer` adds the GridEngine
    `ge_charLayer` property when set."""
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


def make_skeleton(w, h, layer_template, tilesets, *, scene_inside=False):
    """Build a minimal map JSON skeleton. `layer_template` is a list of
    `(name, ge_char_layer, is_objectgroup)` triples in render order. Each
    tilelayer entry produces a blank tilelayer; the single objectlayer
    entry produces a `playerSpawn` placeholder.

    `tilesets` is the per-spec tilesets array to embed. For new (skeleton)
    files this is a placeholder; the per-zone loop overwrites it on every
    run with the up-to-date `make_*_tilesets(common_count)` value.
    """
    layers = []
    for lid, (name, char_layer, is_obj) in enumerate(layer_template, start=1):
        if is_obj:
            spawn_y = (h - 2) * 32 if not scene_inside else (h // 2) * 32
            layers.append({
                'draworder': 'topdown', 'id': lid,
                'name': name, 'opacity': 1,
                'type': 'objectgroup', 'visible': True,
                'x': 0, 'y': 0,
                'objects': [{
                    'height': 32, 'id': 1, 'name': 'player',
                    'rotation': 0, 'type': 'playerSpawn',
                    'visible': True, 'width': 32,
                    'x': (w // 2) * 32, 'y': spawn_y,
                }],
            })
        else:
            layer = make_layer(name, w, h, char_layer)
            layer['id'] = lid
            layers.append(layer)
    skeleton = {
        'height': h, 'width': w,
        'tilewidth': 32, 'tileheight': 32,
        'orientation': 'orthogonal', 'renderorder': 'right-down',
        'tiledversion': '1.11.2', 'type': 'map', 'version': '1.10',
        'tilesets': tilesets,
        'layers': layers,
    }
    if scene_inside:
        skeleton.update({
            'infinite': False, 'compressionlevel': -1,
            'nextlayerid': len(layer_template) + 1,
            'nextobjectid': 2,
        })
    return skeleton


def sort_layers(layers, layer_order):
    """Re-order a layer list to match `layer_order` (list of names).
    Unknown layers go last."""
    def key(l):
        try:
            return layer_order.index(l['name'])
        except ValueError:
            return len(layer_order)
    layers.sort(key=key)


def sync_layer_properties(layers, layer_char):
    """Ensure every tilelayer has the correct `ge_charLayer` property per
    `layer_char` ({layer_name: char_layer_value}). Call this after editing
    layer membership so character-layer tags stay aligned with the spec."""
    for layer in layers:
        if layer['type'] != 'tilelayer':
            continue
        char_layer = layer_char.get(layer['name'])
        props = [p for p in layer.get('properties', []) if p['name'] != 'ge_charLayer']
        if char_layer:
            props.append({'name': 'ge_charLayer', 'type': 'string', 'value': char_layer})
        layer['properties'] = props


# ── Master-file inspection ──────────────────────────────────────────────────

def load_master(path):
    """Read a Tiled master JSON and return (data, tilelayers_dict, interactions_objects, maps_layer)."""
    with open(path) as f:
        master = json.load(f)
    tilelayers = {l['name']: l for l in master['layers'] if l['type'] == 'tilelayer'}
    inter = next((l for l in master['layers']
                  if l['type'] == 'objectgroup' and l['name'] == 'interactions'), None)
    inter_objs = inter['objects'] if inter else []
    maps_layer = next((l for l in master['layers']
                       if l['name'] == 'maps' and l['type'] == 'objectgroup'), None)
    return master, tilelayers, inter_objs, maps_layer


def discover_firstgids(master, source_substrings):
    """Return {key: firstgid} by scanning master's tilesets array for sources
    whose `source` field contains the substring `key`. Tiled renumbers
    firstgids whenever tilesets are added/removed, so always discover
    rather than hardcode.

    `source_substrings` is a list of substrings to match, in priority order
    — each tileset is matched against the first substring that doesn't
    overlap with another substring already matched. (E.g. for `gen3_inside`
    we want to skip `gen3_outside` matches.)
    """
    found = {}
    for ts in master.get('tilesets', []):
        src = ts.get('source', '')
        for needle in source_substrings:
            if needle in src and needle not in found:
                # Don't double-match a substring whose chars overlap a longer one.
                # Example: gen3_inside vs gen3_outside — both contain "gen3_".
                # So we require an exact word-ish match by checking the next char.
                # Simpler: prefer the first source-substring whose match is
                # uniquely identifiable.
                if any(needle in other and other != needle and other in src
                       for other in source_substrings):
                    continue
                found[needle] = ts['firstgid']
                break
    return found


# ── Tile-data extraction ────────────────────────────────────────────────────

def extract_region(data, src_w, src_h, ox, oy, dst_w, dst_h):
    """Extract a `dst_w`×`dst_h` rectangular region from a flat tile-data
    array of size `src_w`×`src_h` starting at tile origin `(ox, oy)`.
    Out-of-bounds reads return 0 (empty tile)."""
    out = []
    for row in range(dst_h):
        for col in range(dst_w):
            sx, sy = ox + col, oy + row
            if 0 <= sx < src_w and 0 <= sy < src_h:
                out.append(data[sy * src_w + sx])
            else:
                out.append(0)
    return out


def build_props_index(tileset_json):
    """Return {tile_id (0-based): props_list} from a tileset JSON."""
    return {tile['id']: tile['properties']
            for tile in tileset_json.get('tiles', [])
            if 'properties' in tile}


# ── Filename / scene-key conventions ───────────────────────────────────────

def name_to_filename(name, overrides=None, *, expand_floor_suffix=False):
    """
    Derive a JSON filename from a CamelCase map name.
    `overrides` is a {camelCaseName: filename} dict for non-standard cases
    (e.g. PalletTown → pallet.json instead of pallet_town.json).
    `expand_floor_suffix` rewrites a trailing `F<digit>` to `Floor<digit>`
    for readability — used by the inside spec.
    """
    overrides = overrides or {}
    if name in overrides:
        return overrides[name]
    if expand_floor_suffix:
        name = re.sub(r'F(\d+)$', lambda m: f'Floor{m.group(1)}', name)
    snake = re.sub(r'(?<=[a-z0-9])(?=[A-Z])', '_', name).lower()
    return snake + '.json'


# ── Per-zone wiring ─────────────────────────────────────────────────────────

def merge_interactions(master_objs, master_px_x, master_px_y, px_w, px_h):
    """Filter master's interaction objects to those whose center falls inside
    the zone's pixel bounds, returning the objects with localised x/y and
    fresh sequential ids. Returns (objects_list, next_object_id)."""
    objects = []
    next_id = 0
    for obj in master_objs:
        cx = obj['x'] + obj.get('width',  0) / 2
        cy = obj['y'] + obj.get('height', 0) / 2
        if not (master_px_x <= cx < master_px_x + px_w and
                master_px_y <= cy < master_px_y + px_h):
            continue
        next_id += 1
        objects.append({
            **obj,
            'x':  obj['x'] - master_px_x,
            'y':  obj['y'] - master_px_y,
            'id': next_id,
        })
    return objects, next_id + 1


def get_or_create_interaction_layer(route_layers):
    """Return the 'interactions' objectgroup, appending one to `route_layers`
    if it doesn't exist."""
    inter = next((l for l in route_layers if l['type'] == 'objectgroup'), None)
    if inter is None:
        max_lid = max((l.get('id') or 0 for l in route_layers), default=0) + 1
        inter = {
            'draworder': 'topdown', 'id': max_lid,
            'name': 'interactions', 'opacity': 1,
            'type': 'objectgroup', 'visible': True,
            'x': 0, 'y': 0, 'objects': [],
        }
        route_layers.append(inter)
    return inter


def resize_route(route, dst_w, dst_h):
    """Resize all tilelayers on `route` to `dst_w`×`dst_h`, blanking the
    data arrays. No-op when dimensions already match."""
    if route['width'] == dst_w and route['height'] == dst_h:
        return False
    print(f'  resizing {route["width"]}x{route["height"]} -> {dst_w}x{dst_h}')
    route['width']  = dst_w
    route['height'] = dst_h
    for layer in route['layers']:
        if layer['type'] != 'tilelayer':
            continue
        layer['width']  = dst_w
        layer['height'] = dst_h
        layer['data']   = [0] * (dst_w * dst_h)
    return True


def tilelayer_insert_index(route_layers):
    """Return the index just before the first objectgroup, where new
    tilelayers should be inserted to keep render order correct."""
    return next(
        (i for i, l in enumerate(route_layers) if l['type'] == 'objectgroup'),
        len(route_layers)
    )


# ── Tileset I/O ─────────────────────────────────────────────────────────────

def load_or_init_tileset(path, name, image, columns, *, image_width=None):
    """Return the tileset JSON at `path`, creating a fresh empty one when
    the file is missing. `columns` and the optional `image_width` set the
    initial canvas dimensions for new tilesets."""
    if path.exists():
        with open(path) as f:
            return json.load(f)
    return {
        'columns':     columns,
        'image':       image,
        'imageheight': 0,
        'imagewidth':  image_width if image_width is not None else columns * 32,
        'margin':      0,
        'name':        name,
        'spacing':     0,
        'tilecount':   0,
        'tiledversion': '1.12.1',
        'tileheight':  32,
        'tilewidth':   32,
        'tiles':       [],
        'type':        'tileset',
        'version':     '1.11',
    }


def write_tileset_json(path, ts_json):
    """Sort tile entries by id and write the tileset JSON to `path` with
    1-space indent (matching what Tiled itself emits)."""
    if 'tiles' in ts_json:
        ts_json['tiles'].sort(key=lambda t: t['id'])
    with open(path, 'w') as f:
        json.dump(ts_json, f, indent=1)
    print(f'Updated {path.name}')


def write_tileset_png(entries, source_image_path, ts_json, dst_png_path,
                       source_columns):
    """
    Compose a tileset PNG from a list of (src_tile_id, dst_tile_id) entries
    sourcing tiles from a single PNG.

    * `source_image_path` — the source PNG to crop tiles from
    * `source_columns`    — column count of the source PNG (for tile→pixel)
    * `ts_json`           — the destination tileset JSON; columns / tilewidth
                            / tileheight are read from here. imagewidth /
                            imageheight / tilecount are written back.
    * `dst_png_path`      — where to write the composed PNG
    Returns True on success, False if Pillow is missing or no entries.
    """
    try:
        from PIL import Image
    except ImportError:
        print('  WARNING: Pillow not installed — cannot rebuild PNG')
        return False
    if not entries:
        return False

    src_img = Image.open(source_image_path).convert('RGBA')
    tw   = ts_json['tilewidth']
    th   = ts_json['tileheight']
    cols = ts_json['columns']
    max_dst = max(dst for _, dst in entries)
    rows    = (max_dst // cols) + 1
    img     = Image.new('RGBA', (cols * tw, rows * th), (0, 0, 0, 0))
    for src_tid, dst_tid in entries:
        sx = (src_tid % source_columns) * tw
        sy = (src_tid // source_columns) * th
        dx = (dst_tid % cols)            * tw
        dy = (dst_tid // cols)           * th
        img.paste(src_img.crop((sx, sy, sx + tw, sy + th)), (dx, dy))
    img.save(dst_png_path)
    ts_json['imagewidth']  = cols * tw
    ts_json['imageheight'] = rows * th
    ts_json['tilecount']   = cols * rows
    print(f'  rebuilt {dst_png_path.name} ({len(entries)} tiles, {cols}x{rows} grid)')
    return True


# ── JS source-file registration ────────────────────────────────────────────

def js_insert_after_last(content, pattern, new_line):
    """Insert `new_line` after the last line in `content` matching `pattern`.
    Returns (new_content, True) on success, (content, False) if no anchor
    line was found."""
    lines    = content.splitlines(keepends=True)
    last_idx = -1
    for i, line in enumerate(lines):
        if re.search(pattern, line):
            last_idx = i
    if last_idx == -1:
        return content, False
    lines.insert(last_idx + 1, new_line + '\n')
    return ''.join(lines), True


def ensure_scene_file(scene_key, *, inside=False):
    """Create `src/scenes/maps/kanto/{scene_key}.js` if missing. Inside
    scenes get an `inside: true` constructor flag."""
    path = SRC_DIR / 'scenes' / 'maps' / 'kanto' / f'{scene_key}.js'
    if path.exists():
        return False
    map_var = scene_key + 'Map'
    inside_line = "      inside: true,\n" if inside else ""
    content = (
        f"import {{ GameMap }} from '@Objects';\n"
        f"import {{ {map_var} }} from '@Maps';\n"
        f"\n"
        f"export default class extends GameMap {{\n"
        f"  constructor() {{\n"
        f"    super({{\n"
        f"      mapName: '{scene_key}',\n"
        f"      map: {map_var},\n"
        f"{inside_line}"
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
    """Register a map in `src/maps/index.js`. If the file is already
    imported under a different variable name (e.g. ProfessorLabMap for a
    file authored elsewhere), re-use that variable for the registry entry
    rather than adding a duplicate import."""
    path    = SRC_DIR / 'maps' / 'index.js'
    content = path.read_text(encoding='utf-8')
    map_var = scene_key + 'Map'
    changed = False

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

    if file_already_imported:
        m = re.search(r"import (\w+) from '\./kanto/" + re.escape(fname) + r"'", content)
        map_var = m.group(1) if m else map_var

    # WORLD_MAP_KEYS entry (only present in outdoor — quoted-filename → quoted-scene-key)
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
        # No anchor → no WORLD_MAP_KEYS section (insides/dungeons), silently skip.

    # Word-boundary regex so we match `Foo,` regardless of whether it's on
    # its own line or sharing one with `Bar, Foo,` etc.
    if not re.search(r'\b' + re.escape(map_var) + r'\b\s*,', content):
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
    """Register a scene class in `src/scenes/index.js`."""
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

    if not re.search(r'\b' + re.escape(scene_key) + r'\b\s*,', content):
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


# ── Per-zone driver ─────────────────────────────────────────────────────────

def iter_zones(maps_layer, *, name_to_file_overrides=None,
                expand_floor_suffix=False):
    """
    Yield each named region from a master's `maps` objectgroup as a
    Zone-shaped dict. Caller is responsible for the per-zone tile/object
    sync — this just centralises filename derivation, scene-key extraction,
    and the maps-object property pass-through.

    Yields dicts with keys:
      name        — CamelCase scene key (object's `name`)
      fname       — derived filename, e.g. "pallet.json"
      x, y        — pixel origin (raw, no offset applied)
      width, height — pixel size
      properties  — list of Tiled custom properties on the maps-layer object
    """
    if not maps_layer:
        return
    for obj in maps_layer['objects']:
        if not obj.get('name'):
            continue
        fname = name_to_filename(
            obj['name'], name_to_file_overrides,
            expand_floor_suffix=expand_floor_suffix,
        )
        yield {
            'name':       obj['name'],
            'fname':      fname,
            'x':          obj['x'],
            'y':          obj['y'],
            'width':      obj['width'],
            'height':     obj['height'],
            'properties': obj.get('properties', []),
        }
