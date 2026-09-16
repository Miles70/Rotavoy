import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Eye, RefreshCw, Search, ShoppingCart, Trash2, X } from "lucide-react";
import OrderDetailsModal from "../../components/admin/OrderDetailsModal";
import { useAdminAuth } from "../../context/AdminAuthContext";
import {
  deleteAdminOrder,
  deleteAdminOrders,
  getAdminOrders,
  updateAdminOrder,
} from "../../services/adminApi";

const orderStatusOptions = [
  "awaiting_payment",
  "pending",
  "processing",
  "shipped",
  "delivered",
  "completed",
  "cancelled",
  "expired",
];
const paymentStatusOptions = ["unpaid", "pending", "paid", "failed", "refunded"];
const ORDERS_PER_PAGE = 25;

function formatMoney(value, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(Number(value) || 0);
}

function formatDate(value) {
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function AdminOrders() {
  const { token } = useAdminAuth();
  const selectAllRef = useRef(null);
  const [orders, setOrders] = useState([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: ORDERS_PER_PAGE,
    total: 0,
    totalPages: 1,
    hasPreviousPage: false,
    hasNextPage: false,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [updatingOrder, setUpdatingOrder] = useState("");
  const [deletingOrder, setDeletingOrder] = useState("");
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [selectedOrderNumbers, setSelectedOrderNumbers] = useState(
    () => new Set(),
  );
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [error, setError] = useState("");

  const loadOrders = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const data = await getAdminOrders(token, {
        page,
        limit: ORDERS_PER_PAGE,
        status: statusFilter,
        paymentStatus: paymentFilter,
        search: appliedSearch,
      });
      const nextOrders = data.orders || [];
      const availableOrderNumbers = new Set(
        nextOrders.map((order) => order.orderNumber),
      );

      setOrders(nextOrders);
      setPagination((current) => data.pagination || current);
      if (data.pagination?.page && data.pagination.page !== page) {
        setPage(data.pagination.page);
      }
      setSelectedOrderNumbers(
        (current) =>
          new Set(
            [...current].filter((orderNumber) =>
              availableOrderNumbers.has(orderNumber),
            ),
          ),
      );
      setSelectedOrder((current) => {
        if (!current) return null;

        return (
          nextOrders.find(
            (order) => order.orderNumber === current.orderNumber,
          ) || null
        );
      });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsLoading(false);
    }
  }, [token, statusFilter, paymentFilter, appliedSearch, page]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const visibleOrders = orders;

  const visibleOrderNumbers = useMemo(
    () => visibleOrders.map((order) => order.orderNumber),
    [visibleOrders],
  );

  const selectedVisibleCount = useMemo(
    () =>
      visibleOrderNumbers.filter((orderNumber) =>
        selectedOrderNumbers.has(orderNumber),
      ).length,
    [selectedOrderNumbers, visibleOrderNumbers],
  );

  const allVisibleSelected =
    visibleOrderNumbers.length > 0 &&
    selectedVisibleCount === visibleOrderNumbers.length;
  const someVisibleSelected =
    selectedVisibleCount > 0 && !allVisibleSelected;

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someVisibleSelected;
    }
  }, [someVisibleSelected]);

  async function handleUpdate(orderNumber, field, value) {
    setUpdatingOrder(orderNumber);
    setError("");

    try {
      const data = await updateAdminOrder(token, orderNumber, {
        [field]: value,
      });

      setOrders((current) =>
        current.map((order) =>
          order.orderNumber === orderNumber ? data.order : order,
        ),
      );
      setSelectedOrder((current) =>
        current?.orderNumber === orderNumber ? data.order : current,
      );
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setUpdatingOrder("");
    }
  }

  function applySearch(event) {
    event.preventDefault();
    setAppliedSearch(searchInput.trim());
    setPage(1);
  }

  function clearSearch() {
    setSearchInput("");
    setAppliedSearch("");
    setPage(1);
  }

  function toggleOrderSelection(orderNumber) {
    setSelectedOrderNumbers((current) => {
      const next = new Set(current);

      if (next.has(orderNumber)) {
        next.delete(orderNumber);
      } else {
        next.add(orderNumber);
      }

      return next;
    });
  }

  function toggleVisibleOrders() {
    setSelectedOrderNumbers((current) => {
      const next = new Set(current);

      if (allVisibleSelected) {
        visibleOrderNumbers.forEach((orderNumber) =>
          next.delete(orderNumber),
        );
      } else {
        visibleOrderNumbers.forEach((orderNumber) =>
          next.add(orderNumber),
        );
      }

      return next;
    });
  }

  async function handleDeleteOrder(order) {
    const confirmed = window.confirm(
      `#${order.orderNumber} siparişi kalıcı olarak silinsin mi? Bu işlem geri alınamaz.`,
    );

    if (!confirmed) return;

    setDeletingOrder(order.orderNumber);
    setError("");

    try {
      await deleteAdminOrder(token, order.orderNumber);
      setOrders((current) =>
        current.filter((item) => item.orderNumber !== order.orderNumber),
      );
      setSelectedOrderNumbers((current) => {
        const next = new Set(current);
        next.delete(order.orderNumber);
        return next;
      });
      setSelectedOrder((current) =>
        current?.orderNumber === order.orderNumber ? null : current,
      );
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setDeletingOrder("");
    }
  }

  async function handleBulkDelete() {
    const orderNumbers = [...selectedOrderNumbers];

    if (orderNumbers.length === 0) return;

    const confirmed = window.confirm(
      `${orderNumbers.length} sipariş kalıcı olarak silinsin mi? Bu işlem geri alınamaz.`,
    );

    if (!confirmed) return;

    setIsBulkDeleting(true);
    setError("");

    try {
      await deleteAdminOrders(token, orderNumbers);
      const deletedOrderNumbers = new Set(orderNumbers);

      setOrders((current) =>
        current.filter(
          (order) => !deletedOrderNumbers.has(order.orderNumber),
        ),
      );
      setSelectedOrderNumbers(new Set());
      setSelectedOrder((current) =>
        current && deletedOrderNumbers.has(current.orderNumber)
          ? null
          : current,
      );
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsBulkDeleting(false);
    }
  }

  const isMutating = Boolean(
    updatingOrder || deletingOrder || isBulkDeleting,
  );

  return (
    <div className="admin-page">
      <div className="admin-page-heading">
        <div>
          <p className="admin-eyebrow">OPERASYON</p>
          <h1>Siparişler</h1>
          <p>Müşteriyi, ödemeyi ve teslimat akışını buradan yönet.</p>
        </div>

        <button
          className="admin-secondary-button"
          type="button"
          onClick={loadOrders}
          disabled={isLoading || isMutating}
        >
          <RefreshCw
            size={18}
            className={isLoading ? "is-spinning" : ""}
          />
          Yenile
        </button>
      </div>

      <section className="admin-toolbar">
        <form className="admin-product-search-form" onSubmit={applySearch}>
          <label className="admin-search-box">
            <Search size={18} />
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Tüm siparişlerde no, müşteri, e-posta ara..."
            />
          </label>
          <button className="admin-secondary-button admin-search-submit" type="submit">Ara</button>
          {appliedSearch ? (
            <button className="admin-search-clear" type="button" onClick={clearSearch} aria-label="Aramayı temizle">
              <X size={17} />
            </button>
          ) : null}
        </form>

        <select
          value={statusFilter}
          onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }}
        >
          <option value="">Tüm siparişler</option>
          {orderStatusOptions.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>

        <select
          value={paymentFilter}
          onChange={(event) => { setPaymentFilter(event.target.value); setPage(1); }}
        >
          <option value="">Tüm ödeme durumları</option>
          {paymentStatusOptions.map((status) => (
            <option key={status} value={status}>{status}</option>
          ))}
        </select>
      </section>

      {error ? (
        <div className="admin-alert admin-alert-error">{error}</div>
      ) : null}

      <section className="admin-panel">
        <div className="admin-panel-header">
          <div>
            <p className="admin-eyebrow">KAYITLAR</p>
            <h2>{pagination.total} sipariş</h2>
          </div>

          <div className="admin-order-bulk-actions">
            {selectedOrderNumbers.size > 0 ? (
              <span>{selectedOrderNumbers.size} seçili</span>
            ) : null}

            <button
              className="admin-bulk-delete-button"
              type="button"
              onClick={handleBulkDelete}
              disabled={
                selectedOrderNumbers.size === 0 || isBulkDeleting
              }
            >
              <Trash2 size={16} />
              {isBulkDeleting ? "Siliniyor..." : "Seçilenleri sil"}
            </button>
          </div>
        </div>

        <div className="admin-table-wrap">
          <table className="admin-table admin-orders-table">
            <thead>
              <tr>
                <th className="admin-order-selection-cell">
                  <input
                    ref={selectAllRef}
                    className="admin-order-checkbox"
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleVisibleOrders}
                    disabled={
                      visibleOrders.length === 0 || isMutating
                    }
                    aria-label="Görünen siparişlerin tümünü seç"
                  />
                </th>
                <th>Sipariş</th>
                <th>Müşteri</th>
                <th>Ürün</th>
                <th>Tutar</th>
                <th>Sipariş durumu</th>
                <th>Ödeme</th>
                <th>Tarih</th>
                <th></th>
              </tr>
            </thead>

            <tbody>
              {!isLoading && visibleOrders.length ? (
                visibleOrders.map((order) => {
                  const isSelected = selectedOrderNumbers.has(
                    order.orderNumber,
                  );
                  const isDeleting =
                    deletingOrder === order.orderNumber;

                  return (
                    <tr
                      key={order.orderNumber}
                      className={isSelected ? "is-selected" : ""}
                    >
                      <td className="admin-order-selection-cell">
                        <input
                          className="admin-order-checkbox"
                          type="checkbox"
                          checked={isSelected}
                          onChange={() =>
                            toggleOrderSelection(order.orderNumber)
                          }
                          disabled={
                            isDeleting || isBulkDeleting
                          }
                          aria-label={`#${order.orderNumber} siparişini seç`}
                        />
                      </td>

                      <td>
                        <strong>#{order.orderNumber}</strong>
                      </td>

                      <td>
                        <div className="admin-customer-cell">
                          <strong>{order.customer?.fullName}</strong>
                          <span>{order.customer?.email}</span>
                          <span>{order.customer?.phone}</span>
                        </div>
                      </td>

                      <td>
                        {order.items?.reduce(
                          (total, item) => total + item.quantity,
                          0,
                        ) || 0}{" "}
                        adet
                      </td>

                      <td>
                        <strong>
                          {formatMoney(
                            order.total,
                            order.currency,
                          )}
                        </strong>
                      </td>

                      <td>
                        <select
                          className={`admin-inline-select admin-status-select-${order.status}`}
                          value={order.status}
                          disabled={
                            updatingOrder === order.orderNumber ||
                            isDeleting ||
                            isBulkDeleting
                          }
                          onChange={(event) =>
                            handleUpdate(
                              order.orderNumber,
                              "status",
                              event.target.value,
                            )
                          }
                        >
                          {orderStatusOptions.map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                      </td>

                      <td>
                        <select
                          className={`admin-inline-select admin-payment-select-${order.paymentStatus}`}
                          value={order.paymentStatus}
                          disabled={
                            updatingOrder === order.orderNumber ||
                            isDeleting ||
                            isBulkDeleting
                          }
                          onChange={(event) =>
                            handleUpdate(
                              order.orderNumber,
                              "paymentStatus",
                              event.target.value,
                            )
                          }
                        >
                          {paymentStatusOptions.map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                      </td>

                      <td>{formatDate(order.createdAt)}</td>

                      <td>
                        <div className="admin-order-actions">
                          <button
                            className="admin-detail-button"
                            type="button"
                            onClick={() => setSelectedOrder(order)}
                            disabled={
                              isDeleting || isBulkDeleting
                            }
                            aria-label={`#${order.orderNumber} siparişini aç`}
                          >
                            <Eye size={16} />
                            Detay
                          </button>

                          <button
                            className="admin-delete-button"
                            type="button"
                            onClick={() => handleDeleteOrder(order)}
                            disabled={
                              isDeleting || isBulkDeleting
                            }
                            aria-label={`#${order.orderNumber} siparişini sil`}
                          >
                            <Trash2 size={16} />
                            {isDeleting ? "Siliniyor..." : "Sil"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="9">
                    <div className="admin-empty-state">
                      <ShoppingCart size={24} />
                      {isLoading
                        ? "Siparişler yükleniyor..."
                        : "Bu filtrede sipariş bulunamadı."}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <footer className="admin-pagination">
          <div className="admin-pagination-info">
            <strong>Sayfa {pagination.page}</strong>
            <span>/ {pagination.totalPages}</span>
          </div>
          <nav className="admin-pagination-nav" aria-label="Sipariş sayfaları">
            <button type="button" onClick={() => setPage((current) => current - 1)} disabled={!pagination.hasPreviousPage || isLoading}>
              <ChevronLeft size={17} />
            </button>
            <span>{pagination.total} toplam kayıt</span>
            <button type="button" onClick={() => setPage((current) => current + 1)} disabled={!pagination.hasNextPage || isLoading}>
              <ChevronRight size={17} />
            </button>
          </nav>
        </footer>
      </section>

      {selectedOrder ? (
        <OrderDetailsModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
        />
      ) : null}
    </div>
  );
}

export default AdminOrders;
