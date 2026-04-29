# Live App: Bin Location Feature - Complete Implementation Checklist

Use this to verify all components of the bin location feature are properly implemented in your live app.

---

## ✅ Database Layer

### 1. Prisma Schema (`prisma/schema.prisma`)

Check that this model exists:

```prisma
model BinLocation {
  id        Int      @id @default(autoincrement())
  shop      String
  location  String
  createdAt DateTime @default(now())

  @@unique([shop, location])
  @@index([shop])
}
```

**Checklist:**
- [ ] `BinLocation` model exists in schema.prisma
- [ ] Has `id`, `shop`, `location`, `createdAt` fields
- [ ] Has unique constraint on `[shop, location]`
- [ ] Has index on `shop`
- [ ] Migration has been run: `npx prisma migrate deploy`

### 2. Database File

**For Local/Development:**
- [ ] `dev.sqlite` file exists in project root
- [ ] File has been created by running migrations
- [ ] File permissions allow read/write

**For Live/Production:**
- [ ] Database initialized with proper migrations
- [ ] `BinLocation` table created in production database
- [ ] No errors during migration

---

## ✅ Backend Functions

### 3. Database CRUD Functions (`app/models/binLocations.server.js`)

All these functions should exist and be exported:

```javascript
export async function getBinLocations(shop) { }
export async function importBinLocations(shop, locations) { }
export async function addManualBinLocation(shop, location) { }
export async function deleteBinLocation(shop, location) { }
export async function clearAllBinLocations(shop) { }
```

**Checklist:**
- [ ] All 5 functions exported
- [ ] `getBinLocations()` returns `Promise<string[]>`
- [ ] `importBinLocations()` returns `{added, duplicates, total}`
- [ ] `addManualBinLocation()` returns `{success, error?}`
- [ ] `deleteBinLocation()` and `clearAllBinLocations()` exist
- [ ] All functions filter by `shop` parameter
- [ ] Error handling with try/catch blocks
- [ ] Duplicate handling with unique constraint

### 4. Parser Functions (`app/utils/binLocationParser.js`)

All these functions should exist and be exported:

```javascript
export async function parseBinLocations(fileType, fileContent) { }
export function validateFileSize(file, maxSizeMB = 5) { }
export function readFileAsText(file) { }
```

**Checklist:**
- [ ] All 3 functions exported
- [ ] `parseBinLocations()` handles CSV format
- [ ] `parseBinLocations()` handles TXT format
- [ ] `parseBinLocations()` auto-detects delimiter
- [ ] Removes headers ("location", "bin", "bin location")
- [ ] Removes duplicates
- [ ] Trims whitespace
- [ ] Returns sorted array
- [ ] `validateFileSize()` checks 5MB limit
- [ ] `readFileAsText()` returns Promise<string>

---

## ✅ Frontend Route & Actions

### 5. Loader (`app/routes/app.fabric.jsx` - loader function)

**Must have:**
```javascript
export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  // ... other code ...

  const binLocations = await getBinLocations(session.shop);

  return {
    // ... other returns ...
    binLocations,
  };
};
```

**Checklist:**
- [ ] `getBinLocations()` imported from models
- [ ] Called in loader with `session.shop`
- [ ] Returned in loader response object
- [ ] `binLocations` is array (or empty array)

### 6. Actions (`app/routes/app.fabric.jsx` - action function)

**Must handle these action types:**

