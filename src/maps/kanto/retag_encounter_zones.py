#!/usr/bin/env python3
"""
One-shot migration: re-tag `encounters` object-layer zones in the master maps.

Before:
    zone.properties = [ { name: "table-id", value: "grass" } ]

After:
    zone.properties = [
        { name: "section",  value: "grass" },
        { name: "table-id", value: "ROUTE_1" },   # resolved from the location rect
    ]

Resolution: for each zone object, find the `location`-typed object on the
`maps` layer whose pixel rectangle contains the zone's pixel center. Read
that location's encounter-table wrapper and copy its `name` field into the
zone's `table-id`. If no containing location is found, fall back to the
top-level map-settings encounter-table's name. If neither exists, leave the
zone untouched and print a warning.

Idempotent: zones that already have a non-slot `table-id` AND a `section`
property are skipped.
"""
import json
import sys
from pathlib import Path

HERE = Path(__file__).parent
MASTERS = [HERE / "kanto.json", HERE / "kanto_inside.json"]
SLOT_NAMES = {"grass", "surf", "good-rod", "super-rod", "old-rod", "rock-smash", "cave"}


def find_property(props, name):
    for p in props or []:
        if p.get("name") == name:
            return p
    return None


def get_encounter_table_names(map_settings):
    """Extract the list of encounter-table entry `name`s from a map-settings
    class value.  Returns [] when no table is declared."""
    if not isinstance(map_settings, dict):
        return []
    tables = map_settings.get("encounter-table")
    if not isinstance(tables, list):
        return []
    names = []
    for wrapper in tables:
        entry = wrapper.get("value") if isinstance(wrapper, dict) else None
        if isinstance(entry, dict) and isinstance(entry.get("name"), str):
            names.append(entry["name"])
    return names


def collect_location_rects(map_data):
    """Return [(rect, tableName)] for every `location` object on the `maps`
    layer that carries an encounter-table.  `tableName` is the first entry
    name declared on that location's map-settings."""
    rects = []
    for layer in map_data.get("layers", []):
        if layer.get("name") != "maps":
            continue
        for obj in layer.get("objects", []):
            if obj.get("type") != "location":
                continue
            map_settings = find_property(obj.get("properties", []), "map-settings")
            if not map_settings:
                continue
            names = get_encounter_table_names(map_settings.get("value") or {})
            if not names:
                continue
            rect = (
                obj.get("x", 0),
                obj.get("y", 0),
                obj.get("x", 0) + obj.get("width", 0),
                obj.get("y", 0) + obj.get("height", 0),
            )
            rects.append((rect, names[0]))
    return rects


def top_level_table_name(map_data):
    """First encounter-table entry name declared at the top-level
    map-settings, or None."""
    map_settings = find_property(map_data.get("properties", []), "map-settings")
    if not map_settings:
        return None
    names = get_encounter_table_names(map_settings.get("value") or {})
    return names[0] if names else None


def zone_center(obj):
    # Handle polygon zones by averaging their absolute vertices;
    # rectangle zones use their own center.
    if "polygon" in obj and obj["polygon"]:
        xs = [obj.get("x", 0) + pt.get("x", 0) for pt in obj["polygon"]]
        ys = [obj.get("y", 0) + pt.get("y", 0) for pt in obj["polygon"]]
        return (sum(xs) / len(xs), sum(ys) / len(ys))
    return (
        obj.get("x", 0) + obj.get("width", 0) / 2,
        obj.get("y", 0) + obj.get("height", 0) / 2,
    )


def retag_map(path: Path) -> tuple[int, int, int]:
    """Returns (zones_seen, zones_updated, zones_skipped_no_table)."""
    data = json.loads(path.read_text())
    rects = collect_location_rects(data)
    fallback = top_level_table_name(data)

    seen = updated = unresolved = 0

    for layer in data.get("layers", []):
        for obj in layer.get("objects", []) or []:
            if obj.get("type") != "encounters":
                continue
            seen += 1
            props = obj.setdefault("properties", [])
            table_prop = find_property(props, "table-id")
            section_prop = find_property(props, "section")

            existing_table = table_prop.get("value") if table_prop else ""
            has_section = section_prop is not None

            # Skip if already migrated: table-id is a real table name AND
            # section is explicitly set.
            if existing_table and existing_table not in SLOT_NAMES and has_section:
                continue

            # Resolve the table name via the containing location rect.
            cx, cy = zone_center(obj)
            resolved = None
            for (x0, y0, x1, y1), name in rects:
                if x0 <= cx <= x1 and y0 <= cy <= y1:
                    resolved = name
                    break
            if resolved is None:
                resolved = fallback

            if resolved is None:
                unresolved += 1
                print(f"[retag] {path.name}: zone '{obj.get('name')}' "
                      f"(id={obj.get('id')}) has no resolvable table "
                      f"— leaving untouched")
                continue

            # `section` carries the slot name.  If `table-id` currently
            # holds a slot name (the old convention) use that; otherwise
            # default to 'grass'.
            section_value = existing_table if existing_table in SLOT_NAMES else "grass"

            # Update or add table-id.
            if table_prop:
                table_prop["value"] = resolved
            else:
                props.append({"name": "table-id", "type": "string", "value": resolved})

            # Update or add section.
            if section_prop:
                section_prop["value"] = section_value
            else:
                props.append({"name": "section", "type": "string", "value": section_value})

            # Keep properties alphabetically ordered to match Tiled's own
            # serialisation, which reduces spurious diffs on the next save.
            props.sort(key=lambda p: p.get("name", ""))
            updated += 1

    path.write_text(json.dumps(data, indent=2) + "\n")
    return seen, updated, unresolved


def main():
    total_seen = total_updated = total_unresolved = 0
    for master in MASTERS:
        if not master.exists():
            print(f"[retag] skipping missing master: {master}")
            continue
        seen, updated, unresolved = retag_map(master)
        print(f"[retag] {master.name}: {seen} zones, {updated} updated, "
              f"{unresolved} unresolved")
        total_seen += seen
        total_updated += updated
        total_unresolved += unresolved
    print(f"[retag] total: {total_seen} zones, {total_updated} updated, "
          f"{total_unresolved} unresolved")
    return 0 if total_unresolved == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
