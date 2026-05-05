# Scanner Extension Pagination Index Fix

## Issue
The scanner extension (scanner.liquid) was showing incorrect item indices on paginated pages.

**Example:**
- Page 1: Items 1-5 ✅ (correct)
- Page 2: Items 11-15 ❌ (should be 6-10)

The index was jumping from 5 to 11 instead of continuing sequentially.

## Root Cause
The JavaScript code in `print-label.js` was calculating indices based on **10 items per page**, but the backend API was actually returning **5 items per page**.

### Incorrect Calculations:
```javascript
// Orders
const orderRowIdx = (ordPage - 1) * 10 + idx + 1;  // ❌ Wrong

// History
const hIdx = (histPage - 1) * 10 + idx + 1;  // ❌ Wrong

// Inventory
const displayNumber = (invPage - 1) * 10 + idx + 1;  // ❌ Wrong
```

### Backend Reality:
```javascript
// app/routes/app.api.proxy.$.jsx
const limit = parseInt(url.searchParams.get("limit") || "5");  // ✅ Actually 5

// app/services/order.server.js
export async function getFabricInventory(admin, cursor = null, {
  limit = 5  // ✅ Default is 5
} = {}) {
```

## Solution
Changed all index calculations from `* 10` to `* 5` to match the actual page size:

### Correct Calculations:
```javascript
// Orders
const orderRowIdx = (ordPage - 1) * 5 + idx + 1;  // ✅ Correct

// History
const hIdx = (histPage - 1) * 5 + idx + 1;  // ✅ Correct

// Inventory
const displayNumber = (invPage - 1) * 5 + idx + 1;  // ✅ Correct
```

## Files Modified
- `extensions/scanner-extension/assets/print-label.js` (4 occurrences fixed)
  - Line ~335: History rendering (first occurrence)
  - Line ~491: Inventory rendering
  - Line ~600: Orders rendering
  - Line ~896: History rendering (second occurrence - loadHistory function)

## Result
Now the indices display correctly:
- Page 1: Items 1-5 ✅
- Page 2: Items 6-10 ✅
- Page 3: Items 11-15 ✅

## Testing
To verify the fix:
1. Navigate to the scanner extension
2. Go to Orders, History, or Stock tab
3. Navigate to page 2
4. Verify that item #6 is shown (not #11)
5. Navigate to page 3
6. Verify that item #11 is shown (not #21)

## Technical Details
- **Page size**: 5 items per page (consistent across all endpoints)
- **Index formula**: `(currentPage - 1) * itemsPerPage + itemIndex + 1`
- **Example for page 2, item 1**: `(2 - 1) * 5 + 0 + 1 = 6` ✅
