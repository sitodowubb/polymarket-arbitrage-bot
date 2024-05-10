"""Adapter base."""
import abc
from ..schema import Item

class BaseAdapter(abc.ABC):
    name = "base"
    def __init__(self, **kw): self.kw = kw; self._loaded = False
    def load(self): ...
    @abc.abstractmethod
    def predict(self, item: Item, images_root: str) -> str: ...
