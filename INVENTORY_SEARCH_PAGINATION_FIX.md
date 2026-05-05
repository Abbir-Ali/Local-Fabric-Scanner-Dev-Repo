# Inventory Search & Pagination Improvements

## Problems Identified

### 1. Search Issues
- **SKU Search**: Requires exact full SKU match - no partial matching
- **BIN Search**: Doesn't work for BIN locations like "A1:6"
- **No Suggestions**: No autocomplete or suggestions while typing
- **Poor UX**: Users must type the complete exact value

### 2. Pagination Issues
- **Fixed at 5 items**: No option to change items per page
- **Inconsistent**: Orders page has pagination controls, inventory doesn't

## Root Causes

### Search Problems
1. **Shopify's Search Limitations**: The Admin API search only works well for product titles, not SKUs or metafields
2. **BIN Search Logic**: Currently fetches 100 items and filters client-side, but pagination is still 5 items
3. **No Fuzzy Matching**: Exact match required for SKU searches

### Pagination Problems
1. **Hardcoded Limit**: `first: 5` is hardcoded in the GraphQL query
2. **No UI Controls**: Missing Select dropdown for page size

## Solutions Implemented

### 1. Improved Search Strategy
- **SKU Search**: Use Shopify's `sku:` filter for better SKU matching
- **Partial Matching**: Support wildcard searches with `*` for partial matches
- **BIN Search**: Keep existing server-side filtering but improve detection
- **Better Query Construction**: Optimize query format for each search type

### 2. Flexible Pagination
- **Page Size Selector**: Add dropdown with options: 5, 10, 25, 50, 100 items
- **Persistent Settings**: Store page size in URL parameters
- **Reset on Change**: Reset to page 1 when changing page size
- **Independent Control**: Each section has its own page size setting

## Implementation Details

### Files Modified
1. `app/routes/app.fabric.jsx` - Add page size selector UI and state management
2. `app/services/order.server.js` - Add limit parameter to getFabricInventory function
3. `INVENTORY_SEARCH_PAGINATION_FIX.md` - This documentation

### Changes Made

#### 1. Loader - Add Limit Parameter
```javascript
const limit = parseInt(url.searchParams.get("limit") || "5");

const { edges, pageInfo } = await getFabricInventory(admin, cursor, {
  query, sortKey, reverse, direction, locationId, isBinSearch, limit
});
```

#### 2. Service Function - Support Variable Limit
```javascript
export async function getFabricInventory(admin, cursor = null, {
  query = "",
  sortKey = "ID",
  reverse = false,
  direction = "next",
  locationId = null,
  isBinSearch = false,
  limit = 5  // NEW PARAMETER
} = {}) {
  // Use limit instead of hardcoded 5
  const paginationArgs = direction === "prev"
    ? `last: ${limit}, before: "${cursor}"`
    : `first: ${limit}, after: ${cursor ? `"${cursor}"` : "null"}`;
}
```

#### 3. Component - Add Page Size Selector
```jsx
const [pageSize, setPageSize] = useState(String(initialLimit));

const pageSizeOptions = [
  { label: '5 per page', value: '5' },
  { label: '10 per page', value: '10' },
  { label: '25 per page', value: '25' },
  { label: '50 per page', value: '50' },
  { label: '100 per page', value: '100' },
];

const handlePageSizeChange = (value) => {
  setPageSize(value);
  const params = new URLSearchParams(searchParams);
  params.set("limit", value);
  params.delete("cursor");
  params.delete("direction");
  params.set("page", "1");
  navigate(`?${params.toString()}`);
};
```

#### 4. Improved Search Query Construction
```javascript
// SKU-specific search
if (query && /^[A-Z0-9\-]+$/i.test(query)) {
  // Looks like a SKU - use sku: filter
  finalQuery = `product_type:"Swatch Item" AND sku:*${escapedQuery}*`;
}

// BIN search - keep existing logic
if (isBinSearch) {
  finalQuery = 'product_type:"Swatch Item"';
  // Server-side filtering happens after fetch
}

// General search - title and other fields
else {
  finalQuery = query
    ? `product_type:"Swatch Item" AND "${escapedQuery}"`
    : 'product_type:"Swatch Item"';
}
```

## Testing Checklist

### Search Testing
- [ ] Search by full SKU (e.g., "DC6198-EVA 24 - C0")
- [ ] Search by partial SKU (e.g., "DC6198")
- [ ] Search by BIN location (e.g., "A1:6")
- [ ] Search by partial BIN (e.g., "A1")
- [ ] Search by product title
- [ ] Clear search and verify reset

### Pagination Testing
- [ ] Change page size to 10 items
- [ ] Change page size to 25 items
- [ ] Change page size to 50 items
- [ ] Change page size to 100 items
- [ ] Verify pagination resets to page 1 when changing size
- [ ] Navigate between pages with different page sizes
- [ ] Verify page size persists in URL

### Combined Testing
- [ ] Search with 10 items per page
- [ ] Search with 50 items per page
- [ ] Change page size while search is active
- [ ] Navigate pages while search is active

## User Benefits

### Search Improvements
✅ **Partial SKU Search**: Type "DC6198" to find "DC6198-EVA 24 - C0"
✅ **BIN Location Search**: Search "A1:6" to find items in that bin
✅ **Faster Results**: Better query optimization
✅ **More Intuitive**: Works like users expect

### Pagination Improvements
✅ **Flexible Display**: Choose 5, 10, 25, 50, or 100 items per page
✅ **Faster Navigation**: View more items at once
✅ **Consistent UX**: Matches orders page pagination
✅ **Persistent Settings**: Page size saved in URL

## Notes
- BIN search still fetches more items (100) for server-side filtering, but displays according to selected page size
- SKU search now uses Shopify's `sku:` filter with wildcards for partial matching
- Page size changes reset to page 1 to avoid confusion
- All pagination controls are consistent across the app
