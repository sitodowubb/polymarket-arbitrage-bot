"""Runner."""
import json, pathlib
from tqdm import tqdm
from .loader import load_items, images_root
from .models import build_model
from .scorer import score


def run_eval(model_name, items_path, output_path, task=None, limit=None, **kw):
    model = build_model(model_name, **kw)
    model.load()
    root = images_root(items_path)
    items = list(load_items(items_path, task=task))
    if limit: items = items[:limit]
    pathlib.Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w") as f:
        for it in tqdm(items, desc=model_name):
            try:
                pred = model.predict(it, root)
            except Exception as e:
                pred = ""
            f.write(json.dumps({"id": it.id, "task": it.task, "prediction": pred}) + "\n")


def score_predictions(items_path, preds_path, report=True):
    items = {it.id: it for it in load_items(items_path)}
    al_items, al_preds = [], []
    for line in open(preds_path):
        r = json.loads(line)
        if r["id"] in items:
            al_items.append(items[r["id"]]); al_preds.append(r["prediction"])
    res = score(al_items, al_preds)
    if report:
        print(json.dumps(res, indent=2))
    return res
