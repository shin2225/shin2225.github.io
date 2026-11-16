"""夜の街並みのドット絵を生成するスクリプト。

  python3 tools/gen_city.py            # assets/city/ に PNG を書き出す
  python3 tools/gen_city.py --seed 7   # 街並みを別の形にする

書き出すもの (すべて横方向にシームレスにつながるタイル):
  city_far.png       遠景のビル群
  city_near.png      近景のビル群 + 歩道 + 街灯
  city_blink_a.png   アンテナの赤いランプ (CSSで点滅)
  city_blink_b.png   ときどき点く窓 (CSSで点滅)
"""
import argparse
import os
import random

from PIL import Image

W = 384          # タイル幅(px)。CSS側でこの幅ごとに繰り返す
NEAR_H = 120
FAR_H = 100

# ---- パレット (トップページの夜空 #070b1f〜#1d2752 に合わせる) ----
FAR_BODY = (25, 32, 76)
FAR_RIM = (37, 47, 102)
FAR_WIN = [(150, 136, 110), (120, 128, 170)]

NEAR_BODIES = [(14, 19, 48), (17, 23, 57), (12, 16, 42), (19, 24, 60)]
NEAR_RIM = (40, 51, 108)
NEAR_SHADE = (9, 12, 32)
WIN_WARM = [(243, 210, 122), (233, 183, 90), (255, 228, 160)]
WIN_COOL = [(159, 180, 255), (190, 205, 255)]
WIN_OFF = (27, 34, 76)

SIDEWALK = (36, 42, 86)
SIDEWALK_DARK = (24, 29, 64)
GROUND = (11, 14, 36)      # = CSS の --ground (#0b0e24)
POLE = (44, 50, 92)
LAMP = (255, 232, 168)
RED = (255, 84, 84)


class Tile:
    """x を W で折り返して描くキャンバス(横にシームレスになる)"""

    def __init__(self, h):
        self.h = h
        self.img = Image.new("RGBA", (W, h), (0, 0, 0, 0))
        self.px = self.img.load()

    def put(self, x, y, c, a=255):
        if 0 <= y < self.h:
            self.px[x % W, y] = (*c, a)

    def get_alpha(self, x, y):
        return self.px[x % W, y][3]

    def blend(self, x, y, c, a):
        """既存の色に c を不透明度 a/255 で重ねる (透明なところはそのまま半透明で置く)"""
        if not 0 <= y < self.h:
            return
        r, g, b, al = self.px[x % W, y]
        if al == 0:
            self.px[x % W, y] = (*c, a)
            return
        k = a / 255
        self.px[x % W, y] = (round(r + (c[0] - r) * k), round(g + (c[1] - g) * k),
                             round(b + (c[2] - b) * k), al)

    def rect(self, x, y, w, h, c, a=255):
        for yy in range(y, y + h):
            for xx in range(x, x + w):
                self.put(xx, yy, c, a)


def far_layer(rng):
    t = Tile(FAR_H)
    x = 0
    tower_at = rng.randrange(60, W - 60)
    while x < W:
        w = rng.randint(8, 22)
        h = rng.randint(28, 78)
        top = FAR_H - h
        t.rect(x, top, w, h, FAR_BODY)
        t.rect(x, top, w, 1, FAR_RIM)
        # 段々の屋上
        if rng.random() < 0.35 and w > 10:
            sw = w // 2
            sh = rng.randint(4, 10)
            sx = x + rng.randint(1, w - sw - 1)
            t.rect(sx, top - sh, sw, sh, FAR_BODY)
            t.rect(sx, top - sh, sw, 1, FAR_RIM)
        # 小さな窓 (1px)
        for yy in range(top + 3, FAR_H - 2, 3):
            for xx in range(x + 2, x + w - 1, 2):
                if rng.random() < 0.10:
                    t.put(xx, yy, rng.choice(FAR_WIN))
        x += w + rng.randint(-2, 1)

    # 電波塔
    tx = tower_at
    base = FAR_H - 1
    top = 6
    for y in range(top + 10, base):
        spread = (y - top) // 14
        t.put(tx - spread, y, FAR_RIM)
        t.put(tx + 1 + spread, y, FAR_RIM)
        if (y - top) % 6 == 0:
            for xx in range(tx - spread, tx + 2 + spread):
                t.put(xx, y, FAR_RIM)
    t.rect(tx - 3, top + 14, 8, 3, FAR_BODY)
    t.rect(tx - 3, top + 14, 8, 1, FAR_RIM)
    t.rect(tx, top, 2, 14, FAR_RIM)
    return t, (tx, top)


