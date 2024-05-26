from svb.schema import Item
from svb.scorer import score, extract_letter


def _mk(task, choices, ans):
    return Item(id="x", task=task, image="x.jpg", question="?", answer=ans, choices=choices)


def test_extract_letter_basic():
    assert extract_letter("C.", 4) == "C"
    assert extract_letter("The answer is B.", 4) == "B"
    assert extract_letter("E", 4) == ""   # out of range


def test_score_per_task():
    items = [_mk("2d_relations", ["left", "right"], "right"),
             _mk("rotation", ["n", "s", "e", "w"], "w")]
    res = score(items, ["B", "D"])
    assert res["accuracy"] == 1.0
    assert res["per_task"]["2d_relations"] == 1.0