```javascript
if (actionType === "importBinLocations") {
  const locationsJson = formData.get("locations");
  const locations = JSON.parse(locationsJson || "[]");
  const result = await importBinLocations(shop, locations);
  return { success: true, actionType, ...result };
}

if (actionType === "addManualBinLocation") {
  const location = formData.get("location");
  const result = await addManualBinLocation(shop, location);
  return { ...result, actionType };
}

if (actionType === "deleteBinLocation") {
  const location = formData.get("location");
  await deleteBinLocation(shop, location);
  return { success: true, actionType, deleted: location };
}

if (actionType === "clearAllBinLocations") {
  await clearAllBinLocations(shop);
  return { success: true, actionType };
}

if (actionType === "updateBin") {
  const productId = formData.get("productId");
  const binValue = formData.get("binValue");
  // GraphQL mutation to update metafield
  const response = await admin.graphql(`#graphql
    mutation updateBin($ownerId: ID!, $value: String!) {
      metafieldsSet(metafields: [
        {
          ownerId: $ownerId,
          namespace: "custom",
          key: "bin_locations",
          type: "single_line_text_field",
          value: $value
        }
      ]) {
        metafields { id value }
        userErrors { field message }
      }
    }`,
    { variables: { ownerId: productId, value: binValue || "" } }
  );
  // ... handle response ...
}
```

**Checklist:**
- [ ] All 5 action types handled: import, add, delete, clear, update
- [ ] `importBinLocations` imported from models
- [ ] Form data properly parsed
- [ ] GraphQL mutation correct for `updateBin`
- [ ] All responses include `{ success: true/false }`
- [ ] Error messages returned when applicable

### 7. Component State (`app/routes/app.fabric.jsx` - component function)

**Must initialize and sync state:**

```javascript
const { binLocations: serverBinLocations } = useLoaderData();
const [binLocations, setBinLocations] = useState(serverBinLocations || []);

useEffect(() => {
  setBinLocations(serverBinLocations || []);
}, [serverBinLocations]);
```

**Checklist:**
- [ ] `useLoaderData()` retrieves `binLocations`
- [ ] Local state initialized from server data
- [ ] `useEffect()` syncs state when server data changes
- [ ] State passed to modal/dropdown component

### 8. UI Components (Import Modal & Dropdown)

**Must have:**
1. **Import Button** - Opens file upload modal
2. **File Input** - Accepts CSV/TXT files
3. **Upload Handler** - Calls `parseBinLocations()` then `importBinLocations` action
4. **Dropdown/Modal** - Shows list of bin locations
5. **Assign Button** - Triggers `updateBin` action with selected location
6. **Manual Add** - Input field to add single location
7. **Delete** - Button to remove individual location
8. **Clear All** - Button to remove all locations with confirmation

**Checklist:**
- [ ] "Import Bin Locations" button visible
- [ ] File input accepts `.csv` and `.txt` files
- [ ] File validation uses `validateFileSize()`
- [ ] File reading uses `readFileAsText()`
- [ ] Parsing uses `parseBinLocations(fileType, content)`
- [ ] Import action triggered with JSON stringified locations
- [ ] Bin dropdown/modal renders array of locations
- [ ] Clicking location calls `updateBin` action
- [ ] Manual add form submits with `actionType: "addManualBinLocation"`
- [ ] Delete action called with `actionType: "deleteBinLocation"`
- [ ] Clear all shows confirmation dialog before deleting
- [ ] Feedback messages shown (success/error banners)

---

## ✅ Search/Filter Logic

### 9. Bin Search Detection (`app/routes/app.fabric.jsx` - loader)

**Must detect bin searches:**

```javascript
const isBinSearch = query && (
  query.toLowerCase().includes('bin') ||
  /^\d/.test(query) ||              // starts with number
  /^[a-zA-Z]+\d+/.test(query) ||   // letters followed by numbers
  /^[a-zA-Z]\d+/.test(query)       // letter followed by number
);
```

**Checklist:**
- [ ] `isBinSearch` logic exists in loader
- [ ] Regex pattern tests are correct
- [ ] `isBinSearch` passed to `getFabricInventory()`
- [ ] Component receives `isBinSearch` prop

### 10. Metafield Filtering (`app/services/order.server.js`)

