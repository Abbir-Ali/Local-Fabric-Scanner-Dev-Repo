import { useLoaderData, useFetcher, useNavigate, useSearchParams, useNavigation } from "@remix-run/react";
import { authenticate } from "../shopify.server";
import {
  Page, Layout, Card, IndexTable, Button, BlockStack, Badge,
  InlineStack, Thumbnail, Text, Pagination, Box, IndexFilters, TextField, Select, useSetIndexFiltersMode,
  Popover, Banner, Spinner, Grid, Modal
} from "@shopify/polaris";
import { ArrowRightIcon, EditIcon, CheckIcon, XIcon, ExportIcon } from "@shopify/polaris-icons";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { getFabricInventory, getShopLocations, getAllFabricInventory, getGlobalInventoryStats } from "../services/order.server";
import { adjustInventory, setInventory } from "../services/inventory.server";

import BarcodeImage from "../components/BarcodeImage";

/**
 * LOADER
 * Fetches fabric products, pagination info, and shop locations.
 */
export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const url = new URL(request.url);

  const cursor = url.searchParams.get("cursor") || null;
  const direction = url.searchParams.get("direction") || "next";
  const page = parseInt(url.searchParams.get("page") || "1");
  const query = url.searchParams.get("query") || "";
  const sortKey = url.searchParams.get("sortKey") || "CREATED_AT";
  const reverse = url.searchParams.get("reverse") === "true";

  // Detect if this is a BIN search (same logic as scanner)
  const isBinSearch = query && (
    query.toLowerCase().includes('bin') ||
    /^\d/.test(query) || // starts with number
    /^[a-zA-Z]+\d+/.test(query) || // letter(s) followed by number(s)
    /^[a-zA-Z]\d+/.test(query) // letter followed by number(s)
  );

  const locations = await getShopLocations(admin);
  const primaryLocation = locations.find(loc => loc.isPrimary) || locations[0];
  const locationId = url.searchParams.get("locationId") || primaryLocation?.id || null;

  const { edges, pageInfo } = await getFabricInventory(admin, cursor, {
    query, sortKey, reverse, direction, locationId, isBinSearch
  });

  const globalStats = await getGlobalInventoryStats(admin, locationId);

  const shopDomain = session.shop.replace(".myshopify.com", "");

  return {
    products: edges,
    pageInfo,
    page,
    shopDomain,
    locations,
    currentLocationId: locationId,
    initialQuery: query,
    initialSort: sortKey,
    initialReverse: reverse,
    globalStats,
    isBinSearch
  };
};

/**
 * ACTION
 * Handles inventory adjustments, bulk updates, and CSV imports.
 */
