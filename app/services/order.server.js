export async function getFabricOrders(admin, cursor = null, direction = "next") {
  try {
    const paginationArgs = direction === "prev" ? `last: 10, before: "${cursor}"` : `first: 10, after: ${cursor ? `"${cursor}"` : "null"}`;
    const response = await admin.graphql(
      `#graphql
        query getFabricOrders($query: String) {
          orders(${paginationArgs}, reverse: true, query: $query) {
            pageInfo { hasNextPage hasPreviousPage startCursor endCursor }
            edges {
              node {
                id
                name
                createdAt
                displayFinancialStatus
                totalPriceSet { shopMoney { amount currencyCode } }
                subtotalPriceSet { shopMoney { amount } }
                totalTaxSet { shopMoney { amount } }
                shippingLine { title originalPriceSet { shopMoney { amount } } }
                shippingAddress { name address1 city zip provinceCode country }
                lineItems(first: 10) {
                  edges {
                    node {
                      id
                      title
                      quantity
                      sku
                      unfulfilledQuantity
                      originalUnitPriceSet { shopMoney { amount } }
                      variant {
                        barcode
                        sku
                        product {
                          productType
                          featuredImage { url }
                          metafields(first: 10) {
                            edges {
                              node {
                                namespace
                                key
                                value
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
                fulfillmentOrders(first: 10) {
                  edges {
                    node {
                      id
                      status
                      lineItems(first: 50) {
                        edges {
                          node {
                            id
                            totalQuantity
                            remainingQuantity
                            lineItem {
                              id
                              title
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }`,
      { variables: { query: "(fulfillment_status:unfulfilled OR fulfillment_status:partial) AND tag:swatch-only" } }
    );
    const responseJson = await response.json();
    return {
      edges: responseJson.data?.orders?.edges || [],
      pageInfo: responseJson.data?.orders?.pageInfo
    };
  } catch (error) {
    console.error("Unfulfilled Service Error:", error);
    return { edges: [], pageInfo: null };
  }
}

export async function getFulfilledFabricOrders(admin, cursor = null, direction = "next") {
  try {
    const paginationArgs = direction === "prev" ? `last: 10, before: "${cursor}"` : `first: 10, after: ${cursor ? `"${cursor}"` : "null"}`;
    const response = await admin.graphql(
      `#graphql
        query getFulfilledOrders {
          orders(${paginationArgs}, reverse: true, query: "fulfillment_status:fulfilled AND tag:swatch-only") {
            pageInfo { hasNextPage hasPreviousPage startCursor endCursor }
            edges {
              node {
                id
                name
                updatedAt
                displayFinancialStatus
                totalPriceSet { shopMoney { amount currencyCode } }
                lineItems(first: 10) {
                  edges {
                    node {
                      id
                      title
                      quantity
                      sku
                      unfulfilledQuantity
                      variant {
                         barcode
                         product { featuredImage { url } }
                      }
                    }
                  }
                }
              }
            }
          }
        }`
    );
    const responseJson = await response.json();
    return {
      edges: responseJson.data?.orders?.edges || [],
      pageInfo: responseJson.data?.orders?.pageInfo
    };
  } catch (error) {
    console.error("Fulfilled Service Error:", error);
    return { edges: [], pageInfo: null };
  }
}

