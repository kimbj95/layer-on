# ACI color defaults per major category
CATEGORY_ACI_COLORS = {
    "A": 1,    # 교통 - Red
    "B": 2,    # 건물 - Yellow
    "C": 4,    # 시설 - Cyan
    "D": 3,    # 식생 - Green
    "E": 5,    # 수계 - Blue
    "F": 30,   # 지형 - Orange
    "G": 8,    # 경계 - Gray
    "H": 9,    # 주기 - Light Gray
}

SUBCATEGORY_ACI_OVERRIDES = {
    "도로중심선": 6,     # Magenta
    "철도": 210,         # Violet
    "하천중심선": 150,   # Sky blue
}


def get_default_aci(layer_info: dict) -> int:
    """Get default ACI color for a layer based on its category."""
    mid = layer_info.get("category_mid", "")
    for keyword, aci in SUBCATEGORY_ACI_OVERRIDES.items():
        if keyword in mid:
            return aci
    major = layer_info.get("category_major", "")
    return CATEGORY_ACI_COLORS.get(major, 7)


def rgb_to_hex(r: int, g: int, b: int) -> str:
    return f"#{r:02x}{g:02x}{b:02x}"
