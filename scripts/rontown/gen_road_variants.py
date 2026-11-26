"""Generate the missing RonTown road auto-tile sprites from the existing art.
Usage: python3 gen_road_variants.py <rontown_public_dir> <out_dir>
Top face of every 128x76 block is a 128x64 2:1 diamond: screen (sx,sy) <-> grid (u,v) in [0,1]^2
  sx = 64 + (u - v) * 64 ; sy = (u + v) * 32.   u grows toward E (x+1), v grows toward S (y+1).
"""
import sys, os
from PIL import Image
src, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
L = lambda n: Image.open(os.path.join(src, n)).convert('RGBA')
grass, street, curve, cross = L('basic-block.png'), L('basic-block-street.png'), L('basic-block-street-curve.png'), L('basic-block-intersection.png')

def uv(sx, sy):
    a = (sx - 64) / 64.0  # u - v
    b = sy / 32.0         # u + v
    return (a + b) / 2, (b - a) / 2

def st(u, v):
    return int(round(64 + (u - v) * 64)), int(round((u + v) * 32))

def inside(u, v, m=-0.02):  # face incl. its 1px rim; walls (u or v > 1.02) stay untouched
    return m < u < 1 - m and m < v < 1 - m

def rotate_face(img, k):
    """Rotate only the top face by k*90deg in grid space (E->N->W->S), keep walls."""
    res = grass.copy()  # rim + walls from plain grass; walls fixed later by fix_walls
    for sy in range(0, 65):
        for sx in range(128):
            u, v = uv(sx + 0.5, sy + 0.5)
            if not (0.03 < u < 1.02 and 0.03 < v < 1.02):  # keep back rim outline, redo front rim
                continue
            su, sv = u, v
            for _ in range(k):  # inverse of (u,v)->(v,1-u)  is  (u,v)->(1-v,u)
                su, sv = 1 - sv, su
            su, sv = min(max(su, 0.04), 0.96), min(max(sv, 0.04), 0.96)  # never sample the outline
            px, py = st(su, sv)
            px, py = min(max(px, 0), 127), min(max(py, 0), 64)
            p = img.getpixel((px, py))
            if p[3] > 0 and img.getpixel((sx, sy))[3] > 0:
                res.putpixel((sx, sy), p)
    return res

ARM = 0.30  # arms of the cross sprite live outside the 0.30..0.70 centre band
def keep_arms(arms):
    res = cross.copy()
    for sy in range(0, 65):
        for sx in range(128):
            u, v = uv(sx + 0.5, sy + 0.5)
            if not inside(u, v):
                continue
            drop = (('N' not in arms and v < ARM) or ('S' not in arms and v > 1 - ARM) or
                    ('W' not in arms and u < ARM) or ('E' not in arms and u > 1 - ARM))
            if drop and grass.getpixel((sx, sy))[3] > 0:
                res.putpixel((sx, sy), grass.getpixel((sx, sy)))
    return res

def fix_walls(img, arms):
    """Front walls: copy the road-notched wall from the cross sprite only under S/E arms."""
    res = img.copy()
    for sy in range(28, 76):
        for sx in range(128):
            if grass.getpixel((sx, sy))[3] == 0:
                continue
            u, v = uv(sx + 0.5, sy + 0.5)
            if inside(u, v):
                continue
            side = 'E' if sx >= 64 else 'S'
            res.putpixel((sx, sy), (cross if side in arms else grass).getpixel((sx, sy)))
    return res

outputs = {
    'basic-block-street-curve-nw.png': fix_walls(rotate_face(curve, 1), 'NW'),   # N+E rotated -> N+W
    'basic-block-street-curve-se.png': fix_walls(rotate_face(curve, 3), 'SE'),   # N+E rotated -> S+E
    'basic-block-street-t-nes.png': fix_walls(keep_arms('NES'), 'NES'),
    'basic-block-street-t-esw.png': fix_walls(keep_arms('ESW'), 'ESW'),
    'basic-block-street-t-nsw.png': fix_walls(keep_arms('NSW'), 'NSW'),
    'basic-block-street-t-new.png': fix_walls(keep_arms('NEW'), 'NEW'),
    'basic-block-street-end-n.png': fix_walls(keep_arms('N'), 'N'),
    'basic-block-street-end-e.png': fix_walls(keep_arms('E'), 'E'),
    'basic-block-street-end-s.png': fix_walls(keep_arms('S'), 'S'),
    'basic-block-street-end-w.png': fix_walls(keep_arms('W'), 'W'),
}
for n, im in outputs.items():
    im.save(os.path.join(out, n))
    print('wrote', n, im.size)
