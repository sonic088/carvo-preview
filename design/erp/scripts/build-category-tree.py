#!/usr/bin/env python3
"""Compact the CARVO/SHEIN admin_tree into a picker payload for Seller ERP."""
from __future__ import annotations

import argparse
import json
from collections import defaultdict
from pathlib import Path


def pack(node: dict, by_parent: dict) -> dict:
    item = {"id": node["carvo_id"], "en": node["en"]}
    if node.get("ar"):
        item["ar"] = node["ar"]
    if node["leaf"]:
        item["isLeaf"] = True
        return item
    children = [pack(child, by_parent) for child in by_parent[node["carvo_id"]]]
    item["children"] = children
    item["leaves"] = sum(1 if child.get("isLeaf") else child.get("leaves", 0) for child in children)
    return item


def convert(src: dict) -> dict:
    cols = src["cols"]
    nodes = [dict(zip(cols, row)) for row in src["nodes"]]
    by_parent = defaultdict(list)
    for node in nodes:
        by_parent[node["parent"]].append(node)

    tops_out = []
    warnings = []
    for top in src["tops"]:
        children = [pack(child, by_parent) for child in by_parent[top["carvo_id"]]]
        calc = sum(1 if child.get("isLeaf") else child.get("leaves", 0) for child in children)
        item = {
            "n": top["n"],
            "key": top["key"],
            "id": top["carvo_id"],
            "en": top["en"],
            "visible": bool(top.get("visible", True)),
            "leaves": top["leaves"],
            "children": children,
        }
        if top.get("ar"):
            item["ar"] = top["ar"]
        if calc != top["leaves"]:
            warnings.append(f"{top['key']}: admin leaves={top['leaves']} packed={calc}")
        tops_out.append(item)

    return {
        "version": src.get("version", "carvo-23-tops"),
        "departments": len(tops_out),
        "leaves": sum(t["leaves"] for t in tops_out),
        "tops": tops_out,
        "_warnings": warnings,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--src", required=True)
    parser.add_argument("--out", required=True)
    args = parser.parse_args()

    src = json.loads(Path(args.src).read_text(encoding="utf-8"))
    payload = convert(src)
    warnings = payload.pop("_warnings")
    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"wrote {out_path} ({out_path.stat().st_size} bytes)")
    print(f"departments={payload['departments']} leaves={payload['leaves']} version={payload['version']}")
    for warning in warnings:
        print("WARN", warning)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
