"""Item schema."""
from dataclasses import dataclass, field, asdict
from typing import List, Optional


TASKS = ("2d_relations", "3d_relations", "rotation")


@dataclass
class Item:
    id: str
    task: str
    image: str
    question: str
    answer: str
    choices: Optional[List[str]] = None
    source: Optional[str] = None
    tags: List[str] = field(default_factory=list)

    def to_dict(self): return asdict(self)

    @classmethod
    def from_dict(cls, d): return cls(**d)

    def validate(self):
        if self.task not in TASKS:
            raise ValueError(f"unknown task {self.task!r}")
