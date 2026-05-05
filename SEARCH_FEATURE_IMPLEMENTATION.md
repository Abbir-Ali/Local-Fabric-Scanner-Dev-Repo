# Order Search Feature Implementation

## Overview
Added comprehensive search functionality across the admin dashboard and theme extension to search orders by:
- Order number (e.g., #1012)
- Customer name (first name or last name)
- Customer email
- Customer phone (when available in order data)

## Changes Made

### 1. Backend Service Layer (`app/services/order.server.js`)

Updated three main order fetching functions to accept and process search queries:

#### `getFabricOrders()` - Pending Orders
- Added `searchQuery` parameter
- Builds Shopify GraphQL query string with search filters
- Searches across: `name`, `email`, `customer.first_name`, `customer.last_name`
- Added customer data fields to GraphQL query (firstName, lastName, email, phone)

#### `getFulfilledFabricOrders()` - Fulfilled Orders
- Added `searchQuery` parameter
- Same search capabilities as pending orders
- Enhanced with customer information in response

#### `getPartiallyFulfilledOrders()` - Partially Fulfilled Orders
- Added `searchQuery` parameter
- Full search support across all customer fields
- Maintains partial fulfillment tracking with search

### 2. Admin Dashboard (`app/routes/app.home.jsx`)

#### Loader Updates
- Added search parameter extraction from URL:
  - `pendingSearch` - for pending orders
  - `partialSearch` - for partially fulfilled orders
  - `fulfilledSearch` - for fulfilled orders
- Passes search queries to respective service functions
- Returns search values to component for state management

#### UI Components
- Added `TextField` component import from Polaris
- Added search input fields for each order section:
  - **Pending Swatch Orders**: Search bar with placeholder "Search by order #, name, email..."
  - **Partially Fulfilled Orders**: Dedicated search input
  - **Fulfilled History**: Dedicated search input
- Implemented debounced search (600ms delay) to avoid excessive API calls
- Search state management with `useState` hooks
- Auto-navigation with URL parameter updates
- Clear button functionality for easy search reset
- Empty state messages differentiate between "no results" and "no orders"

### 3. Theme Extension Frontend (`extensions/scanner-extension/blocks/scanner.liquid`)

#### UI Updates
- Added search input fields to Orders and History tabs
- Consistent styling with existing inventory search
- Responsive design maintains mobile compatibility
- Search inputs use same `.fb-search-sort-container` styling

### 4. Theme Extension JavaScript (`extensions/scanner-extension/assets/print-label.js`)

#### Search Implementation
- Added search input event handlers with 500ms debounce
- `order-search-input` - for Orders tab
- `history-search-input` - for History tab
- Search triggers pagination reset (page 1, clear cursors)

#### Data Fetching Updates
- `loadOrders()`: Extracts search query and passes to API
- `loadHistory()`: Extracts search query and passes to API
- `renderOrders()`: Shows contextual empty states based on search
- `renderHistory()`: Shows contextual empty states based on search

### 5. API Proxy Route (`app/routes/app.api.proxy.$.jsx`)

Updated three API endpoints to handle search parameters:

#### `orders` endpoint
- Extracts `search` query parameter
- Passes to `getFabricOrders()` service function

#### `fulfilled` endpoint
- Extracts `search` query parameter
- Passes to `getFulfilledFabricOrders()` service function

#### `partial` endpoint
- Extracts `search` query parameter
- Passes to `getPartiallyFulfilledOrders()` service function

## Search Capabilities

### What Can Be Searched
1. **Order Number**: Full or partial order number (e.g., "1012", "#1012")
2. **Customer Name**: First name, last name, or full name
3. **Customer Email**: Full or partial email address
4. **Customer Phone**: Phone number (when available)

### Search Behavior
- **Case-insensitive**: Searches work regardless of letter casing
- **Partial matching**: Finds orders with partial matches (e.g., "john" finds "Johnson")
- **Wildcard support**: Uses Shopify's `*term*` syntax for flexible matching
- **Debounced**: 500-600ms delay prevents excessive API calls while typing
- **Pagination-aware**: Search resets to page 1 with fresh results

### Example Searches
- `1012` → Finds order #1012
- `john` → Finds customers named John, Johnson, etc.
- `@gmail.com` → Finds all Gmail customers
- `abbir` → Finds customer "Abbir AA"
- `abbirali113@gmail.com` → Finds specific customer by email

## User Experience Improvements

### Admin Dashboard
- Search bars positioned prominently at the top of each section
- Clear visual feedback when searching (loading states)
- Empty states differentiate between:
  - "No orders found matching your search" (search active)
  - "No pending/fulfilled orders" (no search)
- Search persists across page refreshes via URL parameters
- Clear button for quick search reset

### Theme Extension (Scanner)
- Consistent search experience across Stock, Orders, and History tabs
- Mobile-responsive search inputs
- Real-time search with visual feedback
- Maintains scroll position and UI state during search

## Technical Details

### Shopify GraphQL Query Structure
```graphql
query: "fulfillment_status:unfulfilled AND (tag:fabric-scanner) AND (name:*search* OR email:*search* OR customer.first_name:*search* OR customer.last_name:*search*)"
```

### URL Parameter Format
- Admin: `?pendingSearch=term&partialSearch=term&fulfilledSearch=term`
- Theme: Handled via API proxy with `&search=term`

### Performance Considerations
- Debounced input (500-600ms) reduces API load
- Pagination maintained with search results
- Cursor-based pagination for efficient data fetching
- Search queries optimized with Shopify's native search syntax

## Testing Recommendations

1. **Search Accuracy**
   - Test with order numbers
   - Test with customer names (first, last, full)
   - Test with email addresses
   - Test with partial matches

2. **Edge Cases**
   - Empty search (should show all orders)
   - No results found
   - Special characters in search
   - Very long search terms

3. **Performance**
   - Type quickly and verify debounce works
   - Test with large result sets
   - Verify pagination works with search

4. **Mobile Responsiveness**
   - Test search inputs on mobile devices
   - Verify keyboard behavior
   - Check touch targets

## Future Enhancements

Potential improvements for future iterations:
- Advanced filters (date range, status, amount)
- Search history/suggestions
- Export search results
- Saved searches
- Search by product SKU or barcode
- Search by shipping address
- Multi-field search combinations
