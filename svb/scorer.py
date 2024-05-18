"""CMC scorer."""
import re

_L = re.compile(r"\b([A-Z])\b")


def extract_letter(text, n_choices):
    m = _L.search(text)
    if not m: return ""
    L = m.group(1)
    return L if ord(L) - ord("A") < n_choices else ""


def score(items, predictions):
    by_task = {}
    n_total = 0
    correct_total = 0
    for it, pred in zip(items, predictions):
        if not it.choices:
            continue
        gold = chr(ord("A") + it.choices.index(it.answer))
        guess = extract_letter(pred, len(it.choices))
        ok = int(guess == gold)
        n_total += 1
        correct_total += ok
        d = by_task.setdefault(it.task, {"n": 0, "correct": 0})
        d["n"] += 1; d["correct"] += ok
    return {
        "n": n_total,
        "accuracy": correct_total / max(1, n_total),
        "per_task": {t: d["correct"] / d["n"] for t, d in by_task.items()},
    }
