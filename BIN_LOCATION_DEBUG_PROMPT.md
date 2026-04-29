# Bin Location Feature - Live App Debugging Prompt

## Current Status Report
The bin location feature is **NOT WORKING** in the live app during testing. Use this comprehensive prompt when debugging with your IDE.

---

## 🚀 READY-TO-USE LIVE APP FIX PROMPT

**Copy and paste this entire prompt into your IDE chat to fix the bin location feature:**

```
TASK: Fix Bin Location Feature in Live Fabric Scanner App

STATUS: Feature was working previously but something is broken or missing. Need to diagnose and fix.

FILE STRUCTURE:
- app/models/binLocations.server.js (Database operations)
- app/utils/binLocationParser.js (File parsing)
- app/routes/app.fabric.jsx (Main UI and import logic)
- prisma/schema.prisma (BinLocation database model)

WHAT SHOULD WORK:
1. Users can import bin locations from CSV/TXT files
2. Bins display in a dropdown/modal when assigning to products
3. Bins can be searched (type "A1:1" to find products)
4. Users can manually add/delete individual bins
5. Users can clear all locations at once

SYMPTOMS OF BROKEN FEATURE:
- File import shows no feedback or "0 added"
- Dropdown list is empty even though bins exist
- Search by bin number returns wrong results
- Metafield not updating on products
- "Import Bin Locations" button missing from UI

QUICK DIAGNOSIS STEPS:
1. Check if BinLocation database table exists:
   - Open prisma/schema.prisma
   - Search for "model BinLocation"
   - Verify these fields exist: id, shop, location, createdAt
   - Verify unique constraint: @@unique([shop, location])

2. Check if app.fabric.jsx has bin import action:
   - Search for: actionType === "importBinLocations"
   - Should call: importBinLocations(shop, locations)
   - Should return: { success: true, added, duplicates, total }

3. Check if loader fetches bins:
   - Search for: getBinLocations(session.shop)
   - Should return array and pass as: binLocations: []
   - Should render in component state

4. Verify import function exists and is called:
   - In app/models/binLocations.server.js
   - Function: importBinLocations(shop, locations)
   - Should parse locations and insert to DB

5. Check import modal/UI:
   - Search app.fabric.jsx for "import" (case-insensitive)
   - Look for modal component that handles file upload
   - Check if it calls handleImportBinLocations fetcher

WHAT TO FIX:
1. If BinLocation model missing → Add to prisma/schema.prisma
2. If import action missing → Add to app.fabric.jsx action function
3. If UI button missing → Add import modal to app.fabric.jsx render
4. If loader missing bins → Add getBinLocations() to loader
5. If functions missing → Copy from binLocations.server.js and binLocationParser.js

PROVIDE:
- List of what's currently missing or broken
- Which files need changes
- The exact code additions needed
- Specific line numbers to reference

Please scan the code and tell me exactly what's wrong and what needs to be added/fixed.
```

---

## Feature Overview

### What It Does
- **Import bin locations** from CSV/TXT files into the database
- **Store locations** per shop in the `BinLocation` database table
- **Assign bins to products** via metafield `custom.bin_locations`
- **Search/Filter products** by bin numbers
- **Display bin assignments** in the fabric inventory table
- **Manual entry** of individual bin locations
- **Clear all locations** functionality

### Database Structure
```prisma
model BinLocation {
  id        Int      @id @default(autoincrement())
  shop      String
  location  String
  createdAt DateTime @default(now())
  @@unique([shop, location])  // Shop + Location must be unique
  @@index([shop])
}
```

---

## Technical Architecture

