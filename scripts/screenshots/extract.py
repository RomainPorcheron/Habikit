"""Reconstruit les jours cochés de HabitKit à partir de captures d'écran de la grille."""
import json, sys, datetime as dt
import numpy as np
from PIL import Image

import os
# Dossier des captures (1080 px de large, HabitKit Android, détail d'une habitude) + shots.json :
#   { "today": "2026-09-07", "shots": [ ["fichier-sans-.png", "Sport", [2026, 4]], ... ] }
# Le mois est celui du premier libellé visible en haut de la grille (lu à l'œil).
DIR = os.environ.get('SHOTS_DIR', '.')
CONF = __import__('json').load(open(os.path.join(DIR, 'shots.json')))
U = DIR.rstrip('/') + '/'
TODAY = dt.date.fromisoformat(CONF['today'])
SHOTS = [(f, n, tuple(m)) for f, n, m in CONF['shots']]
SC = 1.2  # les captures font 1080 px de large, mes repères sont en base 900
R = lambda v: int(round(v * SC))
CELL_Y0, CELL_Y1, CELL_X0, CELL_X1 = R(480), R(676), R(120), R(845)
LAB_Y0, LAB_Y1 = R(452), R(480)

def sat(a):
    a = a.astype(float); return (a.max(-1) - a.min(-1)) / 255

def autopitch(p, lo=30, hi=40):
    p = p - p.mean()
    ac = lambda l: (p[:-l] * p[l:]).sum() / (len(p) - l)
    lag = max(range(lo, hi + 1), key=ac)
    if lo < lag < hi:
        y0, y1, y2 = ac(lag - 1), ac(lag), ac(lag + 1)
        den = y0 - 2 * y1 + y2
        return lag + ((y0 - y2) / (2 * den) if den else 0)
    return float(lag)

def phase(p, pitch):
    best = None
    for o in np.arange(0, pitch, 0.25):
        idx = np.round(o + np.arange(0, len(p) + pitch, pitch)).astype(int); idx = idx[idx < len(p)]
        sc = p[idx].sum()
        if best is None or sc > best[1]: best = (o, sc)
    return best[0]

def first_monday(y, m):
    d = dt.date(y, m, 1)
    return d + dt.timedelta(days=(7 - d.weekday()) % 7)

def analyse(fid, first_label_month):
    im = np.array(Image.open(U + fid + '.png').convert('RGB'))
    reg = im[CELL_Y0:CELL_Y1, CELL_X0:CELL_X1]; s = sat(reg)
    px, py = s.mean(0), s.mean(1)
    pitch_x, pitch_y = autopitch(px), autopitch(py)
    ox, oy = phase(px, pitch_x) + CELL_X0, phase(py, pitch_y) + CELL_Y0
    cols = [ox + k * pitch_x for k in range(-1, 40) if CELL_X0 - 4 <= ox + k * pitch_x <= CELL_X1]
    rows = [oy + k * pitch_y for k in range(-1, 12) if CELL_Y0 <= oy + k * pitch_y <= CELL_Y1]
    # libellés de mois : texte gris sur la ligne au-dessus des cases
    lab = im[LAB_Y0:LAB_Y1, CELL_X0:CELL_X1].astype(float)
    dark = ((lab.mean(-1) < 200) & (sat(lab) < 0.25)).any(0)
    runs, x = [], 0
    while x < len(dark):
        if dark[x]:
            st = x
            while x < len(dark) and dark[x:x + 12].any(): x += 1
            runs.append((st + CELL_X0, x + CELL_X0))
        else: x += 1
    runs = [r for r in runs if r[1] - r[0] > 15]
    # libellé = bord gauche d'une colonne
    label_cols = [int(np.argmin([abs((c - pitch_x / 2) - r[0]) for c in cols])) for r in runs]
    # cohérence : écarts entre libellés = écarts entre premiers lundis des mois successifs
    y, m = first_label_month
    months = []
    for i in range(len(runs)):
        months.append((y, m)); m += 1
        if m == 13: y, m = y + 1, 1
    expected = [(first_monday(*months[i]) - first_monday(*months[0])).days // 7 for i in range(len(months))]
    observed = [c - label_cols[0] for c in label_cols]
    ok = expected == observed
    col0_monday = first_monday(*months[0]) - dt.timedelta(weeks=label_cols[0])
    # remplissage des cases
    h = max(3, int(pitch_x * 0.25))
    cells = {}
    for ci, cx in enumerate(cols):
        for ri, cy in enumerate(rows[:7]):
            patch = im[int(cy) - h:int(cy) + h, int(cx) - h:int(cx) + h]
            cells[(ci, ri)] = float(sat(patch).mean())
    fade_cols = {ci for ci, cx in enumerate(cols) if cx < CELL_X0 + 1.2 * pitch_x or cx > CELL_X1 - 2.2 * pitch_x}
    return dict(fid=fid, pitch=(pitch_x, pitch_y), cols=cols, rows=rows[:7], runs=runs, label_cols=label_cols,
                months=months, ok=ok, expected=expected, observed=observed, col0_monday=col0_monday,
                cells=cells, fade_cols=fade_cols)

if __name__ == '__main__':
    for fid, name, month in SHOTS:
        a = analyse(fid, month)
        print(fid, name, 'pitch', [round(p, 2) for p in a['pitch']], 'ncols', len(a['cols']), 'nrows', len(a['rows']),
              'cols', [round(c) for c in a['cols'][:3]], '…', round(a['cols'][-1]), 'rows', [round(r) for r in a['rows']])
        print('   labels', a['runs'], '→ cols', a['label_cols'], 'coherent', a['ok'], a['expected'], a['observed'], 'col0 =', a['col0_monday'])
        vals = sorted(a['cells'].values()); print('   sat quantiles', [round(np.quantile(vals, q), 2) for q in (0, .25, .5, .75, .9, 1)])
        print('   fade cols', sorted(a['fade_cols']))
