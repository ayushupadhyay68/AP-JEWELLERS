(() => {
        "use strict";

        const API_BASE_URL = 'http://127.0.0.1:8000/api';

        // DOM Elements: adjust these IDs/selectors to match your HTML
        const productsGrid = document.getElementById('productsGrid');
        const loadingElement = document.getElementById('loading');
        const goldRateElement = document.getElementById('goldRate');
        const visibleProductCountElement = document.getElementById('visible-product-count');
        const appliedFiltersDiv = document.getElementById('applied-filters');
        const productCountGrid = document.getElementById('product-count-grid');

        const categoryListElm = document.getElementById('filter-category-list'); // container for categories checkboxes
        const purityListElm = document.getElementById('filter-purity-list');     // container for purity checkboxes
        const weightListElm = document.getElementById('filter-weight-list');     // container for weight checkbox/divs
        const priceListElm = document.getElementById('filter-price-list');       // container for price radio inputs

        const resetFilterBtn = document.getElementById('reset-filter');
        const applyFilterBtn = document.getElementById('apply-filter-btn');

        // Selected filters state (just for UI)
        let selectedFilters = {
            categories: [],
            purity: [],
            weights: [],
            price: null,
            sortBy: 'name',
            sortOrder: 'asc',
        };

        // Load gold rate for display (optional)
        async function loadGoldRate() {
            try {
                const res = await fetch(`${API_BASE_URL}/gold-rate`);
                const data = await res.json();
                if (data.gold_rate_per_gram) {
                    goldRateElement.textContent = `Current Gold Rate: ₹${Number(data.gold_rate_per_gram).toFixed(2)} / g`;
                } else {
                    goldRateElement.textContent = 'Gold rate not available';
                }
            } catch {
                goldRateElement.textContent = 'Gold rate not available';
            }
        }

        // Load categories dynamically into sidebar filter
        async function loadCategories() {
            try {
                const res = await fetch(`${API_BASE_URL}/categories`);
                const categories = await res.json();
                if (!Array.isArray(categories)) throw new Error('Invalid categories response');
                categoryListElm.innerHTML = categories.map(cat => `
        <li class="list-item">
          <input type="checkbox" class="tf-check style-2" id="cat-${cat.id}" value="${cat.id}" name="category">
          <label for="cat-${cat.id}"><span>${cat.name}</span></label>
        </li>`).join('');
            } catch (e) {
                categoryListElm.innerHTML = '<li>Error loading categories</li>';
                console.error('Error loading categories:', e);
            }
        }

        // Collect filters from UI inputs
        function collectFilters() {
            const categoryChecks = Array.from(categoryListElm.querySelectorAll('input[name="category"]:checked'))
                .map(cb => cb.value);
            const purityChecks = Array.from(purityListElm.querySelectorAll('input[type="checkbox"]:checked'))
                .map(cb => cb.value);
            // For weights, if checkboxes or divs with selected class
            let weights;
            if (weightListElm.querySelectorAll('input[type="checkbox"]').length) {
                weights = Array.from(weightListElm.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value);
            } else {
                // If divs toggled by class "selected"
                weights = Array.from(weightListElm.querySelectorAll('.check-item.size-check.selected'))
                    .map(div => div.dataset.value);
            }

            const priceRadio = priceListElm.querySelector('input[type="radio"]:checked');
            const priceVal = priceRadio ? priceRadio.value : null;

            selectedFilters.categories = categoryChecks;
            selectedFilters.purity = purityChecks;
            selectedFilters.weights = weights;
            selectedFilters.price = priceVal;
            // sort can be added if UI sorting inputs exist and wired up
        }

        // Build query string for API call from selectedFilters
        function buildQueryParams() {
            const params = new URLSearchParams();

            if (selectedFilters.categories.length > 0) params.append('category_id[]', selectedFilters.categories.join(','));
            if (selectedFilters.purity.length > 0) params.append('purity', selectedFilters.purity.join(','));
            if (selectedFilters.weights.length > 0) params.append('weight', selectedFilters.weights.join(','));
            if (selectedFilters.price) {
                // For price, expected value format e.g. "0-10000"
                let [min, max] = selectedFilters.price.split('-');
                if (min) params.append('min_price', min);
                if (max) params.append('max_price', max);
            }
            if (selectedFilters.sortBy) params.append('sort_by', selectedFilters.sortBy);
            if (selectedFilters.sortOrder) params.append('sort_order', selectedFilters.sortOrder);

            return params.toString();
        }

        // Fetch filtered products from API and render
        async function fetchFilteredProducts() {
            if (loadingElement) loadingElement.style.display = 'block';
            productsGrid.innerHTML = '';

            try {
                const queryStr = buildQueryParams();
                const res = await fetch(`${API_BASE_URL}/products?${queryStr}`, { headers: { 'Accept': 'application/json' } });
                if (!res.ok) throw new Error(`API error: ${res.status}`);
                const data = await res.json();

                const products = data.data || [];
                visibleProductCountElement.textContent = `${products.length} Products Found`;
                productCountGrid.textContent = `${products.length} Products Found`;

                if (applyFilterBtn && applyFilterBtn.querySelector('span')) {
                    applyFilterBtn.querySelector('span').textContent = `APPLY [${products.length}]`;
                }

                if (products.length === 0) {
                    productsGrid.innerHTML = '<div>No products found</div>';
                    return;
                }
                productsGrid.innerHTML = products.map(product => {
                    const price = (product.final_price) ? parseFloat(product.final_price).toFixed(2) : '0.00';
                    return `
          <div class="product-card">
            <div class="product-image" style="background-image: url('${product.primary_image || 'https://via.placeholder.com/250'}')"></div>
            <h3>${product.name}</h3>
            <div>${product.kt}K • ${product.gram}g</div>
            <div class="product-price">₹${price}</div>
            <div>${product.quantity > 0 ? 'In Stock' : 'Out of Stock'}</div>
          </div>
        `;
                }).join('');
            } catch (err) {
                productsGrid.innerHTML = `<div>Error fetching products: ${err.message}</div>`;
                console.error(err);
            } finally {
                if (loadingElement) loadingElement.style.display = 'none';
            }
        }

        // Show currently applied filters badges
        function updateAppliedFiltersDisplay() {
            const chips = [];

            if (selectedFilters.categories.length) chips.push('Category');
            if (selectedFilters.purity.length) chips.push('Purity');
            if (selectedFilters.weights.length) chips.push('Weight');
            if (selectedFilters.price) chips.push('Price');

            if (chips.length === 0) {
                appliedFiltersDiv.innerHTML = '';
                productCountGrid.textContent = 'No Filter Selected';
                return;
            }

            appliedFiltersDiv.innerHTML = chips.map(ch => `<span class="badge bg-primary me-1">${ch}</span>`).join('');
            productCountGrid.textContent = chips.join(', ');
        }

        // Reset all filter inputs (checkboxes, radios, selected divs)
        function resetAllFilters() {
            categoryListElm.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
            purityListElm.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
            priceListElm.querySelectorAll('input[type="radio"]').forEach(rb => rb.checked = false);
            weightListElm.querySelectorAll('.check-item.size-check.selected').forEach(div => div.classList.remove('selected'));

            selectedFilters = { categories: [], purity: [], weights: [], price: null, sortBy: 'name', sortOrder: 'asc' };
            updateAppliedFiltersDisplay();
        }

        // ===== FORM VALIDATION & API SUBMISSION =====
        document.getElementById('checkoutForm').addEventListener('submit', async function (e) {
            e.preventDefault();

            // 1. VALIDATE REQUIRED FIELDS FIRST
            if (!validateForm()) return;

            // 2. PREPARE DATA FOR API
            const formData = {
                shipping_address: formatFullAddress(),
                billing_address: formatFullAddress(), // Same as shipping by default
                payment_method: document.querySelector('input[name="payment_method"]:checked').value,
                email: document.getElementById('email').value.trim(),
                customer_mobile: document.getElementById('customer_mobile').value.trim(),
                first_name: document.getElementById('first_name').value.trim(), // Optional
                last_name: document.getElementById('last_name').value.trim()   // Optional
            };

            // 3. SUBMIT TO API
            try {
                const submitBtn = document.querySelector('.tf-btn.submit');
                submitBtn.disabled = true;
                submitBtn.textContent = 'Processing...';

                const response = await fetch('http://127.0.0.1:8000/api/checkout', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(formData)
                });

                if (!response.ok) throw new Error(await response.text());

                // Success - Redirect or show message
                alert('Order placed successfully!');
                // window.location.href = "/thank-you"; // Uncomment to redirect

            } catch (error) {
                console.error('Checkout Error:', error);
                alert(`Failed: ${error.message || 'Server error'}`);
            } finally {
                const submitBtn = document.querySelector('.tf-btn.submit');
                submitBtn.disabled = false;
                submitBtn.textContent = 'Place Order';
            }
        });

        // ===== HELPER FUNCTIONS =====
        function validateForm() {
            const fields = [
                { id: 'shipping_address', name: 'Address' },
                { id: 'email', name: 'Email', validate: v => /^\S+@\S+\.\S+$/.test(v) || "Invalid email" },
                { id: 'customer_mobile', name: 'Phone', validate: v => v.length >= 10 || "Too short (min 10 digits)" }
            ];

            for (const field of fields) {
                const input = document.getElementById(field.id);
                const value = input.value.trim();

                if (!value) {
                    showError(input, `${field.name} is required`);
                    return false;
                }

                if (field.validate) {
                    const validation = field.validate(value);
                    if (typeof validation === 'string') {
                        showError(input, validation);
                        return false;
                    }
                }
            }
            return true;
        }

        function formatFullAddress() {
            return [
                document.getElementById('shipping_address').value.trim(),
                document.getElementById('apartment').value.trim(),
                document.getElementById('city').value.trim(),
                document.getElementById('zipcode').value.trim()
            ].filter(Boolean).join(', ');
        }

        function showError(input, message) {
            alert(message); // Replace with UI error display if needed
            input.focus();
            input.classList.add('error-field'); // Add CSS class for red border
        }




        // Attach event listeners to filters for collect + fetch call
        function bindFilterEvents() {
            // Category checkboxes
            categoryListElm.addEventListener('change', e => {
                if (e.target && e.target.name === 'category') {
                    collectFilters();
                    updateAppliedFiltersDisplay();
                }
            });
            // Purity checkboxes
            purityListElm.addEventListener('change', e => {
                if (e.target && e.target.type === 'checkbox') {
                    collectFilters();
                    updateAppliedFiltersDisplay();
                }
            });
            // Price radios
            priceListElm.addEventListener('change', e => {
                if (e.target && e.target.type === 'radio') {
                    collectFilters();
                    updateAppliedFiltersDisplay();
                }
            });
            // Weight div toggles - toggle 'selected' class
            weightListElm.addEventListener('click', e => {
                const checkItem = e.target.closest('.check-item.size-check');
                if (checkItem) {
                    checkItem.classList.toggle('selected');
                    collectFilters();
                    updateAppliedFiltersDisplay();
                }
            });
            // Apply button triggers fetch
            applyFilterBtn.addEventListener('click', fetchFilteredProducts);
            // Reset button clears filters and fetches all products
            resetFilterBtn.addEventListener('click', () => {
                resetAllFilters();
                fetchFilteredProducts();
            });
        }

        // Initialize function when DOM is ready
        async function initialize() {
            await loadGoldRate();
            await loadCategories();
            collectFilters();
            updateAppliedFiltersDisplay();
            bindFilterEvents();
            fetchFilteredProducts();
        }

        document.addEventListener('DOMContentLoaded', initialize);
    })();