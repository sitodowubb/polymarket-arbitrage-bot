"""OpenAI Vision adapter."""
import base64, os, pathlib
from .base import BaseAdapter


class OpenAIVisionAdapter(BaseAdapter):
    name = "gpt-4o-mini"

    def __init__(self, model="gpt-4o-mini", mode="cmc"):
        super().__init__()
        self.model = model; self.mode = mode
        self._client = None

    def load(self):
        if self._client is None:
            from openai import OpenAI
            self._client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])

    def _fmt(self, item):
        if self.mode == "cmc" and item.choices:
            opts = "\n".join(f"{chr(65 + i)}. {c}" for i, c in enumerate(item.choices))
            return f"Answer with the option letter.\nQ: {item.question}\n{opts}"
        return item.question

    def predict(self, item, images_root):
        self.load()
        b64 = base64.b64encode(open(pathlib.Path(images_root) / item.image, "rb").read()).decode()
        resp = self._client.chat.completions.create(
            model=self.model, max_tokens=16,
            messages=[{"role": "user", "content": [
                {"type": "text", "text": self._fmt(item)},
                {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{b64}"}},
            ]}])
        return resp.choices[0].message.content.strip()
