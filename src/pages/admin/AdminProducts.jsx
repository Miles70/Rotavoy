import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, FilePenLine, Package, Plus, RefreshCw, Save, Search, X } from "lucide-react";
import ProductCreateModal from "../../components/admin/ProductCreateModal";
import ProductEditModal from "../../components/admin/ProductEditModal";
import { useAdminAuth } from "../../context/AdminAuthContext";
import {
  createAdminProduct,
  getAdminProducts,
  updateAdminProduct,
} from "../../services/adminApi";

const PRODUCTS_PER_PAGE = 20;

const initialPagination = {
  page: 1,
  limit: PRODUCTS_PER_PAGE,
  total: 0,
  totalPages: 1,
  catalogTotal: 0,
  activeTotal: 0,
  hasPreviousPage: false,
  hasNextPage: false,
};

function getPaginationItems(currentPage, totalPages) {
  if (totalPages <= 9) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const candidates = [
    1,
    2,
    currentPage - 2,
    currentPage - 1,
    currentPage,
    currentPage + 1,
    currentPage + 2,
    totalPages - 1,
    totalPages,
  ]
    .filter((page) => page >= 1 && page <= totalPages)
    .filter((page, index, pages) => pages.indexOf(page) === index)
    .sort((left, right) => left - right);

  const items = [];

  candidates.forEach((page, index) => {
    const previousPage = candidates[index - 1];

    if (previousPage && page - previousPage > 1) {
      items.push(`ellipsis-${previousPage}-${page}`);
    }

    items.push(page);
  });

  return items;
}

