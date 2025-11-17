import re
from bs4 import BeautifulSoup
from pathlib import Path

def extract_plants(html_file):
    """Extract plant data from Philippine plants HTML file."""
    
    with open(html_file, 'r', encoding='utf-8') as f:
        soup = BeautifulSoup(f, 'html.parser')
    
    plants = []
    
    # Get family name from h1
    family_elem = soup.find('h1')
    if not family_elem:
        print("Error: Could not find family heading")
        return plants
    
    family_name = family_elem.get_text(strip=True)
    print(f"Extracting plants from family: {family_name}")
    
    # Find all species records
    species_records = soup.find_all('li', class_='species_record')
    
    for record in species_records:
        # Extract genus and species from the first <b><i> tag
        species_elem = record.find('b')
        if not species_elem:
            continue
        
        species_text = species_elem.get_text(strip=True)
        
        # Parse genus and specific epithet
        parts = species_text.split()
        if len(parts) < 2:
            continue
        
        genus = parts[0]
        specific_epithet = parts[1]
        scientific_name = f"{genus} {specific_epithet}"
        
        # Extract author and year from the text after species
        # Format: (Burm.f.) Bech.<!--PROTO-->, Candollea 6 (1935) 22<!--PUBS-->
        # or: Copel., PJS 1(Suppl.) (1906)<!--PUBS-->
        record_html = str(record)
        
        author = ""
        year = ""
        
        # Extract text right after the species italic tag - this contains the author
        # Pattern: </i></b> (Author)<!--PROTO-->
        author_match = re.search(
            r'</i></b>\s*([^<]+?)<!--PROTO-->',
            record_html
        )
        
        if author_match:
            author = author_match.group(1).strip()
            # Decode HTML entities in author
            author = BeautifulSoup(author, 'html.parser').get_text()
        
        # Extract year from the LAST occurrence of (YYYY) pattern after <!--PROTO-->
        # This handles cases like: J. Bot. (Schrader) 1800 (1801) where 1801 is the year
        year_matches = re.findall(
            r'\((\d{4})\)(?!.*\(\d{4}\))',
            record_html[record_html.find('<!--PROTO-->'):record_html.find('<!--PUBS-->') if '<!--PUBS-->' in record_html else len(record_html)]
        )
        if year_matches:
            year = year_matches[0]
        
        # Extract subspecific epithets from the infraspecific list
        subspecific_epithets = []
        infra_list = record.find('ul')
        if infra_list:
            infra_items = infra_list.find_all('li', class_='infra_species_record')
            for item in infra_items:
                # Look for subspecies epithet after "ssp."
                item_text = item.get_text()
                ssp_match = re.search(r'ssp\.\s+(\S+)', item_text)
                if ssp_match:
                    ssp = ssp_match.group(1).rstrip('.')  # Remove trailing period
                    subspecific_epithets.append(ssp)
        
        # If no subspecies found, add one entry with empty subspecific_epithet
        if not subspecific_epithets:
            plant = {
                'family': family_name,
                'genus': genus,
                'specific_epithet': specific_epithet,
                'subspecific_epithet': '',
                'common_name': '',
                'scientific_name': scientific_name,
                'author': author,
                'year_of_publication': year
            }
            plants.append(plant)
        else:
            # Add one entry per subspecies
            for ssp in subspecific_epithets:
                plant = {
                    'family': family_name,
                    'genus': genus,
                    'specific_epithet': specific_epithet,
                    'subspecific_epithet': ssp,
                    'common_name': '',
                    'scientific_name': scientific_name,
                    'author': author,
                    'year_of_publication': year
                }
                plants.append(plant)
    
    return plants

def write_tsv(plants, output_file):
    """Write plants data to TSV file."""
    
    if not plants:
        print("No plants to write")
        return
    
    header = [
        'family',
        'genus',
        'specific_epithet',
        'subspecific_epithet',
        'common_name',
        'scientific_name',
        'author',
        'year_of_publication'
    ]
    
    with open(output_file, 'w', encoding='utf-8') as f:
        # Write header
        # f.write('\t'.join(header) + '\n')
        
        # Write data rows
        for plant in plants:
            row = [
                plant.get('family', ''),
                plant.get('genus', ''),
                plant.get('specific_epithet', ''),
                plant.get('subspecific_epithet', ''),
                plant.get('common_name', ''),
                plant.get('scientific_name', ''),
                plant.get('author', ''),
                plant.get('year_of_publication', '')
            ]
            f.write('\t'.join(row) + '\n')

def main():
    html_file = Path(__file__).parent / 'Plants_in_the_Philippines.html'
    
    if not html_file.exists():
        print(f"Error: HTML file not found at {html_file}")
        return
    
    print(f"Reading HTML from: {html_file}")
    plants = extract_plants(html_file)
    
    if not plants:
        print("No plants found")
        return
    
    print(f"Found {len(plants)} plant records")
    
    output_file = Path(__file__).parent / 'EXTRACTION_RESULTS_PLANTS.tsv'
    write_tsv(plants, output_file)
    
    print(f"\n[OK] TSV exported to: {output_file}")
    print("\n" + "="*80)
    print("EXTRACTED PLANTS (family | genus | specific_epithet | subspecific_epithet | common_name | scientific_name | author | year_of_publication)")
    print("="*80)
    
    # Display results
    for plant in plants:
        print(f"{plant['family']}\t{plant['genus']}\t{plant['specific_epithet']}\t{plant['subspecific_epithet']}\t{plant['common_name']}\t{plant['scientific_name']}\t{plant['author']}\t{plant['year_of_publication']}")

if __name__ == '__main__':
    main()
