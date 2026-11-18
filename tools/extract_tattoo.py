"""Aísla el diseño de un tattoo a partir de una foto recortada.

Uso:  python3 tools/extract_tattoo.py recorte.jpg <id>
Genera:
  assets/markers/<id>.jpg          marcador AR (tinta real sobre piel uniforme)
  assets/markers/<id>-design.png   diseño aislado (PNG transparente)
  assets/effects/<id>.json         contornos + puntos clave para el efecto 3D
Requiere: pip install opencv-python-headless numpy
"""
import json, sys
import cv2
import numpy as np

src, tid = sys.argv[1], sys.argv[2]
im = cv2.imread(src)
h, w = im.shape[:2]

# 1) Puntuación de "tinta": más oscuro y más rojizo que la piel de alrededor
lab = cv2.cvtColor(im, cv2.COLOR_BGR2LAB).astype(np.float32)
L, A = lab[..., 0], lab[..., 1]
def local_bg(ch):
    return cv2.GaussianBlur(cv2.medianBlur(ch.astype(np.uint8), 101).astype(np.float32), (0, 0), 40)
score = np.clip(local_bg(L) - L, 0, 255) + 1.5 * np.clip(A - local_bg(A), 0, 255)
score = cv2.GaussianBlur(score, (0, 0), 2.5)

# 2) Umbral con histéresis + limpieza de pelos y bordes
low = (score > 17).astype(np.uint8)
high = (score > 32).astype(np.uint8)
low = cv2.morphologyEx(low, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7)))
n, lbl, st, _ = cv2.connectedComponentsWithStats(low)
keep = np.zeros(n, bool)
keep[np.unique(lbl[(high > 0) & (low > 0)])] = True
keep[0] = False
mask = np.zeros(low.shape, np.uint8)
for i in range(1, n):
    x, y, ww, hh, a = st[i]
    if not keep[i] or a < 250:
        continue
    if x <= 2 or x + ww >= w - 2:
        continue
    if a < 3000 and (ww > 8 * hh or hh > 8 * ww):  # pelos: finos y alargados
        continue
    mask[lbl == i] = 255
mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (11, 11)))
mask = (cv2.GaussianBlur(mask, (0, 0), 3) > 127).astype(np.uint8) * 255

# 3) Marcador: tinta original sobre piel uniforme (es lo que verá la cámara)
skin = np.median(im[mask == 0], axis=0)
alpha = cv2.GaussianBlur(cv2.dilate(mask, np.ones((5, 5), np.uint8)), (0, 0), 2)[..., None] / 255.0
marker = (im * alpha + skin * (1 - alpha)).astype(np.uint8)
MW = 700
scale = MW / w
marker_s = cv2.resize(marker, (MW, round(h * scale)), interpolation=cv2.INTER_AREA)
cv2.imwrite(f'assets/markers/{tid}.jpg', marker_s, [cv2.IMWRITE_JPEG_QUALITY, 92])

# 4) Diseño aislado en PNG transparente
ink = np.median(im[mask > 0], axis=0)
design = np.zeros((h, w, 4), np.uint8)
design[..., :3] = ink
design[..., 3] = cv2.GaussianBlur(mask, (0, 0), 1)
cv2.imwrite(f'assets/markers/{tid}-design.png', cv2.resize(design, (MW, round(h * scale)), interpolation=cv2.INTER_AREA))

# 5) Contornos vectoriales en coordenadas de MindAR
#    (ancho del marcador = 1, centro = 0,0, eje Y hacia arriba)
def to_ar(pt):
    return [round(pt[0] / w - 0.5, 4), round((h / 2 - pt[1]) / w, 4)]

cnts, hier = cv2.findContours(mask, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_NONE)
shapes = []
for i, c in enumerate(cnts):
    if hier[0][i][3] != -1:  # es un agujero, se añade a su padre
        continue
    outer = cv2.approxPolyDP(c, 2.0, True)[:, 0]
    holes = []
    j = hier[0][i][2]
    while j != -1:
        hole = cv2.approxPolyDP(cnts[j], 2.0, True)[:, 0]
        if len(hole) >= 3 and cv2.contourArea(cnts[j]) > 80:
            holes.append([to_ar(p) for p in hole])
        j = hier[0][j][0]
    x, y, ww, hh = cv2.boundingRect(c)
    shapes.append({
        'outer': [to_ar(p) for p in outer],
        'holes': holes,
        'center': to_ar((x + ww / 2, y + hh / 2)),
        'size': round(max(ww, hh) / w, 4),
        'area': round(cv2.contourArea(c) / (w * w), 6),
    })

# Puntos (círculos pequeños) → partículas del efecto
dots = [s['center'] for s in shapes if s['size'] < 0.05]
data = {'aspect': round(h / w, 4), 'shapes': shapes, 'dots': dots}
json.dump(data, open(f'assets/effects/{tid}.json', 'w'), separators=(',', ':'))
print(f'{len(shapes)} formas, {len(dots)} puntos, aspecto {h / w:.3f}')
