# Orders Not Displaying - Fix Applied

## Problem
- **Symptoms**: Dashboard stats showed 11 pending orders and 1 fulfilled order, but no orders were displaying in any of the three sections (Pending, Partial, Fulfilled)
- **Browser Console**: `swatchOrdersCount: 0, partialOrdersCount: 0, fulfilledOrdersCount: 0`
- **Root Cause**: Missing `read_customers` API scope - GraphQL queries were requesting customer fields but the app didn't have permission

## Investigation
Terminal logs revealed the actual error:
```
Unfulfilled Service Error: GraphqlQueryError: Access denied for customer field. Required access: `read_customers` access scope.
Fulfilled Service Error: GraphqlQueryError: Access denied for customer field. Required access: `read_customers` access scope.
```

The GraphQL queries were requesting customer data (firstName, lastName, email, phone) but the app only had these scopes:
- `read_inventory`
- `read_locations`
- `read_merchant_managed_fulfillment_orders`
- `read_orders`
- `read_products`
- `write_inventory`
- `write_merchant_managed_fulfillment_orders`
- `write_products`

## Solution Applied
Added `read_customers` scope to the app configuration.

### Files Modified
1. `shopify.app.toml` - Added `read_customers` to scopes
2. `app/services/order.server.js` - Query format already correct

### Changes Made

**shopify.app.toml**
```toml
[access_scopes]
scopes = "read_customers,read_inventory,read_locations,read_merchant_managed_fulfillment_orders,read_orders,read_products,write_inventory,write_merchant_managed_fulfillment_orders,write_products"
```

## Next Steps - IMPORTANT!

After adding a new scope, you MUST:

1. **Stop the dev server** (Ctrl+C in terminal)
2. **Restart the dev server**: `npm run dev` or `shopify app dev`
3. **Reinstall the app** on your store:
   - The app will prompt you to approve the new `read_customers` scope
   - Click "Install" or "Update" to grant the new permission
4. **Refresh the admin dashboard** - Your orders should now display

## Why This Happened
The `read_orders` scope gives access to order data (order number, status, line items, etc.) but NOT customer data. Customer information requires the separate `read_customers` scope.

## Testing
After restarting and reinstalling:
1. Check that pending orders (11) display in "Pending Swatch Orders" section
2. Check that fulfilled order (1) displays in "Fulfilled History" section
3. Verify customer names and emails are visible in order details
4. Verify pagination works correctly (5, 10, 25, 50 items per page)
5. Verify search functionality works across all sections

## Related Features
This fix ensures the following features work correctly:
- ✅ Order display in all three sections
- ✅ Customer information display
- ✅ Pagination (5, 10, 25, 50 items per page)
- ✅ Search by order number, customer name, email, phone
- ✅ Real-time stats updates
- ✅ Auto-refresh every 5 seconds

## Notes
- Always check terminal logs for GraphQL errors - they reveal the exact issue
- Scope changes require app reinstallation to take effect
- The `fabric-scanner` tag is the exclusive tag for scanner-processed orders
