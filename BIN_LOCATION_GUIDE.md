# Bin Location Import Examples

This guide shows you how to format your bin locations file for import.

## Supported File Formats

### 1. Space-Separated (TXT or CSV)
**File: bin_locations.txt**
```
location A1:1 A1:2 A1:3 A1:4 A1:5 A1:6 A2:1 A2:2 A2:3 A2:4 A2:5 A2:6
```

### 2. Comma-Separated (CSV)
**File: bin_locations.csv**
```
A1:1,A1:2,A1:3,A1:4,A1:5,A1:6,A2:1,A2:2,A2:3,A2:4,A2:5,A2:6
```

### 3. One Per Line (TXT)
**File: bin_locations.txt**
```
A1:1
A1:2
A1:3
A1:4
A1:5
A1:6
A2:1
A2:2
A2:3
A2:4
A2:5
A2:6
```

### 4. Semicolon-Separated (CSV)
**File: bin_locations.csv**
```
A1:1;A1:2;A1:3;A1:4;A1:5;A1:6;A2:1;A2:2;A2:3;A2:4;A2:5;A2:6
```

## Complete Example for Your Data

Based on your location format (A1:1, A1:2, etc.), here's how to format your file:

### As a TXT file (space-separated):
```
A1:1 A1:2 A1:3 A1:4 A1:5 A1:6 A2:1 A2:2 A2:3 A2:4 A2:5 A2:6 A3:1 A3:2 A3:3 A3:4 A3:5 A3:6 A4:1 A4:2 A4:3 A4:4 A4:5 A4:6 B1:1 B1:2 B1:3 B1:4 B1:5 B1:6
```

### As a CSV file (comma-separated):
```
A1:1,A1:2,A1:3,A1:4,A1:5,A1:6,A2:1,A2:2,A2:3,A2:4,A2:5,A2:6,A3:1,A3:2,A3:3,A3:4,A3:5,A3:6,A4:1,A4:2,A4:3,A4:4,A4:5,A4:6,B1:1,B1:2,B1:3,B1:4,B1:5,B1:6
```

## How to Create Your File

### Method 1: Using Excel/Google Sheets
1. Create a new spreadsheet
2. Put each bin location in a different cell in one row or one column
3. Save as CSV format
4. The system will automatically parse it correctly

### Method 2: Using Text Editor
1. Open Notepad or any text editor
2. Type locations separated by your preferred delimiter (space, comma, newline, or semicolon)
3. Save as `.txt` or `.csv`
4. Upload to the system

### Method 3: Convert from Your Database
If you have bin locations in a database:
- Export as CSV
- Ensure locations are in a single row or column
- Upload directly (no need to reformat)

## Tips

- **Headers** like "location", "bin", or "bin location" are automatically removed
- **Duplicates** are automatically removed
- **Whitespace** is automatically trimmed
- **Results are sorted** alphabetically for easy searching
- **Case sensitive** - "A1:1" and "a1:1" are treated as different

## File Size
- Maximum file size: 5MB
- Typical use: Up to thousands of bin locations

## How It Works in the App

1. Click **"Import Bin Locations"** button
2. Select your file (CSV or TXT)
3. Preview the loaded locations
4. Click **"Import"** to load them
5. You'll see a status showing how many locations are loaded
6. For each product, click **"Assign Bin"** to open the selector
7. Search or scroll through the list
8. Click on a location to select it
9. Confirm with the checkmark button

## Updating Bin Locations

To update or replace your bin locations:
1. Click **"Import Bin Locations"** again
2. Select a new file
3. All locations will be replaced with the new ones
4. Previously selected bins remain valid if they exist in the new list

## Clearing Bin Locations

If you have locations loaded, you'll see a **"Clear X Locations"** button:
1. Click it to remove all loaded locations
2. You can manually enter bins again, or import a new file
