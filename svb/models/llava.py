"""LLaVA adapter."""
import pathlib
import torch
from PIL import Image
from transformers import AutoProcessor, LlavaForConditionalGeneration
from .base import BaseAdapter


class LlavaAdapter(BaseAdapter):
    name = "llava-1.5-7b"

    def __init__(self, hf_id="llava-hf/llava-1.5-7b-hf", device="cuda", mode="cmc"):
        super().__init__()
        self.hf_id = hf_id; self.device = device; self.mode = mode

    def load(self):
        if self._loaded: return
        self.proc = AutoProcessor.from_pretrained(self.hf_id)
        self.model = LlavaForConditionalGeneration.from_pretrained(
            self.hf_id, torch_dtype=torch.bfloat16).to(self.device).eval()
        self._loaded = True

    def _fmt(self, item):
        if self.mode == "cmc" and item.choices:
            opts = "\n".join(f"{chr(65 + i)}. {c}" for i, c in enumerate(item.choices))
            return f"USER: <image>\nAnswer with the option letter.\nQ: {item.question}\n{opts}\nASSISTANT:"
        return f"USER: <image>\n{item.question}\nASSISTANT:"

    @torch.inference_mode()
    def predict(self, item, images_root):
        if not self._loaded: self.load()
        img = Image.open(pathlib.Path(images_root) / item.image).convert("RGB")
        inp = self.proc(text=self._fmt(item), images=img, return_tensors="pt").to(self.device)
        out = self.model.generate(**inp, max_new_tokens=16, do_sample=False)
        return self.proc.batch_decode(out[:, inp.input_ids.shape[1]:], skip_special_tokens=True)[0].strip()
