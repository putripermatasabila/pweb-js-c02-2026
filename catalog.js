/**
 * catalog.js - Mini Shopee Product Catalog
 * Modul 2 Praktikum Pemrograman Web
 * Native Vanilla JavaScript (External Script with defer)
 */

// ============================================================================
// 1. AUTH GUARD (Proteksi Halaman)
// ============================================================================
const currentUser = localStorage.getItem("firstName");

// Jika belum login, redirect paksa kembali ke index.html (halaman login)
if (!currentUser) {
  window.location.href = "index.html";
}

// ============================================================================
// 2. STATE MANAGEMENT & DOM ELEMENTS
// ============================================================================
const API_URL = "https://dummyjson.com/products";
const ITEMS_PER_PAGE = 12;

let allProducts = [];
let filteredProducts = [];
let displayedCount = ITEMS_PER_PAGE;

let searchQuery = "";
let selectedCategory = "";
let selectedSort = "";
let minPrice = null;
let maxPrice = null;

// DOM References
const userNameEl = document.getElementById("user-name");
const logoutBtn = document.getElementById("logout-btn");

const searchInput = document.getElementById("search-input");
const categoryFilter = document.getElementById("category-filter");
const sortFilter = document.getElementById("sort-filter");
const minPriceInput = document.getElementById("min-price");
const maxPriceInput = document.getElementById("max-price");
const resetFilterBtn = document.getElementById("reset-filter-btn");
const emptyResetBtn = document.getElementById("empty-reset-btn");

const productsGrid = document.getElementById("products-grid");
const resultsCountEl = document.getElementById("results-count");
const paginationWrapper = document.getElementById("pagination-wrapper");
const loadMoreBtn = document.getElementById("load-more-btn");
const paginationInfo = document.getElementById("pagination-info");

const errorState = document.getElementById("error-state");
const errorMessageEl = document.getElementById("error-message");
const retryBtn = document.getElementById("retry-btn");
const emptyState = document.getElementById("empty-state");

// ============================================================================
// 3. NAVIGATION BAR & SESSION HANDLER
// ============================================================================
if (userNameEl && currentUser) {
  userNameEl.textContent = currentUser;
}

if (logoutBtn) {
  logoutBtn.addEventListener("click", () => {
    // Hapus sesi pengguna dari Local Storage
    localStorage.removeItem("firstName");
    // Redirect ke halaman login
    window.location.href = "index.html";
  });
}

// ============================================================================
// 4. CLOSURE-BASED DEBOUNCE UTILITY
// ============================================================================
/**
 * Fungsi Debounce memanfaatkan Closure.
 * Variabel `timeoutId` berada di lexical scope luar fungsi yang dikembalikan,
 * sehingga status timer tetap tersimpan antar pemanggilan event.
 * Mencegah re-render yang terlalu sering pada setiap ketikan keyboard.
 */
function debounce(callback, delay = 300) {
  let timeoutId = null; // Terperangkap di dalam closure

  return function (...args) {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      callback.apply(this, args);
      timeoutId = null;
    }, delay);
  };
}

// ============================================================================
// 5. SKELETON LOADING (Fitur Tambahan Nilai Plus)
// ============================================================================
/**
 * Menampilkan kartu skeleton dengan efek shimmer animasi murni CSS
 * saat data sedang diambil (fetching) dari API.
 */
function renderSkeletonLoading(count = 12) {
  errorState.style.display = "none";
  emptyState.style.display = "none";
  paginationWrapper.style.display = "none";

  const skeletonCardsHtml = Array.from({ length: count })
    .map(
      () => `
      <div class="skeleton-card" aria-hidden="true">
        <div class="skeleton-shimmer skeleton-img"></div>
        <div class="skeleton-body">
          <div class="skeleton-shimmer skeleton-tag"></div>
          <div class="skeleton-shimmer skeleton-title"></div>
          <div class="skeleton-shimmer skeleton-title-short"></div>
          <div class="skeleton-shimmer skeleton-rating"></div>
          <div class="skeleton-shimmer skeleton-price"></div>
          <div class="skeleton-shimmer skeleton-btn"></div>
        </div>
      </div>
    `,
    )
    .join("");

  productsGrid.innerHTML = skeletonCardsHtml;
}

// ============================================================================
// 6. POPULATE CATEGORIES DROPDOWN
// ============================================================================
/**
 * Mengisi opsi kategori dropdown secara dinamis dari produk yang di-fetch
 */
