from .base import BaseAdapter
from .llava import LlavaAdapter
from .qwen2_vl import Qwen2VLAdapter

REGISTRY = {"llava-1.5-7b": (LlavaAdapter, {}), "qwen2-vl-7b": (Qwen2VLAdapter, {})}

def build_model(name, **kw):
    cls, d = REGISTRY[name]
    return cls(**{**d, **kw})
