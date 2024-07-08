"""Qwen2-VL adapter."""
import pathlib
import torch
from PIL import Image
from transformers import AutoProcessor, AutoModelForCausalLM
from .base import BaseAdapter


class Qwen2VLAdapter(BaseAdapter):
    name = "qwen2-vl-7b"

    def __init__(self, hf_id="Qwen/Qwen2-VL-7B-Instruct", device="cuda", mode="cmc"):
        super().__init__()
        self.hf_id = hf_id; self.device = device; self.mode = mode

    def load(self):
        if self._loaded: return
        self.proc = AutoProcessor.from_pretrained(self.hf_id, trust_remote_code=True)
        self.model = AutoModelForCausalLM.from_pretrained(
            self.hf_id, torch_dtype=torch.bfloat16, trust_remote_code=True).to(self.device).eval()
        self._loaded = True

    def _fmt(self, item):
        if self.mode == "cmc" and item.choices:
            opts = "\n".join(f"{chr(65 + i)}. {c}" for i, c in enumerate(item.choices))
            return f"Answer with the option letter.\nQ: {item.question}\n{opts}"
        return item.question

    @torch.inference_mode()
    def predict(self, item, images_root):
        if not self._loaded: self.load()
        img = Image.open(pathlib.Path(images_root) / item.image).convert("RGB")
        messages = [{"role": "user", "content": [{"type": "image"}, {"type": "text", "text": self._fmt(item)}]}]
        text = self.proc.apply_chat_template(messages, add_generation_prompt=True, tokenize=False)
        inp = self.proc(text=[text], images=[img], return_tensors="pt").to(self.device)
        out = self.model.generate(**inp, max_new_tokens=16, do_sample=False)
        return self.proc.batch_decode(out[:, inp.input_ids.shape[1]:], skip_special_tokens=True)[0].strip()