**Must check:**
- [ ] `getFabricInventory()` accepts `isBinSearch` parameter
- [ ] When `isBinSearch = true`, builds special GraphQL query
- [ ] Query filters products by metafield `custom.bin_locations`
- [ ] Metafield value matches the search query exactly

---

## ✅ Integration Points

### 11. Imports & Dependencies

**In app.fabric.jsx, check imports:**
```javascript
import {
  getBinLocations,
  importBinLocations,
  addManualBinLocation,
  deleteBinLocation,
  clearAllBinLocations
} from "../models/binLocations.server";
```

**In action function, check:**
```javascript
import { parseBinLocations, validateFileSize, readFileAsText } from "../utils/binLocationParser";
```

**Checklist:**
- [ ] All functions imported in app.fabric.jsx
- [ ] Import paths are correct
- [ ] No circular dependencies
- [ ] Functions are actually exported from their files

### 12. Session & Shop Domain

**Must verify:**
```javascript
const { session } = await authenticate.admin(request);
const shop = session.shop; // e.g., "mystore.myshopify.com"

// All bin operations use this shop domain
await getBinLocations(shop);
await importBinLocations(shop, locations);
```

**Checklist:**
- [ ] `session.shop` is consistent across operations
- [ ] Shop domain includes `.myshopify.com`
- [ ] All database queries filter by same shop value
- [ ] No shop mismatches between operations

---

## ✅ Testing Checklist

### Before Going Live:

1. **Database Test**
   - [ ] Can add bin location to database
   - [ ] Unique constraint prevents duplicates
   - [ ] Locations are shop-specific
   - [ ] Query returns only locations for current shop

2. **Import Test**
   - [ ] Upload CSV file with 10 locations
   - [ ] System correctly parses and stores
   - [ ] UI shows "Added X locations"
   - [ ] Re-uploading shows "0 added, 10 duplicates"

3. **Assignment Test**
   - [ ] Click "Assign Bin" on a product
   - [ ] Dropdown shows imported locations
   - [ ] Select location and save
   - [ ] Check Shopify Admin: metafield updated with correct value
   - [ ] In app: product displays assigned bin

4. **Search Test**
   - [ ] Type bin number in search (e.g., "A1:1")
   - [ ] Wait 600ms for debounce
   - [ ] Results show only products with that bin assigned
   - [ ] Clear search returns all products

5. **Manual Add Test**
   - [ ] Click "Add Manual Bin Location"
   - [ ] Type location name
   - [ ] Click Add
   - [ ] New location appears in dropdown immediately

6. **Delete Test**
   - [ ] Click delete icon next to bin location
   - [ ] Location removed from dropdown
   - [ ] Products with that bin no longer show it (optional cleanup)

7. **Clear All Test**
   - [ ] Click "Clear All Locations"
   - [ ] Confirm in dialog
   - [ ] All locations removed
   - [ ] Dropdown becomes empty
   - [ ] Products lose their bin assignments

8. **Edge Cases**
   - [ ] Empty file import → Should show error
   - [ ] File with headers → Headers stripped automatically
   - [ ] Duplicate entries in file → Counted as duplicates
   - [ ] Whitespace in names → Trimmed automatically
   - [ ] Very long location names → Should store and display correctly
   - [ ] Special characters → Should be preserved

---

## ✅ Common Missing Components

If the feature isn't working, one of these is likely missing:

| Component | File | Impact |
|-----------|------|--------|
| BinLocation model | `prisma/schema.prisma` | Cannot store locations |
| Database functions | `app/models/binLocations.server.js` | Cannot perform CRUD operations |
| Parser functions | `app/utils/binLocationParser.js` | Cannot upload files |
| Import action | `app/routes/app.fabric.jsx` | Cannot import from file |
| Add/Delete/Clear actions | `app/routes/app.fabric.jsx` | Cannot manage locations |
| UpdateBin action | `app/routes/app.fabric.jsx` | Cannot assign to products |
| Loader fetch | `app/routes/app.fabric.jsx` | Dropdown empty |
| Component state | `app/routes/app.fabric.jsx` | State not syncing |
| Import UI button | `app/routes/app.fabric.jsx` | User can't access feature |
| Dropdown component | `app/routes/app.fabric.jsx` | Can't see or select locations |
| Bin search logic | `app/routes/app.fabric.jsx` | Can't search by bin |