export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();

  const actionType = formData.get("actionType");
  console.log(`[ACTION] Received action: ${actionType}`, Object.fromEntries(formData.entries()));

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
        {
          variables: { ownerId: productId, value: binValue || "" }
        }
      );

      const resData = await response.json();
      const errors = resData.data?.metafieldsSet?.userErrors || [];
      if (errors.length > 0) return { success: false, error: errors[0].message };
      return { success: true, field: "bin", updatedValue: binValue };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  if (actionType === "uploadBinLocationsFile") {
    // File has already been parsed and stored in localStorage on the client
    // Server just needs to acknowledge the upload was processed
    console.log("[ACTION] Bin locations file processed successfully");
    return { success: true, message: "Bin locations imported successfully" };
  }

  if (actionType === "adjustInventory") {
    const inventoryItemId = formData.get("inventoryItemId");
    const locationId = formData.get("locationId");
    const delta = formData.get("delta");

    try {
      await adjustInventory(admin, inventoryItemId, locationId, delta);
      return { success: true, message: "Inventory adjusted successfully" };
    } catch (error) {
      console.error("[ACTION] Adjust Error:", error);
      return { success: false, error: error.message };
    }
  }

  if (actionType === "setInventory") {
    const inventoryItemId = formData.get("inventoryItemId");
    const locationId = formData.get("locationId");
    const quantity = formData.get("quantity");

    console.log(`[ACTION] Setting Inventory: Item=${inventoryItemId}, Location=${locationId}, Qty=${quantity}`);

    try {
      await setInventory(admin, inventoryItemId, locationId, quantity);
      return { success: true, message: "Inventory set successfully" };
    } catch (error) {
      console.error("[ACTION] Set Error:", error);
      return { success: false, error: error.message };
    }
  }


  if (actionType === "exportAllBarcodes") {
    try {
      const allBarcodes = await getAllFabricInventory(admin);
      return { success: true, allBarcodes };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  return { success: false, error: "Invalid action type" };
};

/**
 * COMPONENT: FabricInventory
 * Main page component.
 */
export default function FabricInventory() {
  const { products: rawProducts, pageInfo, page, shopDomain, locations, currentLocationId, initialQuery, initialSort, initialReverse, globalStats: initialGlobalStats, isBinSearch: initialIsBinSearch } = useLoaderData();
  const products = rawProducts || [];
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const navigation = useNavigation();
  const fetcher = useFetcher();
  const { mode, setMode } = useSetIndexFiltersMode();

  const stats = initialGlobalStats || { total: 0, lowStock: 0, outOfStock: 0 };
  const isBinSearch = initialIsBinSearch || false;


  const locationOptions = useMemo(() => {
    if (!locations || locations.length === 0) return [{ label: "No locations found", value: "" }];
    return locations.map(loc => ({ label: loc.name, value: loc.id }));
  }, [locations]);
  // sort options 
  const sortOptions = [
    { label: 'Date', value: 'CREATED_AT desc', directionLabel: 'Newest first' },
    { label: 'Date', value: 'CREATED_AT asc', directionLabel: 'Oldest first' },
    { label: 'Title', value: 'TITLE asc', directionLabel: 'A-Z' },
    { label: 'Title', value: 'TITLE desc', directionLabel: 'Z-A' },
    { label: 'Stock', value: 'INVENTORY_TOTAL asc', directionLabel: 'Low to High' },
    { label: 'Stock', value: 'INVENTORY_TOTAL desc', directionLabel: 'High to Low' },
  ];

  const [sortSelected, setSortSelected] = useState([`${initialSort} ${initialReverse ? 'desc' : 'asc'}`]);
  const [queryValue, setQueryValue] = useState(initialQuery || "");
  const [binLocations, setBinLocations] = useState([]);
  const [importModalActive, setImportModalActive] = useState(false);
  const [importError, setImportError] = useState(null);
  const [importSuccess, setImportSuccess] = useState(false);

  useEffect(() => {
    setQueryValue(initialQuery || "");
  }, [initialQuery]);

  // Load bin locations from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("binLocations");
    if (saved) {
      try {
        setBinLocations(JSON.parse(saved));
      } catch (err) {
        console.error("Error loading bin locations:", err);
      }
    }
  }, []);

  const handleQueryChange = useCallback((value) => setQueryValue(value), []);

  useEffect(() => {
    const urlQuery = searchParams.get("query") || "";
    if (queryValue === urlQuery) return;

    const timer = setTimeout(() => {
      const params = new URLSearchParams(searchParams);
      if (queryValue) params.set("query", queryValue);
      else params.delete("query");
      params.delete("cursor");
      params.delete("direction");
      params.set("page", "1");
      navigate(`?${params.toString()}`, { replace: true });
    }, 600);

    return () => clearTimeout(timer);
  }, [queryValue, searchParams, navigate]);

  const handleQueryClear = useCallback(() => {
    setQueryValue("");
    const params = new URLSearchParams(searchParams);
    params.delete("query");
    params.delete("cursor");
    params.delete("direction");
    params.set("page", "1");
    navigate(`?${params.toString()}`);
  }, [searchParams, navigate]);

  const handleSortChange = useCallback((value) => {
    if (!value || value.length === 0 || !value[0]) return;

    setSortSelected(value);
    const splitVal = value[0].split(" ");
    if (splitVal.length < 2) return;

    const [key, direction] = splitVal;
    const rev = direction === "desc";

    const params = new URLSearchParams(searchParams);
    params.set("sortKey", key);
    params.set("reverse", rev ? "true" : "false");
    params.delete("cursor");
    params.delete("direction");
    params.set("page", "1");
    navigate(`?${params.toString()}`);
  }, [searchParams, navigate]);

  const handleLocationChange = useCallback((value) => {
    const params = new URLSearchParams(searchParams);
    params.set("locationId", value);
    navigate(`?${params.toString()}`);
  }, [searchParams, navigate]);

  const handlePagination = (cursor, direction) => {
    const params = new URLSearchParams(searchParams);
    if (cursor) {
      params.set("cursor", cursor);
      params.set("direction", direction);
      params.set("page", direction === "next" ? (page + 1).toString() : (page - 1).toString());
    }
    navigate(`?${params.toString()}`);
  };

  const handleImportBinLocations = async (file) => {
    setImportError(null);
    setImportSuccess(false);

    try {
      // Validate file size
      const maxSizeMB = 5;
      if (file.size > maxSizeMB * 1024 * 1024) {
        throw new Error(`File size exceeds ${maxSizeMB}MB limit`);
      }

      // Read file
      const fileContent = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = (e) => reject(new Error("Failed to read file"));
        reader.readAsText(file);
      });

      // Import parser
      const { parseBinLocations } = await import("../utils/binLocationParser");

      // Parse locations
      const locations = await parseBinLocations(file.type, fileContent);

      // Save to localStorage and state
      setBinLocations(locations);
      localStorage.setItem("binLocations", JSON.stringify(locations));

      setImportSuccess(true);
      setImportModalActive(false);

      // Clear success message after 3 seconds
      setTimeout(() => setImportSuccess(false), 3000);
    } catch (error) {
      console.error("Import error:", error);
      setImportError(error.message || "Failed to import bin locations");
    }
  };

  const handleClearBinLocations = () => {
    if (window.confirm("Are you sure you want to clear all bin locations? This cannot be undone.")) {
      setBinLocations([]);
      localStorage.removeItem("binLocations");
      setImportSuccess(false);
    }
  };

  const handlePrint = (barcode, title, sku, binNumber) => {
    const printWindow = window.open('', '_blank', 'width=600,height=400');

    if (!printWindow) {
      alert("Please allow popups to print barcodes.");
      return;
    }

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Print Barcode - ${barcode}</title>
          <style>
            @page {
              size: 58mm 30mm;
              margin: 0;
            }
            html, body {
              width: 58mm;
              height: 30mm;
              margin: 0;
              padding: 0;
              overflow: hidden;
            }
            body {
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: flex-start;
              font-family: monospace;
              box-sizing: border-box;
              padding-top: 2mm;
            }
            .header {
              width: 100%;
              text-align: center;
              font-size: 14px;
              font-weight: bold;
              margin-bottom: 2mm;
            }
            .barcode-container {
              width: 100%;
              flex: 1;
              display: flex;
              align-items: center;
              justify-content: center;
              padding: 0 2mm;
              box-sizing: border-box;
            }
            svg {
              max-width: 54mm;
              max-height: 18mm;
              height: auto;
            }
          </style>
          <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"><\/script>
        </head>
        <body>
          <div class="header">
            Bin: ${binNumber || "N/A"}
          </div>
          <div class="barcode-container">
            <svg id="barcode"></svg>
          </div>
          <script>
            window.onload = function() {
              if (window.JsBarcode) {
                JsBarcode("#barcode", "${barcode}", {
                  format: "CODE128",
                  width: 2,
                  height: 50,
                  displayValue: false,
                  fontSize: 14,
                  margin: 0
                });
                setTimeout(() => {
                  window.print();
                  window.close();
                }, 600);
              }
            };
          <\/script>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  const handleBulkPrint = (barcodes) => {
    const printWindow = window.open('', '_blank', 'width=800,height=600');

    if (!printWindow) {
      alert("Please allow popups to print barcodes.");
      return;
    }

    const labelsHtml = barcodes.map((item, idx) => `
      <div class="label-page">
        <div class="header">
          Bin: ${item.binNumber || "N/A"}
        </div>
        <div class="barcode-container">
          <svg id="barcode-${idx}"></svg>
        </div>
      </div>
    `).join('');

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Bulk Print Barcodes</title>
          <style>
            @page {
              size: 58mm 30mm;
              margin: 0;
            }
            html, body {
              margin: 0;
              padding: 0;
              font-family: monospace;
            }
            .label-page {
              width: 58mm;
              height: 30mm;
              page-break-after: always;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: flex-start;
              overflow: hidden;
              box-sizing: border-box;
              padding-top: 2mm;
            }
            .header {
              width: 100%;
              text-align: center;
              font-size: 14px;
              font-weight: bold;
              margin-bottom: 2mm;
            }
            .barcode-container {
              width: 100%;
              flex: 1;
              display: flex;
              align-items: center;
              justify-content: center;
              padding: 0 2mm;
              box-sizing: border-box;
            }
            svg {
              max-width: 54mm;
              max-height: 18mm;
              height: auto;
            }
          </style>
          <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"><\/script>
        </head>
        <body>
          ${labelsHtml}
          <script>
            window.onload = function() {
              if (window.JsBarcode) {
                const barcodesData = ${JSON.stringify(barcodes)};
                barcodesData.forEach((item, idx) => {
                  if (item.barcode) {
                    JsBarcode("#barcode-" + idx, item.barcode, {
                      format: "CODE128",
                      width: 2,
                      height: 50,
                      displayValue: false,
                      fontSize: 14,
                      margin: 0
                    });
                  }
                });
                setTimeout(() => {
                  window.print();
                  window.close();
                }, 1000);
              }
            };
          <\/script>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  useEffect(() => {
    if (fetcher.data?.allBarcodes) {
      const barcodesToPrint = fetcher.data.allBarcodes.filter(b => b.barcode);
      if (barcodesToPrint.length === 0) {
        alert("No barcodes found to export.");
      } else {
        handleBulkPrint(barcodesToPrint);
      }
    }
  }, [fetcher.data]);


  const resourceName = { singular: 'product', plural: 'products' };
  const isLoading = navigation.state === "loading" || fetcher.state !== "idle";

  const rowMarkup = products.map(({ node }, index) => {
    const { title, id, legacyResourceId, featuredImage, variants, metafields: metaEdges } = node;
    const variant = variants.edges[0]?.node;
    const sku = variant?.sku || "N/A";
    const barcode = variant?.barcode || "";
    const inventoryItemId = variant?.inventoryItem?.id;
    const binMeta = metaEdges?.edges.find(e => e.node.key === "bin_locations")?.node;
    const adminUrl = `https://admin.shopify.com/store/${shopDomain}/products/${legacyResourceId}`;

    // Find the inventory level matching the selected locationId
    const levels = variant?.inventoryItem?.inventoryLevels?.edges || [];
    const matchingLevel = levels.find(l => l.node.location.id === currentLocationId);
    const available = matchingLevel?.node?.quantities?.find(q => q.name === "available")?.quantity || 0;

    return (
      <IndexTable.Row id={id} key={id} position={index}>
        <IndexTable.Cell>
          <Box paddingInlineStart="300">
            <Text variant="bodySm" tone="subdued" fontWeight="bold">#{index + 1}</Text>
          </Box>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <div style={{ padding: '8px 0' }}>
            <Thumbnail source={featuredImage?.url || ""} alt={title} size="large" />
          </div>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <div style={{ padding: '12px 0' }}>
            <BlockStack gap="100">
              <Text variant="bodyMd" fontWeight="bold" breakWord>{title}</Text>
              <InlineStack gap="200">
                <Badge tone="info" size="small">SKU: {sku}</Badge>
                <Button
                  icon={ArrowRightIcon}
                  variant="plain"
                  external
                  target="_blank"
                  url={adminUrl}
                  size="micro"
                  onClick={(e) => e.stopPropagation()}
                >
                  View in Admin
                </Button>
              </InlineStack>
            </BlockStack>
          </div>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Badge tone={available > 10 ? "success" : available > 0 ? "warning" : "critical"}>
              {available} {available === 1 ? 'unit' : 'units'}
            </Badge>
            <InventoryAdjuster inventoryItemId={inventoryItemId} locationId={currentLocationId} />
          </div>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <BinEditor productId={id} initialBin={binMeta?.value || ""} binLocations={binLocations} />
        </IndexTable.Cell>
        <IndexTable.Cell>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Box
              padding="100"
              background="bg-surface-secondary"
              borderRadius="200"
              borderWidth="025"
              borderColor="border"
              minWidth="100px"
              style={{ display: 'flex', justifyContent: 'center' }}
            >
              <div style={{ transform: 'scale(0.7)', transformOrigin: 'center', opacity: barcode ? 1 : 0.4, height: '35px' }}>
                <BarcodeImage value={barcode} />
              </div>
            </Box>
            {barcode && (
              <Button
                icon={ExportIcon}
                variant="secondary"
                onClick={(e) => {
                  e.stopPropagation();
                  handlePrint(barcode, title, sku, binMeta?.value || "");
                }}
                size="slim"
                accessibilityLabel="Print Label"
              />
            )}
          </div>
        </IndexTable.Cell>
      </IndexTable.Row>
    );
  });

  return (
    <Page
      title="Swatch Item Inventory"
      fullWidth
      primaryAction={{
        content: 'Import Bin Locations',
        onAction: () => setImportModalActive(true),
      }}
      secondaryActions={[
        {
          content: 'Bulk Export Barcodes',
          icon: ExportIcon,
          onAction: () => fetcher.submit({ actionType: "exportAllBarcodes" }, { method: "post" }),
          loading: fetcher.state === "submitting" && fetcher.formData?.get("actionType") === "exportAllBarcodes"
        },
        binLocations.length > 0 && {
          content: `Clear ${binLocations.length} Locations`,
          onAction: handleClearBinLocations,
        }
      ].filter(Boolean)}
    >
      <Layout>
        <BinLocationImportModal
          active={importModalActive}
          onClose={() => setImportModalActive(false)}
          onImport={handleImportBinLocations}
          error={importError}
          success={importSuccess}
          isLoading={false}
          binCount={binLocations.length}
        />

        {importSuccess && (
          <Layout.Section>
            <Banner tone="success" title="Import Successful" onDismiss={() => setImportSuccess(false)}>
              <p>{binLocations.length} bin locations loaded successfully!</p>
            </Banner>
          </Layout.Section>
        )}

        {importError && (
          <Layout.Section>
            <Banner tone="critical" title="Import Error" onDismiss={() => setImportError(null)}>
              <p>{importError}</p>
            </Banner>
          </Layout.Section>
        )}

        {binLocations.length > 0 && (
          <Layout.Section>
            <Card>
              <BlockStack gap="200">
                <InlineStack gap="200" align="center">
                  <Text variant="bodySm" tone="subdued" fontWeight="medium">
                    ✓ {binLocations.length} bin locations loaded
                  </Text>
                  <Button size="slim" variant="tertiary" onClick={() => setImportModalActive(true)}>
                    Update
                  </Button>
                </InlineStack>
              </BlockStack>
            </Card>
          </Layout.Section>
        )}

        {fetcher.data?.message && (
          <Layout.Section>
            <Banner tone="success" onDismiss={() => fetcher.data.message = null}>
              <p>{fetcher.data.message}</p>
            </Banner>
          </Layout.Section>
        )}

        {fetcher.data?.error && (
          <Layout.Section>
            <Banner tone="critical" onDismiss={() => fetcher.data.error = null}>
              <p>{fetcher.data.error}</p>
            </Banner>
          </Layout.Section>
        )}

        <Layout.Section>
          <Grid columns={{ xs: 1, sm: 1, md: 3, lg: 3, xl: 3 }} gap={{ xs: '400', md: '400' }}>
            <Grid.Cell columnSpan={{ xs: 1, sm: 1, md: 2, lg: 2, xl: 2 }}>
              <Card>
                <BlockStack gap="400">
                  <Text variant="headingSm" as="h2">Inventory Summary</Text>
                  <InlineStack gap="1000" align="start">
                    <BlockStack gap="100">
                      <Text variant="bodyXs" tone="subdued" fontWeight="medium">TOTAL ITEMS</Text>
                      <Text variant="headingLg" as="p">{stats.total}</Text>
                    </BlockStack>
                    <div style={{ width: '1px', background: 'var(--p-color-border-subdued)', height: '40px' }} />
                    <BlockStack gap="100">
                      <Text variant="bodyXs" tone="subdued" fontWeight="medium">LOW STOCK</Text>
                      <Text variant="headingLg" as="p" tone="warning">{stats.lowStock}</Text>
                    </BlockStack>
                    <div style={{ width: '1px', background: 'var(--p-color-border-subdued)', height: '40px' }} />
                    <BlockStack gap="100">
                      <Text variant="bodyXs" tone="subdued" fontWeight="medium">OUT OF STOCK</Text>
                      <Text variant="headingLg" as="p" tone="critical">{stats.outOfStock}</Text>
                    </BlockStack>
                  </InlineStack>
                </BlockStack>
              </Card>
            </Grid.Cell>
            <Grid.Cell columnSpan={{ xs: 1, sm: 1, md: 1, lg: 1, xl: 1 }}>
              <Card height="100%">
                <BlockStack gap="400">
                  <Text variant="headingSm" as="h2">Stock Location</Text>
                  <BlockStack gap="200">
                    <Select
                      label="Select Warehouse / Location"
                      labelHidden
                      options={locationOptions}
                      onChange={handleLocationChange}
                      value={currentLocationId}
                    />
                    <Text variant="bodyXs" tone="subdued">Inventory actions will update the selected warehouse.</Text>
                  </BlockStack>
                </BlockStack>
              </Card>
            </Grid.Cell>
          </Grid>
        </Layout.Section>

        <Layout.Section>
          <Card padding="0">
            <Box minHeight="400px">
              {isBinSearch && queryValue && (
                <Box padding="400" borderBottomWidth="025" borderColor="border" background="bg-fill-tertiary">
                  <InlineStack gap="200" align="start">
                    <Badge tone="info">BIN Search Active</Badge>
                    <Text variant="bodySm">Searching for BIN: <strong>{queryValue}</strong></Text>
                  </InlineStack>
                </Box>
              )}
              <IndexFilters
                sortOptions={sortOptions}
                sortSelected={sortSelected}
                onSort={handleSortChange}
                onQueryChange={handleQueryChange}
                onQueryClear={handleQueryClear}
                queryValue={queryValue}
                tabs={[]}
                selected={0}
                onSelect={() => { }}
                mode={mode}
                setMode={setMode}
                loading={isLoading}
                filters={[]}
                canCreateNewView={false}
                queryPlaceholder="Search products or bin..."
              />

              <IndexTable
                resourceName={resourceName}
                itemCount={products.length}
                selectable={false}
                headings={[
                  { title: 'No.' },
                  { title: 'Image' },
                  { title: 'Product Detail' },
                  { title: 'Stock Status' },
                  { title: 'Bin Location' },
                  { title: 'Barcode Reference' },
                ]}
                hasMoreItems={pageInfo?.hasNextPage}
                loading={isLoading}
              >
                {rowMarkup}
              </IndexTable>

              <Box padding="400" borderTopWidth="025" borderColor="border">
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <Pagination
                    hasPrevious={pageInfo?.hasPreviousPage}
                    onPrevious={() => handlePagination(pageInfo.startCursor, "prev")}
                    hasNext={pageInfo?.hasNextPage}
                    onNext={() => handlePagination(pageInfo.endCursor, "next")}
                  />
                </div>
              </Box>
            </Box>
          </Card>
        </Layout.Section>
      </Layout>

    </Page>
  );
}

/**
 * HELPER: InventoryAdjuster
 */
function InventoryAdjuster({ inventoryItemId, locationId }) {
  const fetcher = useFetcher();
  const [active, setActive] = useState(false);
  const [value, setValue] = useState("0");
  const [mode, setMode] = useState("adjust"); // 'adjust' or 'set'

  const toggleActive = useCallback(() => setActive((prev) => !prev), []);

  const handleSync = () => {
    const actionType = mode === "adjust" ? "adjustInventory" : "setInventory";
    const fieldName = mode === "adjust" ? "delta" : "quantity";

    fetcher.submit(
      { actionType, inventoryItemId, locationId, [fieldName]: value },
      { method: "post" }
    );
    setActive(false);
    setValue("0");
  };

  const isLoading = fetcher.state !== "idle";

  return (
    <Popover
      active={active}
      activator={<Button icon={EditIcon} variant="plain" onClick={(e) => { e.stopPropagation(); toggleActive(); }} size="slim" />}
      onClose={toggleActive}
      sectioned
    >
      <BlockStack gap="300">
        <Text variant="headingXs">Inventory Management</Text>

        <div style={{ display: 'flex', gap: '4px', marginBottom: '8px' }}>
          <Button
            size="slim"
            pressed={mode === 'adjust'}
            onClick={() => { setMode('adjust'); setValue("0"); }}
          >
            Adjust by
          </Button>
          <Button
            size="slim"
            pressed={mode === 'set'}
            onClick={() => { setMode('set'); setValue("0"); }}
          >
            New
          </Button>
        </div>

        <TextField
          label={mode === 'adjust' ? "Adjust by quantity" : "Set New Quantity"}
          type="number"
          value={value}
          onChange={setValue}
          autoComplete="off"
          helpText={mode === 'adjust' ? "Use + or - values (e.g. 5, -3)" : "Overrides current stock"}
        />

        <Button
          size="slim"
          onClick={(e) => { e.stopPropagation(); handleSync(); }}
          loading={isLoading}
          variant="primary"
          fullWidth
        >
          {mode === 'adjust' ? 'Adjust Stock' : 'Set Stock'}
        </Button>
      </BlockStack>
    </Popover>
  );
}


/**
 * HELPER: BinLocationImportModal
 * Modal for importing bin locations from file
 */
function BinLocationImportModal({ active, onClose, onImport, error, success, isLoading, binCount }) {
  const [file, setFile] = useState(null);
  const [previewLocations, setPreviewLocations] = useState([]);
  const [showPreview, setShowPreview] = useState(false);
  const [fileProcessing, setFileProcessing] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileSelect = async (e) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFileProcessing(true);
    setFile(selectedFile);

    try {
      const fileContent = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = (e) => reject(new Error("Failed to read file"));
        reader.readAsText(selectedFile);
      });

      const { parseBinLocations } = await import("../utils/binLocationParser");
      const locations = await parseBinLocations(selectedFile.type, fileContent);
      setPreviewLocations(locations.slice(0, 50));
      setShowPreview(true);
    } catch (err) {
      console.error("Error reading file:", err);
    } finally {
      setFileProcessing(false);
    }
  };

  const handleImport = () => {
    if (file) {
      onImport(file);
    }
  };

  const handleReset = () => {
    setFile(null);
    setPreviewLocations([]);
    setShowPreview(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <Modal
      open={active}
      onClose={onClose}
      title="📁 Import Bin Locations"
      size="large"
      primaryAction={{
        content: isLoading ? "Importing..." : "Import",
        onAction: handleImport,
        loading: isLoading,
        disabled: !file || previewLocations.length === 0 || isLoading || fileProcessing,
      }}
      secondaryActions={[
        {
          content: "Cancel",
          onAction: onClose,
        },
      ]}
    >
      <Modal.Section>
        <BlockStack gap="600">
          {error && (
            <Banner tone="critical" title="❌ Import Failed">
              <p>{error}</p>
              <Text variant="bodySm" tone="subdued" as="p">
                Please check your file format and try again.
              </Text>
            </Banner>
          )}

          {success && (
            <Banner tone="success" title="✅ Success">
              <p>Bin locations imported successfully!</p>
            </Banner>
          )}

          <Card>
            <BlockStack gap="400">
              <BlockStack gap="200">
                <Text variant="headingMd" as="h3">Step 1: Select Your File</Text>
                <Text variant="bodySm" tone="subdued">
                  Supports CSV and TXT formats. Maximum 5MB.
                  {binCount > 0 && <> You have {binCount} locations loaded.</>}
                </Text>
              </BlockStack>

              <Box
                borderWidth="2"
                borderRadius="300"
                borderColor={file ? "border-success" : "border"}
                borderStyle="dashed"
                padding="600"
                background={file ? "bg-fill-success-secondary" : "bg-fill-tertiary"}
                style={{
                  cursor: fileProcessing ? "wait" : "pointer",
                  transition: "all 0.3s ease",
                  textAlign: "center",
                }}
                onClick={() => !fileProcessing && fileInputRef.current?.click()}
              >
                <BlockStack gap="200" align="center">
                  <div style={{ fontSize: "32px" }}>
                    {file ? "✓" : "📤"}
                  </div>
                  <BlockStack gap="100">
                    <Text variant="headingSm" fontWeight="bold">
                      {file ? file.name : "Drop your file here"}
                    </Text>
                    {!file && (
                      <Text variant="bodySm" tone="subdued">
                        or click to browse
                      </Text>
                    )}
                    {file && (
                      <Text variant="bodySm" tone="subdued">
                        {(file.size / 1024).toFixed(2)} KB • {previewLocations.length} locations
                      </Text>
                    )}
                  </BlockStack>
                </BlockStack>
              </Box>

              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.txt"
                onChange={handleFileSelect}
                style={{ display: "none" }}
                disabled={isLoading || fileProcessing}
              />

              {file && (
                <Button
                  fullWidth
                  size="slim"
                  variant="tertiary"
                  onClick={handleReset}
                  disabled={isLoading || fileProcessing}
                >
                  Choose Different File
                </Button>
              )}
            </BlockStack>
          </Card>

          {showPreview && previewLocations.length > 0 && (
            <Card>
              <BlockStack gap="300">
                <BlockStack gap="100">
                  <InlineStack align="space-between">
                    <Text variant="headingMd" as="h3">Step 2: Preview</Text>
                    <Badge tone="info">{previewLocations.length}+ locations</Badge>
                  </InlineStack>
                  <Text variant="bodySm" tone="subdued">
                    Here's a preview of the first {previewLocations.length} bin locations
                  </Text>
                </BlockStack>

                <Box
                  style={{
                    maxHeight: "300px",
                    overflowY: "auto",
                    border: "1px solid var(--p-color-border)",
                    borderRadius: "8px",
                    background: "var(--p-color-bg-surface-secondary)",
                  }}
                >
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: "8px", padding: "12px" }}>
                    {previewLocations.map((location, idx) => (
                      <Box
                        key={idx}
                        padding="200"
                        background="bg-surface"
                        borderRadius="150"
                        style={{ textAlign: "center", border: "1px solid var(--p-color-border)" }}
                      >
                        <Text variant="bodySm" fontWeight="medium" fontFamily="mono">
                          {location}
                        </Text>
                      </Box>
                    ))}
                  </div>
                </Box>
              </BlockStack>
            </Card>
          )}

          <Card background="bg-fill-quaternary">
            <BlockStack gap="300">
              <Text variant="headingXs" as="h4">📝 Supported Formats</Text>
              <BlockStack gap="200">
                <div>
                  <Text variant="bodySm" fontWeight="bold">Newline separated:</Text>
                  <Text variant="bodySm" tone="subdued" fontFamily="mono">
                    A1:1<br />A1:2<br />A1:3
                  </Text>
                </div>
                <div>
                  <Text variant="bodySm" fontWeight="bold">Space separated:</Text>
                  <Text variant="bodySm" tone="subdued" fontFamily="mono">
                    A1:1 A1:2 A1:3 A1:4
                  </Text>
                </div>
                <div>
                  <Text variant="bodySm" fontWeight="bold">Comma separated:</Text>
                  <Text variant="bodySm" tone="subdued" fontFamily="mono">
                    A1:1,A1:2,A1:3
                  </Text>
                </div>
              </BlockStack>
            </BlockStack>
          </Card>
        </BlockStack>
      </Modal.Section>
    </Modal>
  );
}


