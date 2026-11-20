"""Turn the Spoaxio logo JPG into transparent PNG icons.

- The white area outside the rounded square becomes transparent (flood fill from the border,
  so the white "S" and text inside the badge are untouched).
- Pixels on the edge are un-blended from white so the outline stays smooth (no white halo).
- Small sizes (16/24/32) use just the "S" mark, because the full badge text is unreadable there.
"""
import sys
from collections import deque
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

src, out_dir = Path(sys.argv[1]), Path(sys.argv[2])
out_dir.mkdir(parents=True, exist_ok=True)

im = Image.open(src).convert("RGB")
W, H = im.size
px = im.load()

# 1. Flood fill the outside white (near-white, connected to the image border).
bg = bytearray(W * H)
q = deque()
def near_white(x, y):
    r, g, b = px[x, y]
    return min(r, g, b) >= 200
for x in range(W):
    for y in (0, H - 1):
        q.append((x, y))
for y in range(H):
    for x in (0, W - 1):
        q.append((x, y))
while q:
    x, y = q.popleft()
    i = y * W + x
    if bg[i] or not near_white(x, y):
        continue
    bg[i] = 1
    if x > 0: q.append((x - 1, y))
    if x < W - 1: q.append((x + 1, y))
    if y > 0: q.append((x, y - 1))
    if y < H - 1: q.append((x, y + 1))

# 2. Build RGBA: background -> transparent; a 3px band next to it -> "colour to alpha" from white.
out = Image.new("RGBA", (W, H))
op = out.load()
band = Image.frombytes("L", (W, H), bytes(255 if b else 0 for b in bg)).filter(ImageFilter.MaxFilter(7)).load()
for y in range(H):
    for x in range(W):
        r, g, b = px[x, y]
        if bg[y * W + x]:
            op[x, y] = (0, 0, 0, 0)
        elif band[x, y]:
            a = max(255 - r, 255 - g, 255 - b) / 255  # how far from white
            if a <= 0.02:
                op[x, y] = (0, 0, 0, 0)
            else:
                un = lambda c: max(0, min(255, round((c - (1 - a) * 255) / a)))
                op[x, y] = (un(r), un(g), un(b), round(a * 255))
        else:
            op[x, y] = (r, g, b, 255)

# 3. Crop to the badge and make it square.
bbox = out.getchannel("A").point(lambda v: 255 if v > 10 else 0).getbbox()
badge = out.crop(bbox)
side = max(badge.size)
sq = Image.new("RGBA", (side, side), (0, 0, 0, 0))
sq.paste(badge, ((side - badge.width) // 2, (side - badge.height) // 2))
sq.save(out_dir / "spoaxio-logo.png", optimize=True)
print("badge bbox", bbox, "->", sq.size)

for s in (48, 64, 128, 256, 512):
    sq.resize((s, s), Image.LANCZOS).save(out_dir / f"spoaxio-{s}.png", optimize=True)

# 4. Small "S" mark for 16/24/32 px: the S cut from the badge, on a navy rounded square.
ox, oy = bbox[0], bbox[1]
s_box = (310 - ox, 245 - oy, 1040 - ox, 735 - oy)  # the S + pixel squares, in badge coordinates
mark = badge.crop(s_box)
M = 512
tile = Image.new("RGBA", (M, M), (0, 0, 0, 0))
d = ImageDraw.Draw(tile)
# fill with the average colour around the S so the pasted crop blends in without a seam
edge = [mark.getpixel((x, y)) for x in range(0, mark.width, 4) for y in (2, mark.height - 3)] +        [mark.getpixel((x, y)) for y in range(0, mark.height, 4) for x in (2, mark.width - 3)]
fill = tuple(sum(c[i] for c in edge) // len(edge) for i in range(3)) + (255,)
print("tile fill", fill)
d.rounded_rectangle((0, 0, M - 1, M - 1), radius=int(M * 0.22), fill=fill, outline=(20, 110, 255, 255), width=int(M * 0.035))
inner = int(M * 0.80)
scale = inner / max(mark.size)
mark_r = mark.resize((round(mark.width * scale), round(mark.height * scale)), Image.LANCZOS)
# feather the crop edges so its own dark background melts into the tile
fm = Image.new("L", mark_r.size, 0)
ImageDraw.Draw(fm).rounded_rectangle((26, 26, mark_r.width - 27, mark_r.height - 27), radius=40, fill=255)
fm = fm.filter(ImageFilter.GaussianBlur(22))
tile.paste(mark_r, ((M - mark_r.width) // 2, (M - mark_r.height) // 2), fm)
clip = Image.new("L", (M, M), 0)
ImageDraw.Draw(clip).rounded_rectangle((0, 0, M - 1, M - 1), radius=int(M * 0.22), fill=255)
tile.putalpha(Image.composite(tile.getchannel("A"), clip, clip))
tile.save(out_dir / "spoaxio-mark-512.png", optimize=True)
for s in (16, 24, 32):
    tile.resize((s, s), Image.LANCZOS).save(out_dir / f"spoaxio-{s}.png", optimize=True)
print("ok")
