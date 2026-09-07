"""Fusionne les captures analysées par extract.py : JSON Habikit (bouton ⤒), SQL Supabase, HTML de validation.
Usage : SHOTS_DIR=~/captures python3 scripts/screenshots/build.py  (écrit dans le dossier courant)
Les habitudes (icône, couleur, type, objectif) sont décrites dans HABITS ci-dessous.
"""
import json, base64, io, uuid, datetime as dt
from collections import Counter
import numpy as np
from PIL import Image
from extract import SHOTS, analyse, first_monday, TODAY, U, R

FILLED, EMPTY = 0.42, 0.28  # saturation : > FILLED coché, < EMPTY vide, entre = douteux
HABITS = {
    'Sport':  dict(icon='🏋️', color='blue',  kind='build', unit='séances', goal=dict(type='min', value=2, metric='count', period='week'), hk='#3b82f6'),
    'Alcool': dict(icon='🍺', color='red',   kind='quit',  unit='verres',  goal=dict(type='max', value=2, metric='count', period='week'), hk='#ef4444'),
    'Taches': dict(icon='✅', color='yellow', kind='build', unit='tâches',  goal=dict(type='min', value=3, metric='count', period='week'), hk='#eab308'),
}

def shot_days(a):
    """(date → (sat, fade)) pour une capture, en s'appuyant sur le libellé le plus cohérent."""
    diffs = [lc - e for lc, e in zip(a['label_cols'], a['expected'])]
    c0 = Counter(diffs).most_common(1)[0][0]
    col0 = first_monday(*a['months'][0]) - dt.timedelta(weeks=c0)
    a['col0_monday'] = col0
    out = {}
    for (ci, ri), s in a['cells'].items():
        d = col0 + dt.timedelta(weeks=ci, days=ri)
        out[d] = (s, ci in a['fade_cols'])
    return out

def merge(shots):
    days = {}  # date → (sat, fade, fid)
    conflicts = []
    for a in shots:
        for d, (s, fade) in shot_days(a).items():
            if d > TODAY: continue
            prev = days.get(d)
            if prev is None or (prev[1] and not fade):
                if prev is not None and (prev[0] > FILLED) != (s > FILLED) and not prev[1]:
                    conflicts.append((d, prev, (s, fade, a['fid'])))
                days[d] = (s, fade, a['fid'])
            elif not prev[1] and not fade and (prev[0] > FILLED) != (s > FILLED):
                conflicts.append((d, prev, (s, fade, a['fid'])))
    return days, conflicts

def png_b64(im):
    b = io.BytesIO(); im.save(b, 'PNG', optimize=True); return base64.b64encode(b.getvalue()).decode()

results = {}
for name in HABITS:
    shots = [analyse(fid, month) for fid, n, month in SHOTS if n == name]
    if not shots: continue
    days, conflicts = merge(shots)
    checked = sorted(d for d, (s, f, _) in days.items() if s > FILLED)
    doubtful = sorted(d for d, (s, f, _) in days.items() if EMPTY <= s <= FILLED)
    results[name] = dict(shots=shots, days=days, checked=checked, doubtful=doubtful, conflicts=conflicts)
    print(name, 'cochés', len(checked), 'douteux', [(str(d), round(days[d][0], 2)) for d in doubtful], 'conflits', conflicts,
          'plage', min(days), '→', max(days), 'col0', [str(a['col0_monday']) for a in shots])

# ---------------------------------------------------------------- JSON Habikit
NS = uuid.UUID('6f1a2b3c-4d5e-4f60-8a7b-9c0d1e2f3a4b')
habits_json, entries_json, sql_habits, sql_entries = [], [], [], []
for order, (name, cfg) in enumerate((n, c) for n, c in HABITS.items() if n in results):
    hid = str(uuid.uuid5(NS, 'habit:' + name))
    r = results[name]
    created = min(r['checked']) if r['checked'] else TODAY
    habits_json.append(dict(id=hid, name=name, icon=cfg['icon'], color=cfg['color'], kind=cfg['kind'], unit=cfg['unit'], metric='count',
                            fields=[], goal=cfg['goal'], archived=False, order=order, createdAt=f'{created}T00:00:00.000Z'))
    sql_habits.append(f"  ('{hid}', u.id, '{name}', '{cfg['icon']}', '{cfg['color']}', '{cfg['kind']}', '{cfg['unit']}', '{json.dumps(cfg['goal'])}'::jsonb, {order}, '{created}')")
    for d in r['checked']:
        eid = str(uuid.uuid5(NS, f'entry:{name}:{d}'))
        at = f'{d}T12:00:00.000Z'
        entries_json.append(dict(id=eid, habitId=hid, date=str(d), at=at, count=1))
        sql_entries.append(f"  ('{eid}', u.id, '{hid}', '{d}', '{at}', 1)")

json.dump(dict(app='habikit', version=1, exportedAt=dt.datetime.now(dt.timezone.utc).isoformat(), habits=habits_json, entries=entries_json),
          open('habikit-import.json', 'w'), ensure_ascii=False, indent=1)

