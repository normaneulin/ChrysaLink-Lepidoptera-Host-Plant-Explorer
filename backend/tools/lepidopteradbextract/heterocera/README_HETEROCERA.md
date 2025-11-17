# Heterocera (Moths) Data Extraction

This folder contains tools for extracting moth species data from Wix gallery HTML files.

## Structure

- `extract_moths.py` - Main extraction script for moth species data
- `EXTRACTION_RESULTS.tsv` - Output TSV file with extracted data
- `EXTRACTION_RESULTS.md` - Output Markdown table with extracted data

## Output Format

The extracted data contains the following columns:

| Column | Description | Required |
|--------|-------------|----------|
| family | Taxonomic family (e.g., Bombycidae) | Optional |
| subfamily | Taxonomic subfamily (e.g., Bombycinae) | Optional |
| tribe | Taxonomic tribe (e.g., Bombycini) | Optional |
| genus | Genus name | Required |
| specific_epithet | Species epithet | Required |
| subspecific_epithet | Subspecies name | Optional |
| common_name | Common name from gallery titles | Optional |
| scientific_name | Full scientific name (constructed) | Required |
| author | Species author/describer | Optional |
| year_of_publication | Year species was described | Optional |

## Usage

```bash
python extract_moths.py <html_file>
```

### Example:
```bash
python extract_moths.py "C:\Users\LENOVO\Downloads\Bombycidae in the Philippines.html"
```

## Input Requirements

The HTML file should be a Wix gallery page with the following structure:

### Gallery Items
Gallery items should have the class: `_L2WwE eiMHrn wixui-gallery__item`

### Title (Common Name)
Title element with class: `nDAgIZ`
- Should contain the common name in BIG CAPS
- Example: `SILKWORM`, `ATLAS MOTH`

### Description
Description paragraph with class: `ksU5zX`
- First line: Species information in format: `Genus species [subspecies] Author Year`
- Should also contain taxonomy on a separate line: `Family; Subfamily` or `Family; Subfamily; Tribe`

### Example Description Structure:
```
Philosamia ricini ricini Walker 1855
Bombycidae; Bombycinae

© Photographer Name
Location, Province
Date
Additional notes...
```

## Species Pattern Recognition

### Full Species Pattern
Matches: `Genus species [subspecies] Author Year`

Examples:
- `Philosamia ricini ricini Walker 1855`
- `Samia cynthia cynthia Drury 1773`
- `Erromena robusta C. & R. Felder 1862`

### Unspecified Species Pattern
Matches: `Genus sp.` (without author/year)

Examples:
- `Ocinara sp.`
- `Trilocha sp.`

## Known Issues

### Dynamic Content
Wix websites often load gallery content dynamically via JavaScript. If you encounter:
- "No species found!" message
- Empty extraction results

**Solution:** The HTML file may be the navigation/home page rather than an actual gallery page. You need to:

1. Navigate to a specific subfamily/family page in your browser
2. Wait for all images to load
3. Right-click → "Save As" → "Webpage, Complete"
4. Save the HTML file
5. Run the extraction script on the saved file

### Specific Pages to Save
For example, instead of the main "Moths in the Philippines" page, save:
- "Bombycidae (Silkworm Moths)" page
- "Brahmaeidae (Brahmin Moths)" page
- "Geometridae (Geometrid Moths)" page

## Output Files

After running the script, you'll get:

1. **EXTRACTION_RESULTS.tsv** - Tab-separated format for Google Sheets
   - Can be directly imported into Google Sheets or Excel
   - Maintains column structure and handles special characters

2. **EXTRACTION_RESULTS.md** - Markdown table format
   - Readable in text editors
   - Can be viewed on GitHub

3. **Console output** - Formatted table displayed during execution
   - Shows summary of extracted data

## Customization

To add genus-specific tribe corrections (for HTML taxonomy errors), edit the script:

```python
# In __init__ method:
self.genus_tribe_map = {
    'GenusName': 'CorrectTribe',
    'Samia': 'Bombycini',
}
```

These mappings will override tribe information from the HTML if available.

## Related

- **Rhopalocera (Butterflies)**: See `../rhopalocera/` folder
- **Main Extractor**: `../extract_butterflies.py` (butterfly version)
