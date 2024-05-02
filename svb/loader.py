"""Item loader."""
import json, pathlib

from .schema import Item


def load_items(path, task=None):
    for line in open(path):
        line = line.strip()
        if not line: continue
        d = json.loads(line)
        if task and d.get("task") != task: continue
        yield Item.from_dict(d)


def images_root(items_path):
    p = pathlib.Path(items_path).resolve().parent
    return str(p / "images") if (p / "images").is_dir() else str(p)