---

## ✅ How to Diagnose What's Missing

Run this checklist in order:

1. **Search codebase for "BinLocation"**
   - If found in schema.prisma → ✅ Database layer exists
   - If not found → ❌ Database schema missing

2. **Search for "importBinLocations"**
   - If found in binLocations.server.js → ✅ Backend functions exist
   - If found in app.fabric.jsx → ✅ Action handler exists
   - If only one place → ❌ Something missing

3. **Search for "parseBinLocations"**
   - If found in binLocationParser.js → ✅ Parser exists
   - If found in app.fabric.jsx → ✅ Being used in frontend
   - If not found → ❌ Parser missing or not imported

4. **Search for "getBinLocations" in loader**
   - If found → ✅ Loader fetches data
   - If not found → ❌ Loader missing this call

5. **Search for "binLocations" in component**
   - If found in useState → ✅ State management exists
   - If found in useEffect → ✅ State syncing exists
   - If neither → ❌ State management missing

6. **Search for "Import" button/modal**
   - If found → ✅ UI exists
   - If not found → ❌ UI missing

7. **Check DevTools Console**
   - Any errors about missing functions?
   - Any GraphQL errors from `updateBin` mutation?
   - Any database errors from Prisma?

---

## ✅ Quick Fix Guide

**If import shows 0 added:**
1. Check file format (CSV/TXT only)
2. Check if locations already exist (duplicates)
3. Check parser is working: test with simple "A1:1,A1:2,A1:3"
4. Check `importBinLocations()` in action handler

**If dropdown is empty:**
1. Check `getBinLocations()` in loader
2. Check `binLocations` prop passed to component
3. Check state initialized: `useState(serverBinLocations || [])`
4. Check useEffect syncs state: `setBinLocations(serverBinLocations)`

**If assignment doesn't save:**
1. Check `updateBin` action exists
2. Check GraphQL mutation response has no `userErrors`
3. Check product ID is in `gid://shopify/Product/123456` format
4. Check shop has `write_products` scope in `shopify.app.toml`

**If search by bin doesn't work:**
1. Check `isBinSearch` detection logic in loader
2. Check regex patterns match your format (e.g., "A1:1")
3. Check `getFabricInventory()` uses `isBinSearch` param
4. Check metafield query filters correctly

---

## ✅ When to Ask for IDE Help

If any of these are missing or broken, ask your IDE:

```
In my Live Fabric Scanner app, the bin location feature is not working.
Here's what I verified is missing/broken:
- [ ] BinLocation database model
- [ ] importBinLocations() function
- [ ] parseBinLocations() function
- [ ] Import action handler in app.fabric.jsx
- [ ] Bin dropdown UI component
- [ ] getBinLocations() in loader
- [ ] updateBin GraphQL mutation
- [ ] State management for binLocations

Please scan app/routes/app.fabric.jsx and tell me which of these components
are missing, and provide the exact code to add/fix.
```

---

## Summary

Before asking IDE for help, check:
1. ✅ Is BinLocation model in schema.prisma?
2. ✅ Are all CRUD functions in binLocations.server.js?
3. ✅ Is parser in binLocationParser.js?
4. ✅ Are import/add/delete/clear actions in app.fabric.jsx?
5. ✅ Is getBinLocations() called in loader?
6. ✅ Is binLocations prop used in component?
7. ✅ Is import UI button visible?
8. ✅ Is dropdown rendered with locations?

If all 8 are ✅, the feature should work. If any are ❌, that's what needs to be fixed.
