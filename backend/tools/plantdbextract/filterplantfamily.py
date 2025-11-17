#!/usr/bin/env python3
# Plant Family Filter
# Filters plant_division_families.csv to keep only families that exist in hostplant_families.csv
# Outputs as TSV with columns: division | family

import csv
import sys
from pathlib import Path

def load_hostplant_families(hostplant_file):
    """Load all families from hostplant_families.csv into a set"""
    hostplant_families = set()
    try:
        # Try different encodings
        for encoding in ['utf-8-sig', 'utf-8', 'latin-1', 'iso-8859-1', 'cp1252']:
            try:
                with open(hostplant_file, 'r', encoding=encoding) as f:
                    reader = csv.DictReader(f)
                    for row in reader:
                        if 'family' in row and row['family'].strip():
                            hostplant_families.add(row['family'].strip())
                return hostplant_families
            except (UnicodeDecodeError, UnicodeError):
                continue
        
        raise ValueError(f"Could not decode {hostplant_file} with any supported encoding")
    except FileNotFoundError:
        print(f"Error: {hostplant_file} not found", file=sys.stderr)
        sys.exit(1)

def filter_plant_families(plant_file, hostplant_families, output_file):
    """Filter plant families and write to TSV output"""
    filtered_count = 0
    removed_count = 0
    
    # Try different encodings
    for encoding in ['utf-8-sig', 'utf-8', 'latin-1', 'iso-8859-1', 'cp1252']:
        try:
            with open(plant_file, 'r', encoding=encoding) as infile:
                reader = csv.DictReader(infile)
                
                with open(output_file, 'w', encoding='utf-8', newline='') as outfile:
                    writer = csv.writer(outfile, delimiter='\t')
                    # Write header
                    writer.writerow(['division', 'family'])
                    
                    for row in reader:
                        family = row['family'].strip() if 'family' in row else ""
                        division = row['division'].strip() if 'division' in row else ""
                        
                        if family in hostplant_families:
                            # Write row to output
                            writer.writerow([division, family])
                            filtered_count += 1
                        else:
                            removed_count += 1
            
            return filtered_count, removed_count
        except (UnicodeDecodeError, UnicodeError):
            continue
    
    print(f"Error: {plant_file} could not be decoded with any supported encoding", file=sys.stderr)
    sys.exit(1)

def main():
    # File paths
    script_dir = Path(__file__).parent
    plant_file = script_dir / 'plant_division_families.csv'
    hostplant_file = script_dir / 'hostplant_families.csv'
    output_file = script_dir / 'FILTERED_PLANT_FAMILIES.tsv'
    
    # Check if input files exist
    if not plant_file.exists():
        print(f"Error: {plant_file} not found", file=sys.stderr)
        sys.exit(1)
    
    if not hostplant_file.exists():
        print(f"Error: {hostplant_file} not found", file=sys.stderr)
        sys.exit(1)
    
    print(f"Loading hostplant families from: {hostplant_file}")
    hostplant_families = load_hostplant_families(hostplant_file)
    print(f"Loaded {len(hostplant_families)} hostplant families")
    
    print(f"\nFiltering plant families from: {plant_file}")
    filtered_count, removed_count = filter_plant_families(plant_file, hostplant_families, output_file)
    
    print(f"Filtered families: {filtered_count}")
    print(f"Removed families: {removed_count}")
    print(f"\n[OK] TSV exported to: {output_file}")
    
    # Display the results
    print("\n" + "="*80)
    print("FILTERED PLANT FAMILIES (division | family)")
    print("="*80)
    
    try:
        with open(output_file, 'r', encoding='utf-8') as f:
            for line in f:
                print(line.rstrip())
    except FileNotFoundError:
        print("Error reading output file", file=sys.stderr)
        sys.exit(1)

if __name__ == '__main__':
    main()
