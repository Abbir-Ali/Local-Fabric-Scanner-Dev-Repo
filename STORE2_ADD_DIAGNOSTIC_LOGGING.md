# Store 2 Fix: Add Diagnostic Logging

This document shows exactly what to add to your code to diagnose why Store 2 bin assignment isn't working.

---

## The Problem

Store 2 silently fails when you try to assign a bin:
- No error message shown
- No console error visible
- Metafield doesn't update
- Button appears to do nothing

**Solution:** Add diagnostic logging to see exactly where it's failing.

---

## Code Changes

### Change 1: Add Logging to Loader (to verify bins load)

**File:** `app/routes/app.fabric.jsx`

**Find this section:**
```javascript
export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const url = new URL(request.url);
  
  const cursor = url.searchParams.get("cursor") || null;
  const direction = url.searchParams.get("direction") || "next";
  const page = parseInt(url.searchParams.get("page") || "1");
  const query = url.searchParams.get("query") || "";
  const sortKey = url.searchParams.get("sortKey") || "CREATED_AT";
  const reverse = url.searchParams.get("reverse") === "true";
  
  const locations = await getShopLocations(admin);
  const primaryLocation = locations.find(loc => loc.isPrimary) || locations[0];
  const locationId = url.searchParams.get("locationId") || primaryLocation?.id || null;
```

**Add this logging:**
```javascript
export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const url = new URL(request.url);
  
  const cursor = url.searchParams.get("cursor") || null;
  const direction = url.searchParams.get("direction") || "next";
  const page = parseInt(url.searchParams.get("page") || "1");
  const query = url.searchParams.get("query") || "";
  const sortKey = url.searchParams.get("sortKey") || "CREATED_AT";
  const reverse = url.searchParams.get("reverse") === "true";
  
  const locations = await getShopLocations(admin);
  const primaryLocation = locations.find(loc => loc.isPrimary) || locations[0];
  const locationId = url.searchParams.get("locationId") || primaryLocation?.id || null;
  
  // ⭐ ADD THIS LOGGING ⭐
  console.log("🔍 LOADER DIAGNOSTIC");
  console.log("Shop:", session.shop);
  console.log("Locations available:", locations.map(l => ({ name: l.name, id: l.id })));
  console.log("Selected locationId:", locationId);
  console.log("Primary Location:", primaryLocation?.name);
  
  const shopDomain = session.shop.replace(".myshopify.com", "");
  const binLocations = await getBinLocations(session.shop);
  
  // ⭐ ADD THIS LOGGING ⭐
  console.log("Bin locations loaded:", binLocations.length, binLocations.slice(0, 5));
```

---

### Change 2: Add Logging to UpdateBin Action (to see what fails)

**File:** `app/routes/app.fabric.jsx`

**Find this section:**
```javascript
export const action = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const shop = session.shop;
  const formData = await request.formData();

  const actionType = formData.get("actionType");
  console.log(`[ACTION] Received action: ${actionType}`);

  if (actionType === "updateBin") {
    const productId = formData.get("productId");
    const binValue = formData.get("binValue");

    try {
      const response = await admin.graphql(
        `#graphql
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

      const resData = await response.json();
      const errors = resData.data?.metafieldsSet?.userErrors || [];
      if (errors.length > 0) return { success: false, error: errors[0].message };
      return { success: true, field: "bin", updatedValue: binValue };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