HV = ',\n'.join(h.replace("u.id, ", "") for h in sql_habits)
EV = ',\n'.join(e.replace("u.id, ", "") for e in sql_entries)
SQL = f"""-- Import Habikit depuis les captures HabitKit ({TODAY}). Idempotent : ids déterministes, on conflict do nothing.
-- Pré-requis : un utilisateur dans auth.users (Authentication → Users → Add user, ou premier magic link).
-- Prend le premier utilisateur créé ; remplacer la sous-requête par un uuid précis si besoin.
with u as (select id from auth.users order by created_at limit 1)
insert into public.habits (id, user_id, name, icon, color, kind, unit, goal, position, created_at)
select v.id, u.id, v.name, v.icon, v.color, v.kind, v.unit, v.goal, v.position, v.created_at from u, (values
{HV}
) as v(id, name, icon, color, kind, unit, goal, position, created_at)
on conflict (id) do nothing;

with u as (select id from auth.users order by created_at limit 1)
insert into public.entries (id, user_id, habit_id, date, at, count)
select v.id, u.id, v.habit_id, v.date, v.at, v.count from u, (values
{EV}
) as v(id, habit_id, date, at, count)
on conflict (id) do nothing;
"""
open('supabase-import.sql', 'w').write(SQL)

# ---------------------------------------------------------------- HTML
def grid_svg(name, start, end, days, cell=16, gap=3, labels=True, fade_marks=True):
    cfg = HABITS[name]; col = cfg['hk']
    start = start - dt.timedelta(days=start.weekday())
    weeks = (end - start).days // 7 + 1
    top = 18 if labels else 2
    w, h = 34 + weeks * (cell + gap), top + 7 * (cell + gap)
    out = [f'<svg viewBox="0 0 {w} {h}" width="{w}" height="{h}" xmlns="http://www.w3.org/2000/svg" font-family="monospace" font-size="10">']
    for ri, lab in enumerate(['', 'Mar', '', 'Jeu', '', 'Sam', '']):
        if lab: out.append(f'<text x="0" y="{top + ri * (cell + gap) + cell - 3}" fill="#666">{lab}</text>')
    for wi in range(weeks):
        monday = start + dt.timedelta(weeks=wi)
        x = 34 + wi * (cell + gap)
        if labels and monday.day <= 7:
            out.append(f'<text x="{x}" y="12" fill="#777">{["Jan.","Févr.","Mars","Avr.","Mai","Juin","Juill.","Août","Sept.","Oct.","Nov.","Déc."][monday.month-1]}</text>')
        for ri in range(7):
            d = monday + dt.timedelta(days=ri)
            y = top + ri * (cell + gap)
            info = days.get(d)
            if d > TODAY or info is None:
                fill, op, stroke = '#e5e7eb', 0.5, ''
            else:
                s, fade, fid = info
                on = s > FILLED
                fill = col; op = 1 if on else 0.15
                stroke = ' stroke="#f59e0b" stroke-width="2"' if (EMPTY <= s <= FILLED) else ''
            out.append(f'<rect x="{x}" y="{y}" width="{cell}" height="{cell}" rx="4" fill="{fill}" fill-opacity="{op}"{stroke}><title>{d} {d.strftime("%a")} sat={info[0]:.2f}</title></rect>' if info else
                       f'<rect x="{x}" y="{y}" width="{cell}" height="{cell}" rx="4" fill="{fill}" fill-opacity="{op}"><title>{d}</title></rect>')
    out.append('</svg>')
    return ''.join(out)