def near_layer(rng):
    t = Tile(NEAR_H)
    blink_a = Tile(NEAR_H)   # 赤ランプ
    blink_b = Tile(NEAR_H)   # ときどき点く窓
    street_top = NEAR_H - 10

    x = 0
    while x < W:
        w = rng.randint(13, 30)
        h = rng.randint(34, 92)
        top = street_top - h
        body = rng.choice(NEAR_BODIES)
        t.rect(x, top, w, h, body)
        # 右側2列に影、上辺に月明かりのふち
        t.rect(x + w - 2, top, 2, h, NEAR_SHADE)
        t.rect(x, top, w - 2, 1, NEAR_RIM)

        # 窓
        style = rng.choice(["grid", "grid", "narrow", "floors"])
        lit = rng.uniform(0.18, 0.5)
        warm = rng.random() < 0.8
        palette = WIN_WARM if warm else WIN_COOL
        if style == "floors":
            for yy in range(top + 4, street_top - 3, 4):
                on = rng.random() < lit + 0.15
                c = rng.choice(palette) if on else WIN_OFF
                t.rect(x + 2, yy, w - 5, 1, c)
        else:
            ww = 2 if style == "grid" else 1
            step = ww + 1 if style == "grid" else 2
            for yy in range(top + 4, street_top - 4, 4):
                for xx in range(x + 2, x + w - 3 - ww + 1, step):
                    r = rng.random()
                    if r < lit:
                        t.rect(xx, yy, ww, 2, rng.choice(palette))
                    else:
                        t.rect(xx, yy, ww, 2, WIN_OFF)
                        if r > 0.985:
                            blink_b.rect(xx, yy, ww, 2, rng.choice(WIN_WARM))

        # 屋上の飾り
        roof = rng.random()
        if roof < 0.28:          # アンテナ + 赤ランプ
            ax = x + rng.randint(2, w - 4)
            ah = rng.randint(5, 10)
            t.rect(ax, top - ah, 1, ah, NEAR_RIM)
            blink_a.put(ax, top - ah - 1, RED)
            blink_a.put(ax - 1, top - ah - 1, RED, 110)
            blink_a.put(ax + 1, top - ah - 1, RED, 110)
        elif roof < 0.48:        # 給水タンク
            tx = x + rng.randint(1, max(1, w - 8))
            t.rect(tx, top - 6, 6, 4, body)
            t.rect(tx, top - 6, 6, 1, NEAR_RIM)
            t.put(tx + 1, top - 2, NEAR_RIM)
            t.put(tx + 4, top - 2, NEAR_RIM)
            t.put(tx + 1, top - 1, NEAR_RIM)
            t.put(tx + 4, top - 1, NEAR_RIM)
        elif roof < 0.62 and w > 16:   # 段々の屋上
            sw = w // 2
            sx = x + rng.randint(1, w - sw - 2)
            sh = rng.randint(5, 12)
            t.rect(sx, top - sh, sw, sh, body)
            t.rect(sx + sw - 1, top - sh, 1, sh, NEAR_SHADE)
            t.rect(sx, top - sh, sw - 1, 1, NEAR_RIM)
        x += w + rng.randint(0, 3)

    # 歩道と地面
    t.rect(0, street_top, W, 1, SIDEWALK)
    t.rect(0, street_top + 1, W, 2, SIDEWALK_DARK)
    for xx in range(0, W, 8):
        t.put(xx, street_top + 1, SIDEWALK)
    t.rect(0, street_top + 3, W, NEAR_H - street_top - 3, GROUND)

    # 街灯 (光のにじみはディザで表現)
    for lx in range(24, W, 64):
        top = street_top - 20
        t.rect(lx, top, 1, 20, POLE)
        t.rect(lx, top, 4, 1, POLE)
        t.rect(lx + 3, top + 1, 2, 1, LAMP)
        # ランプのまわりの小さなにじみ
        for dx, dy, al in [(-1, 0, 90), (2, 0, 90), (0, 1, 120), (1, 1, 120),
                           (0, -1, 70), (1, -1, 70), (-1, 1, 60), (2, 1, 60),
                           (0, 2, 50), (1, 2, 50)]:
            t.blend(lx + 3 + dx, top + 1 + dy, LAMP, al)
        # 足元の光だまり
        for dx in range(-6, 8):
            t.blend(lx + 4 + dx, street_top, LAMP, max(30, 150 - abs(dx - 1) * 18))
            if dx % 2 == 0:
                t.blend(lx + 4 + dx, street_top + 1, LAMP, max(20, 90 - abs(dx - 1) * 14))
    return t, blink_a, blink_b


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--seed", type=int, default=2225)
    ap.add_argument("--out", default=os.path.join(os.path.dirname(__file__), "..", "assets", "city"))
    args = ap.parse_args()
    rng = random.Random(args.seed)
    os.makedirs(args.out, exist_ok=True)

    far, (tx, ty) = far_layer(rng)
    near, blink_a, blink_b = near_layer(rng)
    # 電波塔のてっぺんにも赤ランプ (遠景用の点滅は近景レイヤーに描くと位置がずれるので遠景に直接)
    far.put(tx, ty - 1, RED)
    far.put(tx + 1, ty - 1, RED)

    far.img.save(os.path.join(args.out, "city_far.png"))
    near.img.save(os.path.join(args.out, "city_near.png"))
    blink_a.img.save(os.path.join(args.out, "city_blink_a.png"))
    blink_b.img.save(os.path.join(args.out, "city_blink_b.png"))
    print("written to", os.path.abspath(args.out))


if __name__ == "__main__":
    main()
