#!/usr/bin/env python3
"""
Synchronise le contenu de partials/head-common.html dans les pages
publiques entre les marqueurs HEAD:COMMON-START / HEAD:COMMON-END.

Usage :
  python3 scripts/sync-head.py        # propage dans les fichiers
  python3 scripts/sync-head.py --check # vérifie la cohérence sans modifier
                                       # (exit 1 si une page diverge)
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PARTIAL = ROOT / "partials" / "head-common.html"

# Pages publiques (admin exclu intentionnellement)
PUBLIC_PAGES = [
    "index.html",
    "classement.html",
    "equipes.html",
    "galerie.html",
    "reservations.html",
    "mentions-legales.html",
    "politique-confidentialite.html",
]

START_MARKER = "<!-- HEAD:COMMON-START -->"
END_MARKER = "<!-- HEAD:COMMON-END -->"

BLOCK_RE = re.compile(
    re.escape(START_MARKER) + r".*?" + re.escape(END_MARKER),
    re.DOTALL,
)


def build_block(partial_content):
    return (
        f"{START_MARKER}\n"
        f"{partial_content.rstrip()}\n"
        f"{END_MARKER}"
    )


def sync_file(path, expected_block, check_only):
    text = path.read_text(encoding="utf-8")
    if START_MARKER not in text or END_MARKER not in text:
        return ("missing-markers", None)
    new_text = BLOCK_RE.sub(expected_block, text, count=1)
    if new_text == text:
        return ("up-to-date", None)
    if check_only:
        return ("would-change", None)
    path.write_text(new_text, encoding="utf-8")
    return ("updated", None)


def main():
    check_only = "--check" in sys.argv
    if not PARTIAL.exists():
        print(f"ERROR: {PARTIAL} introuvable")
        sys.exit(1)

    partial_content = PARTIAL.read_text(encoding="utf-8")
    expected_block = build_block(partial_content)

    print(f"Source : {PARTIAL.relative_to(ROOT)}")
    print(f"Mode   : {'CHECK (lecture seule)' if check_only else 'SYNC'}\n")

    issues = 0
    for name in PUBLIC_PAGES:
        path = ROOT / name
        if not path.exists():
            print(f"  ⚠ {name} introuvable, skip")
            continue
        status, _ = sync_file(path, expected_block, check_only)
        symbol = {
            "up-to-date": "✓",
            "updated": "↻",
            "would-change": "✗",
            "missing-markers": "⚠",
        }.get(status, "?")
        print(f"  {symbol} {name:<40} {status}")
        if status in ("would-change", "missing-markers"):
            issues += 1

    if check_only and issues:
        print(f"\n{issues} page(s) divergent ou n'ont pas les marqueurs.")
        print("Lance `python3 scripts/sync-head.py` pour corriger.")
        sys.exit(1)
    print()


if __name__ == "__main__":
    main()