def overlay_html(a, name):
    """Capture (recadrée) + carrés autour des cases détectées cochées, pour comparer à l'œil."""
    im = Image.open(U + a['fid'] + '.png').convert('RGB')
    x0, y0, x1, y1 = R(40), R(440), R(860), R(690)
    crop = im.crop((x0, y0, x1, y1)); cw, ch = crop.size
    b64 = png_b64(crop.resize((cw // 2, ch // 2)))
    col0 = a['col0_monday']
    px, py = a['pitch']
    rects = []
    for (ci, ri), s in a['cells'].items():
        d = col0 + dt.timedelta(weeks=ci, days=ri)
        cx, cy = a['cols'][ci] - x0, a['rows'][ri] - y0
        if s > FILLED: rects.append(f'<rect x="{cx - px/2 + 2:.0f}" y="{cy - py/2 + 2:.0f}" width="{px - 4:.0f}" height="{py - 4:.0f}" rx="6" fill="none" stroke="#111" stroke-width="2.5"><title>{d}</title></rect>')
        elif s >= EMPTY: rects.append(f'<rect x="{cx - px/2 + 2:.0f}" y="{cy - py/2 + 2:.0f}" width="{px - 4:.0f}" height="{py - 4:.0f}" rx="6" fill="none" stroke="#f59e0b" stroke-width="2.5" stroke-dasharray="4 3"><title>{d} douteux {s:.2f}</title></rect>')
    for ci, c in enumerate(a['cols']):
        monday = col0 + dt.timedelta(weeks=ci)
        if monday.day <= 7:
            rects.append(f'<text x="{c - x0 - px/2:.0f}" y="{y1 - y0 - 6}" font-size="18" font-family="monospace" fill="#111">{monday.strftime("%d/%m")}</text>')
    return (f'<div class="shot"><div class="cap">{a["fid"]} · colonne 0 = lundi {col0} · dernière colonne = lundi {col0 + dt.timedelta(weeks=len(a["cols"]) - 1)}</div>'
            f'<div class="wrap"><img src="data:image/png;base64,{b64}" width="{cw // 2}" height="{ch // 2}">'
            f'<svg viewBox="0 0 {cw} {ch}" width="{cw // 2}" height="{ch // 2}">{"".join(rects)}</svg></div></div>')

parts = ['''<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Habikit · validation des captures HabitKit</title>
<style>body{font:14px/1.45 system-ui,sans-serif;margin:16px;color:#111;background:#fafafa;max-width:1100px}h1{font-size:20px}h2{margin-top:36px;padding-top:12px;border-top:2px solid #ddd}
.shot{margin:12px 0}.cap{font-size:12px;color:#666;margin-bottom:4px}.wrap{position:relative;display:inline-block;max-width:100%}.wrap img{display:block;max-width:100%;height:auto}.wrap svg{position:absolute;inset:0;width:100%;height:100%}
.scroll{overflow-x:auto;padding:8px 0}.dates{font-family:monospace;font-size:12px;columns:4;column-gap:16px}.dates div{break-inside:avoid}.doubt{color:#b45309}.tot{font-weight:600}
table{border-collapse:collapse;font-size:13px}td,th{padding:3px 10px;border-bottom:1px solid #eee;text-align:left}.legend{font-size:12px;color:#555}.legend b{display:inline-block;width:12px;height:12px;border-radius:3px;vertical-align:-2px}</style>
<h1>Validation : grilles HabitKit → Habikit</h1>
<p>Chaque capture est reprise avec un <b>carré noir</b> autour de chaque case détectée cochée (survol = date). En <span class="doubt">orange pointillé</span> : case douteuse (bord dégradé de la grille), à confirmer. Sous les captures, la grille fusionnée telle qu'elle sera importée. Semaine du lundi au dimanche, aujourd'hui = lundi 7 sept. 2026.</p>''']
summary = ['<table><tr><th>Habitude</th><th>Jours cochés</th><th>Premier</th><th>Dernier</th><th>Douteux</th><th>Conflits entre captures</th></tr>']
for name, r in results.items():
    summary.append(f'<tr><td>{HABITS[name]["icon"]} {name}</td><td class="tot">{len(r["checked"])}</td><td>{r["checked"][0] if r["checked"] else "-"}</td><td>{r["checked"][-1] if r["checked"] else "-"}</td><td>{len(r["doubtful"])}</td><td>{len(r["conflicts"])}</td></tr>')
summary.append('</table>')
parts.append(''.join(summary))
for name, r in results.items():
    cfg = HABITS[name]
    parts.append(f'<h2>{cfg["icon"]} {name} <span class="legend">— {len(r["checked"])} jours · objectif HabitKit {cfg["goal"]["value"]} / semaine</span></h2>')
    for a in r['shots']: parts.append(overlay_html(a, name))
    start, end = min(r['days']), TODAY
    parts.append(f'<div class="cap">Grille fusionnée ({start} → {end}) telle qu\'importée dans Habikit :</div><div class="scroll">{grid_svg(name, start, end, r["days"])}</div>')
    if r['doubtful']:
        parts.append('<p class="doubt">Douteux (non importés, sat entre %.2f et %.2f) : %s</p>' % (EMPTY, FILLED, ', '.join(f'{d} ({r["days"][d][0]:.2f})' for d in r['doubtful'])))
    if r['conflicts']:
        parts.append('<p class="doubt">Conflits entre les deux captures : %s</p>' % ', '.join(f'{c[0]}' for c in r['conflicts']))
    by_month = Counter((d.year, d.month) for d in r['checked'])
    parts.append('<div class="cap">Par mois : ' + ' · '.join(f'{y}-{m:02d} : {n}' for (y, m), n in sorted(by_month.items())) + '</div>')
    parts.append('<div class="dates">' + ''.join(f'<div>{d} {["lun","mar","mer","jeu","ven","sam","dim"][d.weekday()]}</div>' for d in r['checked']) + '</div>')
parts.append('<h2>Fichiers</h2><ul><li><code>habikit-import.json</code> : à charger avec le bouton ⤒ de l\'app (format Habikit).</li><li><code>supabase-import.sql</code> : à coller dans le SQL editor Supabase une fois validé (nécessite un utilisateur dans auth.users).</li></ul></html>')
open('validation.html', 'w').write('\n'.join(parts))
print('html', len(open('validation.html').read()) // 1024, 'Ko ; json', len(entries_json), 'entrées ; sql', len(sql_entries), 'lignes')
