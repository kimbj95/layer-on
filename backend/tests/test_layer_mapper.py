import pytest

from utils.layer_mapper import LayerMapper


@pytest.fixture
def mapper():
    return LayerMapper()


class TestExactMatch:
    def test_highway(self, mapper):
        info = mapper.get_layer_info("A0013111")
        assert "고속국도" in info["name"]
        assert info["category_major"] == "A"
        assert info["category_major_name"] == "교통"
        assert info["default_color"] == "#FF6B6B"
        assert info["is_mapped"] is True

    def test_building(self, mapper):
        info = mapper.get_layer_info("B0014110")
        assert info["category_major"] == "B"
        assert info["category_major_name"] == "건물"
        assert info["is_mapped"] is True


class TestPrefixFallback:
    def test_unknown_road_variant(self, mapper):
        info = mapper.get_layer_info("A0013199")
        assert info["is_mapped"] is False
        assert info["category_major"] == "A"
        assert info["category_major_name"] == "교통"
        assert info["default_color"] == "#FF6B6B"


class TestCategoryFallback:
    def test_unknown_facility_code(self, mapper):
        info = mapper.get_layer_info("C9999999")
        assert info["is_mapped"] is False
        assert info["category_major"] == "C"
        assert info["category_major_name"] == "시설"
        assert info["default_color"] == "#00CEC9"


class TestUnknown:
    def test_unknown_letter(self, mapper):
        info = mapper.get_layer_info("Z0000000")
        assert info["is_mapped"] is False
        assert info["name"] == "미분류"
        assert info["default_color"] == "#888888"

    def test_empty_string(self, mapper):
        info = mapper.get_layer_info("")
        assert info["is_mapped"] is False
        assert info["name"] == "미분류"

    def test_none(self, mapper):
        info = mapper.get_layer_info(None)
        assert info["is_mapped"] is False
        assert info["name"] == "미분류"


class TestUtilityMethods:
    def test_get_all_categories(self, mapper):
        cats = mapper.get_all_categories()
        assert len(cats) == 8
        codes = [c["code"] for c in cats]
        for letter in "ABCDEFGH":
            assert letter in codes
        for c in cats:
            assert "count" in c
            assert c["count"] > 0

    def test_get_stats(self, mapper):
        stats = mapper.get_stats()
        assert stats["total"] == 680
        assert len(stats["by_category"]) == 8
        assert sum(stats["by_category"].values()) == 680

    def test_get_layers_by_category(self, mapper):
        buildings = mapper.get_layers_by_category("B")
        assert len(buildings) == 145
        names = [b["name"] for b in buildings]
        assert any("건물" in n for n in names)

    def test_get_default_color(self, mapper):
        assert mapper.get_default_color("A0013111") == "#FF6B6B"
        assert mapper.get_default_color("Z0000000") == "#888888"


class TestColorRefinements:
    def test_water_centerline(self, mapper):
        info = mapper.get_layer_info("E0022110")
        assert info["default_color"] == "#85C1FF"
        assert info["category_major"] == "E"

    def test_terrain_layer(self, mapper):
        info = mapper.get_layer_info("F0017111")
        assert "주곡선" in info["name"]
        assert info["default_color"] == "#E17055"

    def test_official_color_preserved(self, mapper):
        info = mapper.get_layer_info("A0013111")
        assert info["official_color"] == "#ff0000"