### File Structure
| File | Purpose |
|------|---------|
| `app/models/binLocations.server.js` | Database operations (CRUD) |
| `app/utils/binLocationParser.js` | Parse CSV/TXT/auto-detect formats |
| `app/routes/app.fabric.jsx` | Main UI & actions for fabric inventory |
| `app/routes/app.settings.jsx` | Settings page (doesn't handle bins) |
| `prisma/schema.prisma` | Database schema definition |

### Data Flow

#### 1. **Import Bins** (File Upload → Database)
```
User uploads file
  ↓
parseBinLocations() → Parse CSV/TXT/Auto-detect
  ↓
importBinLocations() → Insert into DB (handle duplicates)
  ↓
DB constraints prevent duplicates
  ↓
Return { added, duplicates, total }
  ↓
Update UI with feedback
```

#### 2. **Assign Bin to Product** (Metafield Update)
```
User selects bin from dropdown/modal
  ↓
updateBin action triggered
  ↓
GraphQL mutation → metafieldsSet (custom.bin_locations)
  ↓
Shopify Admin API updates product metafield
  ↓
UI confirms assignment
```

#### 3. **Search by Bin** (Special Logic)
```
User searches "A1:1" or "Bin A1:1"
  ↓
isBinSearch detection logic (app.fabric.jsx:27-34)
  ↓
If bin detected → special search query
  ↓
Filter products by metafield value
```

---

## Common Issues & Debugging Checklist

### Issue #1: Import Not Working
**Symptoms:** Upload file → No feedback, or "0 added, X duplicates"

**Debugging Steps:**
1. **Check File Format**
   - Is the file actually CSV or TXT?
   - Run: `parseBinLocations()` with the exact file content
   - Test parsing with simple formats: `A1:1,A1:2,A1:3`

2. **Check Database Connection**
   - Can the app access the database?
   - Does `BinLocation` table exist in Prisma schema?
   - Run migration: `npx prisma migrate dev`

3. **Check Form Data**
   - Is `actionType: "importBinLocations"` being sent?
   - Is `locations` JSON stringified correctly?
   - Log form data in the action handler

4. **Check Duplicates**
   - Are locations already in DB from previous imports?
   - Try with completely new location names
   - Check for whitespace differences ("A1:1" vs "A1:1 ")

5. **Check Constraints**
   - Unique constraint: `@@unique([shop, location])`
   - Same location can't be imported twice for same shop
   - Different shops can have same location names

### Issue #2: Bin Assignment Not Saving
**Symptoms:** Click "Assign Bin" → Select location → No change to product

**Debugging Steps:**
1. **Check Metafield Permissions**
   - App needs scopes: `write_products` (for metafields)
   - Check `shopify.app.toml` scopes list
   - Verify in Shopify Admin > Apps > Your App > Permissions

2. **Check GraphQL Mutation**
   - Does the mutation match Shopify's current schema?
   - Current code uses `metafieldsSet` mutation
   - Verify response has no `userErrors`

3. **Check Product ID Format**
   - Product ID must be in `gid://shopify/Product/123456` format
   - Not a plain number or handle
   - Get from GraphQL query response

4. **Check Metafield Namespace & Key**
   - Namespace: `custom`
   - Key: `bin_locations`
   - Type: `single_line_text_field`
   - Value should be bin location string

5. **Check Network Requests**
   - Open DevTools > Network tab
   - Look for POST requests to `/app/fabric`
   - Check response for `{ success: true/false }`

### Issue #3: Search by Bin Not Working
**Symptoms:** Type "A1:1" → No products returned, or all products shown

**Debugging Steps:**
1. **Check Bin Detection Logic**
   ```javascript
   // In app.fabric.jsx:27-34
   const isBinSearch = query && (
     query.toLowerCase().includes('bin') ||
     /^\d/.test(query) ||              // starts with number
     /^[a-zA-Z]+\d+/.test(query) ||   // letters followed by numbers
     /^[a-zA-Z]\d+/.test(query)       // letter followed by number
   );
   ```
   - Does "A1:1" match these patterns?
   - Test regex: `/^[a-zA-Z]\d+/.test("A1:1")` → Should be true

2. **Check Metafield Query**
   - When `isBinSearch = true`, are we filtering by metafield?
   - Look at `getFabricInventory()` in `app/services/order.server.js`
   - Does it build the correct GraphQL query?

3. **Check Stored Metafield Values**
   - In Shopify Admin, open product
   - Go to Product > Metafields
   - Check if `custom.bin_locations` exists and has correct value
   - Must match exactly what was stored

### Issue #4: Bin Dropdown/List Not Showing
**Symptoms:** Modal opens but list is empty or not loading

**Debugging Steps:**
1. **Check Server Data**
   - In loader: `getBinLocations(shop)` should return array
   - Check database has records: `db.binLocation.findMany()`
   - Verify `shop` domain matches session

2. **Check Props Passing**
   - `binLocations` passed from loader → component state
   - useEffect updates local state when server data changes
   - Check React DevTools: component props and state

3. **Check Filter/Search in Modal**
   - If filtering text input exists, try clearing it
   - Check if search is case-sensitive
   - Test with exact location names

### Issue #5: Database Migrations
**Symptoms:** Column not found, table missing, unique constraint errors

**Debugging Steps:**
1. **Check Schema**
   - `BinLocation` model exists in `prisma/schema.prisma`?
   - Has correct fields: `id, shop, location, createdAt`?
   - Has correct constraints: `@@unique([shop, location])`?

2. **Run Migrations**
   ```bash
   npx prisma migrate dev
   npx prisma db push
   ```

3. **Reset Development DB** (if needed)
   ```bash
   npx prisma migrate reset
   # This will delete all data and re-run migrations
   ```

4. **Check SQLite File**
   - Location: typically `dev.sqlite` in project root
   - If missing, migrations will create it
   - Check file permissions

---

## Complete End-to-End Testing Script

### Step 1: Verify Database Setup
```javascript
// Run in browser console or test file
const response = await fetch('/api/check-bins', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ action: 'count' })
});
// Should show count of existing bins
```

### Step 2: Test File Import
1. Create test file `test_bins.txt`:
   ```
   A1:1 A1:2 A1:3 A1:4 A1:5 A1:6
   A2:1 A2:2 A2:3 A2:4 A2:5 A2:6
   ```
2. Go to Fabric Inventory → Click "Import Bin Locations"
3. Select file → Click Import
4. **Expected:** "Added 12 locations" message (or "0 added, 12 duplicates" if already imported)

### Step 3: Test Bin Assignment
1. Click any product in the table
2. Find "Assign Bin" button/action
3. Select `A1:1` from dropdown
4. **Expected:** Product shows "A1:1" in bin column

### Step 4: Test Search by Bin
1. Type "A1:1" in search box
2. Wait 600ms for debounce
3. **Expected:** Only products with bin "A1:1" appear

### Step 5: Test Manual Entry
1. Click "Add Manual Bin Location"
2. Type "TEST:LOCATION"
3. Click "Add"
4. **Expected:** New location appears in dropdown list

### Step 6: Test Clear
1. Click "Clear X Locations" button
2. Confirm in dialog
3. **Expected:** All bins removed from database and dropdown

---

## Code Inspection Checklist

### app/models/binLocations.server.js
- [ ] All functions are async
- [ ] Error handling returns proper { success, error } format
- [ ] Unique constraint is respected (catches duplicate errors)
- [ ] Shop filter is applied in all queries

### app/utils/binLocationParser.js
- [ ] Handles CSV format (comma-separated)
- [ ] Handles TXT format (newline-separated)
- [ ] Auto-detects delimiter
- [ ] Removes headers ("location", "bin", "bin location")
- [ ] Removes duplicates
- [ ] Trims whitespace
- [ ] Returns sorted array

### app/routes/app.fabric.jsx
- [ ] Loader: `getBinLocations(shop)` returns array
- [ ] Action: `importBinLocations` receives JSON array
- [ ] Action: `updateBin` sends correct GraphQL mutation
- [ ] Action: `deleteBinLocation` removes from DB
- [ ] Action: `clearAllBinLocations` clears all
- [ ] Bin search detection logic: `/^[a-zA-Z]\d+/` test
- [ ] Modal/Dropdown renders bin locations

### app/routes/app.settings.jsx
- [ ] Bin location management is NOT here
- [ ] (Bin features are in app.fabric.jsx)

### prisma/schema.prisma
- [ ] `BinLocation` model exists
- [ ] Unique constraint: `@@unique([shop, location])`
- [ ] Index on shop: `@@index([shop])`

---

## Network & API Debugging

### Check API Responses
Open DevTools → Network tab → Filter by:
- POST requests to `/app/fabric` or `/app`
- Look for action form submissions
- Check response JSON for `{ success: true/false }`

### Common Response Errors
```javascript
// Wrong: Missing success field
{ added: 10, duplicates: 2, total: 12 }

// Right: Must have success
{ success: true, added: 10, duplicates: 2, total: 12 }

// Duplicate error
{ success: false, error: "already exists" }

// Empty location error
{ success: false, error: "Location cannot be empty" }
```

### GraphQL Mutation Check
If `updateBin` fails, the mutation response may have:
```javascript
{
  data: {
    metafieldsSet: {
      metafields: [...],
      userErrors: [
        { field: "ownerId", message: "Invalid ID format" },
        { field: "namespace", message: "..."}
      ]
    }
  }
}
```

---

## Performance Considerations

1. **Large Import (1000+ locations)**
   - Check if import loop is blocking
   - Each location creates DB entry one-by-one
   - Consider batch insert if slow

2. **Search Performance**
   - Debounce delay: 600ms (in app.fabric.jsx:95)
   - GraphQL query with large product dataset
   - Index on `shop` field helps filtering

3. **Dropdown Rendering**
   - If 10,000+ locations: consider pagination or virtual scroll
   - Current implementation loads all at once

---

## Questions to Ask When Debugging

1. **Is the data in the database?**
   - Run: `SELECT * FROM "BinLocation" WHERE shop = 'your-shop'`
   - Or check with Prisma Studio: `npx prisma studio`

2. **Are the bins being returned by the loader?**
   - Add console.log in loader: `console.log("Bins:", binLocations)`
   - Check DevTools > Network > check payload

3. **Is the form action being triggered?**
   - Add console.log in action: `console.log("Action:", actionType)`
   - Check form submission in DevTools

4. **Is the GraphQL mutation successful?**
   - Check `userErrors` array in response
   - Verify metafield namespace and key are correct

5. **Is the shop domain correct?**
   - Must match `session.shop` exactly
   - Example: `mystore.myshopify.com`

---

## IDE Debugging Prompt Template

When asking your IDE for help, use this template:

```
I'm debugging the bin location feature in my Fabric Scanner app.
The issue is: [DESCRIBE YOUR ISSUE]

Current observations:
- [What happens when you test]
- [What you expected to happen]
- [Any error messages in console/logs]

Code files involved:
- app/models/binLocations.server.js (Database CRUD operations)
- app/utils/binLocationParser.js (File parsing logic)
- app/routes/app.fabric.jsx (UI and actions)
- prisma/schema.prisma (BinLocation model)

Database:
- Table: BinLocation (shop, location, createdAt, with unique constraint)
- Operations: import, add manual, delete, clear all

Please help me debug by:
1. [Check specific code section]
2. [Verify if this logic is working]
3. [Suggest test cases to validate]
4. [Check console logs for errors]
```

---

## Quick Reference: Function Signatures

```javascript
// Database Functions
getBinLocations(shop)                          // → Promise<string[]>
importBinLocations(shop, locations)            // → Promise<{added, duplicates, total}>
addManualBinLocation(shop, location)           // → Promise<{success, error?}>
deleteBinLocation(shop, location)              // → Promise<void>
clearAllBinLocations(shop)                     // → Promise<void>

// Parser Functions
parseBinLocations(fileType, fileContent)       // → Promise<string[]>
validateFileSize(file, maxSizeMB)              // → boolean
readFileAsText(file)                           // → Promise<string>
```

---

## Summary

If the bin location feature isn't working in your live app:

1. **First:** Check if data is in the database
2. **Second:** Verify import action is being triggered
3. **Third:** Check GraphQL mutation responses for errors
4. **Fourth:** Inspect network requests in DevTools
5. **Fifth:** Verify shop domain matches across all operations
6. **Finally:** Check for any GraphQL schema changes from Shopify

Use this document as your comprehensive debugging guide for the IDE.
