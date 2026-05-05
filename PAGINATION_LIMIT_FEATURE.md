# Pagination Limit Feature Implementation

## Overview
Added a flexible pagination system that allows users to choose how many items to display per page (5, 10, 25, or 50) across all order sections in the admin dashboard.

## Problem Solved
Previously, users were limited to viewing only 5 items per page, requiring multiple page loads to view larger sets of orders. This feature allows users to customize their viewing experience based on their needs.

## Changes Made

### 1. Backend Service Layer (`app/services/order.server.js`)

Updated all three order fetching functions to accept a `limit` parameter:

#### Function Signatures Updated:
- `getFabricOrders(admin, cursor, direction, searchQuery, limit = 5)`
- `getFulfilledFabricOrders(admin, cursor, direction, searchQuery, limit = 5)`
- `getPartiallyFulfilledOrders(admin, cursor, direction, searchQuery, limit = 5)`

#### Implementation:
- Default limit is 5 (maintains backward compatibility)
- Dynamic pagination args: `` `first: ${limit}` `` or `` `last: ${limit}` ``
- Supports limits: 5, 10, 25, 50

### 2. Admin Dashboard Loader (`app/routes/app.home.jsx`)

#### URL Parameter Handling:
Added limit parameters for each section:
- `pendingLimit` - for pending orders
- `partialLimit` - for partially fulfilled orders
- `fulfilledLimit` - for fulfilled orders

#### Loader Updates:
```javascript
const pendingLimit = parseInt(url.searchParams.get("pendingLimit") || "5");
const partialLimit = parseInt(url.searchParams.get("partialLimit") || "5");
const fulfilledLimit = parseInt(url.searchParams.get("fulfilledLimit") || "5");
```

Passes limit to service functions and returns to component.

### 3. Admin Dashboard UI (`app/routes/app.home.jsx`)

#### New UI Components:
- Added `Select` component import from Polaris
- Page size selector dropdown for each section
- Options: 5, 10, 25, 50 items per page

#### State Management:
```javascript
const [pendingPageSize, setPendingPageSize] = useState(String(initialPendingLimit));
const [partialPageSize, setPartialPageSize] = useState(String(initialPartialLimit));
const [fulfilledPageSize, setFulfilledPageSize] = useState(String(initialFulfilledLimit));
```

#### Change Handlers:
- `handlePendingPageSizeChange()`
- `handlePartialPageSizeChange()`
- `handleFulfilledPageSizeChange()`

Each handler:
1. Updates local state
2. Updates URL parameter
3. Resets pagination (clears cursor, resets to page 1)
4. Triggers data reload

#### UI Layout:
Each section now has a header with:
- Section title (left)
- Page size selector (140px width)
- Search input (300px width)

### 4. API Proxy Route (`app/routes/app.api.proxy.$.jsx`)

Updated three endpoints to handle limit parameter:

#### `orders` endpoint:
```javascript
const limit = parseInt(url.searchParams.get("limit") || "5");
const result = await getFabricOrders(admin, cursor, direction, searchQuery, limit);
```

#### `fulfilled` endpoint:
```javascript
const limit = parseInt(url.searchParams.get("limit") || "5");
const result = await getFulfilledFabricOrders(admin, cursor, direction, searchQuery, limit);
```

#### `partial` endpoint:
```javascript
const limit = parseInt(url.searchParams.get("limit") || "5");
const result = await getPartiallyFulfilledOrders(admin, cursor, direction, searchQuery, limit);
```

### 5. Index Calculation Fix

Updated order numbering to use dynamic page size:
```javascript
// Before:
index={(parseInt(searchParams.get("pendingPage") || "1") - 1) * 5 + idx + 1}

// After:
index={(parseInt(searchParams.get("pendingPage") || "1") - 1) * parseInt(pendingPageSize) + idx + 1}
```

Applied to all three sections (pending, partial, fulfilled).

## User Experience

### Page Size Options:
- **5 per page** - Default, quick browsing
- **10 per page** - Balanced view
- **25 per page** - Larger overview
- **50 per page** - Maximum items per page

### Behavior:
1. **Independent Settings**: Each section (Pending, Partial, Fulfilled) has its own page size setting
2. **Persistent**: Page size persists in URL parameters across page refreshes
3. **Reset on Change**: Changing page size resets to page 1 (prevents showing empty pages)
4. **Combined with Search**: Works seamlessly with search functionality

### UI Layout:
```
┌─────────────────────────────────────────────────────────────┐
│ Section Title          [Page Size ▼] [Search Input...    ] │
└─────────────────────────────────────────────────────────────┘
```

## Technical Details

### URL Parameter Format:
```
?pendingLimit=10&partialLimit=25&fulfilledLimit=5
&pendingSearch=john&partialSearch=&fulfilledSearch=
&pendingCursor=abc123&partialCursor=&fulfilledCursor=
```

### GraphQL Query Impact:
```graphql
# Before (hardcoded):
orders(first: 5, after: $cursor, reverse: true, query: $query)

# After (dynamic):
orders(first: ${limit}, after: $cursor, reverse: true, query: $query)
```

### Performance Considerations:
- Larger page sizes (25, 50) fetch more data per request
- Reduces total number of API calls for users viewing many orders
- Shopify GraphQL handles pagination efficiently with cursors
- No significant performance impact on backend

## Benefits

1. **Flexibility**: Users choose their preferred viewing density
2. **Efficiency**: Fewer page loads for users managing many orders
3. **Consistency**: Same feature across all order sections
4. **Compatibility**: Works with existing search and pagination features
5. **User Control**: Each section can have different page sizes

## Future Enhancements

Potential improvements:
- Remember user's preferred page size (localStorage or user settings)
- Add "View All" option (with reasonable limit like 100)
- Show total count with page size selector
- Add keyboard shortcuts for changing page size
- Export functionality for large datasets

## Testing Recommendations

1. **Page Size Changes**:
   - Test all four options (5, 10, 25, 50)
   - Verify correct number of items displayed
   - Check pagination controls update correctly

2. **Combined Features**:
   - Change page size while search is active
   - Change page size on different pages (not page 1)
   - Verify reset to page 1 behavior

3. **Edge Cases**:
   - Fewer items than selected page size
   - Exactly matching page size
   - Empty results

4. **Performance**:
   - Test with 50 items per page
   - Verify load times are acceptable
   - Check for any UI lag

5. **Persistence**:
   - Refresh page and verify page size persists
   - Navigate away and back
   - Test with multiple browser tabs

## Bug Fixes Included

### Issue: Orders Not Displaying
**Problem**: After adding search parameters, orders weren't showing because the loader expected search parameters but initial load didn't provide them.

**Solution**: Added default values in destructuring:
```javascript
// Before:
const { pendingSearch: initialPendingSearch } = useLoaderData();

// After:
const { pendingSearch: initialPendingSearch = "" } = useLoaderData();
```

This ensures empty string defaults when parameters are missing, allowing orders to load correctly on initial page load.