/**
 * HELPER: BinEditor
 * Enhanced dropdown with search and beautiful UI
 */
function BinEditor({ productId, initialBin, binLocations = [] }) {
  const fetcher = useFetcher();
  const [bin, setBin] = useState(initialBin);
  const [tempBin, setTempBin] = useState(initialBin);
  const [isEditing, setIsEditing] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef(null);

  useEffect(() => {
    setBin(initialBin);
    setTempBin(initialBin);
  }, [initialBin]);

  useEffect(() => {
    if (fetcher.data?.success && fetcher.data?.field === "bin") {
      setBin(fetcher.data.updatedValue);
      setIsEditing(false);
      setSearchValue("");
      setShowSuggestions(false);
      setHighlightedIndex(-1);
    }
  }, [fetcher.data]);

  // Filter suggestions based on search value
  const filteredLocations = useMemo(() => {
    if (!searchValue || binLocations.length === 0) return binLocations;
    return binLocations.filter((loc) =>
      loc.toLowerCase().includes(searchValue.toLowerCase())
    );
  }, [searchValue, binLocations]);

  const handleSelectLocation = (location) => {
    setTempBin(location);
    setSearchValue("");
    setShowSuggestions(false);
    setHighlightedIndex(-1);
  };

  const handleSave = () => {
    fetcher.submit(
      { actionType: "updateBin", productId, binValue: tempBin },
      { method: "post" }
    );
  };

  const handleCancel = () => {
    setIsEditing(false);
    setTempBin(bin);
    setSearchValue("");
    setShowSuggestions(false);
    setHighlightedIndex(-1);
  };

  const handleKeyDown = (e) => {
    if (!showSuggestions || filteredLocations.length === 0) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < filteredLocations.length - 1 ? prev + 1 : prev
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case "Enter":
        e.preventDefault();
        if (highlightedIndex >= 0) {
          handleSelectLocation(filteredLocations[highlightedIndex]);
        }
        break;
      case "Escape":
        e.preventDefault();
        setShowSuggestions(false);
        break;
      default:
        break;
    }
  };

  if (isEditing) {
    return (
      <div ref={containerRef} style={{ position: "relative", width: "100%" }}>
        <Card>
          <BlockStack gap="300">
            <BlockStack gap="100">
              <Text variant="bodySm" fontWeight="bold" as="label">
                🔍 Search Bin Location
              </Text>
              <Text variant="bodyXs" tone="subdued">
                Start typing to filter or use arrow keys to navigate
              </Text>
            </BlockStack>

            <TextField
              value={searchValue}
              onChange={(val) => {
                setSearchValue(val);
                setShowSuggestions(true);
                setHighlightedIndex(-1);
              }}
              onFocus={() => setShowSuggestions(true)}
              onKeyDown={handleKeyDown}
              placeholder="Type location name..."
              autoComplete="off"
              labelHidden
              label="Search"
              type="text"
              suffix={tempBin && <CheckIcon />}
            />

            {binLocations.length === 0 && (
              <Banner tone="warning">
                <Text variant="bodySm">
                  No bin locations imported yet. Please import a file first.
                </Text>
              </Banner>
            )}

            {showSuggestions && binLocations.length > 0 && (
              <Box
                style={{
                  border: "1px solid var(--p-color-border)",
                  borderRadius: "8px",
                  maxHeight: "320px",
                  overflowY: "auto",
                  background: "var(--p-color-bg-surface)",
                }}
              >
                {filteredLocations.length > 0 ? (
                  <div>
                    {filteredLocations.map((location, idx) => (
                      <div
                        key={idx}
                        onClick={() => handleSelectLocation(location)}
                        style={{
                          padding: "10px 12px",
                          cursor: "pointer",
                          borderBottom: "1px solid var(--p-color-border-subdued)",
                          backgroundColor:
                            highlightedIndex === idx
                              ? "var(--p-color-bg-fill-secondary)"
                              : tempBin === location
                                ? "var(--p-color-bg-fill-tertiary)"
                                : "transparent",
                          transition: "background-color 0.15s",
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                        }}
                        onMouseEnter={() => setHighlightedIndex(idx)}
                      >
                        {tempBin === location && (
                          <CheckIcon width="16px" height="16px" />
                        )}
                        <Text
                          variant="bodySm"
                          fontFamily="mono"
                          fontWeight={tempBin === location ? "bold" : "normal"}
                        >
                          {location}
                        </Text>
                      </div>
                    ))}
                  </div>
                ) : (
                  <Box padding="400" style={{ textAlign: "center" }}>
                    <Text variant="bodySm" tone="subdued">
                      No matching locations found
                    </Text>
                  </Box>
                )}
              </Box>
            )}

            <InlineStack gap="200">
              <Button
                onClick={(e) => {
                  e.stopPropagation();
                  handleSave();
                }}
                loading={fetcher.state !== "idle"}
                variant="primary"
                fullWidth
                disabled={!tempBin || fetcher.state !== "idle"}
              >
                Save Location
              </Button>
              <Button
                onClick={(e) => {
                  e.stopPropagation();
                  handleCancel();
                }}
                variant="tertiary"
                disabled={fetcher.state !== "idle"}
              >
                Cancel
              </Button>
            </InlineStack>
          </BlockStack>
        </Card>
      </div>
    );
  }

  return (
    <Button
      onClick={(e) => {
        e.stopPropagation();
        setIsEditing(true);
      }}
      size="slim"
      variant={bin ? "secondary" : "primary"}
      tone={bin ? undefined : "caution"}
    >
      {bin ? (
        <InlineStack gap="150" align="center">
          <Text variant="bodySm" fontWeight="bold">
            📍 {bin}
          </Text>
        </InlineStack>
      ) : (
        <InlineStack gap="150" align="center">
          <Text>+ Assign Bin Location</Text>
        </InlineStack>
      )}
    </Button>
  );
}