function AdminProducts() {
  const { token } = useAdminAuth();
  const [products, setProducts] = useState([]);
  const [pagination, setPagination] = useState(initialPagination);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [stockFilter, setStockFilter] = useState("");
  const [filterOptions, setFilterOptions] = useState({ categories: [], sources: [] });
  const [dirtyKeys, setDirtyKeys] = useState(() => new Set());
  const [savingKey, setSavingKey] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let isCancelled = false;

    async function loadProducts() {
      setIsLoading(true);
      setError("");

      try {
        const data = await getAdminProducts(token, {
          page,
          limit: PRODUCTS_PER_PAGE,
          search: appliedSearch,
          category: categoryFilter,
          source: sourceFilter,
          status: statusFilter,
          stock: stockFilter,
        });

        if (isCancelled) return;

        setProducts(data.products || []);
        setPagination(data.pagination || initialPagination);
        setFilterOptions(data.filters || { categories: [], sources: [] });
        setDirtyKeys(new Set());

        if (data.pagination?.page && data.pagination.page !== page) {
          setPage(data.pagination.page);
        }
      } catch (requestError) {
        if (!isCancelled) {
          setError(requestError.message);
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    loadProducts();

    return () => {
      isCancelled = true;
    };
  }, [token, page, appliedSearch, categoryFilter, sourceFilter, statusFilter, stockFilter, refreshKey]);

  function confirmDiscardChanges() {
    if (dirtyKeys.size === 0) return true;

    return window.confirm(
      "Kaydedilmemiş ürün değişiklikleri var. Sayfadan ayrılırsan bu değişiklikler silinir. Devam edilsin mi?"
    );
  }

  function updateLocalProduct(productKey, field, value) {
    setProducts((current) =>
      current.map((product) => (product.key === productKey ? { ...product, [field]: value } : product))
    );
    setDirtyKeys((current) => {
      const next = new Set(current);
      next.add(productKey);
      return next;
    });
    setSuccess("");
  }

  function changePage(nextPage) {
    if (nextPage === page || nextPage < 1 || nextPage > pagination.totalPages) return;
    if (!confirmDiscardChanges()) return;

    setPage(nextPage);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleSearchSubmit(event) {
    event.preventDefault();
    if (!confirmDiscardChanges()) return;

    const nextSearch = searchInput.trim();
    setAppliedSearch(nextSearch);
    setPage(1);
    setRefreshKey((current) => current + 1);
  }

  function clearSearch() {
    if (!confirmDiscardChanges()) return;

    setSearchInput("");
    setAppliedSearch("");
    setPage(1);
    setRefreshKey((current) => current + 1);
  }

  function refreshProducts() {
    if (!confirmDiscardChanges()) return;
    setRefreshKey((current) => current + 1);
  }

  async function createProduct(payload) {
    setError("");
    setSuccess("");

    const data = await createAdminProduct(token, payload);
    setSuccess(`${data.product.title} kataloğa eklendi.`);
    setSearchInput("");
    setAppliedSearch("");
    setPage(1);
    setRefreshKey((current) => current + 1);
  }

  async function saveProduct(product) {
    setSavingKey(product.key);
    setError("");
    setSuccess("");

    try {
      const payload = {
        title: product.title,
        price: Number(product.price),
        oldPrice: product.oldPrice === "" || product.oldPrice === null ? null : Number(product.oldPrice),
        stock: Number(product.stock),
        badge: product.badge || null,
        isActive: Boolean(product.isActive),
      };
      const data = await updateAdminProduct(token, product.key, payload);
      setProducts((current) =>
        current.map((item) => (item.key === product.key ? data.product : item))
      );
      setDirtyKeys((current) => {
        const next = new Set(current);
        next.delete(product.key);
        return next;
      });
      setSuccess(`${product.title} güncellendi.`);
      setRefreshKey((current) => current + 1);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSavingKey("");
    }
  }

  async function saveProductContent(productKey, payload) {
    const data = await updateAdminProduct(token, productKey, payload);
    setProducts((current) => current.map((item) => (item.key === productKey ? data.product : item)));
    setSuccess(`${data.product.title} içeriği güncellendi.`);
  }

  function changeFilter(setter, value) {
    if (!confirmDiscardChanges()) return;
    setter(value);
    setPage(1);
  }

  const firstVisibleItem = pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1;
  const lastVisibleItem = Math.min(pagination.page * pagination.limit, pagination.total);
  const paginationItems = getPaginationItems(pagination.page, pagination.totalPages);

  return (
    <div className="admin-page">
      <div className="admin-page-heading">
        <div>
          <p className="admin-eyebrow">KATALOG</p>
          <h1>Ürünler</h1>
          <p>Fiyat, stok, rozet ve yayın durumunu doğrudan MongoDB kataloğunda güncelle.</p>
        </div>
        <div className="admin-heading-actions">
          <button className="admin-primary-button" type="button" onClick={() => setIsCreateOpen(true)}>
            <Plus size={18} /> Yeni ürün
          </button>
          <button className="admin-secondary-button" type="button" onClick={refreshProducts} disabled={isLoading}>
            <RefreshCw size={18} className={isLoading ? "is-spinning" : ""} /> Yenile
          </button>
        </div>
      </div>

      <section className="admin-toolbar admin-products-toolbar">
        <form className="admin-product-search-form" onSubmit={handleSearchSubmit}>
          <label className="admin-search-box">
            <Search size={18} />
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Tüm katalogda ürün, anahtar veya kategori ara..."
            />
          </label>
          <button className="admin-secondary-button admin-search-submit" type="submit" disabled={isLoading}>
            Ara
          </button>
          {appliedSearch ? (
            <button className="admin-search-clear" type="button" onClick={clearSearch} aria-label="Aramayı temizle">
              <X size={17} />
            </button>
          ) : null}
        </form>

        <div className="admin-toolbar-summary">
          <span>{pagination.activeTotal} aktif</span>
          <span>{pagination.catalogTotal} toplam</span>
          <span>{dirtyKeys.size} kaydedilmemiş</span>
        </div>
      </section>

      <section className="admin-toolbar admin-filter-toolbar">
        <select value={categoryFilter} onChange={(event) => changeFilter(setCategoryFilter, event.target.value)}>
          <option value="">Tüm kategoriler</option>
          {filterOptions.categories.map((value) => <option key={value} value={value}>{value}</option>)}
        </select>
        <select value={sourceFilter} onChange={(event) => changeFilter(setSourceFilter, event.target.value)}>
          <option value="">Tüm kaynaklar</option>
          {filterOptions.sources.map((value) => <option key={value} value={value}>{value}</option>)}
        </select>
        <select value={statusFilter} onChange={(event) => changeFilter(setStatusFilter, event.target.value)}>
          <option value="">Tüm yayın durumları</option><option value="active">Yayında</option><option value="inactive">Kapalı</option>
        </select>
        <select value={stockFilter} onChange={(event) => changeFilter(setStockFilter, event.target.value)}>
          <option value="">Tüm stoklar</option><option value="out">Stok yok</option><option value="low">Düşük stok (1–10)</option><option value="available">Stok yeterli (10+)</option>
        </select>
      </section>

      {appliedSearch ? (
        <div className="admin-search-result-note">
          “{appliedSearch}” için {pagination.total} ürün bulundu.
        </div>
      ) : null}

      {error ? <div className="admin-alert admin-alert-error">{error}</div> : null}
      {success ? <div className="admin-alert admin-alert-success">{success}</div> : null}

      <section className="admin-panel">
        <div className="admin-table-wrap">
          <table className="admin-table admin-products-table">
            <thead>
              <tr>
                <th>Ürün</th>
                <th>Kategori</th>
                <th>Fiyat</th>
                <th>Eski fiyat</th>
                <th>Stok</th>
                <th>Rozet</th>
                <th>Yayında</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {!isLoading && products.length ? (
                products.map((product) => (
                  <tr key={product.key} className={dirtyKeys.has(product.key) ? "is-dirty" : ""}>
                    <td>
                      <div className="admin-product-cell">
                        <div className="admin-product-thumb">
                          {product.imageUrl ? <img src={product.imageUrl} alt="" /> : product.image || "🛍️"}
                        </div>
                        <div>
                          <input
                            className="admin-table-input admin-product-title-input"
                            value={product.title}
                            onChange={(event) => updateLocalProduct(product.key, "title", event.target.value)}
                          />
                          <span>{product.key}</span>
                        </div>
                      </div>
                    </td>
                    <td><span className="admin-category-pill">{product.categoryKey}</span></td>
                    <td>
                      <input
                        className="admin-table-input admin-number-input"
                        type="number"
                        min="0"
                        step="0.01"
                        value={product.price}
                        onChange={(event) => updateLocalProduct(product.key, "price", event.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        className="admin-table-input admin-number-input"
                        type="number"
                        min="0"
                        step="0.01"
                        value={product.oldPrice ?? ""}
                        placeholder="—"
                        onChange={(event) => updateLocalProduct(product.key, "oldPrice", event.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        className="admin-table-input admin-stock-input"
                        type="number"
                        min="0"
                        value={product.stock}
                        onChange={(event) => updateLocalProduct(product.key, "stock", event.target.value)}
                      />
                    </td>
                    <td>
                      <select
                        className="admin-inline-select"
                        value={product.badge || ""}
                        onChange={(event) => updateLocalProduct(product.key, "badge", event.target.value)}
                      >
                        <option value="">Yok</option>
                        <option value="sale">sale</option>
                        <option value="new">new</option>
                        <option value="stock">stock</option>
                      </select>
                    </td>
                    <td>
                      <label className="admin-switch">
                        <input
                          type="checkbox"
                          checked={Boolean(product.isActive)}
                          onChange={(event) => updateLocalProduct(product.key, "isActive", event.target.checked)}
                        />
                        <span />
                      </label>
                    </td>
                    <td>
                      <button
                        className="admin-save-button"
                        type="button"
                        disabled={!dirtyKeys.has(product.key) || savingKey === product.key}
                        onClick={() => saveProduct(product)}
                      >
                        <Save size={16} />
                        {savingKey === product.key ? "..." : "Kaydet"}
                      </button>
                      <button className="admin-detail-button" type="button" onClick={() => setEditingProduct(product)}>
                        <FilePenLine size={16} /> Detay
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="8">
                    <div className="admin-empty-state">
                      <Package size={24} />
                      {isLoading ? "Ürünler yükleniyor..." : "Bu aramada ürün bulunamadı."}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <footer className="admin-pagination">
          <div className="admin-pagination-info">
            <strong>{firstVisibleItem}–{lastVisibleItem}</strong>
            <span>/ {pagination.total} ürün</span>
          </div>

          <nav className="admin-pagination-nav" aria-label="Ürün sayfaları">
            <button
              type="button"
              onClick={() => changePage(page - 1)}
              disabled={!pagination.hasPreviousPage || isLoading}
              aria-label="Önceki sayfa"
            >
              <ChevronLeft size={17} />
            </button>

            {paginationItems.map((item) =>
              typeof item === "number" ? (
                <button
                  key={item}
                  type="button"
                  className={item === pagination.page ? "is-active" : ""}
                  onClick={() => changePage(item)}
                  disabled={isLoading}
                  aria-current={item === pagination.page ? "page" : undefined}
                >
                  {item}
                </button>
              ) : (
                <span key={item} className="admin-pagination-ellipsis">…</span>
              )
            )}

            <button
              type="button"
              onClick={() => changePage(page + 1)}
              disabled={!pagination.hasNextPage || isLoading}
              aria-label="Sonraki sayfa"
            >
              <ChevronRight size={17} />
            </button>
          </nav>
        </footer>
      </section>

      {isCreateOpen ? (
        <ProductCreateModal onClose={() => setIsCreateOpen(false)} onCreate={createProduct} />
      ) : null}
      {editingProduct ? (
        <ProductEditModal product={editingProduct} onClose={() => setEditingProduct(null)} onSave={saveProductContent} />
      ) : null}
    </div>
  );
}

export default AdminProducts;
