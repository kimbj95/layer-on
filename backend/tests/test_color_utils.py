from utils.color_utils import hex_to_rgb, rgb_to_hex


class TestHexToRgb:
    def test_red_tone(self):
        assert hex_to_rgb("#FF6B6B") == (255, 107, 107)

    def test_black(self):
        assert hex_to_rgb("#000000") == (0, 0, 0)

    def test_white(self):
        assert hex_to_rgb("#FFFFFF") == (255, 255, 255)

    def test_lowercase(self):
        assert hex_to_rgb("#ff6b6b") == (255, 107, 107)

    def test_no_hash(self):
        assert hex_to_rgb("FF6B6B") == (255, 107, 107)


class TestRgbToHex:
    def test_red_tone(self):
        assert rgb_to_hex(255, 107, 107) == "#ff6b6b"

    def test_black(self):
        assert rgb_to_hex(0, 0, 0) == "#000000"

    def test_white(self):
        assert rgb_to_hex(255, 255, 255) == "#ffffff"


class TestRoundTrip:
    def test_hex_rgb_hex(self):
        original = "#ff6b6b"
        r, g, b = hex_to_rgb(original)
        assert rgb_to_hex(r, g, b) == original

    def test_rgb_hex_rgb(self):
        r, g, b = 100, 200, 50
        hex_val = rgb_to_hex(r, g, b)
        assert hex_to_rgb(hex_val) == (r, g, b)
