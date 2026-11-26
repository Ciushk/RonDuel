"""Generate quarter-turn rotations of the directional RonTown shore tiles.
Usage: python3 gen_terrain_rotations.py <rontown_public_dir> <out_dir>
Only the 128x64 top-face diamond is rotated in grid space. Each front-wall column is then taken
from basic-block.png (grass edge) or basic-block-wather.png (water edge), matching the new face edge.
Output: <name>-r1.png, -r2.png, -r3.png  (rN = N quarter turns; the 4 iso orientations)
"""
import sys, os
from PIL import Image
src, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
L = lambda n: Image.open(os.path.join(src, n)).convert('RGBA')
GRASS, WATER = L('basic-block.png'), L('basic-block-wather.png')
SHORE = ['basic-block-wather-grass-50-50.png', 'basic-block-water-grass-20-80.png',
         'basic-block-water-grass-80-20.png']

def uv(sx, sy):
    a = (sx - 64) / 64.0; b = sy / 32.0
    return (a + b) / 2, (b - a) / 2

def st(u, v):
    return int(round(64 + (u - v) * 64)), int(round((u + v) * 32))

def is_water(p):
    return p[2] > p[1] + 20 and p[2] > p[0] + 20

def rotate(img, k):
    res = img.copy()
    for sy in range(0, 65):
        for sx in range(128):
            u, v = uv(sx + 0.5, sy + 0.5)
            if not (0.03 < u < 1.02 and 0.03 < v < 1.02):
                continue  # keep the back-rim outline
            su, sv = u, v
            for _ in range(k):
                su, sv = sv, 1 - su
            su, sv = min(max(su, 0.04), 0.96), min(max(sv, 0.04), 0.96)
            px, py = st(su, sv)
            p = img.getpixel((min(max(px, 0), 127), min(max(py, 0), 63)))
            if p[3] > 0 and img.getpixel((sx, sy))[3] > 0:
                res.putpixel((sx, sy), p)
    for sx in range(128):
        # face pixel ~3px above the front edge in this column
        edge_y = int(64 - abs(sx - 64) / 2) - 3
        mat = WATER if is_water(res.getpixel((sx, max(edge_y, 0)))) else GRASS
        for sy in range(edge_y + 3, 76):
            u, v = uv(sx + 0.5, sy + 0.5)
            if u < 1.0 and v < 1.0:
                continue
            res.putpixel((sx, sy), mat.getpixel((sx, sy)))
    return res

for name in SHORE:
    im = L(name)
    for k in (1, 2, 3):
        o = name.replace('.png', f'-r{k}.png')
        rotate(im, k).save(os.path.join(out, o)); print('wrote', o)
