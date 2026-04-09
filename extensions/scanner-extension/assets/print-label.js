(function () {
    const STORAGE_KEY_VERIFIED = 'fb_verified_items_stable';
    const STORAGE_KEY_PRINTED = 'fb_printed_labels_stable';
    const PROXY_URL = '/apps/fabric-scanner/get';

    let verifiedItems = new Set(),
        printedLabels = new Set(),
        inventoryData = [],
        ordersData = [],
        historyData = [];
    let html5QrCode = null,
        currentUser = null,
        isScanning = false,
        shopDomain = null;

    let invPage = 1,
        invHasPrev = false,
        invHasNext = false,
        invStart = null,
        invEnd = null;
    let invSort = 'CREATED_AT',
        invReverse = true;
    let ordPage = 1,
        ordHasPrev = false,
        ordHasNext = false,
        ordStart = null,
        ordEnd = null;
    let histPage = 1,
        histHasPrev = false,
        histHasNext = false,
        histStart = null,
        histEnd = null;
    let lastOpenedOrderId = null; // Track which order was last opened

    const setLoader = (show) => (document.getElementById('fb-loader').style.display = show ? 'flex' : 'none');

    const loadState = () => {
        try {
            const v = localStorage.getItem(STORAGE_KEY_VERIFIED);
            if (v) verifiedItems = new Set(JSON.parse(v));
            const p = localStorage.getItem(STORAGE_KEY_PRINTED);
            if (p) printedLabels = new Set(JSON.parse(p));
        } catch (e) {
            console.error('Error loading state', e);
        }
    };

    const saveState = () => {
        try {
            localStorage.setItem(STORAGE_KEY_VERIFIED, JSON.stringify([...verifiedItems]));
            localStorage.setItem(STORAGE_KEY_PRINTED, JSON.stringify([...printedLabels]));
        } catch (e) {
            console.error('Error saving state', e);
        }
    };

    const getBin = (node) => {
        if (!node || !node.metafields) return 'N/A';
        const m = node.metafields.edges.find((x) => x.node.key === 'bin_number' && x.node.namespace === 'custom');
        return m ? m.node.value : 'N/A';
    };

    window.toggleOrder = (header) => {
        const items = header.nextElementSibling;
        const chevron = header.querySelector('.fb-chevron');
        const isHidden =
            items.style.display === 'none' ||
            (items.style.display === '' && window.getComputedStyle(items).display === 'none');

        // Find the order ID from the header content
        const orderNameMatch = header.textContent.match(/ORDER\s+([^\s]+)/);
        if (orderNameMatch) {
            const orderName = orderNameMatch[1];
            // Find the order in current data to get its ID
            const orderData = ordersData.find((e) => e.node.name === orderName);
            if (orderData) {
                lastOpenedOrderId = isHidden ? orderData.node.id : null;
            }
        }

        if (isHidden) {
            items.style.display = 'block';
            chevron.classList.add('open');
        } else {
            items.style.display = 'none';
            chevron.classList.remove('open');
        }
    };

    const updateUIVisibility = () => {
        if (!currentUser) return;
        console.log('[UI] Updating visibility based on settings:', currentUser);
        const stockTab = document.getElementById('tab-stock');
        const ordersTab = document.getElementById('tab-orders');
        const historyTab = document.getElementById('tab-history');
        if (currentUser.showStockTab !== false) stockTab.style.display = 'block';
        else stockTab.style.display = 'none';
        if (currentUser.showOrdersTab !== false) ordersTab.style.display = 'block';
        else ordersTab.style.display = 'none';
        if (currentUser.showHistoryTab !== false) historyTab.style.display = 'block';
        else historyTab.style.display = 'none';
        const invSearch = document.getElementById('inv-search-input');
        const invSort = document.getElementById('inv-sort-select');
        if (currentUser.enableInventorySearch === false) invSearch.style.display = 'none';
        else invSearch.style.display = 'block';
        if (currentUser.enableInventorySort === false) invSort.style.display = 'none';
        else invSort.style.display = 'block';
        if (currentUser.showLogoutButton !== false) document.getElementById('logout-trigger').style.display = 'block';
        else document.getElementById('logout-trigger').style.display = 'none';

        const switchTabAutomatically = () => {
            const firstVisible = Array.from(document.querySelectorAll('.fb-tab-btn')).find(
                (b) => b.style.display !== 'none'
            );
            if (firstVisible) {
                firstVisible.click();
            }
        };

        let currentActiveTab = document.querySelector('.fb-tab-btn.active')?.dataset.tab;
        if (currentActiveTab === 'stock-pane' && currentUser.showStockTab === false) switchTabAutomatically();
        if (currentActiveTab === 'orders-pane' && currentUser.showOrdersTab === false) switchTabAutomatically();
        if (currentActiveTab === 'history-pane' && currentUser.showHistoryTab === false) switchTabAutomatically();
    };

    const showApp = () => {
        document.getElementById('auth-section').style.setProperty('display', 'none', 'important');
        document.getElementById('main-nav').style.display = 'flex';
        document.getElementById('app-content').style.display = 'block';
        document.getElementById('user-display-name').innerText = currentUser.name;

        updateUIVisibility();

        let savedTab = localStorage.getItem('fb_active_tab') || 'stock-pane';
        if (savedTab === 'stock-pane' && currentUser.showStockTab === false) savedTab = 'orders-pane';
        if (savedTab === 'orders-pane' && currentUser.showOrdersTab === false) savedTab = 'history-pane';
        if (savedTab === 'history-pane' && currentUser.showHistoryTab === false) savedTab = 'stock-pane';

        console.log(`[TAB RESTORE] Restoring tab: ${savedTab}`);
        document.querySelectorAll('.fb-tab-btn, .fb-pane').forEach((el) => el.classList.remove('active'));
        const activeTabBtn = document.querySelector(`[data-tab="${savedTab}"]`);
        if (activeTabBtn) {
            activeTabBtn.classList.add('active');
            document.getElementById(savedTab)?.classList.add('active');
        } else {
            const firstVisible = Array.from(document.querySelectorAll('.fb-tab-btn')).find(
                (b) => b.style.display !== 'none'
            );
            if (firstVisible) {
                firstVisible.classList.add('active');
                document.getElementById(firstVisible.dataset.tab)?.classList.add('active');
                savedTab = firstVisible.dataset.tab;
            }
        }

        if (savedTab === 'stock-pane') loadInventory();
        else if (savedTab === 'orders-pane') loadOrders();
        else if (savedTab === 'history-pane') loadHistory();
    };

    const refreshSettings = async () => {
        if (!currentUser) return;
        console.log('[SETTINGS] Refreshing fresh settings from server...');
        try {
            const r = await fetch(`${PROXY_URL}?type=settings&_t=${Date.now()}`);
            const j = await r.json();
            if (j.data) {
                currentUser = { ...currentUser, ...j.data };
                console.log('[SETTINGS] Fresh settings merged:', j.data);
                localStorage.setItem('fb_session_stable', JSON.stringify(currentUser));
                updateUIVisibility();
            }
        } catch (e) {
            console.error('[SETTINGS] Failed to refresh settings:', e);
        }
    };

    const restoreSession = () => {
        const saved = localStorage.getItem('fb_session_stable');
        if (!saved) return;
        try {
            currentUser = JSON.parse(saved);
            showApp();
            refreshSettings();
        } catch (e) {
            console.error('Session restore error:', e);
            localStorage.removeItem('fb_session_stable');
        }
    };

    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    function beep(ok) {
        try {
            const o = audioCtx.createOscillator();
            o.connect(audioCtx.destination);
            o.frequency.value = ok ? 800 : 200;
            o.start();
            o.stop(audioCtx.currentTime + 0.1);
        } catch (e) { }
    }
    function vibrate(ok) {
        if (window.navigator && window.navigator.vibrate) {
            window.navigator.vibrate(ok ? 200 : [100, 50, 100]);
        }
    }

    document.getElementById('toggle-pass-btn').onclick = () => {
        const passInput = document.getElementById('staff-pass');
        const eyeOpen = document.getElementById('eye-open');
        const eyeClosed = document.getElementById('eye-closed');
        if (passInput.type === 'password') {
            passInput.type = 'text';
            eyeOpen.style.display = 'none';
            eyeClosed.style.display = 'block';
        } else {
            passInput.type = 'password';
            eyeOpen.style.display = 'block';
            eyeClosed.style.display = 'none';
        }
    };

    document.getElementById('login-btn').onclick = async () => {
        const id = document.getElementById('staff-id').value,
            pin = document.getElementById('staff-pass').value;
        if (!id || !pin) return;
        setLoader(true);
        try {
            const r = await fetch(
                `${PROXY_URL}?type=auth&identifier=${encodeURIComponent(id)}&pin=${pin}&_t=${Date.now()}`
            );
            const j = await r.json();
            if (j.data?.valid) {
                currentUser = j.data.staff;
                console.log('[LOGIN] Current user set to:', currentUser);
                localStorage.setItem('fb_session_stable', JSON.stringify(currentUser));
                showApp();
            } else alert('Invalid login');
        } catch (e) {
            alert('Error connecting to server');
        } finally {
            setLoader(false);
        }
    };

    document.getElementById('logout-trigger').onclick = () => {
        localStorage.removeItem('fb_session_stable');
        location.reload();
    };

    document.querySelectorAll('.fb-tab-btn').forEach((btn) => {
        btn.onclick = (e) => {
            const target = e.target.dataset.tab;
            document.querySelectorAll('.fb-tab-btn, .fb-pane').forEach((el) => el.classList.remove('active'));
            e.target.classList.add('active');
            document.getElementById(target).classList.add('active');

            // Save active tab to localStorage
            localStorage.setItem('fb_active_tab', target);

            // Only fetch if data is empty, otherwise just render existing data
            console.log(`[TAB SWITCH] Switching to: ${target}`);
            if (target === 'stock-pane') {
                if (inventoryData.length > 0) {
                    console.log(`[STOCK] Using cached data (${inventoryData.length} items, page ${invPage})`);
                    renderInventory();
                } else {
                    console.log('[STOCK] No cached data, fetching...');
                    loadInventory();
                }
            } else if (target === 'orders-pane') {
                if (ordersData.length > 0) {
                    console.log(`[ORDERS] Using cached data (${ordersData.length} items, page ${ordPage})`);
                    renderOrders();
                } else {
                    console.log('[ORDERS] No cached data, fetching...');
                    loadOrders();
                }
            } else if (target === 'history-pane') {
                if (historyData.length > 0) {
                    console.log(`[HISTORY] Using cached data (${historyData.length} items, page ${histPage})`);
                    // Re-render history inline
                    document.getElementById('history-container').innerHTML = historyData
                        .map((e, idx) => {
                            const hIdx = (histPage - 1) * 10 + idx + 1;
                            const fulfiller = e.log ? e.log.scannedBy || e.log.staffEmail : 'Unknown';
                            return `<div class="fb-order-card" style="padding:15px; border-radius:12px; border:1px solid var(--p-border);">
                                <div style="display:flex; justify-content:space-between; align-items:center; gap:10px;">
                                    <div style="flex:1;">
                                        <b style="font-size:14px;">${hIdx}. ORDER ${e.node.name}</b><br>
                                        <div style="margin-top:4px;">
                                            <span style="color:var(--p-success); font-weight:700; font-size:11px; letter-spacing:0.5px;">FULFILLED</span><br>
                                            <small style="color:var(--p-text-subdued)">Fulfilled by: <b>${fulfiller}</b></small>
                                        </div>
                                    </div>
                                    <div style="display:flex; align-items:center; gap:8px; flex-shrink:0;">
                                        ${shopDomain
                                    ? `<button class="fb-view-order-btn" onclick="window.open('https://admin.shopify.com/store/${shopDomain}/orders/${e.node.id
                                        .split('/')
                                        .pop()}', '_blank')">📋 View</button>`
                                    : ''
                                }
                                        <small style="color:var(--p-text-subdued); font-size:11px; white-space:nowrap;">${new Date(
                                    e.node.updatedAt
                                ).toLocaleDateString()}</small>
                                    </div>
                                </div>
                            </div>`;
                        })
                        .join('');
                } else {
                    console.log('[HISTORY] No cached data, fetching...');
                    loadHistory();
                }
            }
        };
    });

    document.getElementById('inv-sort-select').onchange = (e) => {
        const [key, rev] = e.target.value.split(':');
        invSort = key;
        invReverse = rev === 'true';
        invPage = 1;
        invStart = null;
        invEnd = null;
        loadInventory();
    };

    let searchTimeout;
    document.getElementById('inv-search-input').oninput = (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            invPage = 1;
            invStart = null;
            invEnd = null;
            loadInventory();
        }, 500);
    };

    const loadInventory = async (dir = 'next', isPagination = false) => {
        const q = document.getElementById('inv-search-input').value || '';
        console.log(
            `[STOCK FETCH] Direction: ${dir}, isPagination: ${isPagination}, Current page: ${invPage}, Query: ${q}`
        );
        setLoader(true);
        let cur = dir === 'next' ? invEnd : invStart;
        if (!cur) dir = 'next';

        // Check if this is a BIN search (more permissive detection)
        const isBinSearch =
            q &&
            (q.toLowerCase().includes('bin') ||
                /^\d/.test(q) || // starts with number
                /^[a-zA-Z]+\d+/.test(q) || // letter(s) followed by number(s)
                /^[a-zA-Z]\d+/.test(q)); // letter followed by number(s)

        console.log(`[SEARCH DEBUG] Query: "${q}", isBinSearch: ${isBinSearch}`);

        try {
            const r = await fetch(
                `${PROXY_URL}?type=inventory&direction=${dir}${cur ? `&cursor=${cur}` : ''
                }&sortKey=${invSort}&reverse=${invReverse}&query=${encodeURIComponent(
                    q
                )}&isBinSearch=${isBinSearch}&_t=${Date.now()}`
            );
            const j = await r.json();
            inventoryData = j.data.edges;
            console.log(
                `[STOCK FETCH] Received ${inventoryData.length} items${isBinSearch ? ' (BIN search applied)' : ''}`
            );

            // Debug: Log first item metafields if BIN search
            if (isBinSearch && inventoryData.length > 0) {
                console.log(
                    `[DEBUG BIN SEARCH] First item metafields:`,
                    JSON.stringify(inventoryData[0].node.metafields?.edges || [], null, 2)
                );
            }

            const pi = j.data.pageInfo;
            // Only update page counter when explicitly paginating, not on tab switches
            if (isPagination && cur) {
                if (dir === 'next') invPage++;
                else if (invPage > 1) invPage--;
                console.log(`[STOCK FETCH] Page updated to: ${invPage}`);
            }
            invHasNext = pi.hasNextPage;
            invHasPrev = pi.hasPreviousPage;
            invStart = pi.startCursor;
            invEnd = pi.endCursor;
            document.getElementById('prev-inventory').disabled = !invHasPrev;
            document.getElementById('next-inventory').disabled = !invHasNext;
            document.getElementById('page-label-inventory').innerText = `Page ${invPage}`;
            document.getElementById('stock-pagination').style.display = invHasNext || invHasPrev ? 'flex' : 'none';
            renderInventory();
        } finally {
            setLoader(false);
        }
    };

    document.getElementById('prev-inventory').onclick = () => loadInventory('prev', true);
    document.getElementById('next-inventory').onclick = () => loadInventory('next', true);

    function renderInventory() {
        console.log(`[STOCK RENDER] Rendering ${inventoryData.length} items for page ${invPage}`);
        const container = document.getElementById('inventory-list');
        if (inventoryData.length === 0) {
            container.innerHTML =
                '<div style="text-align:center; padding:40px; color:var(--p-text-subdued)">No matching inventory found.</div>';
            return;
        }
        container.innerHTML = inventoryData
            .map((e, idx) => {
                const p = e.node,
                    v = p.variants.edges[0].node;
                const bin = getBin(p);
                const displayNumber = (invPage - 1) * 10 + idx + 1;
                return `<div class="fb-stock-card">
                    <div class="fb-stock-body">
                        <img src="${p.featuredImage?.url || ''}" class="fb-stock-img">
                        <div class="fb-stock-info">
                            <div class="fb-stock-title">${p.title}</div>
                            <div class="fb-stock-sku">SKU: ${v.sku || 'N/A'}</div>
                            <div class="fb-stock-qty">Stock: ${p.totalInventory}</div>
                            <div class="fb-stock-meta">
                                <span class="fb-stock-bin">BIN: ${bin}</span>
                                <button class="fb-badge" style="cursor:pointer; background:var(--p-white); border:1px solid var(--p-border); color:var(--p-text-subdued); font-weight:700; margin:0; padding:2px 8px;" onclick="printTag('${p.title.replace(
                    /'/g,
                    "\\'"
                )}', '${v.barcode}', '${bin}', '${p.featuredImage?.url}')">PRINT TAG</button>
                            </div>
                        </div>
                    </div>
                </div>`;
            })
            .join('');
    }

    const loadOrders = async (dir = 'next', isPagination = false) => {
        console.log(`[ORDERS FETCH] Direction: ${dir}, isPagination: ${isPagination}, Current page: ${ordPage}`);
        setLoader(true);
        let cur = dir === 'next' ? ordEnd : ordStart;
        if (!cur) dir = 'next';
        try {
            const r = await fetch(
                `${PROXY_URL}?type=orders&direction=${dir}${cur ? `&cursor=${cur}` : ''}&_t=${Date.now()}`
            );
            const j = await r.json();
            ordersData = j.data.edges;
            shopDomain = j.data.shopDomain;
            console.log(`[ORDERS FETCH] Received ${ordersData.length} items, shopDomain: ${shopDomain}`);
            const pi = j.data.pageInfo;
            if (isPagination && cur) {
                if (dir === 'next') ordPage++;
                else if (ordPage > 1) ordPage--;
                console.log(`[ORDERS FETCH] Page updated to: ${ordPage}`);
            }
            ordHasNext = pi.hasNextPage;
            ordHasPrev = pi.hasPreviousPage;
            ordStart = pi.startCursor;
            ordEnd = pi.endCursor;
            document.getElementById('prev-orders').disabled = !ordHasPrev;
            document.getElementById('next-orders').disabled = !ordHasNext;
            document.getElementById('page-label-orders').innerText = `Page ${ordPage}`;
            document.getElementById('orders-pagination').style.display = ordHasNext || ordHasPrev ? 'flex' : 'none';

            // Check if lastOpenedOrderId is still in the current page data
            const orderExists = ordersData.some((e) => e.node.id === lastOpenedOrderId);
            if (!orderExists) {
                lastOpenedOrderId = null; // Reset if order is no longer on this page
            }

            renderOrders();
        } finally {
            setLoader(false);
        }
    };

    document.getElementById('prev-orders').onclick = () => loadOrders('prev', true);
    document.getElementById('next-orders').onclick = () => loadOrders('next', true);

    function renderOrders() {
        console.log(`[ORDERS RENDER] Rendering ${ordersData.length} items for page ${ordPage}`);
        const container = document.getElementById('order-container');
        if (ordersData.length === 0) {
            container.innerHTML =
                '<div style="text-align:center; padding:40px; color:var(--p-text-subdued)">No pending swatch orders found.</div>';
            return;
        }
        container.innerHTML = ordersData
            .map((e, idx) => {
                const o = e.node;

                // Get all swatch items
                const allFabrics = o.lineItems.edges.filter(
                    (x) => x.node.variant?.product?.productType?.toLowerCase() === 'swatch item'
                );

                // Determine quantities
                let totalSwatchQty = 0;
                let fulfilledSwatchQty = 0;
                const unfulfilledLineItemIds = new Set();
                const fulfilledLineItemIds = new Set();

                allFabrics.forEach((fx) => {
                    const q = fx.node.quantity;
                    const uq = fx.node.unfulfilledQuantity;
                    totalSwatchQty += q;
                    fulfilledSwatchQty += q - uq;

                    if (uq > 0) unfulfilledLineItemIds.add(fx.node.id);
                    if (q - uq > 0) fulfilledLineItemIds.add(fx.node.id);
                });

                // Only count unfulfilled items for verification/button logic
                const fabrics = allFabrics.filter((fx) => fx.node.unfulfilledQuantity > 0);

                if (fabrics.length === 0) return '';
                const allVerified = fabrics.every((x) => verifiedItems.has(x.node.id));
                const labelPrinted = printedLabels.has(o.id);
                const orderRowIdx = (ordPage - 1) * 10 + idx + 1;

                // Check if order is partially fulfilled
                const isPartiallyFulfilled = fulfilledSwatchQty > 0 && fulfilledSwatchQty < totalSwatchQty;
                const isPartiallyShippedStatus = fulfilledSwatchQty > 0 && fulfilledSwatchQty < totalSwatchQty;

                // Map line item IDs to fulfiller names from logs
                const fulfillerMap = {};
                if (e.logs && e.logs.length > 0) {
                    lastLog = e.logs[0]; // Most recent log
                    e.logs.forEach((log) => {
                        const match = log.details.match(/\[ITEMS:([^\]]+)\]/);
                        if (match && match[1]) {
                            const itemIds = match[1].split(',');
                            itemIds.forEach((itemId) => {
                                fulfillerMap[itemId] = log.scannedBy;
                            });
                        }
                    });
                }

                const fulfilledItems = allFabrics.filter((fx) => fulfilledLineItemIds.has(fx.node.id));
                const unfulfilledItems = allFabrics.filter((fx) => !fulfilledLineItemIds.has(fx.node.id));

                return `<div class="fb-order-card" ${isPartiallyShippedStatus ? 'style="border: 2px solid var(--p-accent);"' : ''
                    }>
                    <div class="fb-order-header" onclick="toggleOrder(this)" ${isPartiallyShippedStatus ? 'style="background: rgba(187, 122, 126, 0.05);"' : ''
                    }>
                        <div style="display:flex; justify-content:space-between; width:100%; align-items:center; gap:10px;">
                            <span>${orderRowIdx}. ORDER ${o.name} ${isPartiallyShippedStatus
                        ? `<span style="background: var(--p-accent); color: white; padding: 2px 10px; border-radius: 20px; font-size: 11px; margin-left: 8px;">PARTIAL</span> <span style="font-size: 11px; color: var(--p-accent); margin-left:8px; font-weight:600;">(${fulfilledSwatchQty}/${totalSwatchQty} shipped)</span>`
                        : ''
                    }</span>
                            <div style="display:flex; align-items:center; gap:8px; flex-shrink:0;">
                                ${shopDomain
                        ? `<button class="fb-view-order-btn" onclick="event.stopPropagation(); window.open('https://admin.shopify.com/store/${shopDomain}/orders/${o.id
                            .split('/')
                            .pop()}', '_blank')">📋 View Order</button>`
                        : ''
                    }
                                <svg class="fb-chevron ${lastOpenedOrderId === o.id ? 'open' : idx === 0 && !lastOpenedOrderId ? 'open' : ''
                    }" width="20" height="20" viewBox="0 0 20 20" fill="var(--p-text-subdued)"><path d="M5 7l5 5 5-5H5z"/></svg>
                            </div>
                        </div>
                    </div>
                    <div class="fb-order-items" ${lastOpenedOrderId === o.id
                        ? 'style="display: block;"'
                        : idx === 0 && !lastOpenedOrderId
                            ? 'style="display: block;"'
                            : ''
                    }>
                        ${allFabrics
                        .map((fx) =>
                            renderItemRow(
                                fx,
                                fulfilledLineItemIds.has(fx.node.id),
                                fulfillerMap,
                                o,
                                verifiedItems,
                                printedLabels,
                                allVerified
                            )
                        )
                        .join('')}

                        ${allVerified
                        ? `
                            <div style="padding:15px; text-align:center; background:#f9fafb; border-top: 1px solid #eee;">
                                ${!labelPrinted
                            ? `<button class="fb-btn fb-btn-secondary" style="width:100%; height:45px; font-size:15px; background:var(--p-accent); color:#fff; border-radius:4px; display:flex; align-items:center; justify-content:center; gap:8px;" onclick="printShippingLabel('${o.id
                            }', '${o.name}', '${(o.shippingAddress?.name || '').replace(/'/g, "\\'")}', '${(
                                o.shippingAddress?.address1 || ''
                            ).replace(/'/g, "\\'")}, ${(o.shippingAddress?.city || '').replace(
                                /'/g,
                                "\\'"
                            )}', true)">🏷 Generate Shipping Label</button>`
                            : `<button class="fb-btn fb-btn-success" style="width:100%; height:45px; font-size:15px;" onclick="fulfillNow('${o.id}')">Fulfill Order ${o.name}</button>`
                        }
                            </div>
                        `
                        : verifiedItems.size > 0 && fabrics.some((fx) => verifiedItems.has(fx.node.id))
                            ? `
                            <div style="padding:15px; text-align:center; background:rgba(187, 122, 126, 0.03); border-top: 1px solid var(--p-border);">
                                <button class="fb-btn" style="width:100%; background: var(--p-accent);" onclick="fulfillNow('${o.id
                            }', true)">Ship Verified Swatches (${fabrics.filter((fx) => verifiedItems.has(fx.node.id)).length
                            })</button>
                                <div style="margin-top: 8px; font-size: 11px; color: var(--p-accent); font-weight:500;">Only scanned items will be fulfilled.</div>
                            </div>
                        `
                            : ''
                    }
                    </div>
                </div>`;
            })
            .join('');
    }

    function renderItemRow(fx, isFulfilled, fulfillerMap, o, verifiedItems, printedLabels, allVerified = false) {
        const bin = getBin(fx.node.variant?.product);
        const done = verifiedItems.has(fx.node.id);
        const fulfiller = fulfillerMap[fx.node.id] || 'admin';
        const sku = fx.node.variant?.sku || fx.node.variant?.product?.sku || 'N/A';
        const labelPrinted = printedLabels.has(o.id);
        const showLabelBadge = done && (!allVerified || labelPrinted);

        return `<div style="display:flex; flex-direction:column; gap:8px; padding:12px; border-bottom:1px solid var(--p-border); position:relative; ${done ? 'background:rgba(72, 91, 89, 0.05)' : isFulfilled ? 'background:rgba(130, 115, 108, 0.02)' : ''
            }">
                <!-- Responsive Layout: Image | Text Info | Labels/Buttons -->
                <div style="display:flex; gap:12px; align-items:flex-start; min-width:0;">
                    <!-- Image Column (fixed width, responsive) -->
                    <div style="flex:0 0 80px; display:flex; align-items:center; justify-content:center;">
                        <img src="${fx.node.variant?.product?.featuredImage?.url
            }" style="width:100%; height:80px; border-radius:6px; object-fit:cover;">
                    </div>

                    <!-- Text Info Column (flexible, takes available space) -->
                    <div style="flex:1; min-width:0; display:flex; flex-direction:column; gap:2px;">
                        <div style="font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; font-size:14px; margin-bottom:4px;">${fx.node.title
            }</div>
                        <div class="fb-item-info" style="font-size:12px; line-height:1.5; color:var(--p-text-subdued);">
                            ${fx.node.unfulfilledQuantity === 0
                ? `<div style="margin-bottom:2px;"><span class="fb-status" style="color:var(--p-success) !important; font-weight:600;">✓ Fulfilled by ${fulfiller}</span></div>`
                : ''
            }
                            ${fx.node.unfulfilledQuantity > 0 && fx.node.unfulfilledQuantity < fx.node.quantity
                ? `<div style="margin-bottom:2px;"><span class="fb-status" style="color:var(--p-accent) !important; font-weight:600;">⚠ Partially shipped: ${fx.node.quantity - fx.node.unfulfilledQuantity
                }/${fx.node.quantity}</span></div>`
                : ''
            }
                            <div><strong>BIN:</strong> ${bin}</div>
                            <div><strong>SKU:</strong> ${sku}</div>
                        </div>
                    </div>

                    <!-- Status Column (top-aligned badges) -->
                    <div style="flex:0 0 120px; display:flex; flex-direction:column; gap:6px; align-items:flex-end;">
                        ${isFulfilled
                ? `<div style="background:var(--p-success); color:#fff; padding:4px 8px; border-radius:4px; font-size:11px; font-weight:700; letter-spacing:0.5px; white-space:nowrap; width:100%; text-align:center;">✓ FULFILLED</div>`
                : done
                    ? `<div style="background:rgba(72, 91, 89, 0.1); color:var(--p-success); padding:4px 8px; border-radius:4px; font-size:11px; font-weight:700; border:1px solid var(--p-success); letter-spacing:0.5px; white-space:nowrap; width:100%; text-align:center;">✓ VERIFIED</div>`
                    : ''
            }

                        <!-- Shipping Label Badge (below status) -->
                        ${showLabelBadge
                ? `<div style="background:var(--p-accent); color:#fff; padding:4px 8px; border-radius:4px; font-size:11px; font-weight:700; letter-spacing:0.5px; white-space:nowrap; cursor:pointer; width:100%; text-align:center;" onclick="printShippingLabel('${o.id
                }', '${o.name}', '${(o.shippingAddress?.name || '').replace(/'/g, "\\'")}', '${(
                    o.shippingAddress?.address1 || ''
                ).replace(/'/g, "\\'")}, ${(o.shippingAddress?.city || '').replace(
                    /'/g,
                    "\\'"
                )}')">🏷 LABEL</div>`
                : ''
            }
                    </div>
                </div>

                <!-- SCAN Button positioned at bottom right -->
                ${!isFulfilled && !done
                ? `<div style="position:absolute; bottom:12px; right:12px;">
                        <button class="fb-btn" style="padding: 6px 12px; font-size: 11px; font-weight:600; background:#4a4a4a; color:#fff; white-space:nowrap; ${currentUser.enableScanButton === false ? 'pointer-events: none; opacity: 0.6;' : ''
                }" ${currentUser.enableScanButton === false ? 'disabled' : ''} onclick="startScan('${fx.node.id
                }', '${fx.node.variant?.barcode}', '${fx.node.title.replace(
                    /'/g,
                    "\\'"
                )}', '${bin}', '${sku}')">SCAN</button>
                      </div>`
                : ''
            }
            </div>`;
    }

    window.printShippingLabel = async (id, name, customer, address, isBulk = false) => {
        setLoader(true);
        const logo = currentUser?.brandLogo || '';
        var win = window.open('', '_blank', 'width=300,height=150'); // Thermal label size
        var s = '<script',
            se = '</' + 'script>';

        var html = `<html><head><title>Label - ${name}</title>
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { 
                        font-family: Arial, sans-serif; 
                        width: 2.625in; 
                        height: 1in; 
                        overflow: hidden;
                        background: white;
                    }
                    @media print {
                        @page { 
                            size: 2.625in 1in; 
                            margin: 0; 
                            padding: 0;
                        }
                        body {
                            width: 2.625in;
                            height: 1in;
                            padding: 0.05in;
                            margin: 0;
                        }
                    }
                    .label-container { 
                        display: flex; 
                        align-items: center; 
                        justify-content: space-between; 
                        gap: 0.08in; 
                        height: 0.9in;
                        width: 2.525in;
                        padding: 0.05in;
                    }
                    .logo-box { 
                        width: 0.45in; 
                        height: 0.45in; 
                        display: flex; 
                        align-items: center; 
                        justify-content: center; 
                        flex-shrink: 0;
                        background: white;
                    }
                    .logo-box img { 
                        max-width: 0.4in; 
                        max-height: 0.4in; 
                        object-fit: contain; 
                    }
                    .address-box { 
                        flex: 1; 
                        min-width: 0;
                        display: flex;
                        flex-direction: column;
                        justify-content: center;
                        gap: 0.02in;
                    }
                    .customer-name { 
                        font-weight: bold; 
                        font-size: 9pt; 
                        line-height: 1.1;
                        white-space: nowrap; 
                        overflow: hidden; 
                        text-overflow: ellipsis;
                    }
                    .address-line { 
                        font-size: 7pt; 
                        line-height: 1.1;
                        word-wrap: break-word;
                        overflow: hidden;
                        max-height: 0.3in;
                        color: #000;
                    }
                </style>
            </head><body>
                <div class="label-container">
                    <div class="logo-box">
                        ${logo
                ? `<img src="${logo}" alt="Logo">`
                : '<div style="border: 1px solid #ccc; width: 0.35in; height: 0.35in; font-size: 6pt; display: flex; align-items: center; justify-content: center; color: #999;">LOGO</div>'
            }
                    </div>
                    <div class="address-box">
                        <div class="customer-name">${(customer || 'Customer').substring(0, 30)}</div>
                        <div class="address-line">${(address || 'Address N/A').substring(0, 60)}</div>
                    </div>
                </div>
                ${s}>
                    window.onload = function() { 
                        document.body.style.margin = '0';
                        document.body.style.padding = '0';
                        setTimeout(function() { 
                            window.print(); 
                            setTimeout(function() { window.close(); }, 300);
                        }, 300); 
                    };
                ${se}
            </body></html>`;

        win.document.open();
        win.document.write(html);
        win.document.close();

        setTimeout(() => {
            setLoader(false);
            if (isBulk) {
                printedLabels.add(id);
                saveState();
                renderOrders();
            }
        }, 1000);
    };

    const loadHistory = async (dir = 'next', isPagination = false) => {
        console.log(`[HISTORY FETCH]Direction: ${dir}, isPagination: ${isPagination}, Current page: ${histPage} `);
        setLoader(true);
        let cur = dir === 'next' ? histEnd : histStart;
        if (!cur) dir = 'next';
        try {
            const r = await fetch(
                `${PROXY_URL}?type=fulfilled&direction=${dir}${cur ? `&cursor=${cur}` : ''}&_t=${Date.now()}`
            );
            const j = await r.json();
            historyData = j.data.edges;
            if (j.data.shopDomain) shopDomain = j.data.shopDomain;
            console.log(`[HISTORY FETCH] Received ${historyData.length} items, shopDomain: ${shopDomain}`);
            const pi = j.data.pageInfo;
            if (isPagination && cur) {
                if (dir === 'next') histPage++;
                else if (histPage > 1) histPage--;
                console.log(`[HISTORY FETCH] Page updated to: ${histPage} `);
            }
            histHasNext = pi.hasNextPage;
            histHasPrev = pi.hasPreviousPage;
            histStart = pi.startCursor;
            histEnd = pi.endCursor;
            document.getElementById('prev-history').disabled = !histHasPrev;
            document.getElementById('next-history').disabled = !histHasNext;
            document.getElementById('page-label-history').innerText = `Page ${histPage} `;
            document.getElementById('history-pagination').style.display = histHasNext || histHasPrev ? 'flex' : 'none';

            console.log(`[HISTORY RENDER] Rendering ${historyData.length} items for page ${histPage}`);
            const historyContainer = document.getElementById('history-container');
            if (historyData.length === 0) {
                historyContainer.innerHTML =
                    '<div style="text-align:center; padding:40px; color:var(--p-text-subdued)">No fulfillment history found.</div>';
            } else {
                historyContainer.innerHTML = historyData
                    .map((e, idx) => {
                        const hIdx = (histPage - 1) * 10 + idx + 1;
                        const fulfiller = e.log ? e.log.scannedBy || e.log.staffEmail : 'Unknown';
                        return `<div class="fb-order-card" style="padding:15px;">
                <div style="display:flex; justify-content:space-between; align-items:center; gap:10px;">
                    <div style="flex:1;">
                        <b>${hIdx}. ORDER ${e.node.name}</b><br>
                            <small style="color:var(--p-primary)">Status: FULFILLED</small><br>
                                <small style="color:var(--p-text-subdued)">Fulfilled by: <b>${fulfiller}</b></small>
                            </div>
                            <div style="display:flex; align-items:center; gap:8px; flex-shrink:0;">
                                ${shopDomain
                                ? `<button class="fb-view-order-btn" onclick="window.open('https://admin.shopify.com/store/${shopDomain}/orders/${e.node.id
                                    .split('/')
                                    .pop()}', '_blank')">📋 View</button>`
                                : ''
                            }
                                <small style="color:var(--p-text-subdued); white-space:nowrap;">${new Date(
                                e.node.updatedAt
                            ).toLocaleString()}</small>
                            </div>
                    </div>
                </div>`;
                    })
                    .join('');
            }
        } finally {
            setLoader(false);
        }
    };

    document.getElementById('prev-history').onclick = () => loadHistory('prev', true);
    document.getElementById('next-history').onclick = () => loadHistory('next', true);

    window.startScan = (id, exp, title, bin, sku) => {
        if (isScanning) return;
        isScanning = true;

        // Find the order containing this line item and set it as the last opened order
        const orderData = ordersData.find((e) => e.node.lineItems.edges.some((edge) => edge.node.id === id));
        if (orderData) {
            lastOpenedOrderId = orderData.node.id;
        }

        document.getElementById('camera-modal').style.display = 'flex';
        document.getElementById('scan-target-name').innerText = title;
        document.getElementById('scan-target-sku').innerText = `SKU: ${sku} `;
        document.getElementById('scan-target-bin').innerText = `BIN #${bin} `;

        setTimeout(() => {
            if (!html5QrCode) html5QrCode = new Html5Qrcode('reader');
            html5QrCode
                .start(
                    { facingMode: 'environment' },
                    { fps: 20, qrbox: { width: 300, height: 150 }, aspectRatio: 1.0 },
                    async (decodedText) => {
                        if (isScanning) {
                            if (decodedText.trim() === exp.trim()) {
                                isScanning = false;
                                beep(true);
                                vibrate(true);
                                verifiedItems.add(id);
                                saveState();
                                await closeScanner();
                                renderOrders();
                            } else {
                                isScanning = false;
                                beep(false);
                                vibrate(false);
                                // Close scanner first, then show alert
                                await closeScanner();
                                alert(
                                    `WRONG ITEM!\nYou should go to BIN #${bin}\n\nRequired: ${exp}\nScanned: ${decodedText}\n\nClick OK to scan again.`
                                );
                                // Restart scanning after user dismisses alert
                                startScan(id, exp, title, bin, sku);
                            }
                        }
                    },
                    () => { }
                )
                .catch((err) => {
                    console.error(err);
                    alert('Camera failed.');
                    closeScanner();
                });
        }, 300);
    };

    window.closeScanner = async () => {
        isScanning = false;
        if (html5QrCode) {
            try {
                await html5QrCode.stop();
            } catch (e) { }
            html5QrCode = null;
            const readerDiv = document.getElementById('reader');
            if (readerDiv) readerDiv.innerHTML = '';
        }
        document.getElementById('camera-modal').style.display = 'none';
        return true;
    };

    document.getElementById('scanner-cancel-btn').onclick = closeScanner;

    window.fulfillNow = async (id, isPartial = false) => {
        if (
            isPartial &&
            !confirm('Are you sure you want to perform a partial fulfillment? Only scanned items will be shipped.')
        )
            return;

        setLoader(true);
        try {
            const orderNode = ordersData.find((e) => e.node.id === id)?.node;
            const verifiedItemsForOrder = [];

            if (orderNode) {
                orderNode.lineItems.edges.forEach((edge) => {
                    if (verifiedItems.has(edge.node.id)) {
                        verifiedItemsForOrder.push({
                            id: edge.node.id,
                            quantity: edge.node.quantity,
                        });
                    }
                });
            }

            if (verifiedItemsForOrder.length === 0) {
                alert('No verified items to fulfill.');
                setLoader(false);
                return;
            }

            const r = await fetch(PROXY_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    orderId: id,
                    staffData: currentUser,
                    verifiedItems: verifiedItemsForOrder,
                }),
            });
            const res = await r.json();
            if (res.success) {
                // Use detailed message from API if available, otherwise use generic message
                const successMessage =
                    res.message ||
                    (res.partiallyFulfilled
                        ? 'Partial Fulfillment Successful!'
                        : 'Order Fulfilled Successfully! Moving to History.');
                alert(successMessage);

                // Set the fulfilled order as the last opened order so it stays open after refresh
                lastOpenedOrderId = id;

                // Local UI Update for instant feedback
                if (!res.partiallyFulfilled) {
                    // Remove from ordersData if fully fulfilled
                    ordersData = ordersData.filter((e) => e.node.id !== id);
                    printedLabels.delete(id);
                } else {
                    // For partial fulfillment, let's update the local order node
                    // so it immediately shows the new status/quantities
                    const orderIdx = ordersData.findIndex((e) => e.node.id === id);
                    if (orderIdx !== -1) {
                        const node = ordersData[orderIdx].node;
                        node.lineItems.edges.forEach((edge) => {
                            if (verifiedItems.has(edge.node.id)) {
                                // Update unfulfilled quantity to 0 locally
                                edge.node.unfulfilledQuantity = 0;
                            }
                        });
                    }
                }

                // Clear verified items for these successfully fulfilled items
                if (orderNode) {
                    orderNode.lineItems.edges.forEach((edge) => {
                        if (verifiedItems.has(edge.node.id)) {
                            verifiedItems.delete(edge.node.id);
                        }
                    });
                }

                saveState();
                renderOrders(); // Instant UI Update
                // Reset pagination to show newest data
                ordPage = 1;
                ordStart = null;
                ordEnd = null;
                histPage = 1;
                histStart = null;
                histEnd = null;

                // Refresh after a short delay to let Shopify update its index
                setLoader(true);
                setTimeout(async () => {
                    await Promise.all([loadOrders(), loadHistory()]);
                    setLoader(false);
                }, 2500);
            } else {
                alert('Fulfillment Error: ' + (res.error || 'Unknown error'));
                setLoader(false);
            }
        } catch (e) {
            console.error('Fulfillment Request Error:', e);
            alert('Request failed. Please check connection.');
            setLoader(false);
        }
        // We don't use finally { setLoader(false) } because loadOrders will handle it after the timeout
    };

    window.printTag = function (title, code, bin, img) {
        var win = window.open('', '_blank', 'width=600,height=800');
        var s = '<script',
            se = '</' + 'script>';
        var html = `<html><head><title>Print Label</title>
                ${s} src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js">${se}
                <style>body{text-align:center;padding:40px;margin:0}img{width:300px;border-radius:12px;margin-bottom:15px}h1{font-size:36px;margin:10px 0}.bin{background:#000;color:#fff;font-size:50px;padding:15px;border-radius:8px;margin:20px 0}</style>
                </head><body>
                <img src="${img}" onerror="this.style.display='none'">
                <h1>${title}</h1>
                <div class="bin">BIN: ${bin}</div>
                <div style="margin-top:20px;"><svg id="barcode"></svg></div>
                ${s}>setTimeout(function(){if(window.JsBarcode){JsBarcode("#barcode","${code}",{width:4,height:120,displayValue:true,fontSize:24});setTimeout(function(){window.print()},300)}},500)${se}
                </body></html>`;
        win.document.open();
        win.document.write(html);
        win.document.close();
    };

    // Check for old session and show warning
    const checkOldSession = () => {
        const saved = localStorage.getItem('fb_session_stable');
        if (saved) {
            document.getElementById('clear-session-btn').style.display = 'block';
            document.getElementById('session-warning').style.display = 'block';
        }
    };

    document.getElementById('clear-session-btn').onclick = () => {
        if (confirm('This will clear your old session. You will need to log in again with new credentials. Continue?')) {
            localStorage.removeItem('fb_session_stable');
            localStorage.removeItem(STORAGE_KEY_VERIFIED);
            localStorage.removeItem(STORAGE_KEY_PRINTED);
            alert('Session cleared! Please log in with your new credentials.');
            location.reload();
        }
    };

    checkOldSession();
    loadState();
    restoreSession();

    // Show the root once session state is determined
    const root = document.getElementById('fabric-scanner-root');
    if (root) {
        // If no user was restored, ensure auth section is visible
        if (!currentUser) {
            document.getElementById('auth-section').style.display = 'block';
        }
        root.classList.add('fb-ready');
    }
})();