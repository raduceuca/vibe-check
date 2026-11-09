#!/usr/bin/env python3
"""Bake Stilla shop-assets photos into demo/public/images/ placeholders."""
from __future__ import annotations

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / 'public' / 'shop-assets' / 'img'
OUT = ROOT / 'public' / 'images'

PRODUCTS = [
    'p-hoodie-1600.webp',
    'p-jacket-1600.webp',
    'p-bra-oat-1600.webp',
    'p-bra-black-1600.webp',
    'p-mat-1600.webp',
    'p-bottle-1600.webp',
    'p-headband-1600.webp',
    'life-park-1600.webp',
]


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    # Keep ≥500 KB so large-images still trips on the broken scenario.
    hero = Image.open(SRC / 'hero-1600.webp').convert('RGB').resize((2400, 1370), Image.Resampling.LANCZOS)
    hero.save(OUT / 'hero-4000.png', format='PNG', compress_level=1)
    hero.resize((1600, 900), Image.Resampling.LANCZOS).save(OUT / 'hero-1600.png', format='PNG', compress_level=6)
    hero.resize((800, 450), Image.Resampling.LANCZOS).save(OUT / 'hero-800.png', format='PNG', compress_level=6)
    print(f"hero-4000.png {(OUT / 'hero-4000.png').stat().st_size / 1024 / 1024:.2f} MB")
    for i, name in enumerate(PRODUCTS, 1):
        src = Image.open(SRC / name).convert('RGB')
        src.resize((1600, 1200), Image.Resampling.LANCZOS).save(OUT / f'product-{i}.png', format='PNG', compress_level=6)
        src.resize((560, 420), Image.Resampling.LANCZOS).save(OUT / f'product-{i}-sm.png', format='PNG', compress_level=6)
        print(f'product-{i}.png {(OUT / f"product-{i}.png").stat().st_size / 1024:.0f} KB')
    size = (OUT / 'hero-4000.png').stat().st_size
    if size < 500_000:
        raise SystemExit(f'hero-4000.png too small for large-images ({size} bytes)')


if __name__ == '__main__':
    main()
