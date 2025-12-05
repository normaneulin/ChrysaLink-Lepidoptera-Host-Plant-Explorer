#!/usr/bin/env python3
"""Extract placeholder taxons from CSVs.

For each input CSV, find the taxonomy columns from `division` through `genus` (or `tribe`/`family` if `genus` missing).
For each unique non-empty value in those taxon columns, write a placeholder row with only that single column populated (all others blank), keeping the original header.

Writes output files alongside inputs:
- for `lep_small_db.csv` -> `lepidoptera_placeholder_taxon_db.csv`
- for `plant_small_db.csv` -> `plant_placeholder_taxon_db.csv`

This script is intentionally dependency-free and works with Python 3.6+.
"""
from pathlib import Path
import csv

WORKDIR = Path(__file__).parent

def find_taxon_range(header):
    # Normalize header tokens to lowercase for matching
    low = [h.strip().lower() for h in header]
    try:
        start = low.index('division')
    except ValueError:
        # fallback to first column
        start = 0
    # Prefer genus, then tribe, then family as the last taxon column
    end = None
    for candidate in ('genus', 'tribe', 'family'):
        if candidate in low:
            end = low.index(candidate)
            break
    if end is None:
        # default to start if none found
        end = start
    # ensure start <= end
    if start > end:
        start, end = end, start
    return start, end


def extract_placeholders(in_path: Path, out_path: Path):
    if not in_path.exists():
        print(f"Input not found: {in_path}")
        return
    with in_path.open(newline='', encoding='utf-8') as fh:
        reader = csv.reader(fh)
        try:
            header = next(reader)
        except StopIteration:
            print(f"Empty file: {in_path}")
            return
        rows = list(reader)

    start, end = find_taxon_range(header)
    placeholders = set()
    for r in rows:
        # pad row if shorter than header
        if len(r) < len(header):
            r = r + [''] * (len(header) - len(r))
        for i in range(start, end + 1):
            val = r[i].strip()
            if val:
                placeholders.add((i, val))

    # Sort placeholders by column index then value
    placeholders = sorted(placeholders, key=lambda t: (t[0], t[1]))

    # Write output CSV with same header and one placeholder per row
    with out_path.open('w', newline='', encoding='utf-8') as ofh:
        writer = csv.writer(ofh)
        writer.writerow(header)
        for i, val in placeholders:
            out_row = [''] * len(header)
            out_row[i] = val
            writer.writerow(out_row)
    print(f"Wrote {len(placeholders)} placeholders to {out_path}")


def main():
    tasks = [
        (WORKDIR / 'lep_small_db.csv', WORKDIR / 'lepidoptera_placeholder_taxon_db1.csv'),
       # (WORKDIR / 'plant_small_db.csv', WORKDIR / 'plant_placeholder_taxon_db.csv'),
    ]
    for inp, out in tasks:
        extract_placeholders(inp, out)

if __name__ == '__main__':
    main()