function populateCategoryOptions(products) {
  // Ambil semua kategori unik menggunakan Set
  const categories = Array.from(
    new Set(products.map((p) => p.category).filter(Boolean)),
  ).sort();

  // Reset dropdown dan sisakan opsi default
  categoryFilter.innerHTML = '<option value="">Semua Kategori</option>';

  categories.forEach((cat) => {
    const option = document.createElement("option");
    option.value = cat;
    // Format nama kategori agar berawalan huruf kapital
    option.textContent = cat.charAt(0).toUpperCase() + cat.slice(1);
    categoryFilter.appendChild(option);
  });
}

// ============================================================================
// 7. FETCH DATA PRODUK (Global Error Handling)
// ============================================================================
async function fetchProducts() {
  renderSkeletonLoading(ITEMS_PER_PAGE);
  resultsCountEl.textContent = "Mengambil data dari server dummyjson...";

  try {
    const response = await fetch(API_URL);

    if (!response.ok) {
      throw new Error(`Gagal memuat data (HTTP ${response.status})`);
    }

    const data = await response.json();

    if (!data || !Array.isArray(data.products)) {
      throw new Error("Format data respons API tidak sesuai.");
    }

    allProducts = data.products;

    // Isi pilihan kategori
    populateCategoryOptions(allProducts);

    // Terapkan filter awal & render
    applyFiltersAndRender();
  } catch (error) {
    // Tampilkan pesan error visual jika fetch API gagal
    productsGrid.innerHTML = "";
    paginationWrapper.style.display = "none";
    emptyState.style.display = "none";
    resultsCountEl.textContent = "Terjadi kesalahan";

    errorState.style.display = "block";
    errorMessageEl.textContent =
      error.message || "Gagal menghubungi API DummyJSON. Periksa koneksi internet Anda.";
  }
}

// Tombol Retry untuk koneksi yang gagal
if (retryBtn) {
  retryBtn.addEventListener("click", () => {
    fetchProducts();
  });
}

// ============================================================================
// 8. FILTER & SORTING (Functional Programming)
// ============================================================================
/**
 * Menyaring dan mengurutkan data produk menggunakan functional array methods
 * (.filter, .sort) tanpa memutasi array asli.
 */
function applyFiltersAndRender() {
  errorState.style.display = "none";

  // 1. Filtering dengan .filter()
  filteredProducts = allProducts.filter((product) => {
    // Pencarian berdasarkan nama produk atau kategori
    const titleMatch = product.title
      ? product.title.toLowerCase().includes(searchQuery)
      : false;
    const categoryMatch = product.category
      ? product.category.toLowerCase().includes(searchQuery)
      : false;
    const matchesSearch = !searchQuery || titleMatch || categoryMatch;

    // Filter dropdown kategori
    const matchesCategory =
      !selectedCategory ||
      product.category.toLowerCase() === selectedCategory.toLowerCase();

    // Fitur Nilai Plus: Filter Rentang Harga (Min - Max)
    const matchesMinPrice =
      minPrice === null || product.price >= minPrice;
    const matchesMaxPrice =
      maxPrice === null || product.price <= maxPrice;

    return matchesSearch && matchesCategory && matchesMinPrice && matchesMaxPrice;
  });

  // 2. Sorting dengan .sort() menggunakan pure functional approach
  if (selectedSort === "price-asc") {
    filteredProducts = [...filteredProducts].sort((a, b) => a.price - b.price);
  } else if (selectedSort === "price-desc") {
    filteredProducts = [...filteredProducts].sort((a, b) => b.price - a.price);
  } else if (selectedSort === "rating-desc") {
    filteredProducts = [...filteredProducts].sort((a, b) => b.rating - a.rating);
  } else if (selectedSort === "rating-asc") {
    filteredProducts = [...filteredProducts].sort((a, b) => a.rating - b.rating);
  }

  // Render produk hasil filter
  renderProductGrid();
}

