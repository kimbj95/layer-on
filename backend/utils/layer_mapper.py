import json
from collections import Counter
from pathlib import Path

_DEFAULT_DATA_DIR = Path(__file__).resolve().parent.parent / "data"

_UNKNOWN = {
    "code": "",
    "name": "미분류",
    "category_major": "",
    "category_major_name": "미분류",
    "category_mid": "미분류",
    "default_color": "#888888",
    "official_color": "#888888",
    "linetype": "Continuous",
    "structure": "",
    "is_mapped": False,
}


class LayerMapper:
    def __init__(self, data_dir: str | None = None):
        base = Path(data_dir) if data_dir else _DEFAULT_DATA_DIR
        with open(base / "layer_codes.json", encoding="utf-8") as f:
            self._codes: dict[str, dict] = json.load(f)
        with open(base / "category_colors.json", encoding="utf-8") as f:
            self._categories: dict[str, dict] = json.load(f)

    def get_layer_info(self, layer_code: str | None) -> dict:
        if not layer_code:
            return {**_UNKNOWN}

        code = layer_code.strip().upper()
        if not code:
            return {**_UNKNOWN}

        # 1. Exact match
        if code in self._codes:
            return {**self._codes[code], "is_mapped": True}

        # 2. Prefix match — 7 chars then 4 chars
        for length in (7, 4):
            if len(code) >= length:
                prefix = code[:length]
                for value in self._codes.values():
                    if value["code"].startswith(prefix):
                        return {
                            **value,
                            "code": code,
                            "name": value["category_mid"],
                            "is_mapped": False,
                        }

        # 3. Category fallback — first letter
        first = code[0]
        if first in self._categories:
            cat = self._categories[first]
            return {
                "code": code,
                "name": cat["name"],
                "category_major": first,
                "category_major_name": cat["name"],
                "category_mid": cat["name"],
                "default_color": cat["color"],
                "official_color": cat["color"],
                "linetype": "Continuous",
                "structure": "",
                "is_mapped": False,
            }

        # 4. Unknown
        return {**_UNKNOWN, "code": code}

    def get_all_categories(self) -> list[dict]:
        counts = Counter(v["category_major"] for v in self._codes.values())
        return [
            {"code": k, "name": v["name"], "color": v["color"], "count": counts.get(k, 0)}
            for k, v in self._categories.items()
        ]

    def get_layers_by_category(self, category_letter: str) -> list[dict]:
        cat = category_letter.strip().upper()
        return [v for v in self._codes.values() if v["category_major"] == cat]

    def get_default_color(self, layer_code: str) -> str:
        return self.get_layer_info(layer_code)["default_color"]

    def get_stats(self) -> dict:
        counts = Counter(v["category_major"] for v in self._codes.values())
        return {"total": len(self._codes), "by_category": dict(sorted(counts.items()))}
