import csv
from pathlib import Path

def fix_scientific_names(csv_file, output_file=None):
    """
    Concatenate subspecific_epithet to scientific_name.
    If subspecific_epithet is not empty, append it to scientific_name.
    
    Columns:
    - Column E (index 4): subspecific_epithet
    - Column G (index 6): scientific_name
    """
    
    if output_file is None:
        output_file = csv_file
    
    print(f"Reading CSV from: {csv_file}")
    
    # Read the CSV file
    rows = []
    with open(csv_file, 'r', encoding='utf-8') as f:
        reader = csv.reader(f)
        header = next(reader)
        print(f"Header: {header}")
        
        for idx, row in enumerate(reader, 1):
            if len(row) > 6:  # Ensure we have enough columns
                subspecific_epithet = row[4].strip()  # Column E (index 4)
                scientific_name = row[6].strip()      # Column G (index 6)
                
                # If subspecific_epithet is not empty, append it to scientific_name
                if subspecific_epithet:
                    row[6] = f"{scientific_name} {subspecific_epithet}"
                    print(f"Row {idx}: Updated '{scientific_name}' -> '{row[6]}'")
            
            rows.append(row)
    
    # Write the updated CSV
    print(f"\nWriting updated CSV to: {output_file}")
    with open(output_file, 'w', encoding='utf-8', newline='') as f:
        writer = csv.writer(f)
        writer.writerow(header)
        writer.writerows(rows)
    
    print(f"[OK] CSV updated successfully!")
    print(f"Total rows processed: {len(rows)}")

def main():
    csv_file = Path(__file__).parent.parent / 'PlantDatabase - Sheet1.csv'
    
    if not csv_file.exists():
        print(f"Error: CSV file not found at {csv_file}")
        print("Make sure PlantDatabase - Sheet1.csv is in the plantdbextract directory")
        return
    
    fix_scientific_names(csv_file)

if __name__ == '__main__':
    main()