// ============================================================================
// 9. RENDER PRODUK DINAMIS & LOAD MORE (Array Slicing)
// ============================================================================
function escapeHtml(str) {
  if (typeof str !== "string") return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function renderProductGrid() {
  const total = filteredProducts.length;

  // Update deskripsi hasil
  if (total === 0) {
    resultsCountEl.textContent = "0 produk ditemukan";
    productsGrid.innerHTML = "";
    emptyState.style.display = "block";
    paginationWrapper.style.display = "none";
    return;
  }

  emptyState.style.display = "none";
  resultsCountEl.textContent = `Menampilkan ${Math.min(
    displayedCount,
    total,
  )} dari ${total} produk`;

  // Terapkan teknik ARRAY SLICING untuk pagination / load more
  const visibleProducts = filteredProducts.slice(0, displayedCount);

  // Render daftar produk dalam bentuk kartu (card grid)
  productsGrid.innerHTML = visibleProducts
    .map((product) => {
      const discount = product.discountPercentage
        ? Math.round(product.discountPercentage)
        : null;
      const originalPrice = discount
        ? (product.price / (1 - discount / 100)).toFixed(2)
        : null;

      return `
        <article class="product-card" data-id="${product.id}">
          <div class="card-media">
            ${
              discount
                ? `<span class="badge-discount">-${discount}%</span>`
                : ""
            }
            <img
              src="${escapeHtml(product.thumbnail)}"
              alt="${escapeHtml(product.title)}"
              class="card-image"
              loading="lazy"
              onerror="this.src='https://dummyimage.com/300x200/e2e4ec/6b7280.png?text=No+Image'"
            />
          </div>
          <div class="card-body">
            <span class="card-category">${escapeHtml(product.category || "Produk")}</span>
            <h3 class="card-title" title="${escapeHtml(product.title)}">
              ${escapeHtml(product.title)}
            </h3>
            <div class="card-rating">
              <span class="star-icon" aria-hidden="true">★</span>
              <span class="rating-value">${product.rating ? Number(product.rating).toFixed(1) : "0.0"}</span>
              <span>/ 5.0</span>
            </div>
            <div class="card-price-row">
              <span class="card-price">$${Number(product.price).toFixed(2)}</span>
              ${
                originalPrice
                  ? `<span class="card-original-price">$${originalPrice}</span>`
                  : ""
              }
            </div>
            <button
              type="button"
              class="btn-add-cart"
              data-id="${product.id}"
            >
              Tambah ke Keranjang
            </button>
          </div>
        </article>
      `;
    })
    .join("");

  // Update status Load More
  if (displayedCount < total) {
    paginationWrapper.style.display = "flex";
    loadMoreBtn.disabled = false;
    paginationInfo.textContent = `Masih ada ${total - displayedCount} produk lainnya`;
  } else {
    // Sembunyikan tombol Load More jika seluruh data batch sudah tampil
    paginationWrapper.style.display = "flex";
    loadMoreBtn.disabled = true;
    paginationInfo.textContent = `Seluruh ${total} produk telah ditampilkan`;
  }
}

// ============================================================================
// 10. EVENT LISTENERS
// ============================================================================

// Pencarian Real-Time memanfaatkan Closure Debounce
const handleSearchDebounced = debounce((e) => {
  searchQuery = e.target.value.trim().toLowerCase();
  displayedCount = ITEMS_PER_PAGE; // Reset ke batch pertama saat filter berubah
  applyFiltersAndRender();
}, 300);

searchInput.addEventListener("input", handleSearchDebounced);

// Filter Kategori
categoryFilter.addEventListener("change", (e) => {
  selectedCategory = e.target.value;
  displayedCount = ITEMS_PER_PAGE;
  applyFiltersAndRender();
});

// Sorting Harga & Rating
sortFilter.addEventListener("change", (e) => {
  selectedSort = e.target.value;
  displayedCount = ITEMS_PER_PAGE;
  applyFiltersAndRender();
});

// Fitur Nilai Plus: Filter Rentang Harga dengan Debounce
const handlePriceRangeDebounced = debounce(() => {
  const minVal = parseFloat(minPriceInput.value);
  const maxVal = parseFloat(maxPriceInput.value);

  minPrice = !isNaN(minVal) && minVal >= 0 ? minVal : null;
  maxPrice = !isNaN(maxVal) && maxVal >= 0 ? maxVal : null;

  displayedCount = ITEMS_PER_PAGE;
  applyFiltersAndRender();
}, 350);

minPriceInput.addEventListener("input", handlePriceRangeDebounced);
maxPriceInput.addEventListener("input", handlePriceRangeDebounced);

// Load More Button (Array Slicing pagination)
loadMoreBtn.addEventListener("click", () => {
  displayedCount += ITEMS_PER_PAGE;
  renderProductGrid();
});

// Reset Filter Button
function resetFilters() {
  searchQuery = "";
  selectedCategory = "";
  selectedSort = "";
  minPrice = null;
  maxPrice = null;
  displayedCount = ITEMS_PER_PAGE;

  searchInput.value = "";
  categoryFilter.value = "";
  sortFilter.value = "";
  minPriceInput.value = "";
  maxPriceInput.value = "";

  applyFiltersAndRender();
}

resetFilterBtn.addEventListener("click", resetFilters);
emptyResetBtn.addEventListener("click", resetFilters);

// ============================================================================
// ORANG 3: Event Delegation pada #products-grid
// Membedakan klik tombol "Tambah ke Keranjang" vs klik kartu produk untuk modal.
// ============================================================================
productsGrid.addEventListener("click", (e) => {
  // 1. Prioritas: Cek apakah klik pada tombol "Tambah ke Keranjang"
  const addCartBtn = e.target.closest(".btn-add-cart");
  if (addCartBtn) {
    e.stopPropagation(); // Cegah event bubble ke kartu
    const productId = Number(addCartBtn.dataset.id);
    addToCart(productId);

    // Feedback visual singkat
    const originalText = addCartBtn.textContent;
    addCartBtn.textContent = "✓ Ditambahkan!";
    addCartBtn.style.backgroundColor = "#22c55e";
    addCartBtn.style.color = "#ffffff";
    addCartBtn.disabled = true;
    setTimeout(() => {
      addCartBtn.textContent = originalText;
      addCartBtn.style.backgroundColor = "";
      addCartBtn.style.color = "";
      addCartBtn.disabled = false;
    }, 1200);
    return;
  }

  // 2. Klik pada kartu produk → buka modal detail
  const card = e.target.closest(".product-card");
  if (card) {
    const productId = Number(card.dataset.id);
    openProductModal(productId);
  }
});


// ============================================================================
// 11. INITIALIZATION
// ============================================================================
fetchProducts();

// ============================================================================
// ORANG 3 — CART CRUD (Local Storage)
// ============================================================================
const CART_KEY = "miniShopeeCart";

/**
 * Ambil keranjang dari localStorage. Selalu kembalikan array.
 * Setiap item: { id, title, price, thumbnail, qty }
 */
function getCart() {
  try {
    const raw = localStorage.getItem(CART_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/** Simpan keranjang ke localStorage */
function saveCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
}

/** Tambah produk ke keranjang; jika sudah ada, tambahkan qty */
function addToCart(productId) {
  const product = allProducts.find((p) => p.id === productId);
  if (!product) return;

  const cart = getCart();
  const existingIdx = cart.findIndex((item) => item.id === productId);

  if (existingIdx !== -1) {
    cart[existingIdx].qty += 1;
  } else {
    cart.push({
      id: product.id,
      title: product.title,
      price: product.price,
      thumbnail: product.thumbnail,
      qty: 1,
    });
  }

  saveCart(cart);
  updateCartUI();
}

/** Update badge jumlah dan label total harga di navbar */
function updateCartUI() {
  const cart = getCart();
  const cartBadgeEl = document.getElementById("cart-badge");
  const cartTotalLabelEl = document.getElementById("cart-total-label");

  const totalQty = cart.reduce((sum, item) => sum + item.qty, 0);
  const totalPrice = cart.reduce((sum, item) => sum + item.price * item.qty, 0);

  // Badge
  if (totalQty > 0) {
    cartBadgeEl.style.display = "flex";
    cartBadgeEl.textContent = totalQty > 99 ? "99+" : String(totalQty);
  } else {
    cartBadgeEl.style.display = "none";
  }

  // Label total harga di tombol navbar
  const formatted = new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(totalPrice);
  cartTotalLabelEl.textContent = totalPrice > 0 ? formatted : "Rp 0";
}

// ============================================================================
// ORANG 3 — Modal Detail Produk
// ============================================================================
const productModal = document.getElementById("product-modal");
const modalCloseBtn = document.getElementById("modal-close-btn");
const modalImg = document.getElementById("modal-img");
const modalCategory = document.getElementById("modal-category");
const modalProductTitle = document.getElementById("modal-product-title");
const modalBrandVal = document.getElementById("modal-brand-val");
const modalStock = document.getElementById("modal-stock");
const modalRating = document.getElementById("modal-rating");
const modalDesc = document.getElementById("modal-desc");
const modalPrice = document.getElementById("modal-price");
const modalOriginalPrice = document.getElementById("modal-original-price");
const modalBadgeDiscount = document.getElementById("modal-badge-discount");
const modalAddCartBtn = document.getElementById("modal-add-cart-btn");

/** ID produk yang sedang ditampilkan di modal */
let currentModalProductId = null;

/** Buka modal detail produk berdasarkan ID */
function openProductModal(productId) {
  const product = allProducts.find((p) => p.id === productId);
  if (!product) return;

  currentModalProductId = productId;

  // Isi konten modal
  modalImg.src = product.thumbnail || "";
  modalImg.alt = product.title || "";
  modalCategory.textContent = product.category
    ? product.category.charAt(0).toUpperCase() + product.category.slice(1)
    : "";
  modalProductTitle.textContent = product.title || "-";
  modalBrandVal.textContent = product.brand || "-";
  modalStock.textContent =
    product.stock !== undefined
      ? `${product.stock} unit tersedia`
      : "Tidak tersedia";
  modalRating.textContent = product.rating
    ? `★ ${Number(product.rating).toFixed(1)} / 5.0`
    : "-";
  modalDesc.textContent = product.description || "Tidak ada deskripsi.";

  // Harga
  const discount = product.discountPercentage
    ? Math.round(product.discountPercentage)
    : null;
  modalPrice.textContent = `$${Number(product.price).toFixed(2)}`;

  if (discount) {
    const original = (product.price / (1 - discount / 100)).toFixed(2);
    modalOriginalPrice.textContent = `$${original}`;
    modalBadgeDiscount.textContent = `-${discount}%`;
    modalOriginalPrice.style.display = "inline";
    modalBadgeDiscount.style.display = "inline";
  } else {
    modalOriginalPrice.style.display = "none";
    modalBadgeDiscount.style.display = "none";
  }

  // Reset tombol "Tambah ke Keranjang" di modal
  modalAddCartBtn.textContent = "🛒 Tambah ke Keranjang";
  modalAddCartBtn.classList.remove("added");
  modalAddCartBtn.disabled = false;

  // Tampilkan modal & cegah scroll body
  productModal.style.display = "flex";
  document.body.style.overflow = "hidden";
}

/** Tutup modal detail produk */
function closeProductModal() {
  productModal.style.display = "none";
  document.body.style.overflow = "";
  currentModalProductId = null;
}

// Tombol "Tambah ke Keranjang" di dalam modal produk
modalAddCartBtn.addEventListener("click", () => {
  if (currentModalProductId === null) return;
  addToCart(currentModalProductId);

  modalAddCartBtn.textContent = "✓ Ditambahkan!";
  modalAddCartBtn.classList.add("added");
  modalAddCartBtn.disabled = true;

  setTimeout(() => {
    modalAddCartBtn.textContent = "🛒 Tambah ke Keranjang";
    modalAddCartBtn.classList.remove("added");
    modalAddCartBtn.disabled = false;
  }, 1500);
});

// Tutup modal detail via tombol ✕
modalCloseBtn.addEventListener("click", closeProductModal);

// Tutup modal detail via klik di luar dialog
productModal.addEventListener("click", (e) => {
  if (e.target === productModal) closeProductModal();
});

// ============================================================================
// ORANG 3 — Modal Keranjang Belanja
// ============================================================================
const cartModalEl = document.getElementById("cart-modal");
const cartModalCloseBtn = document.getElementById("cart-modal-close-btn");
const cartItemsList = document.getElementById("cart-items-list");
const cartEmptyState = document.getElementById("cart-empty-state");
const cartFooter = document.getElementById("cart-footer");
const cartModalTotal = document.getElementById("cart-modal-total");
const cartClearBtn = document.getElementById("cart-clear-btn");
const cartCheckoutBtn = document.getElementById("cart-checkout-btn");
const cartContinueBtn = document.getElementById("cart-continue-btn");
const cartBtn = document.getElementById("cart-btn");

/** Render semua item di modal keranjang */
function renderCartModal() {
  const cart = getCart();

  if (cart.length === 0) {
    cartItemsList.style.display = "none";
    cartEmptyState.style.display = "block";
    cartFooter.style.display = "none";
    return;
  }

  cartEmptyState.style.display = "none";
  cartItemsList.style.display = "flex";
  cartFooter.style.display = "flex";

  // Hitung total
  const total = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  const formatted = new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(total);
  cartModalTotal.textContent = formatted;

  // Render baris item
  cartItemsList.innerHTML = cart
    .map(
      (item) => `
        <div class="cart-item" data-id="${item.id}">
          <img
            class="cart-item-img"
            src="${escapeHtml(item.thumbnail || "")}"
            alt="${escapeHtml(item.title)}"
            onerror="this.src='https://dummyimage.com/70x70/e2e4ec/6b7280.png?text=?'"
          />
          <div class="cart-item-details">
            <span class="cart-item-name" title="${escapeHtml(item.title)}">${escapeHtml(item.title)}</span>
            <span class="cart-item-unit-price">$${Number(item.price).toFixed(2)} / pcs</span>
            <span class="cart-item-subtotal">$${(item.price * item.qty).toFixed(2)}</span>
          </div>
          <div class="cart-item-controls">
            <div class="qty-controls">
              <button class="qty-btn" data-action="decrease" data-id="${item.id}" aria-label="Kurangi qty">−</button>
              <span class="qty-value">${item.qty}</span>
              <button class="qty-btn" data-action="increase" data-id="${item.id}" aria-label="Tambah qty">+</button>
            </div>
            <button class="btn-remove-item" data-action="remove" data-id="${item.id}" aria-label="Hapus item">🗑</button>
          </div>
        </div>
      `
    )
    .join("");
}

/** Buka modal keranjang */
function openCartModal() {
  renderCartModal();
  cartModalEl.style.display = "flex";
  document.body.style.overflow = "hidden";
}

/** Tutup modal keranjang */
function closeCartModal() {
  cartModalEl.style.display = "none";
  document.body.style.overflow = "";
}

// Tombol keranjang di navbar → buka modal
cartBtn.addEventListener("click", openCartModal);

// Tutup modal keranjang via tombol ✕
cartModalCloseBtn.addEventListener("click", closeCartModal);

// Tutup modal keranjang via klik overlay
cartModalEl.addEventListener("click", (e) => {
  if (e.target === cartModalEl) closeCartModal();
});

// Tombol "Lanjut Belanja" di empty state
cartContinueBtn.addEventListener("click", closeCartModal);

// Tombol "Hapus Semua" di footer
cartClearBtn.addEventListener("click", () => {
  if (!confirm("Yakin ingin mengosongkan keranjang belanja?")) return;
  saveCart([]);
  updateCartUI();
  renderCartModal();
});

// Tombol "Checkout" → demo konfirmasi
cartCheckoutBtn.addEventListener("click", () => {
  const cart = getCart();
  const total = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  alert(
    `✅ Pesanan dikonfirmasi!\n\nTotal: $${total.toFixed(2)}\nTerima kasih telah berbelanja di Mini Shopee!`
  );
  saveCart([]);
  updateCartUI();
  closeCartModal();
});

/**
 * Event Delegation untuk tombol qty (+/-) dan hapus item di dalam modal keranjang.
 * Satu listener pada container untuk semua baris item.
 */
cartItemsList.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;

  const action = btn.dataset.action;
  const productId = Number(btn.dataset.id);
  const cart = getCart();
  const idx = cart.findIndex((item) => item.id === productId);
  if (idx === -1) return;

  if (action === "increase") {
    cart[idx].qty += 1;
  } else if (action === "decrease") {
    cart[idx].qty -= 1;
    if (cart[idx].qty <= 0) {
      cart.splice(idx, 1); // Hapus item jika qty = 0
    }
  } else if (action === "remove") {
    cart.splice(idx, 1);
  }

  saveCart(cart);
  updateCartUI();
  renderCartModal();
});

// ============================================================================
// ORANG 3 — Keyboard: Tutup modal aktif dengan Escape
// ============================================================================
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (productModal.style.display === "flex") closeProductModal();
  if (cartModalEl.style.display === "flex") closeCartModal();
});

// ============================================================================
// ORANG 3 — Back to Top Button
// ============================================================================
const backToTopBtn = document.getElementById("back-to-top-btn");

/** Tampilkan/sembunyikan tombol back-to-top berdasarkan posisi scroll */
function handleScrollVisibility() {
  if (window.scrollY > 320) {
    backToTopBtn.style.display = "flex";
  } else {
    backToTopBtn.style.display = "none";
  }
}

backToTopBtn.addEventListener("click", () => {
  window.scrollTo({ top: 0, behavior: "smooth" });
});

// Pasang scroll listener dengan debounce ringan untuk performa
const handleScrollDebounced = debounce(handleScrollVisibility, 80);
window.addEventListener("scroll", handleScrollDebounced, { passive: true });

// ============================================================================
// Inisialisasi UI Keranjang saat halaman dimuat (dari data localStorage)
// ============================================================================
updateCartUI();