```

**Replace with this (with detailed logging):**
```javascript
export const action = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const shop = session.shop;
  const formData = await request.formData();

  const actionType = formData.get("actionType");
  console.log(`[ACTION] Received action: ${actionType}`);

  if (actionType === "updateBin") {
    const productId = formData.get("productId");
    const binValue = formData.get("binValue");

    // ⭐ ADD THIS DETAILED LOGGING ⭐
    console.log("🔍 UPDATE BIN ACTION STARTED");
    console.log("Shop:", shop);
    console.log("Product ID:", productId);
    console.log("Product ID type:", typeof productId);
    console.log("Product ID starts with gid://:", productId?.startsWith("gid://"));
    console.log("Bin Value:", binValue);
    
    // Validate product ID format
    if (!productId || !productId.startsWith("gid://")) {
      console.error("❌ INVALID PRODUCT ID FORMAT", productId);
      return { 
        success: false, 
        error: `Invalid Product ID format. Got: ${productId}. Expected: gid://shopify/Product/...` 
      };
    }

    try {
      console.log("📤 SENDING GRAPHQL MUTATION");
      const response = await admin.graphql(
        `#graphql
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

      console.log("📥 RESPONSE RECEIVED");
      const resData = await response.json();
      console.log("Response data:", JSON.stringify(resData, null, 2));
      
      const errors = resData.data?.metafieldsSet?.userErrors || [];
      if (errors.length > 0) {
        console.error("❌ GRAPHQL USER ERRORS:", errors);
        return { success: false, error: errors[0].message };
      }
      
      console.log("✅ METAFIELD UPDATED SUCCESSFULLY");
      return { success: true, field: "bin", updatedValue: binValue };
    } catch (error) {
      console.error("❌ CATCH ERROR:", error);
      return { success: false, error: error.message };
    }
  }
```

---

### Change 3: Add Logging to Frontend Component (to verify form submission)

**File:** `app/routes/app.fabric.jsx`

**Find this section (in the component):**
```javascript
const handleImportBinLocations = useCallback((locations) => {
  fetcher.submit(
    { actionType: "importBinLocations", locations: JSON.stringify(locations) },
    { method: "post" }
  );
}, [fetcher]);
```

**Add this section after the component loads:**
```javascript
// ⭐ ADD THIS HELPER FUNCTION ⭐
const assignBinToProduct = useCallback((productId, binValue) => {
  console.log("🔍 ASSIGN BIN CLICKED");
  console.log("Product ID:", productId);
  console.log("Bin Value:", binValue);
  console.log("Fetcher state:", fetcher.state);
  
  if (!productId || !binValue) {
    console.error("❌ Missing productId or binValue");
    return;
  }
  
  console.log("📤 Submitting updateBin action");
  fetcher.submit(
    { actionType: "updateBin", productId, binValue },
    { method: "post" }
  );
}, [fetcher]);
```

Then in your button click handler, use this:
```javascript
// Instead of directly calling the action, call the logging version
onClick={() => assignBinToProduct(productId, selectedBin)}
```

---

## How to Use This Diagnostic Info

### Step 1: Deploy the Logging Code
1. Add the three changes above to your app
2. Redeploy to your live stores
3. Restart the app on both stores

### Step 2: Test on Store 2
1. Open Store 2 admin
2. Go to Fabric Inventory
3. Open browser DevTools: **F12**
4. Go to **Console** tab
5. Click on a product
6. Click "+ Assign Bin"
7. Select a bin location (e.g., "A1:1")
8. Press Enter or click Submit

### Step 3: Check Console Output

You should see logs like:

```
🔍 LOADER DIAGNOSTIC
Shop: mystore2.myshopify.com
Locations available: [{name: "Jamestown office", id: "gid://..."}, ...]
Selected locationId: gid://shopify/Location/123456
Primary Location: Jamestown office
Bin locations loaded: 431 Array(5) ["A1:1", "A1:2", "A1:3", "A1:4", "A1:5"]
```

Then when you click assign:

```
🔍 ASSIGN BIN CLICKED
Product ID: gid://shopify/Product/789012
Bin Value: A1:1
📤 Submitting updateBin action
```

Then:

```
🔍 UPDATE BIN ACTION STARTED
Shop: mystore2.myshopify.com
Product ID: gid://shopify/Product/789012
Product ID type: string
Product ID starts with gid://: true
Bin Value: A1:1
📤 SENDING GRAPHQL MUTATION
📥 RESPONSE RECEIVED
Response data: {
  "data": {
    "metafieldsSet": {
      "metafields": [...],
      "userErrors": []
    }
  }
}
✅ METAFIELD UPDATED SUCCESSFULLY
```

### Step 4: Compare Results

Compare logs between:
- Store 1 (working) - note the output
- Store 2 (broken) - note what's different

### Step 5: Share the Diagnostic Output

Once you have the logs, you can see exactly where it fails:

**If it fails at "ASSIGN BIN CLICKED":**
- Button not working properly
- Product ID not being set correctly

**If it fails at "SENDING GRAPHQL MUTATION":**
- Product ID format is wrong
- GraphQL query has issues

**If it fails after "RESPONSE RECEIVED":**
- GraphQL mutation executed but returned errors
- Check the response data for userErrors

**If it shows "✅ METAFIELD UPDATED SUCCESSFULLY" but metafield is still empty:**
- Mutation executed successfully
- But metafield isn't displaying
- Might be a Shop2-specific metafield definition issue

---

## Removing Diagnostic Code

Once you've identified the problem, remove the logging code:

1. Remove all `console.log()` statements
2. Remove the `assignBinToProduct` helper function
3. Redeploy

Or keep it in production temporarily if you need to monitor it.

---

## Common Diagnostic Results & Solutions

### Result: Product ID is invalid or missing
```
Product ID: undefined
❌ INVALID PRODUCT ID FORMAT
```
**Solution:** Check how product IDs are generated in the loader. Might need to fix `getFabricInventory()`.

### Result: GraphQL returns userErrors
```
❌ GRAPHQL USER ERRORS: [
  { field: "ownerId", message: "Invalid ID" }
]
```
**Solution:** Product ID format is wrong. Verify it's `gid://shopify/Product/` format.

### Result: GraphQL mutation works but metafield empty
```
✅ METAFIELD UPDATED SUCCESSFULLY
```
But in Shopify Admin, the metafield is still empty.

**Solution:** Metafield definition might not exist in Store 2. Need to:
1. Create it manually in Shopify Admin, or
2. Deploy a migration to auto-create it

### Result: Different location data
```
Store 1 Locations: [{name: "My Custom Location", id: "gid://shopify/Location/111"}]
Store 2 Locations: [{name: "Jamestown office", id: "gid://shopify/Location/222"}]
```
**Solution:** Different location IDs might cause products to have different metadata. This is normal and should work fine.

---

## Summary

The diagnostic code will show you:
1. ✅ Are bin locations loading in Store 2?
2. ✅ Is the assign button triggering?
3. ✅ Is the product ID in the right format?
4. ✅ Is the GraphQL mutation executing?
5. ✅ Are there GraphQL errors?
6. ✅ Is the metafield actually being set?

Once you know which step is failing, you can fix it.