export async function getFabricInventory(admin, cursor = null, { query = "", sortKey = "ID", reverse = false, direction = "next", locationId = null, isBinSearch = false } = {}) {
  try {
    // For BIN searches, don't use sorting to ensure we get diverse products
    const activeSortKey = (query && !isBinSearch) ? "RELEVANCE" : (isBinSearch ? "ID" : sortKey);
    const activeReverse = (query && !isBinSearch) ? false : (isBinSearch ? false : reverse);
    
    let finalQuery;
    if (isBinSearch) {
      // For BIN searches, fetch all swatch items (no text search) - we'll filter by BIN on server
      finalQuery = 'product_type:"Swatch Item"';
    } else {
      // For regular searches, use Shopify's search
      const escapedQuery = query.replace(/"/g, '\\"');
      finalQuery = query 
        ? `product_type:"Swatch Item" AND "${escapedQuery}"` 
        : 'product_type:"Swatch Item"';
    }

    const paginationArgs = direction === "prev" ? `last: 10, before: "${cursor}"` : `first: 10, after: ${cursor ? `"${cursor}"` : "null"}`;

    console.log(`[INVENTORY SEARCH] Variables:`, { finalQuery, activeSortKey, activeReverse, isBinSearch, pagination: isBinSearch ? '100 items' : '10 items' });

    let resJson;
    try {
      const response = await admin.graphql(
        `#graphql
        query getInventory($query: String, $sortKey: ProductSortKeys, $reverse: Boolean) {
          products(${isBinSearch ? (direction === "prev" ? "last: 100, before: \"" + cursor + "\"" : "first: 100, after: " + (cursor ? "\"" + cursor + "\"" : "null")) : paginationArgs}, query: $query, sortKey: $sortKey, reverse: $reverse) {
            pageInfo { hasNextPage hasPreviousPage startCursor endCursor }
            edges {
              node {
                id
                legacyResourceId
                title
                totalInventory
                featuredImage { url }
                metafields(first: 10) {
                  edges {
                    node {
                      namespace
                      key
                      value
                    }
                  }
                }
                variants(first: 1) {
                  edges {
                    node {
                      id
                      sku
                      barcode
                      inventoryItem {
                        id
                        inventoryLevels(first: 10) {
                          edges {
                            node {
                              id
                              location { id name }
                              quantities(names: ["available"]) {
                                name
                                quantity
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }`,
        { variables: { query: finalQuery, sortKey: activeSortKey, reverse: activeReverse } }
      );
      resJson = await response.json();
    } catch (err) {
      console.error("[INVENTORY SEARCH] FATAL ERROR:", err);
      throw err;
    }

    if (resJson.errors) {
      console.error("[INVENTORY SEARCH] GRAPHQL ERRORS:", JSON.stringify(resJson.errors, null, 2));
    }

    let edges = resJson.data?.products?.edges || [];
    
    // Debug: Log metafields for first few products
    if (edges.length > 0) {
      console.log(`[DEBUG METAFIELDS] First product metafields:`, JSON.stringify(edges[0].node.metafields?.edges || [], null, 2));
    }
    
    // Apply BIN filtering server-side if this is a BIN search
    if (isBinSearch && query) {
      const searchLower = query.toLowerCase();
      const beforeFilter = edges.length;
      console.log(`[BIN SEARCH DEBUG] Filtering ${beforeFilter} products for BIN: "${query}"`);
      
      edges = edges.filter((edge) => {
        const metafields = edge.node.metafields?.edges || [];
        const binMetafield = metafields.find(mf => mf.node.key === 'bin_number' && mf.node.namespace === 'custom');
        const binValue = binMetafield?.node.value || '';
        
        // Debug: Log all BIN values we encounter
        if (binValue) {
          console.log(`[BIN VALUE FOUND] Product "${edge.node.title}" has BIN: "${binValue}"`);
        }
        
        const matches = binValue && binValue.toLowerCase().includes(searchLower);
        if (matches) {
          console.log(`[BIN MATCH] Query "${query}" matched BIN "${binValue}" for product ${edge.node.title}`);
        }
        return matches;
      });
      console.log(`[INVENTORY BIN FILTER] Server-side filtered from ${beforeFilter} to ${edges.length} items for BIN search: "${query}"`);
      
      // If no matches found, log all available BIN values for debugging
      if (edges.length === 0) {
        console.log(`[BIN SEARCH DEBUG] No matches found for "${query}". Available BIN values in this batch:`);
        resJson.data?.products?.edges?.forEach(edge => {
          const metafields = edge.node.metafields?.edges || [];
          const binMetafield = metafields.find(mf => mf.node.key === 'bin_number' && mf.node.namespace === 'custom');
          if (binMetafield) {
            console.log(`  - "${binMetafield.node.value}" (${edge.node.title})`);
          }
        });
      }
    }

    console.log(`[INVENTORY SEARCH] Success: Found ${edges.length} products for query: "${finalQuery}"${isBinSearch ? ' (BIN filtered)' : ''}`);
    if (edges.length === 0 && !query) {
       console.log("[INVENTORY SEARCH] WARNING: No products found with 'Swatch Item' type. Checking all products...");
    }
    
    return {
      edges: edges,
      pageInfo: resJson.data?.products?.pageInfo
    };
  } catch (error) {
    console.error("Inventory Service Error:", error);
    return { edges: [], pageInfo: null, error: error.message };
  }
}
export async function getPartiallyFulfilledOrders(admin, cursor = null, direction = "next") {
  try {
    const paginationArgs = direction === "prev" ? `last: 10, before: "${cursor}"` : `first: 10, after: ${cursor ? `"${cursor}"` : "null"}`;
    const response = await admin.graphql(
      `#graphql
        query getPartiallyFulfilledOrders {
          orders(${paginationArgs}, reverse: true, query: "fulfillment_status:partial AND tag:swatch-only") {
            pageInfo { hasNextPage hasPreviousPage startCursor endCursor }
            edges {
              node {
                id
                name
                createdAt
                updatedAt
                displayFinancialStatus
                totalPriceSet { shopMoney { amount currencyCode } }
                lineItems(first: 50) {
                  edges {
                    node {
                      id
                      title
                      quantity
                      sku
                      unfulfilledQuantity
                      variant {
                        barcode
                        sku
                        product {
                          productType
                          featuredImage { url }
                          metafields(first: 10) {
                            edges {
                              node {
                                namespace
                                key
                                value
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
                fulfillmentOrders(first: 10) {
                  edges {
                    node {
                      id
                      status
                      lineItems(first: 50) {
                        edges {
                          node {
                            id
                            totalQuantity
                            remainingQuantity
                            lineItem {
                              id
                              title
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }`
    );
    const responseJson = await response.json();
    return {
      edges: responseJson.data?.orders?.edges || [],
      pageInfo: responseJson.data?.orders?.pageInfo
    };
  } catch (error) {
    console.error("Partially Fulfilled Service Error:", error);
    return { edges: [], pageInfo: null };
  }
}

export async function getFulfilledOrdersCount(admin) {
  try {
    const response = await admin.graphql(
      `#graphql
        query getFulfilledCount {
          orders(first: 1, query: "fulfillment_status:fulfilled AND tag:swatch-only") {
             nodes { id }
          }
        }`
    );
    const resJson = await response.json();
    // In Shopify GraphQL, the total count is available if you request it via connection, 
    // but the simplest way here is to use the nodes count or a dedicated count query if allowed.
    // However, the standard way is to use the query above.
    // To get the ACTUAL total count efficiently:
    const countResponse = await admin.graphql(
      `#graphql
      query getCount {
        ordersCount(query: "fulfillment_status:fulfilled AND tag:swatch-only") {
          count
        }
      }`
    );
    const countData = await countResponse.json();
    return countData.data?.ordersCount?.count || 0;
  } catch (error) {
    console.error("Fulfilled Count Error:", error);
    return 0;
  }
}

export async function getShopLocations(admin) {
  try {
    const response = await admin.graphql(
      `#graphql
      query getLocations {
        locations(first: 10) {
          nodes {
            id
            name
            isActive
            isPrimary
          }
        }
      }`
    );
    const resJson = await response.json();
    return resJson.data?.locations?.nodes || [];
  } catch (error) {
    console.error("Get Locations Error:", error);
    return [];
  }
}

export async function getAllFabricInventory(admin) {
  let allProducts = [];
  let hasNextPage = true;
  let cursor = null;

  try {
    while (hasNextPage) {
      const response = await admin.graphql(
        `#graphql
        query getAllInventory($cursor: String) {
          products(first: 50, after: $cursor, query: "product_type:'Swatch Item'") {
            pageInfo { hasNextPage endCursor }
            edges {
              node {
                title
                metafields(first: 10) {
                  edges {
                    node {
                      namespace
                      key
                      value
                    }
                  }
                }
                variants(first: 1) {
                  edges {
                    node {
                      sku
                      barcode
                    }
                  }
                }
              }
            }
          }
        }`,
        { variables: { cursor } }
      );

      const resJson = await response.json();
      const products = resJson.data?.products?.edges || [];
      allProducts = allProducts.concat(products.map(p => {
        const binMeta = p.node.metafields.edges.find(e => e.node.key === "bin_number")?.node;
        return {
          title: p.node.title,
          sku: p.node.variants.edges[0]?.node?.sku || "N/A",
          barcode: p.node.variants.edges[0]?.node?.barcode || "",
          binNumber: binMeta?.value || ""
        };
      }));

      hasNextPage = resJson.data?.products?.pageInfo.hasNextPage;
      cursor = resJson.data?.products?.pageInfo.endCursor;
    }
    return allProducts;
  } catch (error) {
    console.error("GetAllInventory Error:", error);
    return [];
  }
}

export async function getGlobalInventoryStats(admin, locationId) {
  let stats = { total: 0, lowStock: 0, outOfStock: 0 };
  let hasNextPage = true;
  let cursor = null;

  try {
    while (hasNextPage) {
      const response = await admin.graphql(
        `#graphql
        query getGlobalStats($cursor: String) {
          products(first: 100, after: $cursor, query: "product_type:'Swatch Item'") {
            pageInfo { hasNextPage endCursor }
            edges {
              node {
                variants(first: 1) {
                  edges {
                    node {
                      inventoryItem {
                        inventoryLevel(locationId: "${locationId}") {
                          quantities(names: ["available"]) {
                            quantity
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }`,
        { variables: { cursor } }
      );

      const resJson = await response.json();
      if (resJson.errors) {
        console.error("[GLOBAL STATS] GraphQL Errors:", JSON.stringify(resJson.errors, null, 2));
        break;
      }

      const products = resJson.data?.products?.edges || [];
      products.forEach(p => {
        const variant = p.node.variants.edges[0]?.node;
        const available = variant?.inventoryItem?.inventoryLevel?.quantities[0]?.quantity || 0;
        
        stats.total++;
        if (available <= 0) stats.outOfStock++;
        else if (available < 10) stats.lowStock++;
      });

      hasNextPage = resJson.data?.products?.pageInfo.hasNextPage;
      cursor = resJson.data?.products?.pageInfo.endCursor;
    }
    return stats;
  } catch (error) {
    console.error("GetGlobalInventoryStats Error:", error);
    return stats;
  }
}
