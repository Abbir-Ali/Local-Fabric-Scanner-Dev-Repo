# Fabric Scanner System

A Shopify embedded admin app for fabric swatch order fulfillment using barcode scanning. Staff use a phone camera to scan barcodes on fabric swatches, which triggers order fulfillment directly through Shopify's API.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Remix (React Router v7) + Vite 6 |
| UI | Polaris v12 + App Bridge React v4 |
| Database | Prisma v6 + SQLite (dev) |
| Shopify | shopify-app-remix v4.1 |
| Scanning | html5-qrcode (extension), jsbarcode (admin) |
| Deployment | Docker |

---

## Local Development

### Prerequisites
- Node.js 18+
- Shopify CLI installed globally
- Shopify Partner account + development store

### Setup

```bash
# Install dependencies
yarn install

# Run database migrations
npx prisma migrate deploy

# Start dev server
shopify app dev
```

The Shopify CLI handles tunneling, environment variables, and connecting to your dev store automatically.

### Environment Variables

Copy `.env.dist` to `.env` and fill in:

```
SHOPIFY_API_KEY=
SHOPIFY_API_SECRET=
SHOPIFY_APP_URL=
```

---

## Project Structure

```
app/
  routes/           # Remix routes (admin pages + webhooks + proxy)
  models/           # Database layer (logs, settings, staff)
  services/         # Shopify API layer (orders, inventory)
  components/       # Shared React components
  utils/            # Helpers (bin location parser)
  shopify.server.js # Shopify auth config
  db.server.js      # Prisma client

extensions/
  scanner-extension/
    blocks/scanner.liquid   # Main scanner UI (theme app block)
    assets/                 # print-label.js, thumbs-up.png
    locales/                # i18n strings

prisma/
  schema.prisma     # Database models
  migrations/       # Migration history
```

---

## Database Models

### `ScanLog`
Tracks every fulfillment event.

| Field | Type | Notes |
|---|---|---|
| id | Int | Auto-increment |
| shop | String | Shop domain |
| orderId | String | Shopify Order GID |
| status | String | FULFILLED / PARTIALLY FULFILLED / VOID |
| scannedBy | String | Staff name |
| staffEmail | String | |
| timestamp | DateTime | Default: now |
| details | String | JSON metadata (item IDs, timestamps) |

### `AppSettings`
Per-shop configuration.

| Field | Type | Notes |
|---|---|---|
| shop | String | Unique |
| adminName | String | Global admin credential |
| adminPin | String | Global admin PIN |
| brandLogo | String | Base64 encoded image |
| showStockTab | Boolean | Feature toggle |
| showOrdersTab | Boolean | Feature toggle |
| showHistoryTab | Boolean | Feature toggle |
| enableScanButton | Boolean | Feature toggle |
| enableInventorySearch | Boolean | Feature toggle |
| enableInventorySort | Boolean | Feature toggle |
| showStaffManagement | Boolean | Feature toggle |
| showLogoutButton | Boolean | Feature toggle |

### `Staff`
Individual staff members.

| Field | Type | Notes |
|---|---|---|
| shop | String | |
| name | String | |
| email | String | Unique per shop |
| pin | String | 4–6 digits |

---

## Admin Routes

| Route | Purpose |
|---|---|
| `/app` | Welcome / landing page |
| `/app/home` | Dashboard — stats, pending orders, partial fulfillments, history |
| `/app/fabric` | Inventory — search, sort, bin locations, barcode printing |
| `/app/settings` | Staff & Security, Brand & Logo, Feature Visibility |
| `/app/logs` | Scan log history with search + pagination |
| `/app/print` | Bulk barcode label printing |
| `/app/init` | Ensures app settings exist on first load |

### Webhooks

| Route | Purpose |
|---|---|
| `/webhooks/orders/updated` | Sync fulfillment status changes to scan logs |
| `/webhooks/app/uninstalled` | Clean up session data |
| `/webhooks/app/scopes_update` | Update session scopes |

---

## App Proxy

All requests from the scanner extension go through the app proxy at `/apps/fabric-scanner`.

### GET Endpoints

| `type` param | Returns |
|---|---|
| `auth` | Validate PIN, return user + settings |
| `inventory` | Paginated swatch inventory with optional BIN search |
| `orders` | Unfulfilled swatch orders |
| `fulfilled` | Fulfilled swatch orders |
| `partial` | Partially fulfilled orders |
| `settings` | Feature toggles + brand logo |

### POST

Creates a fulfillment for scanned items. Accepts verified line item IDs, creates the Shopify fulfillment, and writes a `ScanLog` entry. Supports partial fulfillment — only verified items are fulfilled.

---

## Scanner Extension (Theme App Block)

Lives on the storefront as a theme app block. Staff access it on their phones.

### Authentication
- PIN-based login (admin or staff)
- Session stored in `localStorage`
- Settings synced from admin on login

### Tabs

**Stock** — Browse swatch inventory, search by product name or BIN location, adjust quantities.

**Orders** — View unfulfilled orders. Tap Scan on an item to open the camera. Scanning the correct barcode marks the item as verified. Once all items are verified, the Fulfill Order button appears.

**History** — View fulfilled orders and scan logs.

### Scan Flow
1. Staff taps **Scan** on a line item
2. Camera opens via `html5-qrcode`
3. Barcode is matched against the product's barcode reference
4. On match: vibration + beep, item marked verified
5. When all items verified: **Fulfill Order** button appears
6. Tapping Fulfill calls the proxy POST endpoint
7. Shopify fulfillment is created, scan log is written

---

## Bin Locations

Bin locations are imported via the Inventory page in the admin. Supported file formats: CSV or TXT.

### Supported Delimiters
- Newline (one per line)
- Comma: `A1:1,A1:2,A1:3`
- Space: `A1:1 A1:2 A1:3`
- Semicolon: `A1:1;A1:2;A1:3`

### Notes
- Headers like "location", "bin", "bin location" are stripped automatically
- Duplicates are removed automatically
- Results are sorted alphabetically
- Max file size: 5MB

### How to Import
1. Go to **Swatch Item Inventory** in the admin
2. Click **Import Bin Locations**
3. Select your CSV or TXT file
4. Preview the loaded locations
5. Click **Import**
6. For each product, click **Assign Bin** to pick a location

---

## Shopify App Config

- **Client ID**: `2d6b6b6e3120ef4ce721ef0cc8acc228`
- **Scopes**: `read_inventory`, `write_inventory`, `read_orders`, `read_products`, `write_products`, `read_locations`, `read_merchant_managed_fulfillment_orders`, `write_merchant_managed_fulfillment_orders`
- **App Proxy prefix**: `/apps/fabric-scanner`
- **Embedded**: yes

---

## Figma Diagrams

UI flow diagrams for the full system:

- [Admin Dashboard](https://www.figma.com/online-whiteboard/create-diagram/50bce69f-e468-490c-9e09-00720b3bf569)
- [Inventory, Logs & Settings](https://www.figma.com/online-whiteboard/create-diagram/246ba9f2-83a8-4a5c-97ad-0db96659b494)
- [Scanner Frontend (Login + Tabs + Scan Flow)](https://www.figma.com/online-whiteboard/create-diagram/42665161-e1ff-446a-9f4f-ba4dd460257b)

---

## Deployment

The app is containerized with Docker. For production, swap SQLite for PostgreSQL or MySQL by updating the `datasource` in `prisma/schema.prisma`.

```bash
# Build
yarn build

# Deploy via Shopify CLI
shopify app deploy
```

Set `NODE_ENV=production` and all three env vars on your hosting platform.
