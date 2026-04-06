"""Tests for ACI color utilities."""

from utils.color_utils import (
    CATEGORY_ACI_COLORS,
    get_default_aci,
    rgb_to_hex,
)


class TestGetDefaultAci:
    def test_traffic_category(self):
        info = {"category_major": "A", "category_mid": "도로경계"}
        assert get_default_aci(info) == 1  # Red

    def test_building_category(self):
        info = {"category_major": "B", "category_mid": "건물"}
        assert get_default_aci(info) == 2  # Yellow

    def test_water_category(self):
        info = {"category_major": "E", "category_mid": "하천"}
        assert get_default_aci(info) == 5  # Blue

    def test_subcategory_override_road_centerline(self):
        info = {"category_major": "A", "category_mid": "도로중심선"}
        assert get_default_aci(info) == 6  # Magenta

    def test_subcategory_override_river_centerline(self):
        info = {"category_major": "E", "category_mid": "하천중심선"}
        assert get_default_aci(info) == 150  # Sky blue

    def test_unknown_category(self):
        info = {"category_major": "Z", "category_mid": ""}
        assert get_default_aci(info) == 7  # White default

    def test_empty_info(self):
        assert get_default_aci({}) == 7


class TestCategoryAciColors:
    def test_all_categories_present(self):
        for letter in "ABCDEFGH":
            assert letter in CATEGORY_ACI_COLORS


class TestRgbToHex:
    def test_red(self):
        assert rgb_to_hex(255, 0, 0) == "#ff0000"

    def test_white(self):
        assert rgb_to_hex(255, 255, 255) == "#ffffff"

    def test_black(self):
        assert rgb_to_hex(0, 0, 0) == "#000000"
