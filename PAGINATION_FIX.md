# Cursor Pagination Fix - Dashboard

## Problem
When clicking "Next" on the Pending Orders pagination, the page would show 0 orders even though the next button was enabled. This affected all three paginated sections on the dashboard:
- Pending Swatch Orders
- Partially Fulfilled Orders
- Fulfilled History

## Root Cause
The `getFabricOrders` function in `app/services/order.server.js` was fetching orders with the query:
```
(fulfillment_status:unfulfilled OR fulfillment_status:partial) AND tag:swatch-only
```

This returned BOTH unfulfilled and partial orders. The frontend then filtered out partial orders to prevent duplicates:
```javascript
const partialIds = new Set(partialData.edges.map(e => e.node.id));
const pendingFiltered = pendingData.edges.filter(e => !partialIds.has(e.node.id));
```

**The Issue**: When navigating to page 2, if that page only contained partial orders, after filtering them out, the pending section would show 0 results - but the pagination still thought there was a next page.

## Solution

### 1. Updated GraphQL Query
Changed `getFabricOrders` to only fetch truly unfulfilled orders:
```javascript
// Before
query: "(fulfillment_status:unfulfilled OR fulfillment_status:partial) AND tag:swatch-only"

// After
query: "fulfillment_status:unfulfilled AND tag:swatch-only"
```

### 2. Removed Frontend Filtering
Since we're now only fetching unfulfilled orders, we don't need to filter out partial orders:
```javascript
// Before
const partialIds = new Set(partialData.edges.map(e => e.node.id));
const pendingFiltered = pendingData.edges.filter(e => !partialIds.has(e.node.id));
return { swatchOrders: pendingFiltered, ... }

// After
return { swatchOrders: pendingData.edges, ... }
```

## Files Changed
- `app/services/order.server.js` - Updated `getFabricOrders` query
- `app/routes/app.home.jsx` - Removed frontend filtering logic

## Testing
After this fix:
1. Pending Orders section only shows truly unfulfilled orders
2. Partially Fulfilled Orders section shows orders with partial fulfillment
3. Pagination works correctly - no empty pages
4. Each section maintains its own cursor state independently

## Additional Notes
- The `getPartiallyFulfilledOrders` function already had the correct query: `fulfillment_status:partial AND tag:swatch-only`
- The `getFulfilledFabricOrders` function already had the correct query: `fulfillment_status:fulfilled AND tag:swatch-only`
- No changes were needed to the pagination handlers - they were already correctly managing cursor state
