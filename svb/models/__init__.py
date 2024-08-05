from .base import BaseAdapter
from .llava import LlavaAdapter
from .qwen2_vl import Qwen2VLAdapter
from .openai_api import OpenAIVisionAdapter


REGISTRY = {
    "llava-1.5-7b": (LlavaAdapter, {"hf_id": "llava-hf/llava-1.5-7b-hf"}),
    "llava-1.5-13b": (LlavaAdapter, {"hf_id": "llava-hf/llava-1.5-13b-hf"}),
    "qwen2-vl-7b": (Qwen2VLAdapter, {}),
    "gpt-4o-mini": (OpenAIVisionAdapter, {"model": "gpt-4o-mini"}),
    "gpt-4o": (OpenAIVisionAdapter, {"model": "gpt-4o"}),
}


def build_model(name, **kw):
    cls, d = REGISTRY[name]
    return cls(**{**d, **kw})


__all__ = ["BaseAdapter", "build_model", "REGISTRY"]
