#!/usr/bin/env python3
"""Retrouver ses données HabitKit sans l'export Pro, à partir d'une copie de l'app.

Deux usages, détaillés dans docs/IMPORT_HABITKIT.md :

  # 1. Sauvegarde iPhone locale NON chiffrée (Finder / iTunes) : cherche l'app et copie sa base
  python scripts/habitkit_backup_to_json.py --backup "~/Library/Application Support/MobileSync/Backup/<id>" --out habitkit-db/

  # 2. Base SQLite (extraite en 1, ou tirée d'un émulateur Android rooté) → JSON au format export HabitKit
  python scripts/habitkit_backup_to_json.py --db habitkit-db/habitkit.db --out habitkit-export.json

Le JSON produit se charge dans Habikit avec le bouton ⤒ (Importer). Le script ne connaît pas le
schéma exact de la base : il exporte toutes les tables, en renommant celles qui ressemblent à
`habits`, `completions`, `intervals` et en passant les colonnes en camelCase. Si l'import échoue,
ouvrir le JSON et ajuster à la main (voir la doc pour les clés attendues).
"""
from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import sqlite3
import sys
from datetime import datetime, timezone
from pathlib import Path

SQLITE_MAGIC = b"SQLite format 3\x00"


def camel(name: str) -> str:
    parts = re.split(r"[_\s]+", name.strip())
    return parts[0].lower() + "".join(p[:1].upper() + p[1:] for p in parts[1:])


def to_iso(value):
    """Epoch (s ou ms) ou texte de date → ISO 8601 UTC. Sinon valeur inchangée."""
    if isinstance(value, (int, float)) and value > 10_000_000:
        secs = value / 1000 if value > 100_000_000_000 else value
        return datetime.fromtimestamp(secs, tz=timezone.utc).isoformat().replace("+00:00", "Z")
    if isinstance(value, str) and re.match(r"^\d{4}-\d{2}-\d{2}", value):
        try:
            d = datetime.fromisoformat(value.replace("Z", "+00:00"))
            if d.tzinfo is None:
                d = d.replace(tzinfo=timezone.utc)
            return d.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
        except ValueError:
            return value
    return value


TABLE_ALIASES = {"habits": "habit", "completions": "completion", "intervals": "interval"}


def db_to_export(db_path: Path) -> dict:
    con = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
    con.row_factory = sqlite3.Row
    tables = [r[0] for r in con.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")]
    out: dict = {}
    for table in tables:
        rows = []
        for row in con.execute(f'SELECT * FROM "{table}"'):
            obj = {}
            for key in row.keys():
                v = row[key]
                if isinstance(v, bytes):
                    continue
                ck = camel(key)
                if re.search(r"date|time|created|updated|at$", ck, re.I):
                    v = to_iso(v)
                if ck in ("archived", "isArchived") and isinstance(v, int):
                    v = bool(v)
                obj[ck] = v
            if "isArchived" in obj and "archived" not in obj:
                obj["archived"] = obj["isArchived"]
            rows.append(obj)
        key = table
        for alias, stem in TABLE_ALIASES.items():
            if stem in table.lower():
                key = alias
        out[key] = rows
        print(f"  table {table:30s} → {key:12s} {len(rows)} ligne(s)", file=sys.stderr)
    con.close()
    if "habits" not in out:
        print("⚠ Aucune table ressemblant à `habits` : vérifier le fichier (est-ce bien la base HabitKit ?)", file=sys.stderr)
    return out


def is_sqlite(path: Path) -> bool:
    try:
        with open(path, "rb") as f:
            return f.read(16) == SQLITE_MAGIC
    except OSError:
        return False


def extract_from_backup(backup: Path, out_dir: Path, needle: str) -> list[Path]:
    manifest = backup / "Manifest.db"
    if not manifest.exists():
        sys.exit(f"Manifest.db introuvable dans {backup} : est-ce bien le dossier d'une sauvegarde ?")
    if not is_sqlite(manifest):
        sys.exit(
            "Manifest.db est chiffré : la sauvegarde est chiffrée. Refaire une sauvegarde locale sans chiffrement,\n"
            "ou extraire avec la bibliothèque Python `iOSbackup` (voir docs/IMPORT_HABITKIT.md)."
        )
    con = sqlite3.connect(f"file:{manifest}?mode=ro", uri=True)
    rows = con.execute(
        "SELECT fileID, domain, relativePath FROM Files WHERE lower(domain) LIKE ? AND flags = 1",
        (f"%{needle.lower()}%",),
    ).fetchall()
    con.close()
    if not rows:
        sys.exit(f"Aucun fichier dont le domaine contient « {needle} ». Lister les domaines : --list-domains")
    out_dir.mkdir(parents=True, exist_ok=True)
    copied: list[Path] = []
    for file_id, domain, rel in rows:
        src = backup / file_id[:2] / file_id
        if not src.exists():
            continue
        dest = out_dir / domain.replace("AppDomain-", "") / rel
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dest)
        tag = "SQLite" if is_sqlite(dest) else ""
        print(f"  {domain}/{rel} {tag}", file=sys.stderr)
        if tag:
            copied.append(dest)
    return copied


def list_domains(backup: Path) -> None:
    con = sqlite3.connect(f"file:{backup / 'Manifest.db'}?mode=ro", uri=True)
    for (d,) in con.execute("SELECT DISTINCT domain FROM Files WHERE domain LIKE 'AppDomain%' ORDER BY domain"):
        print(d)


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--backup", help="dossier d'une sauvegarde iPhone locale non chiffrée")
    ap.add_argument("--db", help="base SQLite HabitKit à convertir en JSON")
    ap.add_argument("--out", required=True, help="dossier (avec --backup) ou fichier .json (avec --db)")
    ap.add_argument("--app", default="habitkit", help="fragment du bundle id à chercher (défaut : habitkit)")
    ap.add_argument("--list-domains", action="store_true", help="avec --backup : lister les apps présentes et sortir")
    args = ap.parse_args()

    if args.backup:
        backup = Path(os.path.expanduser(args.backup))
        if args.list_domains:
            return list_domains(backup)
        dbs = extract_from_backup(backup, Path(args.out), args.app)
        if not dbs:
            sys.exit("Fichiers copiés mais aucune base SQLite trouvée : chercher un .db / .sqlite / .realm dans le dossier de sortie.")
        for db in dbs:
            target = db.with_suffix(".json")
            print(f"\nConversion {db.name} → {target.name}", file=sys.stderr)
            target.write_text(json.dumps(db_to_export(db), ensure_ascii=False, indent=2))
        print("\nImporter le .json dans Habikit avec le bouton ⤒.", file=sys.stderr)
    elif args.db:
        data = db_to_export(Path(args.db))
        Path(args.out).write_text(json.dumps(data, ensure_ascii=False, indent=2))
        print(f"→ {args.out} ({len(data.get('habits', []))} habitudes, {len(data.get('completions', []))} complétions)", file=sys.stderr)
    else:
        ap.error("--backup ou --db requis")


if __name__ == "__main__":
    main()
