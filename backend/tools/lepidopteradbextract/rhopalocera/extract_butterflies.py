#!/usr/bin/env python3
# Butterfly Species Data Extractor
# Extracts butterfly species data from HTML files and outputs as a table
# Includes tribe information extracted from family/subfamily/tribe classification

import re
import json
import sys
from pathlib import Path
from bs4 import BeautifulSoup
import csv
import html as html_module


class ButterflyExtractor:
    def __init__(self, html_file):
        self.html_file = html_file
        self.species_list = []
        # Known genus to tribe mappings to correct HTML errors
        self.genus_tribe_map = {
            'Sinthusa': 'Polyommatini',
        }

        self.parse()
    
    def parse(self):
        # Parse the HTML file and extract butterfly species data
        with open(self.html_file, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Decode HTML entities
        content = html_module.unescape(content)
        
        # Extract using BeautifulSoup for reliable parsing of gallery items with titles
        self._extract_species_from_gallery(content)
    
    
    def _extract_species_from_gallery(self, content):
        """Extract species from gallery items with tribe information"""
        
        soup = BeautifulSoup(content, 'html.parser')
        
        # Find all gallery items
        gallery_items = soup.find_all('div', class_='_L2WwE eiMHrn wixui-gallery__item')
        
        seen = set()
        
        # Two patterns: one for full species, one for sp. (unspecified)
        # Pattern 1: Genus species [subspecies] Author Year - may have comma before year
        species_pattern1 = r'([A-Z][a-z]+)\s+([a-z]+)(?:\s+([a-z]+))?\s+([A-Z][A-Z\sa-z.&,\-]*[A-Za-z.]),?\s+(\d{4})'
        # Pattern 2: Genus sp. [?/♀/♂] - unspecified species
        species_pattern2 = r'([A-Z][a-z]+)\s+(sp\.?)(?:\s+[?♀♂])?'
        # Pattern for taxonomy: Family; Subfamily OR Family; Subfamily; Tribe
        # Match 2 or 3 part format
        taxonomy_pattern = r'([A-Za-z]+);\s*([\w]+)(?:;\s*(\w+))?'
        
        for item in gallery_items:
            # Get the title (common name) - it's in big caps
            title_elem = item.find('div', class_='nDAgIZ')
            common_name = title_elem.get_text(strip=True) if title_elem else ""
            
            # Get the description which contains species and tribe info
            desc_elem = item.find('p', class_='ksU5zX')
            if not desc_elem:
                continue
            
            desc_text = desc_elem.get_text(separator='\n', strip=True)
            
            # Try pattern 1 first (full species info)
            species_match = re.search(species_pattern1, desc_text)
            is_sp = False
            
            if not species_match:
                # Try pattern 2 (sp. unspecified)
                species_match = re.search(species_pattern2, desc_text)
                is_sp = True
            
            if not species_match:
                continue
            
            groups = species_match.groups()
            genus = groups[0]
            species = groups[1]
            
            # For full species (pattern 1)
            if not is_sp and len(groups) >= 5:
                subspecific = groups[2] if groups[2] else ""
                author = groups[3].strip()
                year = groups[4]
            # For sp. (pattern 2)
            elif is_sp:
                subspecific = ""
                author = ""  # unspecified species have no author/year
                year = ""
            else:
                continue
            
            # Skip invalid entries - allow "sp." for unspecified species
            if species != 'sp.' and species != 'sp':
                # Only apply strict validation to named species
                if len(species) < 3 or not species.islower() or any(char.isdigit() for char in species):
                    continue
            
            # Subspecies epithet must be at least 3 chars, all lowercase, no numbers
            if subspecific and (len(subspecific) < 3 or not subspecific.islower() or any(char.isdigit() for char in subspecific)):
                continue
            
            # Clean up author (remove extra spaces and trailing commas)
            if author:
                author = re.sub(r'\s+', ' ', author).strip().rstrip(',').strip()
                
                # Author must be at least 3 characters and have at least one capital letter
                if len(author) < 3 or author.islower():
                    continue
            
            # Skip obvious false positives
            if genus.lower() in ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december', 'treadaway']:
                continue
            
            # Extract taxonomy from description
            # Handle both 3-part (Family;Subfamily;Tribe) and 2-part (Family;Subfamily) formats
            taxonomy_match = re.search(taxonomy_pattern, desc_text)
            if not taxonomy_match:
                continue
            
            subfamily = taxonomy_match.group(2)
            tribe = taxonomy_match.group(3) if taxonomy_match.group(3) else ""  # Tribe can be empty
            
            # Correct tribe based on known genus-tribe mappings (fixes HTML errors)
            if genus in self.genus_tribe_map:
                tribe = self.genus_tribe_map[genus]
            
            # Create deduplication key
            key = (genus, species, subspecific, author, year, tribe)
            if key in seen:
                continue
            seen.add(key)
            
            # Clean up common name - only keep if it's all caps or mostly caps
            common_name_clean = common_name.strip()
            if common_name_clean and not any(char.isdigit() for char in common_name_clean):
                # Remove special characters like ♀, ♂, ?
                common_name_clean = re.sub(r'[♀♂?]', '', common_name_clean).strip()
                # Only keep if mostly uppercase letters
                if common_name_clean and (common_name_clean.isupper() or 
                    (len([c for c in common_name_clean if c.isupper()]) / max(1, len([c for c in common_name_clean if c.isalpha()])) > 0.7)):
                    pass  # Keep it
                else:
                    common_name_clean = ""
            else:
                common_name_clean = ""
            
            species_record = {
                'subfamily': subfamily,
                'tribe': tribe,
                'genus': genus,
                'specific_epithet': species,
                'subspecific_epithet': subspecific,
                'common_name': common_name_clean,
                'scientific_name': f"{genus} {species}" + (f" {subspecific}" if subspecific else ""),
                'author': author,
                'year_of_publication': year
            }
            
            self.species_list.append(species_record)
        
        return
    
    def to_tsv(self, output_file):
        """Export species list to TSV (Tab-Separated Values) for Google Sheets"""
        if not self.species_list:
            print("No species found!")
            return
        
        keys = ['subfamily', 'tribe', 'genus', 'specific_epithet', 'subspecific_epithet', 'common_name', 
                'scientific_name', 'author', 'year_of_publication']
        
        with open(output_file, 'w', newline='', encoding='utf-8') as f:
            # Write header
            f.write('\t'.join(keys) + '\n')
            # Write data rows
            for species in self.species_list:
                row = [str(species.get(key, '')) for key in keys]
                f.write('\t'.join(row) + '\n')
        
        print(f"[OK] TSV exported to: {output_file}")
    
    def to_csv(self, output_file):
        """Export species list to CSV"""
        if not self.species_list:
            print("No species found!")
            return
        
        keys = ['genus', 'specific_epithet', 'subspecific_epithet', 'common_name', 
                'scientific_name', 'author', 'year_of_publication']
        
        with open(output_file, 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=keys)
            writer.writeheader()
            writer.writerows(self.species_list)
        
        print(f"[OK] CSV exported to: {output_file}")
    
    def to_json(self, output_file):
        """Export species list to JSON"""
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(self.species_list, f, indent=2, ensure_ascii=False)
        
        print(f"[OK] JSON exported to: {output_file}")
    
    def to_markdown_table(self, output_file=None):
        """Export species list as Markdown table"""
        if not self.species_list:
            print("No species found!")
            return
        
        lines = ["| Subfamily | Tribe | Genus | Specific Epithet | Subspecific Epithet | Common Name | Scientific Name | Author | Year |",
                 "|-----------|-------|-------|------------------|---------------------|-------------|-----------------|--------|------|"]
        
        for species in self.species_list:
            line = (f"| {species['subfamily']} | {species['tribe']} | {species['genus']} | {species['specific_epithet']} | "
                   f"{species['subspecific_epithet']} | {species['common_name']} | "
                   f"{species['scientific_name']} | {species['author']} | {species['year_of_publication']} |")
            lines.append(line)
        
        output = "\n".join(lines)
        
        if output_file:
            with open(output_file, 'w', encoding='utf-8') as f:
                f.write(output)
            print(f"[OK] Markdown table exported to: {output_file}")
        
        return output
    
    def print_table(self):
        """Print species list as a formatted table"""
        if not self.species_list:
            print("No species found!")
            return
        
        print("\n" + "="*160)
        print(f"{'Subfamily':<18} {'Tribe':<15} {'Genus':<15} {'Sp. Epithet':<15} {'Subsp. Epithet':<15} {'Common Name':<20} {'Scientific Name':<25} {'Author':<15} {'Year':<6}")
        print("="*160)
        
        for species in self.species_list:
            print(f"{species['subfamily']:<18} {species['tribe']:<15} {species['genus']:<15} {species['specific_epithet']:<15} {species['subspecific_epithet']:<15} "
                  f"{species['common_name']:<20} {species['scientific_name']:<25} {species['author']:<15} {species['year_of_publication']:<6}")
        
        print("="*160)
        print(f"\nTotal species found: {len(self.species_list)}\n")
    
    def get_species_list(self):
        """Return the species list"""
        return self.species_list


def main():
    if len(sys.argv) < 2:
        print("Usage: python extract_butterflies.py <html_file> [--csv <output.csv>] [--json <output.json>] [--md <output.md>]")
        sys.exit(1)
    
    html_file = sys.argv[1]
    
    if not Path(html_file).exists():
        print(f"Error: File not found: {html_file}")
        sys.exit(1)
    
    print(f"Extracting butterfly species from: {html_file}")
    
    extractor = ButterflyExtractor(html_file)
    
    # Print the table
    extractor.print_table()
    
    # Note about Wix sites
    if extractor.species_list:
        if len(extractor.species_list) <= 5:
            print("\nNote: If this is a Wix website, it may load content dynamically.")
            print("For complete data extraction, you may need to manually export from the website")
            print("or access the underlying data source.")
    
    # Automatically save to EXTRACTION_RESULTS.md and TSV
    script_dir = Path(__file__).parent
    results_file = script_dir / "EXTRACTION_RESULTS.md"
    results_tsv = script_dir / "EXTRACTION_RESULTS.tsv"
    extractor.to_markdown_table(str(results_file))
    extractor.to_tsv(str(results_tsv))
    
    # Parse additional arguments
    i = 2
    while i < len(sys.argv):
        if sys.argv[i] == '--csv' and i + 1 < len(sys.argv):
            output_file = sys.argv[i + 1]
            extractor.to_csv(output_file)
            i += 2
        elif sys.argv[i] == '--json' and i + 1 < len(sys.argv):
            output_file = sys.argv[i + 1]
            extractor.to_json(output_file)
            i += 2
        elif sys.argv[i] == '--md' and i + 1 < len(sys.argv):
            output_file = sys.argv[i + 1]
            extractor.to_markdown_table(output_file)
            i += 2
        else:
            i += 1


if __name__ == '__main__':
    main()
