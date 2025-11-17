# Butterfly Species Data Extractor

A Python script to extract butterfly species data from HTML files (like Wix-based websites) and export to multiple formats.

## Features

- Extracts genus, specific epithet, subspecific epithet, common name, scientific name, author, and publication year
- Handles duplicates automatically
- Supports multiple output formats: CSV, JSON, Markdown table, and console display
- Flexible regex patterns to catch various species name formatting

## Usage

### Basic Usage

```bash
python extract_butterflies.py <html_file>
```

This will display the extracted species table in the console.

### With Export Options

```bash
python extract_butterflies.py <html_file> --csv output.csv --json output.json --md output.md
```

### Options

- `--csv <file>`: Export to CSV format
- `--json <file>`: Export to JSON format
- `--md <file>`: Export as Markdown table

## Example

```bash
python extract_butterflies.py "Butterflies in the Philippines.html" --csv butterflies.csv
```

## Output Format

### CSV
```csv
genus,specific_epithet,subspecific_epithet,common_name,scientific_name,author,year_of_publication
Badamia,exclamationis,,BROWN AWL,Badamia exclamationis,Fabricius,1775
Hasora,mavis,,BANDED AWL,Hasora mavis,Evans,1934
```

### Markdown Table
```markdown
| Genus | Specific Epithet | Subspecific Epithet | Common Name | Scientific Name | Author | Year |
|-------|------------------|---------------------|-------------|-----------------|--------|------|
| Badamia | exclamationis |  | BROWN AWL | Badamia exclamationis | Fabricius | 1775 |
```

## How It Works

1. Parses the HTML file using BeautifulSoup
2. Extracts all text content
3. Uses regex patterns to find species names in format: `Genus species [subspecies] Author Year`
4. Searches backward in the text for common names (typically in capitals)
5. Deduplicates results
6. Exports to requested format(s)

## Requirements

- Python 3.7+
- beautifulsoup4

## Installation

```bash
pip install beautifulsoup4
```

## Notes

- The script handles both subspecies formats and basic species listings
- Common names are extracted by finding the last capitalized text before the scientific name
- Empty fields are left blank in CSV/JSON output (as per your requirement)
- Subspecific epithet field will be empty for species without subspecific designation

## Extracted Species from Example File

9 species were successfully extracted:
- Badamia exclamationis
- Hasora mavis
- Bibasis gomata lorquini
- Bibasis oedipodea paltra
- Choaspes estrella de
- Hasora badra badra
- Hasora chromus chromus
- Hasora khoda minsona
- Hasora mixta mixta
