import json
import math
from pathlib import Path


def convert(input_path: str) -> None:
    output_path = str(Path(input_path).parent / f"{Path(input_path).stem}_graph.json")
    with open(input_path, "r", encoding="utf-8") as f:
        snapshot = json.load(f)

    entity_types = snapshot.get("entity_types", {})
    relationships = snapshot.get("relationships", [])
    bindings = snapshot.get("bindings", {})

    entity_names = list(entity_types.keys())
    name_to_id = {name: i for i, name in enumerate(entity_names)}

    n = len(entity_names)
    radius = max(300, n * 30)

    nodes = []
    for i, name in enumerate(entity_names):
        angle = 2 * math.pi * i / n if n > 1 else 0
        binding = bindings.get(name, {})
        nodes.append({
            "id": i,
            "name": name,
            "type": binding.get("table_name", ""),
            "color": "#3498db",
            "x": round(radius * math.cos(angle), 2),
            "y": round(radius * math.sin(angle), 2),
            "comments": [],
        })

    links = []
    for link_id, rel in enumerate(relationships):
        source = rel.get("source_entity", "")
        target = rel.get("target_entity", "")
        if source not in name_to_id or target not in name_to_id:
            print(f"Warning: skipping '{rel.get('name')}' — unknown entity")
            continue
        links.append({
            "id": link_id,
            "sourceId": name_to_id[source],
            "targetId": name_to_id[target],
            "name": rel.get("name", ""),
            "type": "",
            "color": "#99ccff",
            "comments": [],
        })

    graph = {
        "nodes": nodes,
        "links": links,
        "nextNodeId": len(nodes),
        "nextLinkId": len(links),
    }

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(graph, f, indent=2, ensure_ascii=False)

    print(f"Done - {len(nodes)} nodes, {len(links)} links -> {output_path}")


if __name__ == "__main__":
    INPUT_PATH = r"C:\Users\YourPathHere\file.json"

    convert(INPUT_PATH)
